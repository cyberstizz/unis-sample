
class CacheService {
  constructor() {
    // In-memory cache (fast, session-only)
    this.memoryCache = new Map();
    
    // Cache TTLs (time to live in milliseconds)
    this.ttls = {
      user: 5 * 60 * 1000,        // 5 minutes - user profiles change infrequently
      playlists: 2 * 60 * 1000,   // 2 minutes - playlists change more often
      feed: 1 * 60 * 1000,        // 1 minute - feed is dynamic
      trending: 3 * 60 * 1000,    // 3 minutes - trending updates less frequently
      artist: 10 * 60 * 1000,     // 10 minutes - artist info rarely changes
      song: 30 * 60 * 1000,       // 30 minutes - song metadata is static
    };
  }

  // Generate cache key
  _key(type, id, params = {}) {
    const paramStr = Object.keys(params).length 
      ? JSON.stringify(params) 
      : '';
    return `${type}:${id}:${paramStr}`;
  }

  // Check if cache entry is expired
  _isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }

  // Get from cache
  get(type, id, params = {}) {
    const key = this._key(type, id, params);
    
    // Check memory cache first (fastest)
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this._isExpired(memEntry)) {
      console.log(`[Cache HIT] Memory: ${key}`);
      return memEntry.data;
    }

    // Check localStorage (survives page refresh)
    try {
      const lsItem = localStorage.getItem(key);
      if (lsItem) {
        const entry = JSON.parse(lsItem);
        if (!this._isExpired(entry)) {
          console.log(`[Cache HIT] LocalStorage: ${key}`);
          // Promote to memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // Clean up expired entry
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }

    console.log(`[Cache MISS] ${key}`);
    return null;
  }

  // Set cache entry
  set(type, id, data, params = {}) {
    const key = this._key(type, id, params);
    const ttl = this.ttls[type] || 60000; // Default 1 minute
    const entry = {
      data,
      expiresAt: Date.now() + ttl,
      cachedAt: Date.now()
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in localStorage (skip for large data to avoid quota issues)
    try {
      const size = JSON.stringify(entry).length;
      if (size < 500000) { // Less than 500KB
        localStorage.setItem(key, JSON.stringify(entry));
      }
    } catch (e) {
      console.warn('LocalStorage write error (quota?):', e);
    }

    console.log(`[Cache SET] ${key} (TTL: ${ttl}ms)`);
  }

  // Invalidate specific cache
  invalidate(type, id, params = {}) {
    const key = this._key(type, id, params);
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('LocalStorage delete error:', e);
    }
    console.log(`[Cache INVALIDATE] ${key}`);
  }

  // Invalidate all caches of a type (e.g., all playlists)
  invalidateType(type) {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${type}:`)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear localStorage
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(`${type}:`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('LocalStorage bulk delete error:', e);
    }

    console.log(`[Cache INVALIDATE TYPE] ${type}`);
  }

  // Clear all caches
  clearAll() {
    this.memoryCache.clear();
    try {
      // Only clear cache keys, preserve auth token
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== 'token' && key.includes(':')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('LocalStorage clear error:', e);
    }
    console.log('[Cache CLEAR ALL]');
  }

  // Get cache stats (for debugging)
  getStats() {
    return {
      memorySize: this.memoryCache.size,
      localStorageKeys: Object.keys(localStorage).filter(k => k.includes(':')).length
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

export default cacheService;