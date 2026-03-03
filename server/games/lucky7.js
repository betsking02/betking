const crypto = require('crypto');

// A=1, 2-10 face, J=11, Q=12, K=13
const CARD_VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_NUMERIC = { A:1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, J:11, Q:12, K:13 };
const SUITS = ['hearts','diamonds','clubs','spades'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

function play(stake, bet) {
  // bet: 'under' | 'lucky7' | 'over'
  const seed = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', seed).update('card').digest('hex');
  const cardIndex = parseInt(hash.slice(0, 8), 16) % 52;
  const valueIndex = cardIndex % 13;
  const suitIndex = Math.floor(cardIndex / 13);
  const value = CARD_VALUES[valueIndex];
  const suit = SUITS[suitIndex];
  const numericValue = CARD_NUMERIC[value];

  let result;
  if (numericValue < 7) result = 'under';
  else if (numericValue === 7) result = 'lucky7';
  else result = 'over';

  const won = bet === result;
  // Under/Over: 6/13 chance → 1.94x | Lucky 7: 1/13 chance → 11x
  const multiplier = won ? (bet === 'lucky7' ? 11 : 1.94) : 0;

  return {
    card: { value, suit, numericValue, display: `${value}${SUIT_SYMBOLS[suit]}` },
    result,
    bet,
    won,
    multiplier,
    payout: won ? Math.round(stake * multiplier * 100) / 100 : 0,
    seed,
  };
}

module.exports = { play };
