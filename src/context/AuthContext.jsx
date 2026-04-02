import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../components/axiosInstance';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const VALID_THEMES = ['blue', 'orange', 'red', 'green', 'purple', 'yellow', 'dianna'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState('blue');

  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId;
    } catch (e) {
      console.error('Token decode failed', e);
      return null;
    }
  };

  // Apply theme to the DOM root
  const applyTheme = (themeName) => {
    const validated = VALID_THEMES.includes(themeName) ? themeName : 'blue';
    document.getElementById('root')?.setAttribute('data-theme', validated);
    setThemeState(validated);
  };

  // Save theme to backend + apply locally
  const setTheme = async (themeName, userId) => {
    applyTheme(themeName);
    try {
      await axiosInstance.put(`/v1/users/profile/${userId}`, {
        themePreference: themeName
      });
      setUser(prev => prev ? { ...prev, themePreference: themeName } : prev);
    } catch (err) {
      console.error('Failed to save theme preference:', err);
      // Theme still applied locally even if save fails
    }
  };

  // On mount, check token + fetch profile
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const userId = decodeToken(token);
      if (userId) {
        axiosInstance.get(`/v1/users/profile/${userId}`)
          .then(async (res) => {
            const profileData = res.data;

            // Apply saved theme preference
            if (profileData.themePreference) {
              applyTheme(profileData.themePreference);
            }

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
      const response = await axiosInstance.post('/auth/login', credentials);
      localStorage.setItem('token', response.data.token);
      const userId = decodeToken(response.data.token);
      if (userId) {
        const profileRes = await axiosInstance.get(`/v1/users/profile/${userId}`);
        const profileData = profileRes.data;

        // Apply saved theme on login
        if (profileData.themePreference) {
          applyTheme(profileData.themePreference);
        }

        try {
          const roleCheck = await axiosInstance.get('/v1/admin/roles');
          const myRole = roleCheck.data?.find(r => r.user?.userId === profileData.userId);
          profileData.adminRole = myRole ? myRole.roleLevel : null;
        } catch (e) {
          profileData.adminRole = null;
        }

        setUser(profileData);
        return { success: true };
      } else {
        throw new Error('Invalid token');
      }
    } catch (error) {
      localStorage.removeItem('token');
      return {
         success: false,
         error: typeof error.response?.data === 'string' ? error.response.data : error.response?.data?.message || 'Login failed',
        data: error.response?.data, };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    applyTheme('blue'); // Reset to default on logout
    window.location.href = '/login';
  };

  const value = { user, login, logout, loading, theme, setTheme };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};