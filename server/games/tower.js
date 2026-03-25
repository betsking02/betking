const crypto = require('crypto');

// Tower difficulties: columns per row, traps per row
const DIFFICULTIES = {
  easy:   { columns: 4, traps: 1, rows: 8,  label: 'Easy' },
  medium: { columns: 3, traps: 1, rows: 8,  label: 'Medium' },
  hard:   { columns: 2, traps: 1, rows: 8,  label: 'Hard' },
};

// Multiplier tables per difficulty (floor 1 through 8)
function getMultiplier(difficulty, floor) {
  if (floor <= 0) return 1;

  const diff = DIFFICULTIES[difficulty];
  const safePerRow = diff.columns - diff.traps;
  let multiplier = 1;

  for (let i = 0; i < floor; i++) {
    multiplier *= diff.columns / safePerRow;
  }

  // Apply 3% house edge
  multiplier *= 0.97;
  return Math.round(multiplier * 100) / 100;
}

const activeGames = new Map();

function generateTraps(serverSeed, nonce, rows, columns, trapsPerRow) {
  const trapMap = [];
  for (let row = 0; row < rows; row++) {
    const rowTraps = new Set();
    let counter = 0;
    while (rowTraps.size < trapsPerRow) {
      const hash = crypto
        .createHmac('sha256', serverSeed)
        .update(`${nonce}:${row}:${counter}`)
        .digest('hex');
      const value = parseInt(hash.substring(0, 8), 16) % columns;
      rowTraps.add(value);
      counter++;
    }
    trapMap.push(Array.from(rowTraps));
  }
  return trapMap;
}

function createGame(userId, stake, difficulty) {
  const diff = DIFFICULTIES[difficulty];
  if (!diff) throw new Error('Invalid difficulty');

  const serverSeed = crypto.randomBytes(32).toString('hex');
  const nonce = Date.now().toString();
  const gameId = `tower_${userId}_${Date.now()}`;

  const trapMap = generateTraps(serverSeed, nonce, diff.rows, diff.columns, diff.traps);

  const game = {
    gameId,
    userId,
    stake,
    difficulty,
    columns: diff.columns,
    rows: diff.rows,
    trapsPerRow: diff.traps,
    trapMap,        // trapMap[row] = [trapColumnIndices]
    currentFloor: 0, // 0 = ground (no floor cleared yet)
    revealedTiles: [], // [{row, col}]
    status: 'active', // active | won | lost
    multiplier: 1,
    createdAt: Date.now(),
  };

  activeGames.set(gameId, game);

  // Auto-expire after 10 minutes
  setTimeout(() => activeGames.delete(gameId), 600000);

  return {
    gameId,
    columns: diff.columns,
    rows: diff.rows,
    trapsPerRow: diff.traps,
    difficulty,
    multiplier: 1,
    nextMultiplier: getMultiplier(difficulty, 1),
    currentFloor: 0,
  };
}

function climbFloor(gameId, column) {
  const game = activeGames.get(gameId);
  if (!game) throw new Error('Game not found or expired');
  if (game.status !== 'active') throw new Error('Game is not active');

  const targetRow = game.currentFloor; // next row to climb (0-indexed from bottom)
  if (targetRow >= game.rows) throw new Error('Already at the top');
  if (column < 0 || column >= game.columns) throw new Error('Invalid column');

  const isTrap = game.trapMap[targetRow].includes(column);

  game.revealedTiles.push({ row: targetRow, col: column });

  if (isTrap) {
    game.status = 'lost';
    game.multiplier = 0;
    activeGames.set(gameId, game);

    return {
      isTrap: true,
      row: targetRow,
      column,
      multiplier: 0,
      gameOver: true,
      currentFloor: game.currentFloor,
      trapMap: game.trapMap, // reveal all traps on loss
      payout: 0,
    };
  }

  game.currentFloor = targetRow + 1;
  game.multiplier = getMultiplier(game.difficulty, game.currentFloor);

  const reachedTop = game.currentFloor >= game.rows;

  if (reachedTop) {
    game.status = 'won';
    const payout = Math.round(game.stake * game.multiplier * 100) / 100;
    activeGames.set(gameId, game);

    return {
      isTrap: false,
      row: targetRow,
      column,
      multiplier: game.multiplier,
      gameOver: true,
      reachedTop: true,
      currentFloor: game.currentFloor,
      trapMap: game.trapMap,
      payout,
    };
  }

  const nextMultiplier = getMultiplier(game.difficulty, game.currentFloor + 1);
  activeGames.set(gameId, game);

  return {
    isTrap: false,
    row: targetRow,
    column,
    multiplier: game.multiplier,
    nextMultiplier,
    gameOver: false,
    currentFloor: game.currentFloor,
    payout: Math.round(game.stake * game.multiplier * 100) / 100,
  };
}

function cashout(gameId) {
  const game = activeGames.get(gameId);
  if (!game) throw new Error('Game not found or expired');
  if (game.status !== 'active') throw new Error('Game is not active');
  if (game.currentFloor === 0) throw new Error('Must climb at least one floor before cashing out');

  game.status = 'won';
  const payout = Math.round(game.stake * game.multiplier * 100) / 100;
  activeGames.set(gameId, game);

  return {
    payout,
    multiplier: game.multiplier,
    trapMap: game.trapMap,
    currentFloor: game.currentFloor,
  };
}

function getGame(gameId) {
  return activeGames.get(gameId);
}

module.exports = { createGame, climbFloor, cashout, getGame, activeGames, DIFFICULTIES, getMultiplier };
