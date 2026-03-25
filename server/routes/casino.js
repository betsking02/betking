const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const slots = require('../games/slots');
const roulette = require('../games/roulette');
const blackjack = require('../games/blackjack');
const poker = require('../games/poker');
const mines = require('../games/mines');
const dice = require('../games/dice');
const plinko = require('../games/plinko');
const coinflip = require('../games/coinflip');
const hilo = require('../games/hilo');
const dragontiger = require('../games/dragontiger');
const lucky7 = require('../games/lucky7');
const andarbahar = require('../games/andarbahar');
const tower = require('../games/tower');

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

// Mines - Start
router.post('/mines/start', authenticate, (req, res, next) => {
  try {
    const { stake, difficulty } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });
    if (!difficulty || !mines.DIFFICULTIES[difficulty]) {
      return res.status(400).json({ error: 'Invalid difficulty (easy/medium/hard)' });
    }

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
      VALUES (?, 'bet_placed', ?, ?, 'Mines bet')
    `).run(req.user.id, -stake, newBalance);

    const game = mines.createGame(req.user.id, stake, difficulty);
    game.balance = newBalance;

    res.json(game);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet') || err.message.includes('difficulty')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Mines - Reveal tile
router.post('/mines/reveal', authenticate, (req, res, next) => {
  try {
    const { gameId, tileIndex } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });
    if (tileIndex === undefined || tileIndex === null) return res.status(400).json({ error: 'tileIndex is required' });

    const result = mines.revealTile(gameId, tileIndex);

    // If hit a mine, record the lost bet
    if (result.isMine) {
      const game = mines.getGame(gameId);
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      db.prepare(`
        INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
        VALUES (?, 'mines', ?, ?, 0, 'lost', ?, datetime('now'))
      `).run(req.user.id, `Mines ${game.difficulty}`, game.stake, JSON.stringify({
        difficulty: game.difficulty,
        mineCount: game.mineCount,
        revealed: game.revealedTiles.length,
        result: 'mine_hit',
      }));
      result.balance = user.balance;
    } else if (result.allRevealed) {
      // All safe tiles revealed — auto cashout
      const game = mines.getGame(gameId);
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      const finalBalance = user.balance + result.payout;
      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'bet_won', ?, ?, ?)
      `).run(req.user.id, result.payout, finalBalance, `Mines win x${result.multiplier}`);
      db.prepare(`
        INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
        VALUES (?, 'mines', ?, ?, ?, 'won', ?, datetime('now'))
      `).run(req.user.id, `Mines ${game.difficulty}`, game.stake, result.payout, JSON.stringify({
        difficulty: game.difficulty,
        mineCount: game.mineCount,
        revealed: game.revealedTiles.length,
        multiplier: result.multiplier,
        result: 'all_revealed',
      }));
      result.balance = finalBalance;
    }

    res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not active') || err.message.includes('already') || err.message.includes('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Mines - Cashout
