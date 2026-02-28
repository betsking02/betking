const crypto = require('crypto');

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function getColor(number) {
  if (number === 0) return 'green';
  return RED_NUMBERS.includes(number) ? 'red' : 'black';
}

const BET_TYPES = {
  straight: { payout: 35, check: (bet, num) => num === bet.number },
  split: { payout: 17, check: (bet, num) => bet.numbers.includes(num) },
  street: { payout: 11, check: (bet, num) => bet.numbers.includes(num) },
  corner: { payout: 8, check: (bet, num) => bet.numbers.includes(num) },
  line: { payout: 5, check: (bet, num) => bet.numbers.includes(num) },
  column: { payout: 2, check: (bet, num) => {
    if (num === 0) return false;
    return (num % 3 === bet.column % 3) || (bet.column === 3 && num % 3 === 0);
  }},
  dozen: { payout: 2, check: (bet, num) => {
    if (num === 0) return false;
    const dozen = Math.ceil(num / 12);
    return dozen === bet.dozen;
  }},
  red: { payout: 1, check: (bet, num) => RED_NUMBERS.includes(num) },
  black: { payout: 1, check: (bet, num) => BLACK_NUMBERS.includes(num) },
  odd: { payout: 1, check: (bet, num) => num !== 0 && num % 2 === 1 },
  even: { payout: 1, check: (bet, num) => num !== 0 && num % 2 === 0 },
  low: { payout: 1, check: (bet, num) => num >= 1 && num <= 18 },
  high: { payout: 1, check: (bet, num) => num >= 19 && num <= 36 },
};

function spinRoulette(bets) {
  const winningNumber = crypto.randomInt(0, 37); // 0-36
  const color = getColor(winningNumber);

  const results = bets.map(bet => {
    const betType = BET_TYPES[bet.type];
    if (!betType) return { ...bet, won: false, payout: 0 };

    const won = betType.check(bet, winningNumber);
    const payout = won ? bet.stake + (bet.stake * betType.payout) : 0;

    return { ...bet, won, payout: Math.round(payout * 100) / 100 };
  });

  const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);

  return {
    winningNumber,
    color,
    results,
    totalStake,
    totalPayout,
    netWin: Math.round((totalPayout - totalStake) * 100) / 100
  };
}

module.exports = { spinRoulette, getColor, RED_NUMBERS, BLACK_NUMBERS, BET_TYPES };
