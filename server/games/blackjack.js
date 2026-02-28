const { createDeck, shuffle, handTotal, cardString } = require('./utils/deck');

// In-memory store for active hands
const activeHands = new Map();

function startHand(userId, stake) {
  const deck = shuffle(createDeck(6));
  const playerCards = [deck.pop(), deck.pop()];
  const dealerCards = [deck.pop(), deck.pop()];

  const handId = `bj_${userId}_${Date.now()}`;
  const playerTotal = handTotal(playerCards);
  const dealerTotal = handTotal(dealerCards);

  let status = 'playing';
  let result = null;

  // Check for blackjack
  if (playerTotal === 21) {
    if (dealerTotal === 21) {
      status = 'settled';
      result = 'push';
    } else {
      status = 'settled';
      result = 'blackjack';
    }
  }

  const hand = {
    handId,
    userId,
    deck,
    playerCards,
    dealerCards,
    playerTotal,
    dealerTotal: handTotal([dealerCards[0]]), // Only show first card value
    stake,
    status,
    result,
    doubledDown: false,
    createdAt: Date.now()
  };

  activeHands.set(handId, hand);

  // Auto-clean old hands after 10 minutes
  setTimeout(() => activeHands.delete(handId), 600000);

  return formatHand(hand, status !== 'settled');
}

function playerAction(handId, action) {
  const hand = activeHands.get(handId);
  if (!hand) throw new Error('Hand not found or expired');
  if (hand.status !== 'playing') throw new Error('Hand is not active');

  switch (action) {
    case 'hit':
      hand.playerCards.push(hand.deck.pop());
      hand.playerTotal = handTotal(hand.playerCards);
      if (hand.playerTotal > 21) {
        hand.status = 'settled';
        hand.result = 'bust';
      } else if (hand.playerTotal === 21) {
        return finishDealerTurn(hand);
      }
      break;

    case 'stand':
      return finishDealerTurn(hand);

    case 'double':
      if (hand.playerCards.length !== 2) throw new Error('Can only double on first two cards');
      hand.doubledDown = true;
      hand.stake *= 2;
      hand.playerCards.push(hand.deck.pop());
      hand.playerTotal = handTotal(hand.playerCards);
      if (hand.playerTotal > 21) {
        hand.status = 'settled';
        hand.result = 'bust';
      } else {
        return finishDealerTurn(hand);
      }
      break;

    default:
      throw new Error('Invalid action');
  }

  activeHands.set(handId, hand);
  return formatHand(hand, hand.status !== 'settled');
}

function finishDealerTurn(hand) {
  hand.dealerTotal = handTotal(hand.dealerCards);

  // Dealer draws until 17+
  while (hand.dealerTotal < 17) {
    hand.dealerCards.push(hand.deck.pop());
    hand.dealerTotal = handTotal(hand.dealerCards);
  }

  // Determine result
  if (hand.dealerTotal > 21) {
    hand.result = 'dealer_bust';
  } else if (hand.playerTotal > hand.dealerTotal) {
    hand.result = 'win';
  } else if (hand.playerTotal < hand.dealerTotal) {
    hand.result = 'lose';
  } else {
    hand.result = 'push';
  }

  hand.status = 'settled';
  activeHands.set(hand.handId, hand);
  return formatHand(hand, false);
}

function calculatePayout(hand) {
  switch (hand.result) {
    case 'blackjack': return hand.stake * 2.5; // 3:2
    case 'win':
    case 'dealer_bust': return hand.stake * 2;
    case 'push': return hand.stake; // Money back
    default: return 0;
  }
}

function formatHand(hand, hideDealerCard) {
  return {
    handId: hand.handId,
    playerCards: hand.playerCards.map(cardString),
    dealerCards: hideDealerCard
      ? [cardString(hand.dealerCards[0]), '??']
      : hand.dealerCards.map(cardString),
    playerTotal: hand.playerTotal,
    dealerTotal: hideDealerCard ? handTotal([hand.dealerCards[0]]) : handTotal(hand.dealerCards),
    stake: hand.stake,
    status: hand.status,
    result: hand.result,
    payout: hand.status === 'settled' ? calculatePayout(hand) : null,
    doubledDown: hand.doubledDown,
    canDouble: hand.playerCards.length === 2 && hand.status === 'playing',
    canHit: hand.status === 'playing' && hand.playerTotal < 21
  };
}

module.exports = { startHand, playerAction, activeHands };