router.post('/mines/cashout', authenticate, (req, res, next) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });

    const game = mines.getGame(gameId);
    if (!game) return res.status(400).json({ error: 'Game not found or expired' });

    const result = mines.cashout(gameId);

    // Credit winnings
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    const finalBalance = user.balance + result.payout;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_won', ?, ?, ?)
    `).run(req.user.id, result.payout, finalBalance, `Mines win x${result.multiplier}`);

    // Record bet
    db.prepare(`
      INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
      VALUES (?, 'mines', ?, ?, ?, 'won', ?, datetime('now'))
    `).run(req.user.id, `Mines ${game.difficulty}`, game.stake, result.payout, JSON.stringify({
      difficulty: game.difficulty,
      mineCount: game.mineCount,
      revealed: game.revealedTiles.length,
      multiplier: result.multiplier,
      result: 'cashout',
    }));

    result.balance = finalBalance;
    res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not active') || err.message.includes('Must reveal')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Dice Roll
router.post('/dice/roll', authenticate, (req, res, next) => {
  try {
    const { stake, target, direction } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });
    if (!target || !direction) return res.status(400).json({ error: 'Target and direction required' });

    const result = processCasinoBet(req.user.id, stake, 'dice', `${direction} ${target}`, () => {
      return dice.roll(stake, target, direction);
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet') || err.message.includes('Target') || err.message.includes('Direction')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Plinko
router.post('/plinko/drop', authenticate, (req, res, next) => {
  try {
    const { stake } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });

    const result = processCasinoBet(req.user.id, stake, 'plinko', 'Plinko Drop', () => {
      return plinko.drop(stake);
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Coin Flip
router.post('/coinflip/flip', authenticate, (req, res, next) => {
  try {
    const { stake, choice } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });
    if (!choice) return res.status(400).json({ error: 'Choice is required' });

    const result = processCasinoBet(req.user.id, stake, 'coinflip', choice, () => {
      return coinflip.flip(stake, choice);
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet') || err.message.includes('Choice')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Hi-Lo - Start
router.post('/hilo/start', authenticate, (req, res, next) => {
  try {
    const { stake } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });

    const maxBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'max_bet'").get()?.value || '50000');
    const minBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'min_bet'").get()?.value || '10');
    if (stake > maxBet || stake < minBet) return res.status(400).json({ error: `Bet must be between ${minBet} and ${maxBet}` });

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

    const newBalance = user.balance - stake;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, req.user.id);
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_placed', ?, ?, 'Hi-Lo bet')
    `).run(req.user.id, -stake, newBalance);

    const game = hilo.startGame(req.user.id, stake);
    game.balance = newBalance;

    // Calculate initial probabilities
    const val = game.currentCard.numericValue;
    game.higherChance = Math.round(((14 - val) / 13) * 100);
    game.lowerChance = Math.round(((val - 2) / 13) * 100);

    res.json(game);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Hi-Lo - Guess
