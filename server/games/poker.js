const { createDeck, shuffle, cardString } = require('./utils/deck');

const HAND_RANKS = {
  ROYAL_FLUSH: { rank: 9, name: 'Royal Flush', payout: 800 },
  STRAIGHT_FLUSH: { rank: 8, name: 'Straight Flush', payout: 50 },
  FOUR_OF_A_KIND: { rank: 7, name: 'Four of a Kind', payout: 25 },
  FULL_HOUSE: { rank: 6, name: 'Full House', payout: 9 },
  FLUSH: { rank: 5, name: 'Flush', payout: 6 },
  STRAIGHT: { rank: 4, name: 'Straight', payout: 4 },
  THREE_OF_A_KIND: { rank: 3, name: 'Three of a Kind', payout: 3 },
  TWO_PAIR: { rank: 2, name: 'Two Pair', payout: 2 },
  JACKS_OR_BETTER: { rank: 1, name: 'Jacks or Better', payout: 1 },
  NO_WIN: { rank: 0, name: 'No Win', payout: 0 }
};

const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

function evaluateHand(cards) {
  const ranks = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => a - b);
  const suits = cards.map(c => c.suit);
  
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1) ||
    (ranks.join(',') === '2,3,4,5,14'); // Ace-low straight

  const rankCounts = {};
  ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  if (isFlush && isStraight && ranks[4] === 14 && ranks[0] === 10) return HAND_RANKS.ROYAL_FLUSH;
  if (isFlush && isStraight) return HAND_RANKS.STRAIGHT_FLUSH;
  if (counts[0] === 4) return HAND_RANKS.FOUR_OF_A_KIND;
  if (counts[0] === 3 && counts[1] === 2) return HAND_RANKS.FULL_HOUSE;
  if (isFlush) return HAND_RANKS.FLUSH;
  if (isStraight) return HAND_RANKS.STRAIGHT;
  if (counts[0] === 3) return HAND_RANKS.THREE_OF_A_KIND;
  if (counts[0] === 2 && counts[1] === 2) return HAND_RANKS.TWO_PAIR;
  if (counts[0] === 2) {
    const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2));
    if (pairRank >= 11) return HAND_RANKS.JACKS_OR_BETTER;
  }
  return HAND_RANKS.NO_WIN;
}

// In-memory store for active poker hands
const activePokerHands = new Map();

function deal(userId, stake) {
  const deck = shuffle(createDeck());
  const cards = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
  const handId = `pk_${userId}_${Date.now()}`;

  const hand = { handId, userId, deck, cards, stake, phase: 'deal', createdAt: Date.now() };
  activePokerHands.set(handId, hand);

  setTimeout(() => activePokerHands.delete(handId), 600000);

  return {
    handId,
    cards: cards.map(cardString),
    phase: 'deal',
    stake
  };
}

function draw(handId, holdIndices) {
  const hand = activePokerHands.get(handId);
  if (!hand) throw new Error('Hand not found or expired');
  if (hand.phase !== 'deal') throw new Error('Already drawn');

  // Replace non-held cards
  for (let i = 0; i < 5; i++) {
    if (!holdIndices.includes(i)) {
      hand.cards[i] = hand.deck.pop();
    }
  }

  hand.phase = 'complete';
  const result = evaluateHand(hand.cards);
  const payout = hand.stake * result.payout;

  activePokerHands.delete(handId);

  return {
    handId,
    cards: hand.cards.map(cardString),
    phase: 'complete',
    handName: result.name,
    handRank: result.rank,
    payout,
    stake: hand.stake
  };
}

module.exports = { deal, draw, evaluateHand, HAND_RANKS, activePokerHands };
