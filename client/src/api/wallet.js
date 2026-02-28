import api from './axios';

export const getBalance = () => api.get('/wallet/balance');
export const deposit = (amount) => api.post('/wallet/deposit', { amount });
export const withdraw = (amount) => api.post('/wallet/withdraw', { amount });
export const getTransactions = (params) => api.get('/wallet/transactions', { params });
