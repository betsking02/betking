const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { signToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(20).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(50).required(),
  display_name: Joi.string().max(50).optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

// Register
router.post('/register', (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { username, email, password, display_name } = value;
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Username or email already exists' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const defaultBalance = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'default_balance'").get()?.value || '10000');

    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, display_name, role, balance) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, email, passwordHash, display_name || username, 'user', defaultBalance);

    const user = db.prepare('SELECT id, username, role, balance, display_name FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = signToken({ userId: user.id, username: user.username, role: user.role });

    res.status(201).json({ token, user });
  } catch (err) { next(err); }
});

// Login
router.post('/login', (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { username, password } = value;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    const token = signToken({ userId: user.id, username: user.username, role: user.role }, user.role === 'demo');

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, balance: user.balance, display_name: user.display_name }
    });
  } catch (err) { next(err); }
});

// Demo Login
router.post('/demo-login', (req, res, next) => {
  try {
    const demoId = crypto.randomBytes(4).toString('hex');
    const username = `demo_${demoId}`;
    const passwordHash = bcrypt.hashSync(crypto.randomBytes(8).toString('hex'), 10);
    const defaultBalance = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'default_balance'").get()?.value || '10000');

    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role, balance, is_demo) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, passwordHash, 'Demo User', 'demo', defaultBalance, 1);

    const user = { id: result.lastInsertRowid, username, role: 'demo', balance: defaultBalance, display_name: 'Demo User', is_demo: 1 };
    const token = signToken({ userId: user.id, username: user.username, role: 'demo' }, true);

    res.status(201).json({ token, user });
  } catch (err) { next(err); }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// User dashboard stats
router.get('/dashboard', authenticate, (req, res) => {
  const userId = req.user.id;

  const totalBets = db.prepare('SELECT COUNT(*) as count FROM bets WHERE user_id = ?').get(userId).count;
  const totalWagered = db.prepare('SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = ?').get(userId).total;
  const totalWon = db.prepare("SELECT COALESCE(SUM(actual_payout), 0) as total FROM bets WHERE user_id = ? AND status = 'won'").get(userId).total;
  const totalLost = db.prepare("SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = ? AND status = 'lost'").get(userId).total;
  const pendingBets = db.prepare("SELECT COUNT(*) as count FROM bets WHERE user_id = ? AND status = 'pending'").get(userId).count;
  const wonBets = db.prepare("SELECT COUNT(*) as count FROM bets WHERE user_id = ? AND status = 'won'").get(userId).count;
  const lostBets = db.prepare("SELECT COUNT(*) as count FROM bets WHERE user_id = ? AND status = 'lost'").get(userId).count;

  const recentBets = db.prepare(`
    SELECT * FROM bets WHERE user_id = ? ORDER BY placed_at DESC LIMIT 10
  `).all(userId);

  const recentTransactions = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(userId);

  // Game breakdown
  const gameBreakdown = db.prepare(`
    SELECT game_type, COUNT(*) as count, COALESCE(SUM(stake), 0) as wagered, COALESCE(SUM(actual_payout), 0) as won
    FROM bets WHERE user_id = ? GROUP BY game_type
  `).all(userId);

  res.json({
    stats: {
      totalBets,
      totalWagered: Math.round(totalWagered),
      totalWon: Math.round(totalWon),
      totalLost: Math.round(totalLost),
      netProfit: Math.round(totalWon - totalWagered),
      pendingBets,
      wonBets,
      lostBets,
      winRate: totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0
    },
    gameBreakdown,
    recentBets,
    recentTransactions
  });
});

module.exports = router;
