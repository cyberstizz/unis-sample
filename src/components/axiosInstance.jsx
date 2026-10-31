// src/components/axiosInstance.jsx

import axios from 'axios';
import cacheService from '../services/cacheService';
import { clearAllQueueState } from '../utils/queuePersistence';

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

// Request interceptor: attach the token, and answer from the cache when allowed
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = (config.method || 'get').toLowerCase();

    // Only requests that change something carry these two headers. On a GET
    // they made the browser send a CORS "preflight" (an extra OPTIONS round
    // trip) before every call a guest made. The backend only reads the
    // platform header when it records something (plays, sign-ups, activity),
    // which is always a POST.
    if (method !== 'get') {
      // Tells the backend which app the request came from (web, ios,
      // android), for the platform split in the admin metrics.
      config.headers['X-Unis-Platform'] = 'web';
      // Let the browser set Content-Type for FormData (file uploads)
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      } else if (config.data !== undefined) {
        config.headers['Content-Type'] = 'application/json';
      }
    }

    // GET requests on the CACHEABLE list may be answered from the cache.
    const cacheKey = cacheKeyFor(config);
    if (cacheKey) {
      // Remember who asked, so a response that arrives after a sign-out or a
      // switch of account isn't saved under the next person's name.
      config.unisCacheKey = { ...cacheKey, viewer: cacheService.viewer() };
      const cached = cacheService.get(cacheKey.type, cacheKey.id, cacheKey.params);
      if (cached) {
        config.adapter = () =>
          Promise.resolve({
            data: cached,
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config,
            request: {},
          });
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: save allowed GET responses, clear what a change made
// stale, and handle an expired session (401)
axiosInstance.interceptors.response.use(
  (response) => {
    const key = response.config.unisCacheKey;
    if (key && response.statusText !== 'OK (Cached)' && key.viewer === cacheService.viewer()) {
      cacheService.set(key.type, key.id, response.data, key.params);
    }

    const method = (response.config.method || 'get').toLowerCase();
    if (['post', 'put', 'delete', 'patch'].includes(method)) {
      invalidateCachesForMutation(apiPath(response.config), method);
    }

    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // ★ FIX (feed #1 — "the page reloads after almost any action"):
      //   This used to hard-redirect on EVERY 401. A guest browsing the Feed
      //   hits protected endpoints constantly (play tracking, queue add,
      //   default-song, track-view). Each 401 fired
      //   `window.location.href = '/login'` — a FULL PAGE RELOAD. That is the
      //   "refresh" the user sees when clicking a song or queueing a track.
      //
      //   A 401 only means "your session died" if you actually had a session.
      //   Guests simply have no token, so we swallow it and let the caller
      //   (e.g. AuthGateSheet) handle the gating. No token, no redirect.
      const hadSession = !!localStorage.getItem('token');

      if (hadSession) {
        // ★ ROOT-CAUSE FIX (stale-session bug): a 401 with a token in hand means
        //   the session is dead — almost always an expired JWT (24h TTL). Tear it
        //   down IN-APP rather than only hard-redirecting: clear the token, drop
        //   the stale theme, wipe caches, and tell AuthContext to null out `user`.
        //   That makes the avatar disappear and lets the AuthGateSheet appear,
        //   which is the graceful behaviour the rest of the app expects — instead
        //   of the "avatar still showing, Profile says sign in" limbo.
        localStorage.removeItem('token');
        localStorage.removeItem('unis-theme');
        cacheService.clearAll();
        // Drop the persisted play queue too. It is per-user data; leaving it
        // behind means the next account to sign in on this device inherits the
        // previous user's queue.
        clearAllQueueState();
        window.dispatchEvent(new CustomEvent('unis:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

// ─── What the app may cache ──────────────────────────────────────────────────
// Only these GET endpoints are cached, each matched on its whole path (from
// /v1/ on) and keyed by its id plus every query parameter, sorted. Anything not
// listed always goes to the server. Before, keys were built by loose patterns:
// every URL containing /artist/<id> (songs, videos, awards, analytics) shared
// one entry and lost its query string, which is why about 30 calls had to pass
// useCache: false.
// The type names match the lifetimes in services/cacheService.jsx.
const CACHEABLE = [
  // A profile: /v1/users/profile/{userId}
  { type: 'user', re: /^\/v1\/users\/profile\/([^/]+)$/, id: (m) => m[1] },
  // Trending by score, and trending today
  { type: 'trending', re: /^\/v1\/media\/trending$/, id: () => 'score' },
  { type: 'trending', re: /^\/v1\/media\/trending\/today$/, id: () => 'today' },
  // New releases
  { type: 'feed', re: /^\/v1\/media\/new$/, id: () => 'new' },
  // One song: /v1/media/song/{songId} (not its sub-paths such as /is-liked)
  { type: 'song', re: /^\/v1\/media\/song\/([^/]+)$/, id: (m) => m[1] },
  // An artist's songs: /v1/media/songs/artist/{artistId}
  { type: 'artist', re: /^\/v1\/media\/songs\/artist\/([^/]+)$/, id: (m) => m[1] },
  // Past winners, and the live race standings
  { type: 'awardsPast', re: /^\/v1\/awards\/past$/, id: () => 'past' },
  { type: 'standings', re: /^\/v1\/awards\/standings$/, id: () => 'standings' },
  // Place lookups (reference data)
  { type: 'jurisdictions', re: /^\/v1\/jurisdictions\/([^/]+)\/breadcrumb$/, id: (m) => `${m[1]}/breadcrumb` },
  { type: 'jurisdictions', re: /^\/v1\/jurisdictions\/byName\/([^/]+)$/, id: (m) => `byName/${m[1]}` },
];

// The request's path from /v1/ on, plus its query parameters (both the ones
// written into the URL and the ones passed as `params`).
function requestParts(config) {
  let full;
  try {
    full = new URL(axiosInstance.getUri(config), 'http://local');
  } catch {
    return null;
  }
  const at = full.pathname.indexOf('/v1/');
  if (at === -1) return null;
  const params = {};
  full.searchParams.forEach((value, name) => {
    params[name] = value;
  });
  return { path: full.pathname.slice(at).replace(/\/+$/, ''), params };
}

function apiPath(config) {
  return requestParts(config)?.path || '';
}

// The cache entry for a GET request, or null when it must go to the server.
function cacheKeyFor(config) {
  if ((config.method || 'get').toLowerCase() !== 'get' || config.useCache === false) return null;
  const parts = requestParts(config);
  if (!parts) return null;
  for (const rule of CACHEABLE) {
    const m = parts.path.match(rule.re);
    if (m) return { type: rule.type, id: rule.id(m), params: parts.params };
  }
  return null;
}

// What a change makes stale. Each rule clears only what that change affects.
// Plays used to clear every cached trending list, feed, profile and artist on
// each play, so on a busy evening almost nothing was ever served from cache;
// now a play clears only that song.
function invalidateCachesForMutation(path, method) {
  const songId = path.match(/^\/v1\/media\/song\/([^/]+)/)?.[1];

  // A play (signed in or not): only that song's entry (its play count).
  if (/^\/v1\/media\/song\/[^/]+\/(play|anonymous-play)$/.test(path)) {
    cacheService.invalidate('song', songId);
    return;
  }

  // Like or unlike: that song, and the artist song lists that show likes.
  if (/^\/v1\/media\/song\/[^/]+\/like$/.test(path)) {
    cacheService.invalidate('song', songId);
    cacheService.invalidateType('artist');
    return;
  }

  // Video plays and likes: videos aren't cached, so nothing to clear.
  if (/^\/v1\/media\/video\/[^/]+\/(play|like)$/.test(path)) {
    return;
  }

  // Votes change the standings and the voter's and nominee's scores.
  if (path.startsWith('/v1/vote')) {
    cacheService.invalidateType('standings');
    cacheService.invalidateType('user');
    cacheService.invalidateType('trending');
    return;
  }

  // Uploading, editing or removing a song or video.
  if (/^\/v1\/media\/(song|video|songs|videos)(\/|$)/.test(path)) {
    if (songId) cacheService.invalidate('song', songId);
    cacheService.invalidateType('trending');
    cacheService.invalidateType('feed');
    cacheService.invalidateType('artist');
    return;
  }

  // Any change to an account: profile, photo, bio, links, default song,
  // supported artist, follows. Clears every cached profile and artist song
  // list on this browser. (It used to clear an entry named "profile" for
  // edits like /v1/users/profile/{id}/bio, so the old bio came back.)
  if (path.startsWith('/v1/users')) {
    cacheService.invalidateType('user');
    cacheService.invalidateType('artist');
    return;
  }

  // Phone verification flips phone_verified on the profile.
  if (path.startsWith('/v1/phone/')) {
    cacheService.invalidateType('user');
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
    // ALL methods now propagate errors to the caller. Components have
    // try/catch blocks around apiCall and rely on those catches to set
    // error UI state. Silently returning { data: [] } from failed GETs
    // (the previous behavior) made every error path in the UI unreachable
    // in real-API mode — users saw empty pages instead of "Failed to load."
    //
    // The previous GET fallback to getMockResponse only made sense in
    // !USE_REAL_API mode (which is already handled at the top of this
    // function). In USE_REAL_API mode, errors are real and must surface.
    throw error;
  }
};

// Export function to manually invalidate cache (for UI actions)
export const invalidateCache = (type, id) => {
  cacheService.invalidate(type, id);
};

export const invalidateCacheType = (type) => {
  cacheService.invalidateType(type);
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
    clearAllQueueState();
    window.location.href = '/login';
  }
};

export default axiosInstance;