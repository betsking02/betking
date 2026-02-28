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
  { id: 'crash', name: 'Crash', icon: '📈', path: '/casino/crash', color: '#ff6b00', description: 'Cash out before crash!' },
  { id: 'color', name: 'Color Prediction', icon: '🔴', path: '/casino/color-prediction', color: '#9b59b6', description: 'Predict the color' },
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
