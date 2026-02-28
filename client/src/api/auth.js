import api from './axios';

export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const demoLogin = () => api.post('/auth/demo-login');
export const getMe = () => api.get('/auth/me');
export const verifyEmail = (data) => api.post('/auth/verify', data);
export const resendCode = (data) => api.post('/auth/resend-code', data);
