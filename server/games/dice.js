const crypto = require('crypto');

function roll(stake, target, direction) {
  if (target < 2 || target > 98) throw new Error('Target must be between 2 and 98');
  if (direction !== 'over' && direction !== 'under') throw new Error('Direction must be over or under');

  // Generate provably fair result 1-100
  const seed = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', seed).update(String(Date.now())).digest('hex');
  const result = (parseInt(hash.substring(0, 8), 16) % 100) + 1;

  // Calculate win chance and payout multiplier
  const winChance = direction === 'over' ? (100 - target) : (target - 1);
  const multiplier = Math.round((99 / winChance) * 0.97 * 100) / 100; // 3% house edge

  const won = direction === 'over' ? result > target : result < target;
  const payout = won ? Math.round(stake * multiplier * 100) / 100 : 0;

  return {
    result,
    target,
    direction,
    won,
    multiplier,
    winChance,
    payout,
    totalWin: payout,
  };
}

function getMultiplier(target, direction) {
  const winChance = direction === 'over' ? (100 - target) : (target - 1);
  if (winChance <= 0) return 0;
  return Math.round((99 / winChance) * 0.97 * 100) / 100;
}

module.exports = { roll, getMultiplier };
