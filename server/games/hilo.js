const crypto = require('crypto');

const activeGames = new Map();

const CARD_VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['hearts','diamonds','clubs','spades'];

function randomCard(seed, index) {
  const hash = crypto.createHmac('sha256', seed).update(`card_${index}`).digest('hex');
  const cardIdx = parseInt(hash.substring(0, 8), 16) % 52;
  const valueIdx = cardIdx % 13;
  const suitIdx = Math.floor(cardIdx / 13);
  return {
    value: CARD_VALUES[valueIdx],
    suit: SUITS[suitIdx],
    numericValue: valueIdx + 2, // 2=2, 3=3, ..., 14=Ace
    display: `${CARD_VALUES[valueIdx]}${suitIdx === 0 ? '♥' : suitIdx === 1 ? '♦' : suitIdx === 2 ? '♣' : '♠'}`,
  };
}

function startGame(userId, stake) {
  const seed = crypto.randomBytes(32).toString('hex');
  const gameId = `hilo_${userId}_${Date.now()}`;
  const firstCard = randomCard(seed, 0);

  const game = {
    gameId,
    userId,
    stake,
    seed,
    cardIndex: 1,
    currentCard: firstCard,
    history: [firstCard],
    streak: 0,
    multiplier: 1,
    status: 'active',
    createdAt: Date.now(),
  };

  activeGames.set(gameId, game);
  setTimeout(() => activeGames.delete(gameId), 600000);

  return {
    gameId,
    currentCard: firstCard,
    streak: 0,
    multiplier: 1,
  };
}

function guess(gameId, direction) {
  const game = activeGames.get(gameId);
  if (!game) throw new Error('Game not found or expired');
  if (game.status !== 'active') throw new Error('Game is not active');
  if (direction !== 'higher' && direction !== 'lower') throw new Error('Guess must be higher or lower');

  const nextCard = randomCard(game.seed, game.cardIndex);
  game.cardIndex++;

  const currentVal = game.currentCard.numericValue;
  const nextVal = nextCard.numericValue;

  let won;
  if (nextVal === currentVal) {
    // Tie = lose (like hitting the edge)
    won = false;
  } else if (direction === 'higher') {
    won = nextVal > currentVal;
  } else {
    won = nextVal < currentVal;
  }

  game.history.push(nextCard);
  game.currentCard = nextCard;

  if (!won) {
    game.status = 'lost';
    game.multiplier = 0;
    activeGames.set(gameId, game);

    return {
      won: false,
      card: nextCard,
      previousCard: game.history[game.history.length - 2],
      streak: game.streak,
      multiplier: 0,
      gameOver: true,
      payout: 0,
      history: game.history,
    };
  }

  game.streak++;

  // Multiplier based on probability of correct guess
  // Higher card from 2: 12/13 chance → low multi. From K: 1/13 chance → high multi
  const higherChance = (14 - currentVal) / 13;
  const lowerChance = (currentVal - 2) / 13;
  const guessChance = direction === 'higher' ? higherChance : lowerChance;
  const stepMulti = Math.max(1.05, Math.round((0.97 / guessChance) * 100) / 100);
  game.multiplier = Math.round(game.multiplier * stepMulti * 100) / 100;

  activeGames.set(gameId, game);

  // Calculate next guess probabilities for UI
  const nextHigherChance = Math.round(((14 - nextVal) / 13) * 100);
  const nextLowerChance = Math.round(((nextVal - 2) / 13) * 100);

  return {
    won: true,
    card: nextCard,
    previousCard: game.history[game.history.length - 2],
    streak: game.streak,
    multiplier: game.multiplier,
    gameOver: false,
    payout: Math.round(game.stake * game.multiplier * 100) / 100,
    history: game.history,
    nextHigherChance,
    nextLowerChance,
  };
}

function cashout(gameId) {
  const game = activeGames.get(gameId);
  if (!game) throw new Error('Game not found or expired');
  if (game.status !== 'active') throw new Error('Game is not active');
  if (game.streak === 0) throw new Error('Must win at least one round before cashing out');

  game.status = 'won';
  const payout = Math.round(game.stake * game.multiplier * 100) / 100;
  activeGames.set(gameId, game);

  return {
    payout,
    multiplier: game.multiplier,
    streak: game.streak,
    history: game.history,
  };
}

function getGame(gameId) {
  return activeGames.get(gameId);
}

module.exports = { startGame, guess, cashout, getGame, activeGames };
