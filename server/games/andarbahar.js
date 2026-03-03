const crypto = require('crypto');

const CARD_VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['hearts','diamonds','clubs','spades'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

function makeCard(cardIndex) {
  const value = CARD_VALUES[cardIndex % 13];
  const suit = SUITS[Math.floor(cardIndex / 13)];
  const numericValue = cardIndex % 13 + 2;
  return { value, suit, numericValue, display: `${value}${SUIT_SYMBOLS[suit]}` };
}

function play(stake, bet) {
  // bet: 'andar' | 'bahar'
  const seed = crypto.randomBytes(16).toString('hex');

  // Draw joker card
  const jokerHash = crypto.createHmac('sha256', seed).update('joker').digest('hex');
  const joker = makeCard(parseInt(jokerHash.slice(0, 8), 16) % 52);

  // Deal cards alternately (Andar first) until a card matching joker value appears
  const andarCards = [];
  const baharCards = [];
  let result = null;

  for (let i = 0; i < 52 && !result; i++) {
    const hash = crypto.createHmac('sha256', seed).update(`deal_${i}`).digest('hex');
    const card = makeCard(parseInt(hash.slice(0, 8), 16) % 52);
    const isAndar = i % 2 === 0; // Andar gets cards on even turns (0, 2, 4…)
    if (isAndar) andarCards.push(card);
    else baharCards.push(card);
    if (card.value === joker.value) {
      result = isAndar ? 'andar' : 'bahar';
    }
  }

  if (!result) result = 'andar'; // fallback

  const won = bet === result;
  const multiplier = won ? 1.9 : 0;

  return {
    joker,
    andarCards,
    baharCards,
    result,
    bet,
    won,
    multiplier,
    payout: won ? Math.round(stake * multiplier * 100) / 100 : 0,
    seed,
  };
}

module.exports = { play };
