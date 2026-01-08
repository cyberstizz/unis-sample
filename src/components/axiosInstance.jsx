import axios from 'axios';
import cacheService from '../services/cacheService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';
const IS_DEV = import.meta.env.DEV;

const effectiveBaseURL = IS_DEV && USE_REAL_API 
  ? 'http://localhost:8080/api'
  : (USE_REAL_API ? API_BASE_URL : null);

const axiosInstance = axios.create({
  baseURL: effectiveBaseURL,
  timeout: 10000,
});

// Request interceptor: Attach token + check cache
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Let browser set Content-Type for FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else {
      config.headers['Content-Type'] = 'application/json';
    }

    // Cache check for GET requests only
    if (config.method === 'get' && config.useCache !== false) {
      const cacheKey = getCacheKeyFromUrl(config.url);
      if (cacheKey) {
        const cached = cacheService.get(cacheKey.type, cacheKey.id, cacheKey.params);
        if (cached) {
          // Return cached data (cancel request)
          config.adapter = () => {
            return Promise.resolve({
              data: cached,
              status: 200,
              statusText: 'OK (Cached)',
              headers: config.headers,
              config,
              request: {}
            });
          };
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Cache responses + handle 401
axiosInstance.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method === 'get' && response.config.useCache !== false) {
      const cacheKey = getCacheKeyFromUrl(response.config.url);
      if (cacheKey) {
        cacheService.set(cacheKey.type, cacheKey.id, response.data, cacheKey.params);
      }
    }

    // Invalidate related caches on mutations
    if (['post', 'put', 'delete', 'patch'].includes(response.config.method)) {
      invalidateCachesForMutation(response.config.url, response.config.method);
    }

    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      cacheService.clearAll();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper: Extract cache key from URL
function getCacheKeyFromUrl(url) {
  if (!url) return null;

  // User profile: /v1/users/profile/{userId}
  const userProfileMatch = url.match(/\/v1\/users\/profile\/([^?]+)/);
  if (userProfileMatch) {
    return { type: 'user', id: userProfileMatch[1], params: {} };
  }

  // Playlists: /api/playlists
  if (url.includes('/api/playlists') && !url.includes('/tracks')) {
    const playlistIdMatch = url.match(/\/api\/playlists\/([^?\/]+)/);
    if (playlistIdMatch) {
      return { type: 'playlists', id: playlistIdMatch[1], params: {} };
    }
    return { type: 'playlists', id: 'all', params: {} };
  }

  // Trending TODAY: /v1/media/trending/today
  if (url.includes('/v1/media/trending/today')) {
    const params = extractQueryParams(url);
    return { type: 'trending', id: params.jurisdictionId || 'default', params };
  }

  // Trending (score-based): /v1/media/trending
  const trendingMatch = url.match(/\/v1\/media\/trending(?!\/today)/);
  if (trendingMatch) {
    const params = extractQueryParams(url);
    return { type: 'trending', id: params.jurisdictionId || 'default', params };
  }

  // New releases: /v1/media/new
  const newMatch = url.match(/\/v1\/media\/new/);
  if (newMatch) {
    const params = extractQueryParams(url);
    return { type: 'feed', id: params.jurisdictionId || 'default', params };
  }

  // Artist: /v1/users/artist/{artistId} or /artist/{artistId}
  const artistMatch = url.match(/\/artist\/([^?\/]+)/);
  if (artistMatch) {
    return { type: 'artist', id: artistMatch[1], params: {} };
  }

  // Song: /v1/media/song/{songId}
  const songMatch = url.match(/\/v1\/media\/song\/([^?\/]+)/);
  if (songMatch) {
    return { type: 'song', id: songMatch[1], params: {} };
  }

  return null;
}

// Helper: Extract query params
function extractQueryParams(url) {
  const params = {};
  const urlObj = new URL(url, 'http://dummy.com');
  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// UPDATED: Better cache invalidation logic
function invalidateCachesForMutation(url, method) {
  // Play tracking - invalidate song and trending caches
  if (url.includes('/play')) {
    const songIdMatch = url.match(/\/song\/([^\/\?]+)\/play/);
    if (songIdMatch) {
      const songId = songIdMatch[1];
      console.log(`[Cache] Invalidating song ${songId} after play`);
      cacheService.invalidate('song', songId);
      cacheService.invalidateType('trending'); // Affects trending lists
      cacheService.invalidateType('feed'); // Affects new releases
    }
    return;
  }

  // Playlist mutations
  if (url.includes('/api/playlists')) {
    cacheService.invalidateType('playlists');
    console.log('[Cache] Invalidated playlists after mutation');
    return;
  }

  // Vote mutations
  if (url.includes('/vote')) {
    const songIdMatch = url.match(/\/song\/([^\/\?]+)/);
    if (songIdMatch) {
      cacheService.invalidate('song', songIdMatch[1]);
      cacheService.invalidateType('trending');
    }
    console.log('[Cache] Invalidated after vote');
    return;
  }

  // Song/Video upload or delete
  if ((url.includes('/media/song') || url.includes('/media/video')) && 
      (method === 'post' || method === 'delete')) {
    cacheService.invalidateType('trending');
    cacheService.invalidateType('feed');
    cacheService.invalidateType('artist');
    console.log('[Cache] Invalidated after media upload/delete');
    return;
  }

  // User updates
  if (url.includes('/v1/users/') && (method === 'put' || method === 'patch')) {
    const userIdMatch = url.match(/\/v1\/users\/([^\/\?]+)/);
    if (userIdMatch) {
      cacheService.invalidate('user', userIdMatch[1]);
      cacheService.invalidate('artist', userIdMatch[1]);
    }
    console.log('[Cache] Invalidated user/artist after update');
    return;
  }

  if (url.includes('/media/song') && method === 'patch') {
  const songIdMatch = url.match(/\/song\/([^\/\?]+)/);
  if (songIdMatch) {
    cacheService.invalidate('song', songIdMatch[1]);
  }
  cacheService.invalidateType('trending');
  cacheService.invalidateType('feed');
  console.log('[Cache] Invalidated after song patch');
  return;
}

}

// Export cache-aware API call wrapper
export const apiCall = async (config) => {
  if (!USE_REAL_API) {
    console.log('Using mock data (backend offline/Netlify)');
    return getMockResponse(config.url, config.method);
  }
  try {
    return await axiosInstance(config);
  } catch (error) {
    console.warn('API fallback to mock:', error);
    return getMockResponse(config.url, config.method);
  }
};

// Export function to manually invalidate cache (for UI actions)
export const invalidateCache = (type, id) => {
  cacheService.invalidate(type, id);
  console.log(`[Cache] Manually invalidated ${type}:${id}`);
};

export const invalidateCacheType = (type) => {
  cacheService.invalidateType(type);
  console.log(`[Cache] Manually invalidated type: ${type}`);
};

// Mock helper
const getMockResponse = (url, method) => {
  if (url.includes('/auth/login') && method === 'post') {
    return { data: { token: 'mock-jwt-for-demo' } };
  }
  if (url.includes('/v1/users/profile')) {
    return { data: { userId: 'dummy', jurisdiction: { jurisdictionId: '00000000-0000-0000-0000-000000000002' }, supportedArtistId: null } };
  }
  return { data: [] };
};

export const logoutUser = async () => {
  try {
    await axiosInstance.post('/auth/logout');
  } catch (err) {
    console.warn('Logout request failed', err);
  } finally {
    localStorage.removeItem('token');
    cacheService.clearAll();
    window.location.href = '/login';
  }
};

export default axiosInstance;