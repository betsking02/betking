const crypto = require('crypto');

const ROWS = 12;

// Multipliers for 13 slots (ROWS + 1) at bottom — symmetric, edges pay most
const MULTIPLIERS = [10, 3, 1.6, 1.2, 1.1, 0.5, 0.3, 0.5, 1.1, 1.2, 1.6, 3, 10];

function drop(stake) {
  const seed = crypto.randomBytes(16).toString('hex');
  const path = [];
  let position = 0; // start at center

  for (let row = 0; row < ROWS; row++) {
    const hash = crypto.createHmac('sha256', seed).update(`${row}`).digest('hex');
    const bit = parseInt(hash.substring(row * 2, row * 2 + 2), 16) % 2;
    // 0 = left, 1 = right
    position += bit;
    path.push(bit === 0 ? 'L' : 'R');
  }

  // position ranges from 0 to ROWS (12), maps to slot index 0-12
  const slotIndex = position;
  const multiplier = MULTIPLIERS[slotIndex];
  const payout = Math.round(stake * multiplier * 100) / 100;

  return {
    path,
    slotIndex,
    multiplier,
    payout,
    totalWin: payout,
    multipliers: MULTIPLIERS,
    rows: ROWS,
  };
}

module.exports = { drop, MULTIPLIERS, ROWS };
