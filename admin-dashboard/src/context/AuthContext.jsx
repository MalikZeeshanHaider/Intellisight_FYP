import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../api/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore session by asking the backend who owns the cookie.
  useEffect(() => {
    authAPI.getMe()
      .then((res) => setUser(res.data?.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      const { admin } = response.data;
      setUser(admin);
      return { success: true, user: admin };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
    window.location.href = '/login';
  };

  /**
   * Check if the current user has a specific permission key.
   * SuperAdmin (permissions === ['*']) always returns true.
   */
  const hasPermission = useCallback((key) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes(key);
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0e27' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
