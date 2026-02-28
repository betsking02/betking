const crypto = require('crypto');

function generateCrashPoint(serverSeed, roundNumber) {
  const hash = crypto.createHmac('sha256', serverSeed).update(String(roundNumber)).digest('hex');
  const h = parseInt(hash.substring(0, 8), 16);

  // 1 in 33 chance of instant crash at 1.00x (house edge)
  if (h % 33 === 0) return 1.00;

  const e = Math.pow(2, 32);
  const result = Math.floor((100 * e) / (h + 1)) / 100;
  return Math.max(1.00, Math.min(result, 1000.00)); // Cap at 1000x
}

function hashChain(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

class CrashGameManager {
  constructor(io) {
    this.io = io;
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.roundNumber = 0;
    this.status = 'waiting'; // waiting | running | crashed
    this.crashPoint = 0;
    this.startTime = null;
    this.bets = new Map(); // socketId -> { userId, username, amount, cashedOut, cashoutMultiplier }
    this.multiplier = 1.00;
    this.tickInterval = null;
    this.history = []; // last 20 crash points
  }

  start() {
    this.newRound();
  }

  newRound() {
    this.roundNumber++;
    this.status = 'waiting';
    this.bets.clear();
    this.multiplier = 1.00;
    this.crashPoint = generateCrashPoint(this.serverSeed, this.roundNumber);
    
    const hash = hashChain(`${this.serverSeed}:${this.roundNumber}`);

    if (this.io) {
      this.io.to('crash').emit('crash:waiting', {
        roundId: this.roundNumber,
        countdown: 10,
        hash
      });
    }

    // Wait 10 seconds then start
    setTimeout(() => this.startRound(), 10000);
  }

  startRound() {
    this.status = 'running';
    this.startTime = Date.now();

    if (this.io) {
      this.io.to('crash').emit('crash:start', { roundId: this.roundNumber });
    }

    this.tickInterval = setInterval(() => this.tick(), 100);
  }

  tick() {
    const elapsed = Date.now() - this.startTime;
    this.multiplier = Math.round(Math.pow(Math.E, 0.00006 * elapsed) * 100) / 100;

    if (this.multiplier >= this.crashPoint) {
      this.crash();
      return;
    }

    if (this.io) {
      this.io.to('crash').emit('crash:tick', { multiplier: this.multiplier });
    }
  }

  crash() {
    clearInterval(this.tickInterval);
    this.status = 'crashed';
    this.multiplier = this.crashPoint;

    this.history.unshift(this.crashPoint);
    if (this.history.length > 20) this.history.pop();

    if (this.io) {
      this.io.to('crash').emit('crash:end', {
        crashPoint: this.crashPoint,
        roundId: this.roundNumber
      });
    }

    // Start new round after 3 seconds
    setTimeout(() => this.newRound(), 3000);
  }

  placeBet(socketId, userId, username, amount) {
    if (this.status !== 'waiting') throw new Error('Bets only during waiting phase');
    if (this.bets.has(socketId)) throw new Error('Already bet this round');

    this.bets.set(socketId, {
      userId,
      username,
      amount,
      cashedOut: false,
      cashoutMultiplier: null
    });

    if (this.io) {
      this.io.to('crash').emit('crash:bet_placed', { username, amount });
    }

    return true;
  }

  cashout(socketId) {
    if (this.status !== 'running') throw new Error('Game not running');
    const bet = this.bets.get(socketId);
    if (!bet) throw new Error('No bet found');
    if (bet.cashedOut) throw new Error('Already cashed out');

    bet.cashedOut = true;
    bet.cashoutMultiplier = this.multiplier;
    const payout = Math.round(bet.amount * this.multiplier * 100) / 100;

    if (this.io) {
      this.io.to('crash').emit('crash:cashed_out', {
        username: bet.username,
        multiplier: this.multiplier,
        payout
      });
    }

    return { payout, multiplier: this.multiplier };
  }

  getState() {
    return {
      status: this.status,
      roundId: this.roundNumber,
      multiplier: this.multiplier,
      crashPoint: this.status === 'crashed' ? this.crashPoint : null,
      bets: Array.from(this.bets.values()).map(b => ({
        username: b.username,
        amount: b.amount,
        cashedOut: b.cashedOut,
        cashoutMultiplier: b.cashoutMultiplier
      })),
      history: this.history
    };
  }
}

module.exports = { CrashGameManager, generateCrashPoint };
