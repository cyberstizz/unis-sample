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
          .then(async (res) => {
            const profileData = res.data;
            try {
              const roleCheck = await axiosInstance.get('/v1/admin/roles');
              const myRole = roleCheck.data?.find(r => r.user?.userId === profileData.userId);
              profileData.adminRole = myRole ? myRole.roleLevel : null;
            } catch (e) {
              profileData.adminRole = null;
            }
            setUser(profileData);
          })
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
      const response = await axiosInstance.post('/api/auth/login', credentials);
      localStorage.setItem('token', response.data.token);
      // Decode for userId + fetch profile
      const userId = decodeToken(response.data.token);
      if (userId) {
        const profileRes = await axiosInstance.get(`/v1/users/profile/${userId}`);
        const profileData = profileRes.data;

        // Check for admin role
        try {
          const roleCheck = await axiosInstance.get('/v1/admin/roles');
          const myRole = roleCheck.data?.find(r => r.user?.userId === profileData.userId);
          profileData.adminRole = myRole ? myRole.roleLevel : null;
        } catch (e) {
          // 403 = not an admin, that's fine
          profileData.adminRole = null;
        }

        setUser(profileData);
        return { success: true };
      } else {
        throw new Error('Invalid token');
      }
    } catch (error) {
      localStorage.removeItem('token');
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