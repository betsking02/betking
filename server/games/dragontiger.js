const crypto = require('crypto');

const CARD_VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['hearts','diamonds','clubs','spades'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

function drawCard(seed, index) {
  const hash = crypto.createHmac('sha256', seed).update(`card_${index}`).digest('hex');
  const cardIndex = parseInt(hash.slice(0, 8), 16) % 52;
  const valueIndex = cardIndex % 13;
  const suitIndex = Math.floor(cardIndex / 13);
  const value = CARD_VALUES[valueIndex];
  const suit = SUITS[suitIndex];
  const numericValue = valueIndex + 2; // 2–14, Ace=14
  return { value, suit, numericValue, display: `${value}${SUIT_SYMBOLS[suit]}` };
}

function play(stake, bet) {
  // bet: 'dragon' | 'tiger' | 'tie'
  const seed = crypto.randomBytes(16).toString('hex');
  const dragon = drawCard(seed, 0);
  const tiger = drawCard(seed, 1);

  let result;
  if (dragon.numericValue > tiger.numericValue) result = 'dragon';
  else if (tiger.numericValue > dragon.numericValue) result = 'tiger';
  else result = 'tie';

  const won = bet === result;
  const multiplier = won ? (bet === 'tie' ? 8 : 1.94) : 0;

  return {
    dragon,
    tiger,
    result,
    bet,
    won,
    multiplier,
    payout: won ? Math.round(stake * multiplier * 100) / 100 : 0,
    seed,
  };
}

function generateRound() {
  const seed = crypto.randomBytes(16).toString('hex');
  const dragon = drawCard(seed, 0);
  const tiger = drawCard(seed, 1);

  let result;
  if (dragon.numericValue > tiger.numericValue) result = 'dragon';
  else if (tiger.numericValue > dragon.numericValue) result = 'tiger';
  else result = 'tie';

  return { dragon, tiger, result, seed };
}

module.exports = { play, generateRound };