router.post('/hilo/guess', authenticate, (req, res, next) => {
  try {
    const { gameId, direction } = req.body;
    if (!gameId || !direction) return res.status(400).json({ error: 'gameId and direction required' });

    const result = hilo.guess(gameId, direction);

    if (result.gameOver) {
      const game = hilo.getGame(gameId);
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      db.prepare(`
        INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
        VALUES (?, 'hilo', ?, ?, 0, 'lost', ?, datetime('now'))
      `).run(req.user.id, `Hi-Lo streak ${game.streak}`, game.stake, JSON.stringify({
        streak: game.streak,
        lastCard: result.card.display,
      }));
      result.balance = user.balance;
    }

    res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not active') || err.message.includes('Guess')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Hi-Lo - Cashout
router.post('/hilo/cashout', authenticate, (req, res, next) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });

    const game = hilo.getGame(gameId);
    if (!game) return res.status(400).json({ error: 'Game not found or expired' });

    const result = hilo.cashout(gameId);

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    const finalBalance = user.balance + result.payout;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_won', ?, ?, ?)
    `).run(req.user.id, result.payout, finalBalance, `Hi-Lo win x${result.multiplier}`);
    db.prepare(`
      INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
      VALUES (?, 'hilo', ?, ?, ?, 'won', ?, datetime('now'))
    `).run(req.user.id, `Hi-Lo streak ${result.streak}`, game.stake, result.payout, JSON.stringify({
      streak: result.streak,
      multiplier: result.multiplier,
    }));

    result.balance = finalBalance;
    res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not active') || err.message.includes('Must win')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Dragon vs Tiger
router.post('/dragontiger/play', authenticate, (req, res, next) => {
  try {
    const { stake, bet } = req.body;
    if (!stake || !bet) return res.status(400).json({ error: 'stake and bet required' });
    if (!['dragon','tiger','tie'].includes(bet)) return res.status(400).json({ error: 'Invalid bet' });
    const result = processCasinoBet(req.user.id, stake, 'dragontiger', bet, () => dragontiger.play(stake, bet));
    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet')) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Lucky 7
router.post('/lucky7/play', authenticate, (req, res, next) => {
  try {
    const { stake, bet } = req.body;
    if (!stake || !bet) return res.status(400).json({ error: 'stake and bet required' });
    if (!['under','lucky7','over'].includes(bet)) return res.status(400).json({ error: 'Invalid bet' });
    const result = processCasinoBet(req.user.id, stake, 'lucky7', bet, () => lucky7.play(stake, bet));
    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet')) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Andar Bahar
router.post('/andarbahar/play', authenticate, (req, res, next) => {
  try {
    const { stake, bet } = req.body;
    if (!stake || !bet) return res.status(400).json({ error: 'stake and bet required' });
    if (!['andar','bahar'].includes(bet)) return res.status(400).json({ error: 'Invalid bet' });
    const result = processCasinoBet(req.user.id, stake, 'andarbahar', bet, () => andarbahar.play(stake, bet));
    res.json(result);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet')) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Tower - Start
router.post('/tower/start', authenticate, (req, res, next) => {
  try {
    const { stake, difficulty } = req.body;
    if (!stake) return res.status(400).json({ error: 'Stake is required' });
    if (!difficulty || !tower.DIFFICULTIES[difficulty]) {
      return res.status(400).json({ error: 'Invalid difficulty (easy/medium/hard)' });
    }

    const maxBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'max_bet'").get()?.value || '50000');
    const minBet = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key = 'min_bet'").get()?.value || '10');
    if (stake > maxBet || stake < minBet) return res.status(400).json({ error: `Bet must be between ${minBet} and ${maxBet}` });

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    if (user.balance < stake) return res.status(400).json({ error: 'Insufficient balance' });

    const newBalance = user.balance - stake;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, req.user.id);
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_placed', ?, ?, 'Tower bet')
    `).run(req.user.id, -stake, newBalance);

    const game = tower.createGame(req.user.id, stake, difficulty);
    game.balance = newBalance;

    res.json(game);
  } catch (err) {
    if (err.message.includes('balance') || err.message.includes('bet') || err.message.includes('difficulty')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Tower - Build (add a floor)
router.post('/tower/build', authenticate, (req, res, next) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });

    const result = tower.build(gameId);

    if (result.collapsed) {
      const game = tower.getGame(gameId);
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      db.prepare(`
        INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
        VALUES (?, 'tower', ?, ?, 0, 'lost', ?, datetime('now'))
      `).run(req.user.id, `Tower ${game.difficulty}`, game.stake, JSON.stringify({
        difficulty: game.difficulty,
        floorsBuilt: game.currentFloor,
        collapseFloor: result.collapseFloor,
        result: 'collapsed',
      }));
      result.balance = user.balance;
    } else if (result.reachedTop) {
      const game = tower.getGame(gameId);
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
      const finalBalance = user.balance + result.payout;
      db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'bet_won', ?, ?, ?)
      `).run(req.user.id, result.payout, finalBalance, `Tower win x${result.multiplier}`);
      db.prepare(`
        INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
        VALUES (?, 'tower', ?, ?, ?, 'won', ?, datetime('now'))
      `).run(req.user.id, `Tower ${game.difficulty}`, game.stake, result.payout, JSON.stringify({
        difficulty: game.difficulty,
        floorsBuilt: game.currentFloor,
        multiplier: result.multiplier,
        result: 'reached_top',
      }));
      result.balance = finalBalance;
    }

    res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not active') || err.message.includes('Already')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Tower - Cashout
router.post('/tower/cashout', authenticate, (req, res, next) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });

    const game = tower.getGame(gameId);
    if (!game) return res.status(400).json({ error: 'Game not found or expired' });

    const result = tower.cashout(gameId);

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    const finalBalance = user.balance + result.payout;
    db.prepare("UPDATE users SET balance = ?, updated_at = datetime('now') WHERE id = ?").run(finalBalance, req.user.id);
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_won', ?, ?, ?)
    `).run(req.user.id, result.payout, finalBalance, `Tower win x${result.multiplier}`);

    db.prepare(`
      INSERT INTO bets (user_id, game_type, selection, stake, actual_payout, status, game_details, settled_at)
      VALUES (?, 'tower', ?, ?, ?, 'won', ?, datetime('now'))
    `).run(req.user.id, `Tower ${game.difficulty}`, game.stake, result.payout, JSON.stringify({
      difficulty: game.difficulty,
      floorsClimbed: game.currentFloor,
      multiplier: result.multiplier,
      result: 'cashout',
    }));

    result.balance = finalBalance;
    res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('not active') || err.message.includes('Must build')) {
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
