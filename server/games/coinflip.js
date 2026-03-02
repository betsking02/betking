const crypto = require('crypto');

function flip(stake, choice) {
  if (choice !== 'heads' && choice !== 'tails') throw new Error('Choice must be heads or tails');

  const seed = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', seed).update(String(Date.now())).digest('hex');
  const value = parseInt(hash.substring(0, 8), 16) % 1000;

  // 48.5% heads, 48.5% tails, 3% house edge
  const result = value < 485 ? 'heads' : value < 970 ? 'tails' : (choice === 'heads' ? 'tails' : 'heads');
  const won = result === choice;
  const multiplier = 1.94;
  const payout = won ? Math.round(stake * multiplier * 100) / 100 : 0;

  return {
    result,
    choice,
    won,
    multiplier,
    payout,
    totalWin: payout,
  };
}

module.exports = { flip };
