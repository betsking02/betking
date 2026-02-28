const { verifyToken } = require('../utils/jwt');
const db = require('../config/database');
const { CrashGameManager } = require('../games/crash');
const { ColorPredictionManager } = require('../games/colorPrediction');

let crashManager = null;
let colorManager = null;

function setupSocket(io) {
  crashManager = new CrashGameManager(io);
  colorManager = new ColorPredictionManager(io);

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

    socket.on('crash:place_bet', ({ amount }, callback) => {
      if (!socket.user) return callback?.({ error: 'Not authenticated' });
      try {
        // Deduct balance
        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(socket.user.id);
        if (user.balance < amount) return callback?.({ error: 'Insufficient balance' });

        const newBalance = user.balance - amount;
        db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, socket.user.id);
        db.prepare(`
          INSERT INTO transactions (user_id, type, amount, balance_after, description)
          VALUES (?, 'bet_placed', ?, ?, 'Crash game bet')
        `).run(socket.user.id, -amount, newBalance);

        crashManager.placeBet(socket.id, socket.user.id, socket.user.username, amount);
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

        // Credit winnings
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

    // === MATCH SUBSCRIPTIONS ===
    socket.on('subscribe:match', ({ matchId }) => {
      socket.join(`match:${matchId}`);
    });

    socket.on('unsubscribe:match', ({ matchId }) => {
      socket.leave(`match:${matchId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Start game loops
  crashManager.start();
  colorManager.start();

  console.log('Socket.io initialized, Crash & Color Prediction games started');
}

module.exports = { setupSocket, getCrashManager: () => crashManager, getColorManager: () => colorManager };
