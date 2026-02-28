const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const slots = require('../games/slots');
const roulette = require('../games/roulette');
const blackjack = require('../games/blackjack');
const poker = require('../games/poker');

// Helper: process casino bet (deduct stake, return result, credit winnings)
function processCasinoBet(userId, stake, gameType, selection, gameLogicFn) {
  const maxBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'max_bet'").get()?.value || '50000');
  const minBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'min_bet'").get()?.value || '10');

  if (stake > maxBet) throw new Error(`Maximum bet is ${maxBet}`);
  if (stake < minBet) throw new Error(`Minimum bet is ${minBet}`);

  const result = db.transaction(() => {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    if (user.balance < stake) throw new Error('Insufficient balance');

    // Deduct stake
    let newBalance = user.balance - stake;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, userId);

    // Run game logic
    const gameResult = gameLogicFn();
    const payout = gameResult.totalWin || gameResult.payout || 0;

    // Credit winnings
    if (payout > 0) {
      newBalance += payout;
      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, userId);
    }

    // Record bet
    const roundId = uuidv4();
    const status = payout > 0 ? 'won' : 'lost';
    db.prepare(`
      INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_round_id, game_details, settled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(userId, gameType, selection, stake, payout, status, roundId, JSON.stringify(gameResult));

    // Record transactions
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
      VALUES (?, 'bet_placed', ?, ?, ?, ?)
    `).run(userId, -stake, user.balance - stake, roundId, `${gameType} bet`);

    if (payout > 0) {
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
        VALUES (?, 'bet_won', ?, ?, ?, ?)
      `).run(userId, payout, newBalance, roundId, `${gameType} win`);
    }

    return { gameResult, balance: newBalance, payout, status };
  })();

  return result;
}

// Slots - Spin
router.post('/slots/spin', authenticate, (req, res, next) => {
  try {
    const { stake } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });

    const result = processCasinoBet(req.user.id, stake, 'slots', 'Slot Spin', () => {
      return slots.spin(stake);
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Roulette - Spin
router.post('/roulette/spin', authenticate, (req, res, next) => {
  try {
    const { bets } = req.body;
    if (!bets || !Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ error: 'Bets array is required' });
    }

    const totalStake = bets.reduce((sum, b) => sum + (b.stake || 0), 0);
    const selections = bets.map(b => `${b.type}:${b.number || b.numbers || b.color || ''}`).join(', ');

    const result = processCasinoBet(req.user.id, totalStake, 'roulette', selections, () => {
      const gameResult = roulette.spinRoulette(bets);
      return { ...gameResult, totalWin: gameResult.totalPayout };
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Blackjack - Start
router.post('/blackjack/start', authenticate, (req, res, next) => {
  try {
    const { stake } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });

    const maxBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'max_bet'").get()?.value || '50000');
    const minBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'min_bet'").get()?.value || '10');
    if (stake > maxBet || stake < minBet) return res.status(400).json({ error: `Bet must be between ${minBet} and ${maxBet}` });

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

    // Deduct stake
    const newBalance = user.balance - stake;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, req.user.id);
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_placed', ?, ?, 'Blackjack bet')
    `).run(req.user.id, -stake, newBalance);

    const hand = blackjack.startHand(req.user.id, stake);

    // If settled immediately (blackjack or push), handle payout
    if (hand.status === 'settled' && hand.payout > 0) {
      const finalBalance = newBalance + hand.payout;
      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'bet_won', ?, ?, ?)
      `).run(req.user.id, hand.payout, finalBalance, `Blackjack ${hand.result}`);
      hand.balance = finalBalance;
    } else {
      hand.balance = newBalance;
    }

    res.json(hand);
  } catch (err) { next(err); }
});

// Blackjack - Action (hit/stand/double)
router.post('/blackjack/action', authenticate, (req, res, next) => {
  try {
    const { handId, action } = req.body;
    if (!handId || !action) return res.status(400).json({ error: 'handId and action required' });

    // For double down, check balance for additional stake
    if (action === 'double') {
      const activeHand = blackjack.activeHands.get(handId);
      if (activeHand) {
        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
        if (user.balance < activeHand.stake) {
          return res.status(400).json({ error: 'Insufficient balance to double down' });
        }
        // Deduct additional stake
        const newBalance = user.balance - activeHand.stake;
        db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, req.user.id);
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, balance_after, description)
          VALUES (?, 'bet_placed', ?, ?, 'Blackjack double down')
        `).run(req.user.id, -activeHand.stake, newBalance);
      }
    }

    const hand = blackjack.playerAction(handId, action);

    // Handle settlement
    if (hand.status === 'settled') {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      if (hand.payout > 0) {
        const finalBalance = user.balance + hand.payout;
        db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, balance_after, description)
          VALUES (?, 'bet_won', ?, ?, ?)
        `).run(req.user.id, hand.payout, finalBalance, `Blackjack ${hand.result}`);
        hand.balance = finalBalance;
      } else {
        hand.balance = user.balance;
      }

      // Record bet
      db.prepare(`
        INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
        VALUES (?, 'blackjack', ?, ?, ?, ?, ?, datetime('now'))
      `).run(req.user.id, `BJ Hand`, hand.stake, hand.payout || 0, hand.payout > 0 ? 'won' : 'lost', JSON.stringify(hand));
    } else {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      hand.balance = user.balance;
    }

    res.json(hand);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not active')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Poker - Deal
router.post('/poker/deal', authenticate, (req, res, next) => {
  try {
    const { stake } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

    const newBalance = user.balance - stake;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, req.user.id);
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_placed', ?, ?, 'Poker bet')
    `).run(req.user.id, -stake, newBalance);

    const hand = poker.deal(req.user.id, stake);
    hand.balance = newBalance;

    res.json(hand);
  } catch (err) { next(err); }
});

// Poker - Draw
router.post('/poker/draw', authenticate, (req, res, next) => {
  try {
    const { handId, holdIndices } = req.body;
    if (!handId) return res.status(400).json({ error: 'handId is required' });
    if (!Array.isArray(holdIndices)) return res.status(400).json({ error: 'holdIndices must be an array' });

    const result = poker.draw(handId, holdIndices);

    if (result.payout > 0) {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      const finalBalance = user.balance + result.payout;
      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'bet_won', ?, ?, ?)
      `).run(req.user.id, result.payout, finalBalance, `Poker: ${result.handName}`);
      result.balance = finalBalance;
    } else {
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      result.balance = user.balance;
    }

    // Record bet
    db.prepare(`
      INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
      VALUES (?, 'poker', ?, ?, ?, ?, ?, datetime('now'))
    `).run(req.user.id, result.handName, result.stake, result.payout, result.payout > 0 ? 'won' : 'lost', JSON.stringify(result));

    res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('Already')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Casino game history
router.get('/history', authenticate, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const bets = db.prepare(`
    SELECT * FROM bets WHERE user_id = ? AND game_type != 'sports'
    ORDER BY placed_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, parseInt(limit), parseInt(offset));

  res.json({ bets });
});

module.exports = router;
