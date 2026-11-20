// src/utils/buildUrl.test.js
//
// buildUrl turns whatever the backend stored for a song, artwork or photo into
// an address the browser can load. Every media element in the app goes through
// it, so a mistake here breaks playback and images everywhere.
//
// Rules:
//   • private R2 addresses are rewritten to the public CDN
//   • full addresses pass through
//   • relative paths go on the API server's root — never under /api
//   • spaces and special characters are encoded once, never twice

import { describe, it, expect } from 'vitest';
import buildUrlDefault, { buildUrl } from './buildUrl';

const CDN = 'https://cdn.unismusic.com';
const API_ROOT = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/api\/?$/, '');

describe('buildUrl — nothing to build', () => {
  it.each([null, undefined, '', '   ', 0, 42, {}, []])('%p → null', (value) => {
    expect(buildUrl(value)).toBeNull();
  });
});

describe('buildUrl — private R2 → public CDN', () => {
  it('rewrites a bucket address that includes /unis-media/', () => {
    expect(buildUrl('https://abc123.r2.cloudflarestorage.com/unis-media/uploads/song.mp3'))
      .toBe(`${CDN}/uploads/song.mp3`);
  });

  it('rewrites one that goes straight to /uploads/', () => {
    expect(buildUrl('https://abc123.r2.cloudflarestorage.com/uploads/cover.jpg'))
      .toBe(`${CDN}/uploads/cover.jpg`);
  });

  it('keeps sub-folders', () => {
    expect(buildUrl('https://abc123.r2.cloudflarestorage.com/unis-media/uploads/artists/42/photo.png'))
      .toBe(`${CDN}/uploads/artists/42/photo.png`);
  });

  it('falls back to the path for an unknown bucket layout', () => {
    expect(buildUrl('https://abc123.r2.cloudflarestorage.com/other/file.mp3'))
      .toBe(`${CDN}/other/file.mp3`);
  });

  it('never returns the private host', () => {
    [
      'https://abc123.r2.cloudflarestorage.com/unis-media/uploads/a.mp3',
      'https://abc123.r2.cloudflarestorage.com/uploads/a.mp3',
      'https://abc123.r2.cloudflarestorage.com/x/a.mp3',
    ].forEach((url) => expect(buildUrl(url)).not.toContain('r2.cloudflarestorage.com'));
  });
});

describe('buildUrl — full addresses pass through', () => {
  it.each([
    'https://cdn.unismusic.com/uploads/song.mp3',
    'https://images.unsplash.com/photo-1?w=800&q=80',
    'http://localhost:8080/uploads/song.mp3',
  ])('%s is unchanged', (url) => {
    expect(buildUrl(url)).toBe(url);
  });
});

describe('buildUrl — relative paths', () => {
  it('goes on the API server root', () => {
    expect(buildUrl('/uploads/song.mp3')).toBe(`${API_ROOT}/uploads/song.mp3`);
  });

  it('adds the missing slash', () => {
    expect(buildUrl('uploads/song.mp3')).toBe(`${API_ROOT}/uploads/song.mp3`);
  });

  it('never lands under /api — media is served from the server root', () => {
    expect(buildUrl('/uploads/song.mp3')).not.toMatch(/\/api\/uploads/);
  });

  it('trims stray whitespace', () => {
    expect(buildUrl('  /uploads/song.mp3  ')).toBe(`${API_ROOT}/uploads/song.mp3`);
  });
});

describe('buildUrl — encoding', () => {
  it('encodes spaces in a file name', () => {
    expect(buildUrl('https://cdn.unismusic.com/uploads/my new song.mp3'))
      .toBe('https://cdn.unismusic.com/uploads/my%20new%20song.mp3');
  });

  it('does not double-encode a name that is already encoded', () => {
    expect(buildUrl('https://cdn.unismusic.com/uploads/my%20new%20song.mp3'))
      .toBe('https://cdn.unismusic.com/uploads/my%20new%20song.mp3');
  });

  it('is stable when run twice (a URL built once can be passed through again)', () => {
    const once = buildUrl('/uploads/Tony Fadd – Midnight (Remix).mp3');
    expect(buildUrl(once)).toBe(once);
  });

  it('handles accented and non-Latin names', () => {
    expect(buildUrl('https://cdn.unismusic.com/uploads/canción.mp3'))
      .toBe('https://cdn.unismusic.com/uploads/canci%C3%B3n.mp3');
  });

  it('survives a malformed percent sequence instead of throwing', () => {
    expect(() => buildUrl('https://cdn.unismusic.com/uploads/100%.mp3')).not.toThrow();
    expect(buildUrl('https://cdn.unismusic.com/uploads/100%.mp3'))
      .toBe('https://cdn.unismusic.com/uploads/100%25.mp3');
  });

  it('encodes spaces in a rewritten R2 address too', () => {
    expect(buildUrl('https://abc.r2.cloudflarestorage.com/unis-media/uploads/my song.mp3'))
      .toBe(`${CDN}/uploads/my%20song.mp3`);
  });
});

describe('buildUrl — exports', () => {
  it('the default export is the same function', () => {
    expect(buildUrlDefault).toBe(buildUrl);
  });
});
