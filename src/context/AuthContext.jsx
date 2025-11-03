import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../components/axiosInstance';  

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axiosInstance.get('/v1/users/profile')
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token'); 
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    try {
      const response = await axiosInstance.post('/auth/login', credentials);
      localStorage.setItem('token', response.data.token);
      // Fetch profile for full user data
      const profileRes = await axiosInstance.get('/v1/users/profile');
      setUser(profileRes.data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data || 'Login failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';  // Or use navigate
  };

  const value = { user, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};