export const SPORT_ICONS = {
  cricket: '🏏',
  football: '⚽',
  tennis: '🎾',
  basketball: '🏀',
  kabaddi: '🤼'
};

export const SPORT_NAMES = {
  cricket: 'Cricket',
  football: 'Football',
  tennis: 'Tennis',
  basketball: 'Basketball',
  kabaddi: 'Kabaddi'
};

export const CASINO_GAMES = [
  { id: 'slots', name: 'Lucky Slots', icon: '🎰', path: '/casino/slots', color: '#ffd700', description: 'Spin to win!' },
  { id: 'roulette', name: 'Roulette', icon: '🎡', path: '/casino/roulette', color: '#ff4444', description: 'European Roulette' },
  { id: 'blackjack', name: 'Blackjack', icon: '🃏', path: '/casino/blackjack', color: '#00e701', description: '21 wins!' },
  { id: 'poker', name: 'Video Poker', icon: '♠️', path: '/casino/poker', color: '#1da1f2', description: 'Jacks or Better' },
  { id: 'aviator', name: 'Aviator', icon: '✈️', path: '/casino/aviator', color: '#ff6b00', description: 'Cash out before it flies away!' },
  { id: 'crash', name: 'Crash', icon: '📈', path: '/casino/crash', color: '#ff6b00', description: 'Cash out before crash!' },
  { id: 'color', name: 'Color Prediction', icon: '🔴', path: '/casino/color-prediction', color: '#9b59b6', description: 'Predict the color' },
  { id: 'mines', name: 'Mines', icon: '💣', path: '/casino/mines', color: '#e67e22', description: 'Find gems, avoid mines!' },
  { id: 'dice', name: 'Dice Roll', icon: '🎲', path: '/casino/dice', color: '#3498db', description: 'Over or under?' },
  { id: 'plinko', name: 'Plinko', icon: '📍', path: '/casino/plinko', color: '#9b59b6', description: 'Watch it drop!' },
  { id: 'coinflip', name: 'Coin Flip', icon: '🪙', path: '/casino/coinflip', color: '#f39c12', description: 'Heads or tails?' },
  { id: 'hilo', name: 'Hi-Lo', icon: '🃏', path: '/casino/hilo', color: '#2ecc71', description: 'Higher or lower?' },
  { id: 'dragontiger', name: 'Dragon vs Tiger', icon: '🐉', path: '/casino/dragontiger', color: '#e74c3c', description: 'Dragon or Tiger wins?' },
  { id: 'lucky7', name: 'Lucky 7', icon: '7️⃣', path: '/casino/lucky7', color: '#f1c40f', description: 'Under, Lucky 7, or Over?' },
  { id: 'andarbahar', name: 'Andar Bahar', icon: '🎴', path: '/casino/andarbahar', color: '#1abc9c', description: 'Classic Indian card game!' },
  { id: 'tower', name: 'Tower Rush', icon: '🏗️', path: '/casino/tower', color: '#f5a623', description: 'Build high, cash out before it falls!' },
];

export const BET_AMOUNTS = [100, 500, 1000, 5000, 10000];

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatOdds = (odds) => {
  return odds?.toFixed(2) || '-';
};

export const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};
