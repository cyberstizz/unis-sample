// src/utils/buildUrl.js
//
// Universal URL normalizer for Unis media assets.
//
// Handles all 4 URL patterns found in the database:
//
// 1. Public R2 (no /uploads/):
//    https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev/4eba2ed5-...-1762729433893.mp3
//    → Already works. Pass through.
//
// 2. Public R2 (with /uploads/):
//    https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev/uploads/25435e26-...-My fav.JPG
//    → Already works. Pass through.
//
// 3. Private R2 (with /unis-media/uploads/):
//    https://b9cdcab49fa03c52a7b4d440cbc370c3.r2.cloudflarestorage.com/unis-media/uploads/08c742ea-...-Bump This (Mastered).mp3
//    → Rewrite to: https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev/uploads/08c742ea-...-Bump This (Mastered).mp3
//
// 4. Private R2 (with just /uploads/, no bucket prefix):
//    https://b9cdcab49fa03c52a7b4d440cbc370c3.r2.cloudflarestorage.com/uploads/songartworkfour.jpg
//    → Rewrite to: https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev/uploads/songartworkfour.jpg

const PUBLIC_R2_BASE = 'https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev';

const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL
  : 'http://localhost:8080';

export function buildUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const cleaned = url.trim();
  if (!cleaned) return null;

  // ── Private R2 → rewrite to public CDN ──
  if (cleaned.includes('r2.cloudflarestorage.com')) {
    // Pattern 3: .../unis-media/uploads/filename.ext
    const unisBucketIndex = cleaned.indexOf('/unis-media/uploads/');
    if (unisBucketIndex !== -1) {
      // Extract everything after /unis-media/ → "uploads/filename.ext"
      const relativePath = cleaned.slice(unisBucketIndex + '/unis-media'.length); // → "/uploads/filename.ext"
      return `${PUBLIC_R2_BASE}${relativePath}`;
    }

    // Pattern 4: .../uploads/filename.ext (no unis-media prefix)
    const uploadsIndex = cleaned.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
      const relativePath = cleaned.slice(uploadsIndex); // → "/uploads/filename.ext"
      return `${PUBLIC_R2_BASE}${relativePath}`;
    }

    // Fallback: unknown private R2 structure — try to extract after the domain
    try {
      const urlObj = new URL(cleaned);
      return `${PUBLIC_R2_BASE}${urlObj.pathname}`;
    } catch {
      return cleaned; // Can't parse, return as-is
    }
  }

  // ── Already a full URL (public R2 or any other CDN) → pass through ──
  if (cleaned.startsWith('http')) return cleaned;

  // ── Relative path → prepend API base ──
  return `${API_BASE_URL}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
}

export default buildUrl;