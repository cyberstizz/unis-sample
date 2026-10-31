// src/services/cacheService.jsx
//
// The web app's own cache of API responses (only the GET responses that
// components/axiosInstance.jsx allows: see CACHEABLE there).
//
// Every entry belongs to one viewer: the signed-in account, or "guest". A
// profile fetched by its owner includes private fields (email, phone and so
// on), so an entry saved for one account is never served to another, even on
// the same browser. AuthContext also empties the whole cache when someone
// signs in or out, and when a session expires.
//
// Two layers:
//   • memory: fast, gone on reload;
//   • localStorage: survives a reload. Keys start with "unis-cache:" so
//     clearing the cache never touches the app's other saved settings.
// An entry that was saved to localStorage is only trusted while it is still
// there. So when another tab signs out (and empties localStorage), this tab
// stops using its in-memory copies too.

const PREFIX = 'unis-cache:';

// The old version stored entries as "user:<id>:", "artist:<id>:" and so on,
// shared by everyone who used the browser. They're deleted once on load.
const OLD_FORMAT = /^(user|playlists|feed|trending|artist|song):/;

const MAX_LOCAL_BYTES = 500_000; // bigger responses stay in memory only

const MINUTE = 60 * 1000;

class CacheService {
  constructor() {
    this.memoryCache = new Map();

    // How long each kind of response may be reused, in milliseconds. Kept at
    // or below the server's own cache for the same data (CacheConfig.java),
    // so the app never shows anything older than the server would.
    this.ttls = {
      user: 5 * MINUTE,          // a profile (cleared when its owner edits it)
      trending: 1 * MINUTE,      // trending and trending today
      feed: 1 * MINUTE,          // new releases
      song: 5 * MINUTE,          // one song (cleared when it's played or liked)
      artist: 2 * MINUTE,        // an artist's song list
      awardsPast: 10 * MINUTE,   // past winners (a race closes at most hourly)
      standings: 30 * 1000,      // live race standings (cleared when you vote)
      jurisdictions: 30 * MINUTE // place names and breadcrumbs (reference data)
    };

    this._removeOldFormatEntries();
  }

  // ── who is viewing ─────────────────────────────────────────────────────────
  // The signed-in account's id from the stored token, or "guest". Only used to
  // keep each viewer's entries apart; the server still checks the token.
  viewer() {
    return this._viewer();
  }

  _viewer() {
    let token = null;
    try {
      token = localStorage.getItem('token');
    } catch {
      return 'guest';
    }
    if (!token) return 'guest';
    if (token === this._lastToken) return this._lastViewer;
    let viewer = 'unknown';
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
      viewer = payload.userId || payload.sub || 'unknown';
    } catch {
      /* unreadable token: keep it apart from everyone else's entries */
    }
    this._lastToken = token;
    this._lastViewer = viewer;
    return viewer;
  }

  // ── keys ───────────────────────────────────────────────────────────────────
  // unis-cache:<viewer>:<type>:<id>:<sorted query parameters>
  _key(type, id, params = {}) {
    const names = Object.keys(params).sort();
    const query = names.map((n) => `${n}=${params[n]}`).join('&');
    return `${PREFIX}${this._viewer()}:${type}:${id}:${query}`;
  }

  _isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }

  // ── read ───────────────────────────────────────────────────────────────────
  get(type, id, params = {}) {
    const key = this._key(type, id, params);

    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this._isExpired(memEntry)) {
      if (!memEntry.persisted || this._stillStored(key)) {
        this._log('HIT', key);
        return memEntry.data;
      }
      this.memoryCache.delete(key); // emptied elsewhere (another tab signed out)
    }

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const entry = JSON.parse(raw);
        if (!this._isExpired(entry)) {
          this.memoryCache.set(key, { ...entry, persisted: true });
          this._log('HIT (storage)', key);
          return entry.data;
        }
        localStorage.removeItem(key);
      }
    } catch {
      /* storage blocked or entry unreadable: treat as a miss */
    }

    return null;
  }

  _stillStored(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return true; // storage unavailable: memory is all there is
    }
  }

  // ── write ──────────────────────────────────────────────────────────────────
  set(type, id, data, params = {}) {
    const key = this._key(type, id, params);
    const ttl = this.ttls[type] || MINUTE;
    const entry = { data, expiresAt: Date.now() + ttl, cachedAt: Date.now() };

    let persisted = false;
    try {
      const json = JSON.stringify(entry);
      if (json.length < MAX_LOCAL_BYTES) {
        localStorage.setItem(key, json);
        persisted = true;
      }
    } catch {
      /* quota full or storage blocked: keep it in memory only */
    }
    this.memoryCache.set(key, { ...entry, persisted });
    this._log('SET', key);
  }

  // ── remove ─────────────────────────────────────────────────────────────────
  // invalidate(type, id): every entry for that item, whatever its query
  // parameters, for every viewer on this browser.
  // invalidate(type, id, params): only that exact entry, for the current viewer.
  invalidate(type, id, params) {
    if (params && Object.keys(params).length) {
      const key = this._key(type, id, params);
      this.memoryCache.delete(key);
      try { localStorage.removeItem(key); } catch { /* nothing stored */ }
      return;
    }
    this._removeWhere((key) => key.includes(`:${type}:${id}:`));
  }

  // Every entry of one kind (all trending lists, all profiles, ...).
  invalidateType(type) {
    this._removeWhere((key) => key.includes(`:${type}:`));
  }

  // Everything this cache ever saved. Called on sign-in, sign-out and when a
  // session expires. The app's other saved settings are left alone.
  clearAll() {
    this.memoryCache.clear();
    this._removeWhere(() => true);
    this._removeOldFormatEntries();
    this._log('CLEAR ALL', '');
  }

  _removeWhere(matches) {
    for (const key of [...this.memoryCache.keys()]) {
      if (matches(key)) this.memoryCache.delete(key);
    }
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX) && matches(key)) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* storage blocked: nothing stored there */
    }
  }

  _removeOldFormatEntries() {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && OLD_FORMAT.test(key)) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* storage blocked */
    }
  }

  _log(what, key) {
    if (import.meta.env.DEV) console.log(`[Cache ${what}] ${key}`);
  }

  // For debugging in the browser console.
  getStats() {
    let stored = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)?.startsWith(PREFIX)) stored++;
      }
    } catch { /* storage blocked */ }
    return { memorySize: this.memoryCache.size, localStorageKeys: stored };
  }
}

// One shared instance for the whole app.
const cacheService = new CacheService();

export default cacheService;
