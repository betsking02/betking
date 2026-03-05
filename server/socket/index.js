const { verifyToken } = require('../utils/jwt');
const db = require('../config/database');
const { CrashGameManager } = require('../games/crash');
const { ColorPredictionManager } = require('../games/colorPrediction');
const { LiveGameManager } = require('../games/LiveGameManager');
const { generateRound: dtGenerateRound } = require('../games/dragontiger');
const { generateRound: l7GenerateRound } = require('../games/lucky7');
const { generateRound: abGenerateRound } = require('../games/andarbahar');

let crashManager = null;
let colorManager = null;
let dtManager = null;
let l7Manager = null;
let abManager = null;

function createPayoutHandler(io) {
  return (userId, amount, description) => {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
    if (!user) return;
    const newBalance = Math.round((user.balance + amount) * 100) / 100;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);
    db.prepare(`INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'bet_won', ?, ?, ?)`).run(userId, amount, newBalance, description);
    io.to(`user:${userId}`).emit('wallet:balance_update', { balance: newBalance });
  };
}

function setupSocket(io) {
  crashManager = new CrashGameManager(io);
  colorManager = new ColorPredictionManager(io);

  const payoutHandler = createPayoutHandler(io);

  dtManager = new LiveGameManager(io, {
    gameId: 'dragontiger',
    roundDuration: 30,
    validBets: ['dragon', 'tiger', 'tie'],
    payouts: { dragon: 1.94, tiger: 1.94, tie: 8 },
    generateRound: dtGenerateRound,
    revealDelay: 2000,
    resultDisplayTime: 5000,
  }, payoutHandler);

  l7Manager = new LiveGameManager(io, {
    gameId: 'lucky7',
    roundDuration: 30,
    validBets: ['under', 'lucky7', 'over'],
    payouts: { under: 1.94, lucky7: 11, over: 1.94 },
    generateRound: l7GenerateRound,
    revealDelay: 2000,
    resultDisplayTime: 5000,
  }, payoutHandler);

  abManager = new LiveGameManager(io, {
    gameId: 'andarbahar',
    roundDuration: 30,
    validBets: ['andar', 'bahar'],
    payouts: { andar: 1.9, bahar: 1.9 },
    generateRound: abGenerateRound,
    revealDelay: 2000,
    resultDisplayTime: 8000,
  }, payoutHandler);

  // Auto-cashout handler for Aviator/Crash game
  crashManager.setAutoCashoutHandler((socketId, bet, multiplier) => {
    try {
      const payout = Math.round(bet.amount * multiplier * 100) / 100;
      const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(bet.userId);
      if (!user) return false;
      const newBalance = user.balance + payout;
      db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, bet.userId);
      db.prepare(`INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'bet_won', ?, ?, ?)`).run(bet.userId, payout, newBalance, `Aviator auto-cashout at ${multiplier}x`);
      io.to(`user:${bet.userId}`).emit('wallet:balance_update', { balance: newBalance });
      return true;
    } catch { return false; }
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = db.prepare('SELECT id, username, role, balance FROM users WHERE id = ?').get(decoded.userId);
        if (user) {
          socket.user = user;
          return next();
        }
      } catch (err) {
        // Allow unauthenticated connections for spectating
      }
    }
    socket.user = null;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user?.username || 'anonymous'})`);

    // Join user to their personal room for balance updates
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
    }

    // === CRASH GAME ===
    socket.on('crash:join', () => {
      socket.join('crash');
      socket.emit('crash:state', crashManager.getState());
    });

    socket.on('crash:leave', () => {
      socket.leave('crash');
    });

    socket.on('crash:place_bet', ({ amount, autoCashout }, callback) => {
      if (!socket.user) return callback?.({ error: 'Not authenticated' });
      try {
        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(socket.user.id);
        if (user.balance < amount) return callback?.({ error: 'Insufficient balance' });

        const newBalance = user.balance - amount;
        db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, socket.user.id);
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, balance_after, description)
          VALUES (?, 'bet_placed', ?, ?, 'Aviator/Crash game bet')
        `).run(socket.user.id, -amount, newBalance);

        crashManager.placeBet(socket.id, socket.user.id, socket.user.username, amount, autoCashout || null);
        io.to(`user:${socket.user.id}`).emit('wallet:balance_update', { balance: newBalance });
        callback?.({ success: true, balance: newBalance });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    socket.on('crash:cashout', (_, callback) => {
      if (!socket.user) return callback?.({ error: 'Not authenticated' });
      try {
        const { payout, multiplier } = crashManager.cashout(socket.id);

        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(socket.user.id);
        const newBalance = user.balance + payout;
        db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, socket.user.id);
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, balance_after, description)
          VALUES (?, 'bet_won', ?, ?, ?)
        `).run(socket.user.id, payout, newBalance, `Crash cashout at ${multiplier}x`);

        io.to(`user:${socket.user.id}`).emit('wallet:balance_update', { balance: newBalance });
        callback?.({ success: true, payout, multiplier, balance: newBalance });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    // === COLOR PREDICTION ===
    socket.on('color:join', () => {
      socket.join('color');
      socket.emit('color:state', colorManager.getState());
    });

    socket.on('color:leave', () => {
      socket.leave('color');
    });

    socket.on('color:place_bet', ({ color, amount }, callback) => {
      if (!socket.user) return callback?.({ error: 'Not authenticated' });
      try {
        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(socket.user.id);
        if (user.balance < amount) return callback?.({ error: 'Insufficient balance' });

        const newBalance = user.balance - amount;
        db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, socket.user.id);
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, balance_after, description)
          VALUES (?, 'bet_placed', ?, ?, ?)
        `).run(socket.user.id, -amount, newBalance, `Color prediction: ${color}`);

        colorManager.placeBet(socket.id, socket.user.id, socket.user.username, color, amount);
        io.to(`user:${socket.user.id}`).emit('wallet:balance_update', { balance: newBalance });
        callback?.({ success: true, balance: newBalance });
      } catch (err) {
        callback?.({ error: err.message });
      }
    });

    // === LIVE CARD GAMES (Dragon Tiger, Lucky 7, Andar Bahar) ===
    function registerLiveGame(manager, gameId) {
      socket.on(`live:${gameId}:join`, () => {
        socket.join(gameId);
        socket.emit(`live:${gameId}:state`, manager.getState());
      });

      socket.on(`live:${gameId}:leave`, () => {
        socket.leave(gameId);
      });

      socket.on(`live:${gameId}:place_bet`, ({ bet, amount }, callback) => {
        if (!socket.user) return callback?.({ error: 'Not authenticated' });
        try {
          const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(socket.user.id);
          if (user.balance < amount) return callback?.({ error: 'Insufficient balance' });

          const newBalance = Math.round((user.balance - amount) * 100) / 100;
          db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, socket.user.id);
          db.prepare(`
            INSERT INTO transactions (user_id, type, amount, balance_after, description)
            VALUES (?, 'bet_placed', ?, ?, ?)
          `).run(socket.user.id, -amount, newBalance, `${gameId}: ${bet}`);

          manager.placeBet(socket.id, socket.user.id, socket.user.username, bet, amount);
          io.to(`user:${socket.user.id}`).emit('wallet:balance_update', { balance: newBalance });
          callback?.({ success: true, balance: newBalance });
        } catch (err) {
          callback?.({ error: err.message });
        }
      });
    }

    registerLiveGame(dtManager, 'dragontiger');
    registerLiveGame(l7Manager, 'lucky7');
    registerLiveGame(abManager, 'andarbahar');

    // === MATCH SUBSCRIPTIONS ===
    socket.on('subscribe:match', ({ matchId }) => {
      socket.join(`match:${matchId}`);
    });

    socket.on('unsubscribe:match', ({ matchId }) => {
      socket.leave(`match:${matchId}`);
    });

    // === LIVE SPORTS SUBSCRIPTIONS (Smart Polling) ===
    socket.on('sports:subscribe', () => {
      socket.join('sports:live');
      socket._watchingSports = true;
      const { addWatcher } = require('../services/matchSyncService');
      addWatcher();
    });

    socket.on('sports:unsubscribe', () => {
      socket.leave('sports:live');
      if (socket._watchingSports) {
        socket._watchingSports = false;
        const { removeWatcher } = require('../services/matchSyncService');
        removeWatcher();
      }
    });

    socket.on('disconnect', () => {
      // Clean up watcher count if user was watching sports
      if (socket._watchingSports) {
        socket._watchingSports = false;
        const { removeWatcher } = require('../services/matchSyncService');
        removeWatcher();
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Start game loops
  crashManager.start();
  colorManager.start();
  dtManager.start();
  l7Manager.start();
  abManager.start();

  // Wire up match sync to broadcast via socket
  const { setSocketIO } = require('../services/matchSyncService');
  setSocketIO(io);

  console.log('Socket.io initialized, all game loops started');
}

module.exports = { setupSocket, getCrashManager: () => crashManager, getColorManager: () => colorManager };
