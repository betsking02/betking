const crypto = require('crypto');

const COLORS = {
  red: { payout: 2, probability: 0.475 },
  green: { payout: 2, probability: 0.475 },
  violet: { payout: 4.5, probability: 0.05 }
};

function generateColor(serverSeed, roundNumber) {
  const hash = crypto.createHmac('sha256', serverSeed).update(String(roundNumber)).digest('hex');
  const value = parseInt(hash.substring(0, 8), 16) % 1000;

  if (value < 50) return 'violet';   // 5%
  if (value < 525) return 'red';     // 47.5%
  return 'green';                     // 47.5%
}

class ColorPredictionManager {
  constructor(io) {
    this.io = io;
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.roundNumber = 0;
    this.roundDuration = 60; // seconds
    this.bettingCutoff = 10; // stop bets 10 seconds before result
    this.status = 'betting'; // betting | locked | result
    this.bets = []; // { userId, username, color, amount, socketId }
    this.secondsLeft = this.roundDuration;
    this.currentResult = null;
    this.history = [];
    this.timerInterval = null;
  }

  start() {
    this.newRound();
  }

  newRound() {
    this.roundNumber++;
    this.status = 'betting';
    this.bets = [];
    this.secondsLeft = this.roundDuration;
    this.currentResult = generateColor(this.serverSeed, this.roundNumber);

    if (this.io) {
      this.io.to('color').emit('color:new_round', {
        roundId: this.roundNumber,
        countdown: this.roundDuration
      });
    }

    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    this.secondsLeft--;

    if (this.secondsLeft === this.bettingCutoff) {
      this.status = 'locked';
      if (this.io) {
        this.io.to('color').emit('color:locked', { roundId: this.roundNumber });
      }
    }

    if (this.secondsLeft <= 0) {
      this.resolveRound();
      return;
    }

    if (this.io) {
      this.io.to('color').emit('color:tick', {
        secondsLeft: this.secondsLeft,
        status: this.status
      });
    }
  }

  resolveRound() {
    clearInterval(this.timerInterval);
    this.status = 'result';

    const color = this.currentResult;
    const payout = COLORS[color].payout;

    const winners = this.bets
      .filter(b => b.color === color)
      .map(b => ({
        userId: b.userId,
        username: b.username,
        amount: b.amount,
        payout: Math.round(b.amount * payout * 100) / 100
      }));

    this.history.unshift({ roundId: this.roundNumber, color });
    if (this.history.length > 20) this.history.pop();

    if (this.io) {
      this.io.to('color').emit('color:result', {
        roundId: this.roundNumber,
        color,
        winners
      });
    }

    // New round after 5 seconds
    setTimeout(() => this.newRound(), 5000);
  }

  placeBet(socketId, userId, username, color, amount) {
    if (this.status !== 'betting') throw new Error('Betting is closed');
    if (!COLORS[color]) throw new Error('Invalid color');

    const existing = this.bets.find(b => b.userId === userId);
    if (existing) throw new Error('Already bet this round');

    this.bets.push({ userId, username, color, amount, socketId });

    const betCounts = { red: 0, green: 0, violet: 0 };
    this.bets.forEach(b => betCounts[b.color]++);

    if (this.io) {
      this.io.to('color').emit('color:bets_count', betCounts);
    }

    return true;
  }

  getState() {
    const betCounts = { red: 0, green: 0, violet: 0 };
    this.bets.forEach(b => betCounts[b.color]++);

    return {
      status: this.status,
      roundId: this.roundNumber,
      secondsLeft: this.secondsLeft,
      betCounts,
      history: this.history
    };
  }
}

module.exports = { ColorPredictionManager, generateColor, COLORS };
