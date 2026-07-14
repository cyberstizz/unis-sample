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
  const [authLoaded, setAuthLoaded] = useState(false);
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
    localStorage.setItem('unis-theme', validated);
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
    }
  };

  // On mount, apply cached theme immediately (before profile loads)
  // This prevents the blue flash on page reload/login
  useEffect(() => {
    // ★ FIX (feed #2 — "the last user's theme colour persists after sign-out"):
    //   This used to re-apply the cached theme unconditionally on every mount.
    //   Since logout never cleared `unis-theme`, a signed-out visitor kept the
    //   previous user's --unis-primary. The header papered over it (it forces
    //   the blue logo for guests) but the page body stayed themed — exactly the
    //   mismatch the user describes. Only restore a cached theme if there is
    //   actually a session to restore it for.
    const hasSession = !!localStorage.getItem('token');
    const cached = localStorage.getItem('unis-theme');

    if (hasSession && cached && VALID_THEMES.includes(cached)) {
      document.getElementById('root')?.setAttribute('data-theme', cached);
      setThemeState(cached);
    } else {
      // Guest: hard-reset to the default brand theme.
      localStorage.removeItem('unis-theme');
      document.getElementById('root')?.setAttribute('data-theme', 'blue');
      setThemeState('blue');
    }
  }, []);

  // On mount, check token + fetch profile OR enter guest mode
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const userId = decodeToken(token);
      if (userId) {
        axiosInstance.get(`/v1/users/profile/${userId}`, { useCache: false })
          .then(async (res) => {
            const profileData = res.data;

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
          .finally(() => {
            setLoading(false);
            setAuthLoaded(true);
          });
      } else {
        // Token exists but is malformed — clear it, enter guest mode
        localStorage.removeItem('token');
        setLoading(false);
        setAuthLoaded(true);
      }
    } else {
      // No token at all — guest mode, NOT a redirect
      setLoading(false);
      setAuthLoaded(true);
    }
  }, []);

    const refreshUser = async () => {
    const token = localStorage.getItem('token');
    const userId = token && decodeToken(token);
    if (!userId) return;
    try {
      const res = await axiosInstance.get(`/v1/users/profile/${userId}`, { useCache: false });
      setUser((prev) => ({ ...(prev || {}), ...res.data }));
    } catch (e) { console.error('refreshUser failed', e); }
  };
  // …add refreshUser to the `value` object

  const login = async (credentials) => {
    try {
      const response = await axiosInstance.post('/auth/login', credentials);
      localStorage.setItem('token', response.data.token);

      const userId = decodeToken(response.data.token);
      if (userId) {
        const profileRes = await axiosInstance.get(`/v1/users/profile/${userId}`, { useCache: false });
        const profileData = profileRes.data;

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
        setAuthLoaded(true);

        // Notify other contexts (PlayerContext, etc.) that the user just logged in
        window.dispatchEvent(new CustomEvent('unis:login', {
          detail: { userId: profileData.userId }
        }));

        return { success: true };
      } else {
        throw new Error('Invalid token');
      }
    } catch (error) {
      localStorage.removeItem('token');
      return {
        success: false,
        error: typeof error.response?.data === 'string' ? error.response.data : error.response?.data?.message || 'Login failed',
        data: error.response?.data,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('unis-theme');            // ★ feed #2
    document.getElementById('root')?.setAttribute('data-theme', 'blue'); // ★ feed #2
    setThemeState('blue');                            // ★ feed #2
    setUser(null);

    // Notify other contexts to clear their state on logout
    window.dispatchEvent(new CustomEvent('unis:logout'));

    window.location.href = '/login';
  };

  // Derived state — true when auth check is done AND there is no user
  const isGuest = authLoaded && !user;

  const value = {
    user,
    login,
    logout,
    loading,
    authLoaded,
    isGuest,
    theme,
    setTheme,
    refreshUser,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  
};