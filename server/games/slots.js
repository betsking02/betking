const crypto = require('crypto');

const SYMBOLS = ['7', 'BAR', 'CHERRY', 'BELL', 'LEMON', 'ORANGE', 'PLUM', 'GRAPE', 'WILD', 'SCATTER'];

// Weighted reel strip (controls probabilities)
const REEL_STRIP = [
  'GRAPE', 'LEMON', 'ORANGE', 'PLUM', 'CHERRY', 'GRAPE', 'BELL', 'LEMON',
  'ORANGE', 'PLUM', 'BAR', 'GRAPE', 'LEMON', 'CHERRY', 'ORANGE', 'BELL',
  'PLUM', 'GRAPE', 'LEMON', 'ORANGE', '7', 'PLUM', 'GRAPE', 'CHERRY',
  'BELL', 'LEMON', 'ORANGE', 'WILD', 'PLUM', 'SCATTER'
];

const PAYOUTS = {
  '7':       { 3: 50, 4: 100, 5: 500 },
  'BAR':     { 3: 20, 4: 40, 5: 200 },
  'CHERRY':  { 2: 1, 3: 10, 4: 25, 5: 100 },
  'BELL':    { 3: 5, 4: 15, 5: 75 },
  'WILD':    { 3: 25, 4: 50, 5: 250 },
  'LEMON':   { 3: 2, 4: 5, 5: 15 },
  'ORANGE':  { 3: 2, 4: 5, 5: 15 },
  'PLUM':    { 3: 2, 4: 5, 5: 15 },
  'GRAPE':   { 3: 2, 4: 5, 5: 15 },
};

// Simple 5 paylines for a 5x3 grid
const PAYLINES = [
  [1, 1, 1, 1, 1],  // middle row
  [0, 0, 0, 0, 0],  // top row
  [2, 2, 2, 2, 2],  // bottom row
  [0, 1, 2, 1, 0],  // V shape
  [2, 1, 0, 1, 2],  // inverted V
];

function spin(betAmount) {
  const betPerLine = betAmount / PAYLINES.length;
  
  // Generate 5x3 grid
  const grid = [];
  const reelStops = [];
  for (let reel = 0; reel < 5; reel++) {
    const stop = crypto.randomInt(0, REEL_STRIP.length);
    reelStops.push(stop);
    const col = [];
    for (let row = 0; row < 3; row++) {
      const idx = (stop + row) % REEL_STRIP.length;
      col.push(REEL_STRIP[idx]);
    }
    grid.push(col);
  }

  // Check paylines
  const wins = [];
  let totalWin = 0;

  for (let lineIdx = 0; lineIdx < PAYLINES.length; lineIdx++) {
    const line = PAYLINES[lineIdx];
    const symbols = line.map((row, reel) => grid[reel][row]);
    
    // Count consecutive matching symbols from left (WILD matches anything)
    const firstSymbol = symbols[0] === 'WILD' ? symbols.find(s => s !== 'WILD') || 'WILD' : symbols[0];
    
    if (firstSymbol === 'SCATTER') continue;
    
    let count = 0;
    for (const sym of symbols) {
      if (sym === firstSymbol || sym === 'WILD') count++;
      else break;
    }

    if (PAYOUTS[firstSymbol] && PAYOUTS[firstSymbol][count]) {
      const winAmount = betPerLine * PAYOUTS[firstSymbol][count];
      totalWin += winAmount;
      wins.push({ line: lineIdx, symbol: firstSymbol, count, amount: winAmount });
    }
  }

  // Check scatters (anywhere on grid)
  let scatterCount = 0;
  for (let reel = 0; reel < 5; reel++) {
    for (let row = 0; row < 3; row++) {
      if (grid[reel][row] === 'SCATTER') scatterCount++;
    }
  }
  
  if (scatterCount >= 3) {
    const scatterWin = betAmount * (scatterCount === 3 ? 5 : scatterCount === 4 ? 20 : 50);
    totalWin += scatterWin;
    wins.push({ line: -1, symbol: 'SCATTER', count: scatterCount, amount: scatterWin });
  }

  return {
    grid,
    reelStops,
    paylines: PAYLINES,
    wins,
    totalWin: Math.round(totalWin * 100) / 100,
    symbols: SYMBOLS
  };
}

module.exports = { spin, SYMBOLS, PAYLINES };
