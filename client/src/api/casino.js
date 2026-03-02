import api from './axios';

export const spinSlots = (stake) => api.post('/casino/slots/spin', { stake });
export const spinRoulette = (bets) => api.post('/casino/roulette/spin', { bets });
export const startBlackjack = (stake) => api.post('/casino/blackjack/start', { stake });
export const blackjackAction = (handId, action) => api.post('/casino/blackjack/action', { handId, action });
export const dealPoker = (stake) => api.post('/casino/poker/deal', { stake });
export const drawPoker = (handId, holdIndices) => api.post('/casino/poker/draw', { handId, holdIndices });
export const startMines = (stake, difficulty) => api.post('/casino/mines/start', { stake, difficulty });
export const revealMine = (gameId, tileIndex) => api.post('/casino/mines/reveal', { gameId, tileIndex });
export const cashoutMines = (gameId) => api.post('/casino/mines/cashout', { gameId });
export const rollDice = (stake, target, direction) => api.post('/casino/dice/roll', { stake, target, direction });
export const dropPlinko = (stake) => api.post('/casino/plinko/drop', { stake });
export const flipCoin = (stake, choice) => api.post('/casino/coinflip/flip', { stake, choice });
export const startHiLo = (stake) => api.post('/casino/hilo/start', { stake });
export const guessHiLo = (gameId, direction) => api.post('/casino/hilo/guess', { gameId, direction });
export const cashoutHiLo = (gameId) => api.post('/casino/hilo/cashout', { gameId });
export const getCasinoHistory = (params) => api.get('/casino/history', { params });
