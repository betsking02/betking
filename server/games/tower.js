const crypto = require('crypto');

// Difficulty: risk level determines collapse chance per floor
const DIFFICULTIES = {
  easy:   { collapseChance: 0.15, maxFloors: 15, label: 'Easy' },   // 15% per floor
  medium: { collapseChance: 0.25, maxFloors: 12, label: 'Medium' }, // 25% per floor
  hard:   { collapseChance: 0.40, maxFloors: 10, label: 'Hard' },   // 40% per floor
};

// Get multiplier for a given floor (compound growth with house edge)
function getMultiplier(difficulty, floor) {
  if (floor <= 0) return 1;
  const diff = DIFFICULTIES[difficulty];
  const survivalRate = 1 - diff.collapseChance;
  // Fair multiplier = 1 / survivalRate^floor, with 3% house edge
  let multiplier = Math.pow(1 / survivalRate, floor) * 0.97;
  return Math.round(multiplier * 100) / 100;
}

const activeGames = new Map();

// Pre-determine which floor the building collapses on
function generateCollapseFloor(serverSeed, nonce, difficulty) {
  const diff = DIFFICULTIES[difficulty];
  // Simulate each floor to find where collapse happens
  for (let floor = 1; floor <= diff.maxFloors; floor++) {
    const hash = crypto
      .createHmac('sha256', serverSeed)
      .update(`${nonce}:floor:${floor}`)
      .digest('hex');
    const value = parseInt(hash.substring(0, 8), 16) / 0xFFFFFFFF; // 0 to 1
    if (value < diff.collapseChance) {
      return floor; // Building collapses when trying to build this floor
    }
  }
  // Survived all floors — collapse after max
  return diff.maxFloors + 1;
}

function createGame(userId, stake, difficulty) {
  const diff = DIFFICULTIES[difficulty];
  if (!diff) throw new Error('Invalid difficulty');

  const serverSeed = crypto.randomBytes(32).toString('hex');
  const nonce = Date.now().toString();
  const gameId = `tower_${userId}_${Date.now()}`;

  const collapseFloor = generateCollapseFloor(serverSeed, nonce, difficulty);

  const game = {
    gameId,
    userId,
    stake,
    difficulty,
    maxFloors: diff.maxFloors,
    collapseFloor,    // building collapses when trying to build this floor
    currentFloor: 0,  // 0 = no floors built yet
    status: 'active', // active | won | lost
    multiplier: 1,
    createdAt: Date.now(),
  };

  activeGames.set(gameId, game);
  setTimeout(() => activeGames.delete(gameId), 600000);

  return {
    gameId,
    difficulty,
    maxFloors: diff.maxFloors,
    multiplier: 1,
    nextMultiplier: getMultiplier(difficulty, 1),
    currentFloor: 0,
  };
}

function build(gameId) {
  const game = activeGames.get(gameId);
  if (!game) throw new Error('Game not found or expired');
  if (game.status !== 'active') throw new Error('Game is not active');

  const targetFloor = game.currentFloor + 1;

  // Check if building collapses on this floor
  if (targetFloor >= game.collapseFloor) {
    game.status = 'lost';
    game.multiplier = 0;
    activeGames.set(gameId, game);

    return {
      collapsed: true,
      floor: targetFloor,
      collapseFloor: game.collapseFloor,
      multiplier: 0,
      gameOver: true,
      currentFloor: game.currentFloor,
      payout: 0,
    };
  }

  // Floor built successfully
  game.currentFloor = targetFloor;
  game.multiplier = getMultiplier(game.difficulty, game.currentFloor);

  const reachedTop = game.currentFloor >= game.maxFloors;

  if (reachedTop) {
    game.status = 'won';
    const payout = Math.round(game.stake * game.multiplier * 100) / 100;
    activeGames.set(gameId, game);

    return {
      collapsed: false,
      floor: targetFloor,
      multiplier: game.multiplier,
      gameOver: true,
      reachedTop: true,
      currentFloor: game.currentFloor,
      payout,
    };
  }

  const nextMultiplier = getMultiplier(game.difficulty, game.currentFloor + 1);
  activeGames.set(gameId, game);

  return {
    collapsed: false,
    floor: targetFloor,
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
  if (game.currentFloor === 0) throw new Error('Must build at least one floor before cashing out');

  game.status = 'won';
  const payout = Math.round(game.stake * game.multiplier * 100) / 100;
  activeGames.set(gameId, game);

  return {
    payout,
    multiplier: game.multiplier,
    currentFloor: game.currentFloor,
    collapseFloor: game.collapseFloor,
  };
}

function getGame(gameId) {
  return activeGames.get(gameId);
}

module.exports = { createGame, build, cashout, getGame, activeGames, DIFFICULTIES, getMultiplier };
