import api from './axios';

export const placeBet = (data) => api.post('/bets', data);
export const getBetHistory = (params) => api.get('/bets/history', { params });
export const getActiveBets = () => api.get('/bets/active');
export const getBet = (id) => api.get(`/bets/${id}`);
