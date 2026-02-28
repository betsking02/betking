import { createContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('betking_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authApi.getMe()
        .then(res => setUser(res.data.user))
        .catch(() => { logout(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const saveAuth = useCallback((data) => {
    localStorage.setItem('betking_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const loginUser = useCallback(async (username, password) => {
    const res = await authApi.login({ username, password });
    saveAuth(res.data);
    return res.data;
  }, [saveAuth]);

  const registerUser = useCallback(async (data) => {
    const res = await authApi.register(data);
    saveAuth(res.data);
    return res.data;
  }, [saveAuth]);

  const demoLogin = useCallback(async () => {
    const res = await authApi.demoLogin();
    saveAuth(res.data);
    return res.data;
  }, [saveAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('betking_token');
    setToken(null);
    setUser(null);
  }, []);

  const updateBalance = useCallback((newBalance) => {
    setUser(prev => prev ? { ...prev, balance: newBalance } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, registerUser, demoLogin, logout, updateBalance }}>
      {children}
    </AuthContext.Provider>
  );
}
