const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const Joi = require('joi');

const betSchema = Joi.object({
  match_id: Joi.number().integer().optional(),
  game_type: Joi.string().valid('sports', 'slots', 'roulette', 'blackjack', 'poker', 'crash', 'color_prediction').required(),
  bet_type: Joi.string().optional(),
  selection: Joi.string().required(),
  odds: Joi.number().positive().optional(),
  stake: Joi.number().positive().required()
});

// Place a bet
router.post('/', authenticate, (req, res, next) => {
  try {
    const { error, value } = betSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { match_id, game_type, bet_type, selection, odds, stake } = value;
    const userId = req.user.id;

    const maxBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'max_bet'").get()?.value || '50000');
    const minBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'min_bet'").get()?.value || '10');

    if (stake > maxBet) return res.status(400).json({ error: `Maximum bet is ${maxBet}` });
    if (stake < minBet) return res.status(400).json({ error: `Minimum bet is ${minBet}` });

    const potentialPayout = odds ? stake * odds : stake;

    const placeBet = db.transaction(() => {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
      if (user.balance < stake) {
        throw new Error('Insufficient balance');
      }

      const newBalance = user.balance - stake;
      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, userId);

      const result = db.prepare(`
        INSERT INTO bets (user_id, match_id, game_type, bet_type, selection, odds_at_placement, stake, potential_payout, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(userId, match_id || null, game_type, bet_type || null, selection, odds || null, stake, potentialPayout);

      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
        VALUES (?, 'bet_placed', ?, ?, ?, ?)
      `).run(userId, -stake, newBalance, String(result.lastInsertRowid), `Bet on ${selection}`);

      return { betId: result.lastInsertRowid, newBalance };
    });

    const { betId, newBalance } = placeBet();
    const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(betId);

    res.status(201).json({ bet, balance: newBalance });
  } catch (err) {
    if (err.message === 'Insufficient balance') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    next(err);
  }
});

// Get bet history
router.get('/history', authenticate, (req, res) => {
  const { page = 1, limit = 20, game_type } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM bets WHERE user_id = ?';
  const params = [req.user.id];

  if (game_type) {
    query += ' AND game_type = ?';
    params.push(game_type);
  }

  query += ' ORDER BY placed_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const bets = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM bets WHERE user_id = ?').get(req.user.id).count;

  res.json({ bets, total, page: parseInt(page), limit: parseInt(limit) });
});

// Get active bets
router.get('/active', authenticate, (req, res) => {
  const bets = db.prepare("SELECT * FROM bets WHERE user_id = ? AND status = 'pending' ORDER BY placed_at DESC").all(req.user.id);
  res.json({ bets });
});

// Get single bet
router.get('/:id', authenticate, (req, res) => {
  const bet = db.prepare('SELECT * FROM bets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!bet) return res.status(404).json({ error: 'Bet not found' });
  res.json({ bet });
});

module.exports = router;
