const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const Joi = require('joi');

const amountSchema = Joi.object({
  amount: Joi.number().positive().min(100).max(1000000).required()
});

// Get balance
router.get('/balance', authenticate, (req, res) => {
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
  res.json({ balance: user.balance });
});

// Deposit (virtual)
router.post('/deposit', authenticate, (req, res, next) => {
  try {
    const { error, value } = amountSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const deposit = db.transaction(() => {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      const newBalance = user.balance + value.amount;

      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, req.user.id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'deposit', ?, ?, 'Virtual deposit')
      `).run(req.user.id, value.amount, newBalance);

      return newBalance;
    });

    const newBalance = deposit();
    res.json({ balance: newBalance, message: 'Deposit successful' });
  } catch (err) { next(err); }
});

// Withdraw (virtual)
router.post('/withdraw', authenticate, (req, res, next) => {
  try {
    const { error, value } = amountSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const withdraw = db.transaction(() => {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      if (user.balance < value.amount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = user.balance - value.amount;
      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, req.user.id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'withdraw', ?, ?, 'Virtual withdrawal')
      `).run(req.user.id, -value.amount, newBalance);

      return newBalance;
    });

    const newBalance = withdraw();
    res.json({ balance: newBalance, message: 'Withdrawal successful' });
  } catch (err) {
    if (err.message === 'Insufficient balance') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    next(err);
  }
});

// Transaction history
router.get('/transactions', authenticate, (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.user.id];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const transactions = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(req.user.id).count;

  res.json({ transactions, total, page: parseInt(page), limit: parseInt(limit) });
});

module.exports = router;
