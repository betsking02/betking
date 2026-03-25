class LiveGameManager {
  constructor(io, config, payoutHandler) {
    this.io = io;
    this.gameId = config.gameId;
    this.roundDuration = config.roundDuration || 30;
    this.bettingCutoff = config.bettingCutoff || 3;
    this.validBets = config.validBets;
    this.payouts = config.payouts;
    this.generateRound = config.generateRound;
    this.revealDelay = config.revealDelay || 2000;
    this.resultDisplayTime = config.resultDisplayTime || 5000;
    this.payoutHandler = payoutHandler;

    this.roundNumber = 0;
    this.status = 'betting';
    this.secondsLeft = this.roundDuration;
    this.bets = [];
    this.roundData = null;
    this.history = [];
    this.timerInterval = null;
  }

  emit(event, data) {
    if (this.io) {
      this.io.to(this.gameId).emit(`live:${this.gameId}:${event}`, data);
    }
  }

  start() {
    this.newRound();
  }

  newRound() {
    this.roundNumber++;
    this.status = 'betting';
    this.bets = [];
    this.secondsLeft = this.roundDuration;
    this.roundData = this.generateRound();

    this.emit('new_round', {
      roundId: this.roundNumber,
      countdown: this.roundDuration,
    });

    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    this.secondsLeft--;

    if (this.secondsLeft === this.bettingCutoff) {
      this.status = 'locked';
      this.emit('locked', { roundId: this.roundNumber });
    }

    if (this.secondsLeft <= 0) {
      clearInterval(this.timerInterval);
      this.status = 'revealing';
      this.emit('revealing', { roundId: this.roundNumber });
      setTimeout(() => this.resolveRound(), this.revealDelay);
      return;
    }

    this.emit('tick', {
      secondsLeft: this.secondsLeft,
      status: this.status,
    });
  }

  resolveRound() {
    clearInterval(this.timerInterval);
    this.status = 'result';

    const winningBet = this.roundData.result;

    const winners = this.bets
      .filter(b => b.choice === winningBet)
      .map(b => {
        const multiplier = this.payouts[b.choice];
        const payout = Math.round(b.amount * multiplier * 100) / 100;
        return { userId: b.userId, username: b.username, amount: b.amount, payout, multiplier };
      });

    // Credit winners
    for (const w of winners) {
      try {
        this.payoutHandler(w.userId, w.payout, `${this.gameId} win (${w.multiplier}x)`);
      } catch (e) { /* ignore payout errors */ }
    }

    this.history.unshift({
      roundId: this.roundNumber,
      result: winningBet,
      roundData: this.roundData,
    });
    if (this.history.length > 20) this.history.pop();

    this.emit('result', {
      roundId: this.roundNumber,
      roundData: this.roundData,
      winners: winners.map(w => ({ username: w.username, payout: w.payout, multiplier: w.multiplier })),
      totalBets: this.bets.length,
    });

    setTimeout(() => this.newRound(), this.resultDisplayTime);
  }

  placeBet(socketId, userId, username, choice, amount) {
    if (this.status !== 'betting') throw new Error('Betting is closed');
    if (!this.validBets.includes(choice)) throw new Error('Invalid bet option');
    this.bets.push({ socketId, userId, username, choice, amount });

    const betCounts = {};
    for (const opt of this.validBets) {
      betCounts[opt] = this.bets.filter(b => b.choice === opt).length;
    }

    this.emit('bets_count', { betCounts, totalBets: this.bets.length });
  }

  getState() {
    const betCounts = {};
    for (const opt of this.validBets) {
      betCounts[opt] = this.bets.filter(b => b.choice === opt).length;
    }

    return {
      status: this.status,
      roundId: this.roundNumber,
      secondsLeft: this.secondsLeft,
      betCounts,
      totalBets: this.bets.length,
      history: this.history.slice(0, 15),
      roundData: (this.status === 'result' || this.status === 'revealing') ? this.roundData : null,
    };
  }
}

module.exports = { LiveGameManager };
