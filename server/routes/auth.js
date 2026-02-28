const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { signToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const Joi = require('joi');
const { generateCode, sendVerificationEmail } = require('../services/emailService');

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

// Register - creates account + sends verification code
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { username, email, password, display_name } = value;
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Username or email already exists' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const defaultBalance = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'default_balance'").get()?.value || '10000');

    // Generate verification code (6 digits, expires in 10 minutes)
    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const result = db.prepare(
      "INSERT INTO users (username, email, password_hash, display_name, role, balance, is_verified, verification_code, verification_expires) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)"
    ).run(username, email, passwordHash, display_name || username, 'user', defaultBalance, code, expires);

    // Send verification email
    const emailResult = await sendVerificationEmail(email, code);

    const response = {
      message: emailResult.sent
        ? 'Account created. Please check your email for the verification code.'
        : 'Account created. Email could not be sent - use the code shown below.',
      requiresVerification: true,
      email: email,
      emailSent: emailResult.sent,
      userId: result.lastInsertRowid
    };

    // If email failed, send the code directly so user can still verify
    if (!emailResult.sent) {
      response.code = code;
      response.emailError = emailResult.error;
    }

    res.status(201).json(response);
  } catch (err) { next(err); }
});

// Verify email with code
router.post('/verify', (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_verified) return res.status(400).json({ error: 'Email is already verified' });

    // Check code
    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check expiry
    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Mark as verified
    db.prepare("UPDATE users SET is_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = ?").run(user.id);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    // Auto-login after verification
    const token = signToken({ userId: user.id, username: user.username, role: user.role });
    res.json({
      message: 'Email verified successfully!',
      token,
      user: { id: user.id, username: user.username, role: user.role, balance: user.balance, display_name: user.display_name }
    });
  } catch (err) { next(err); }
});

// Resend verification code
router.post('/resend-code', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_verified) return res.status(400).json({ error: 'Email is already verified' });

    // Generate new code
    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare("UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?").run(code, expires, user.id);

    const emailResult = await sendVerificationEmail(user.email, code);

    if (emailResult.sent) {
      res.json({ message: 'New verification code sent to your email.' });
    } else {
      res.json({ message: 'Email could not be sent. Use the code shown below.', code, emailError: emailResult.error });
    }
  } catch (err) { next(err); }
});

// Login - checks if verified
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

    // Check if email is verified (skip for demo and admin accounts)
    if (!user.is_verified && user.role === 'user') {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email
      });
    }

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
    const token = signToken({ userId: user.id, username: user.username, role: user.role }, user.role === 'demo');

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, balance: user.balance, display_name: user.display_name }
    });
  } catch (err) { next(err); }
});

// Demo Login (no verification needed)
router.post('/demo-login', (req, res, next) => {
  try {
    const demoId = crypto.randomBytes(4).toString('hex');
    const username = `demo_${demoId}`;
    const passwordHash = bcrypt.hashSync(crypto.randomBytes(8).toString('hex'), 10);
    const defaultBalance = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'default_balance'").get()?.value || '10000');

    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role, balance, is_demo, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)'
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
