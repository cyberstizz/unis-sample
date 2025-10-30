import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';  
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';  
const axiosInstance = axios.create({
baseURL: USE_REAL_API ? API_BASE_URL : null,
headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,  // 10s for uploads/plays
});

// Request interceptor: Auto-attach Bearer token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 (token invalid/expired → logout/redirect)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';  // Hard redirect (or use navigate in context)
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;