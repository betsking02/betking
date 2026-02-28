const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, adminAuth } = require('../middleware/auth');

router.use(authenticate, adminAuth);

// Dashboard stats
router.get('/dashboard', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalBets = db.prepare('SELECT COUNT(*) as count FROM bets').get().count;
  const totalWagered = db.prepare('SELECT COALESCE(SUM(stake), 0) as total FROM bets').get().total;
  const totalPaidOut = db.prepare('SELECT COALESCE(SUM(actual_payout), 0) as total FROM bets').get().total;
  const activeBets = db.prepare("SELECT COUNT(*) as count FROM bets WHERE status = 'pending'").get().count;
  const liveMatches = db.prepare("SELECT COUNT(*) as count FROM matches WHERE status = 'live'").get().count;

  const recentBets = db.prepare(`
    SELECT b.*, u.username FROM bets b
    JOIN users u ON b.user_id = u.id
    ORDER BY b.placed_at DESC LIMIT 10
  `).all();

  res.json({
    stats: {
      totalUsers,
      totalBets,
      totalWagered: Math.round(totalWagered),
      totalPaidOut: Math.round(totalPaidOut),
      housePnL: Math.round(totalWagered - totalPaidOut),
      activeBets,
      liveMatches
    },
    recentBets
  });
});

// List users
router.get('/users', (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT id, username, email, display_name, role, balance, is_demo, is_verified, created_at, last_login FROM users';
  const params = [];

  if (search) {
    query += ' WHERE username LIKE ? OR email LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const users = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  res.json({ users, total });
});

// Update user
router.put('/users/:id', (req, res) => {
  const { balance, role } = req.body;
  const userId = req.params.id;

  if (balance !== undefined) {
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(balance, userId);
  }
  if (role) {
    db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, userId);
  }

  const user = db.prepare('SELECT id, username, email, role, balance FROM users WHERE id = ?').get(userId);
  res.json({ user });
});

// Add balance to user
router.post('/users/:id/add-balance', (req, res) => {
  const { amount, reason } = req.body;
  const userId = req.params.id;

  if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const result = db.transaction(() => {
    const user = db.prepare('SELECT id, username, balance FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');

    const newBalance = user.balance + amount;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, userId);

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bonus', ?, ?, ?)
    `).run(userId, amount, newBalance, reason || 'Balance added by admin');

    return db.prepare('SELECT id, username, email, role, balance, display_name, is_demo, created_at, last_login FROM users WHERE id = ?').get(userId);
  })();

  res.json({ user: result, message: `Added ₹${amount} to ${result.username}` });
});

// Remove balance from user
router.post('/users/:id/remove-balance', (req, res) => {
  const { amount, reason } = req.body;
  const userId = req.params.id;

  if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const result = db.transaction(() => {
    const user = db.prepare('SELECT id, username, balance FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');
    if (user.balance < amount) throw new Error('User does not have enough balance');

    const newBalance = user.balance - amount;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, userId);

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'withdraw', ?, ?, ?)
    `).run(userId, -amount, newBalance, reason || 'Balance removed by admin');

    return db.prepare('SELECT id, username, email, role, balance, display_name, is_demo, created_at, last_login FROM users WHERE id = ?').get(userId);
  })();

  res.json({ user: result, message: `Removed ₹${amount} from ${result.username}` });
});

// List all bets
router.get('/bets', (req, res) => {
  const { page = 1, limit = 20, status, game_type } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT b.*, u.username FROM bets b JOIN users u ON b.user_id = u.id WHERE 1=1';
  const params = [];

  if (status) { query += ' AND b.status = ?'; params.push(status); }
  if (game_type) { query += ' AND b.game_type = ?'; params.push(game_type); }

  query += ' ORDER BY b.placed_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const bets = db.prepare(query).all(...params);
  res.json({ bets });
});

// Settle a bet manually
router.put('/bets/:id/settle', (req, res) => {
  const { status, payout } = req.body;
  if (!['won', 'lost', 'void'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const settle = db.transaction(() => {
    const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
    if (!bet) throw new Error('Bet not found');

    db.prepare("UPDATE bets SET status = ?, actual_payout = ?, settled_at = datetime('now') WHERE id = ?")
      .run(status, payout || 0, bet.id);

    if (status === 'won' && payout > 0) {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(bet.user_id);
      const newBalance = user.balance + payout;
      db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, bet.user_id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
        VALUES (?, 'bet_won', ?, ?, ?, 'Admin settled bet')
      `).run(bet.user_id, payout, newBalance, String(bet.id));
    } else if (status === 'void') {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(bet.user_id);
      const newBalance = user.balance + bet.stake;
      db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, bet.user_id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
        VALUES (?, 'refund', ?, ?, ?, 'Bet voided by admin')
      `).run(bet.user_id, bet.stake, newBalance, String(bet.id));
    }

    return db.prepare('SELECT * FROM bets WHERE id = ?').get(bet.id);
  })();

  res.json({ bet: settle });
});

// List matches
router.get('/matches', (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY commence_time DESC').all();
  res.json({ matches });
});

// Create match
router.post('/matches', (req, res) => {
  const { sport_key, league, home_team, away_team, commence_time, is_featured } = req.body;
  const result = db.prepare(`
    INSERT INTO matches (sport_key, league, home_team, away_team, commence_time, is_featured)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sport_key, league, home_team, away_team, commence_time, is_featured ? 1 : 0);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ match });
});

// Update match
router.put('/matches/:id', (req, res) => {
  const { status, home_score, away_score, result } = req.body;
  const matchId = req.params.id;

  if (status) db.prepare("UPDATE matches SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, matchId);
  if (home_score !== undefined) db.prepare('UPDATE matches SET home_score = ? WHERE id = ?').run(home_score, matchId);
  if (away_score !== undefined) db.prepare('UPDATE matches SET away_score = ? WHERE id = ?').run(away_score, matchId);
  if (result) db.prepare('UPDATE matches SET result = ? WHERE id = ?').run(result, matchId);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  res.json({ match });
});

// Get/Update settings
router.get('/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM app_settings').all();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json({ settings: obj });
});

router.put('/settings', (req, res) => {
  const { settings } = req.body;
  const update = db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))");
  for (const [key, value] of Object.entries(settings)) {
    update.run(key, String(value));
  }
  res.json({ message: 'Settings updated' });
});

// Delete user
router.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);

  // Prevent deleting yourself
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own admin account' });
  }

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM bets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  })();

  res.json({ message: `User "${user.username}" deleted successfully` });
});

// Change user password
router.put('/users/:id/password', (req, res) => {
  const userId = parseInt(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, userId);

  res.json({ message: `Password changed for "${user.username}"` });
});

// Toggle user verification status
router.put('/users/:id/verify', (req, res) => {
  const userId = parseInt(req.params.id);
  const { is_verified } = req.body;

  const user = db.prepare('SELECT id, username, is_verified FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newStatus = is_verified !== undefined ? (is_verified ? 1 : 0) : (user.is_verified ? 0 : 1);
  db.prepare("UPDATE users SET is_verified = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, userId);

  res.json({ message: `${user.username} is now ${newStatus ? 'verified' : 'unverified'}`, is_verified: newStatus });
});

module.exports = router;
