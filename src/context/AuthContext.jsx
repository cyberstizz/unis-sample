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

  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])); 
      return payload.userId;  
    } catch (e) {
      console.error('Token decode failed', e);
      return null;
    }
  };

  // On mount, check token + fetch profile if present
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const userId = decodeToken(token);
      if (userId) {
        axiosInstance.get(`/v1/users/profile/${userId}`)  
          .then((res) => setUser(res.data))
          .catch((err) => {
            if (err.response?.status === 401 || err.response?.status === 404) {
              localStorage.removeItem('token');  
            }
          })
          .finally(() => setLoading(false));
      } else {
        localStorage.removeItem('token');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    try {
      const response = await axiosInstance.post('/auth/login', credentials);
      localStorage.setItem('token', response.data.token);
      // Decode for userId + fetch profile
      const userId = decodeToken(response.data.token);
      if (userId) {
        const profileRes = await axiosInstance.get(`/v1/users/profile/${userId}`);
        setUser(profileRes.data);
        return { success: true };
      } else {
        throw new Error('Invalid token');
      }
    } catch (error) {
      localStorage.removeItem('token');  // Clean up on fail
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