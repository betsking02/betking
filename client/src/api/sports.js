import api from './axios';

export const getSports = () => api.get('/sports');
export const getMatchesBySport = (sportKey) => api.get(`/sports/${sportKey}/matches`);
export const getAllMatches = (params) => api.get('/sports/matches/all', { params });
export const getLiveMatches = () => api.get('/sports/matches/live');
export const getFeaturedMatches = () => api.get('/sports/matches/featured');
export const getMatch = (id) => api.get(`/sports/matches/${id}`);
