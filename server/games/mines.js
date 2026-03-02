const crypto = require('crypto');

const DIFFICULTIES = {
  easy:   { mines: 3,  gridSize: 25, label: 'Easy' },
  medium: { mines: 5,  gridSize: 25, label: 'Medium' },
  hard:   { mines: 7,  gridSize: 25, label: 'Hard' },
};

// In-memory store for active games
const activeGames = new Map();

function generateMinePositions(serverSeed, nonce, mineCount, gridSize) {
  const positions = new Set();
  let counter = 0;

  while (positions.size < mineCount) {
    const hash = crypto
      .createHmac('sha256', serverSeed)
      .update(`${nonce}:${counter}`)
      .digest('hex');
    const value = parseInt(hash.substring(0, 8), 16) % gridSize;
    positions.add(value);
    counter++;
  }

  return Array.from(positions);
}

function calculateMultiplier(mineCount, gridSize, revealedCount) {
  if (revealedCount === 0) return 1;

  const safeTiles = gridSize - mineCount;
  let multiplier = 1;

  for (let i = 0; i < revealedCount; i++) {
    const remaining = gridSize - i;
    const safeRemaining = safeTiles - i;
    multiplier *= remaining / safeRemaining;
  }

  // Apply 3% house edge
  multiplier *= 0.97;

  return Math.round(multiplier * 100) / 100;
}

function createGame(userId, stake, difficulty) {
  const diff = DIFFICULTIES[difficulty];
  if (!diff) throw new Error('Invalid difficulty');

  const serverSeed = crypto.randomBytes(32).toString('hex');
  const nonce = Date.now().toString();
  const gameId = `mines_${userId}_${Date.now()}`;

  const minePositions = generateMinePositions(serverSeed, nonce, diff.mines, diff.gridSize);

  const game = {
    gameId,
    userId,
    stake,
    difficulty,
    mineCount: diff.mines,
    gridSize: diff.gridSize,
    minePositions,
    revealedTiles: [],
    status: 'active', // active | won | lost
    multiplier: 1,
    createdAt: Date.now(),
  };

  activeGames.set(gameId, game);

  // Auto-expire after 10 minutes
  setTimeout(() => activeGames.delete(gameId), 600000);

  return {
    gameId,
    gridSize: diff.gridSize,
    mineCount: diff.mines,
    difficulty,
    multiplier: 1,
  };
}

function revealTile(gameId, tileIndex) {
  const game = activeGames.get(gameId);
  if (!game) throw new Error('Game not found or expired');
  if (game.status !== 'active') throw new Error('Game is not active');
  if (tileIndex < 0 || tileIndex >= game.gridSize) throw new Error('Invalid tile index');
  if (game.revealedTiles.includes(tileIndex)) throw new Error('Tile already revealed');

  const isMine = game.minePositions.includes(tileIndex);

  if (isMine) {
    game.status = 'lost';
    game.multiplier = 0;
    activeGames.set(gameId, game);

    return {
      isMine: true,
      tileIndex,
      multiplier: 0,
      gameOver: true,
      revealedTiles: game.revealedTiles,
      minePositions: game.minePositions,
      payout: 0,
    };
  }

  game.revealedTiles.push(tileIndex);
  game.multiplier = calculateMultiplier(game.mineCount, game.gridSize, game.revealedTiles.length);

  const safeTiles = game.gridSize - game.mineCount;
  const allRevealed = game.revealedTiles.length >= safeTiles;

  if (allRevealed) {
    game.status = 'won';
    activeGames.set(gameId, game);

    return {
      isMine: false,
      tileIndex,
      multiplier: game.multiplier,
      gameOver: true,
      allRevealed: true,
      revealedTiles: game.revealedTiles,
      minePositions: game.minePositions,
      payout: Math.round(game.stake * game.multiplier * 100) / 100,
    };
  }

  // Calculate next multiplier for preview
  const nextMultiplier = calculateMultiplier(game.mineCount, game.gridSize, game.revealedTiles.length + 1);

  activeGames.set(gameId, game);

  return {
    isMine: false,
    tileIndex,
    multiplier: game.multiplier,
    nextMultiplier,
    gameOver: false,
    revealedTiles: game.revealedTiles,
    payout: Math.round(game.stake * game.multiplier * 100) / 100,
  };
}

function cashout(gameId) {
  const game = activeGames.get(gameId);
  if (!game) throw new Error('Game not found or expired');
  if (game.status !== 'active') throw new Error('Game is not active');
  if (game.revealedTiles.length === 0) throw new Error('Must reveal at least one tile before cashing out');

  game.status = 'won';
  const payout = Math.round(game.stake * game.multiplier * 100) / 100;

  activeGames.set(gameId, game);

  return {
    payout,
    multiplier: game.multiplier,
    minePositions: game.minePositions,
    revealedTiles: game.revealedTiles,
  };
}

function getGame(gameId) {
  return activeGames.get(gameId);
}

module.exports = { createGame, revealTile, cashout, getGame, activeGames, DIFFICULTIES, calculateMultiplier };
