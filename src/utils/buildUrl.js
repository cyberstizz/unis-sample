// src/utils/buildUrl.js
//
// Universal URL normalizer for Unis media assets.
//
// Handles all URL patterns found in the database:
//
// 1. Public R2 (no /uploads/):
//    https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev/4eba2ed5-...-1762729433893.mp3
//
// 2. Public R2 (with /uploads/):
//    https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev/uploads/25435e26-...-My fav.JPG
//
// 3. Private R2 (with /unis-media/uploads/):
//    https://b9cdcab49fa03c52a7b4d440cbc370c3.r2.cloudflarestorage.com/unis-media/uploads/...
//
// 4. Private R2 (with just /uploads/):
//    https://b9cdcab49fa03c52a7b4d440cbc370c3.r2.cloudflarestorage.com/uploads/...
//
// All returned URLs are passed through encodeURI() to handle spaces and
// special characters in filenames (e.g. "My fav.JPG" → "My%20fav.JPG").

const PUBLIC_R2_BASE = 'https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev';

const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL
  : 'http://localhost:8080';

/**
 * Safely encode a URL — handles spaces and special chars in filenames
 * without double-encoding URLs that are already partially encoded.
 */
function safeEncode(url) {
  // Decode first to avoid double-encoding (e.g. %20 → %2520),
  // then re-encode the whole thing.
  try {
    return encodeURI(decodeURI(url));
  } catch {
    // decodeURI can throw on malformed percent sequences — just encode raw
    return encodeURI(url);
  }
}

export function buildUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const cleaned = url.trim();
  if (!cleaned) return null;

  // ── Private R2 → rewrite to public CDN ──
  if (cleaned.includes('r2.cloudflarestorage.com')) {
    // Pattern 3: .../unis-media/uploads/filename.ext
    const unisBucketIndex = cleaned.indexOf('/unis-media/uploads/');
    if (unisBucketIndex !== -1) {
      const relativePath = cleaned.slice(unisBucketIndex + '/unis-media'.length);
      return safeEncode(`${PUBLIC_R2_BASE}${relativePath}`);
    }

    // Pattern 4: .../uploads/filename.ext (no unis-media prefix)
    const uploadsIndex = cleaned.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
      const relativePath = cleaned.slice(uploadsIndex);
      return safeEncode(`${PUBLIC_R2_BASE}${relativePath}`);
    }

    // Fallback: unknown private R2 structure
    try {
      const urlObj = new URL(cleaned);
      return safeEncode(`${PUBLIC_R2_BASE}${urlObj.pathname}`);
    } catch {
      return safeEncode(cleaned);
    }
  }

  // ── Already a full URL (public R2 or any other CDN) → encode and pass through ──
  if (cleaned.startsWith('http')) return safeEncode(cleaned);

  // ── Relative path → prepend API base ──
  const separator = cleaned.startsWith('/') ? '' : '/';
  return safeEncode(`${API_BASE_URL}${separator}${cleaned}`);
}

export default buildUrl;