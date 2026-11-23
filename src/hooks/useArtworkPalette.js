// src/hooks/useArtworkPalette.js
// ─────────────────────────────────────────────────────────────
// Reads the colours out of a song's artwork so the player can wear them:
// the mini player's tint, its glass, and Now Playing's moving background.
//
// How: the cover is drawn onto a tiny 24×24 canvas and its pixels are
// sampled. The most vivid mid-tone becomes the "glow", the darker pixels
// become the "deep" colour, and two darkened versions make the resting
// tint. Lightness is clamped so white text on the tint always passes
// 4.5:1, whatever the cover looks like.
//
// Reading a canvas needs the image served with CORS (the R2 bucket's CORS
// policy allows the Unis origins). A cover the browser already cached
// without CORS headers can fail once, so a failed read retries a single
// time with a cache-busting parameter. If that also fails, the neutral
// palette is used and nothing breaks.
//
// Results are cached per URL for the session, so a song only ever gets
// sampled once.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

const SIZE = 24;
const cache = new Map();

export const NEUTRAL_PALETTE = Object.freeze({
  glow: 'hsl(222, 22%, 46%)',
  deep: 'hsl(224, 30%, 11%)',
  rest1: 'hsl(222, 18%, 24%)',
  rest2: 'hsl(224, 26%, 14%)',
  glass: 'hsla(222, 20%, 26%, 0.42)',
  ready: false,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const hsl = (h, s, l) => `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
const hsla = (h, s, l, a) => `hsla(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`;

// Exported for tests.
export function derivePalette(data) {
  let n = 0;
  const sum = [0, 0, 0];
  let dn = 0;
  const dark = [0, 0, 0];
  let best = null;
  let bestScore = -1;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum[0] += r; sum[1] += g; sum[2] += b; n += 1;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l < 0.42) { dark[0] += r; dark[1] += g; dark[2] += b; dn += 1; }
    // Vivid and mid-light wins; near-black and near-white lose.
    const score = s * (1 - Math.abs(l - 0.5) * 1.6);
    if (score > bestScore) { bestScore = score; best = [h, s, l]; }
  }
  if (!n) return null;

  const avg = rgbToHsl(sum[0] / n, sum[1] / n, sum[2] / n);
  const vib = bestScore > 0.12 && best ? best : avg;
  const deepSrc = dn ? rgbToHsl(dark[0] / dn, dark[1] / dn, dark[2] / dn) : avg;

  return {
    glow: hsl(vib[0], clamp(vib[1], 0.35, 0.85), clamp(vib[2], 0.5, 0.62)),
    deep: hsl(deepSrc[0], clamp(deepSrc[1], 0.2, 0.6), clamp(deepSrc[2], 0.1, 0.18)),
    rest1: hsl(vib[0], clamp(vib[1], 0.25, 0.6), 0.27),
    rest2: hsl(deepSrc[0], clamp(deepSrc[1], 0.2, 0.55), 0.15),
    glass: hsla(vib[0], clamp(vib[1], 0.25, 0.6), 0.28, 0.4),
    ready: true,
  };
}

function loadImage(src, bust) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = bust ? `${src}${src.includes('?') ? '&' : '?'}unis-pal=1` : src;
  });
}

async function extract(src) {
  for (const bust of [false, true]) {
    try {
      const img = await loadImage(src, bust);
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      return derivePalette(ctx.getImageData(0, 0, SIZE, SIZE).data);
    } catch {
      // Tainted canvas or failed load: retry once with a fresh request.
    }
  }
  return null;
}

export default function useArtworkPalette(src) {
  const [palette, setPalette] = useState(() => (src && cache.get(src)) || NEUTRAL_PALETTE);

  useEffect(() => {
    if (!src) { setPalette(NEUTRAL_PALETTE); return undefined; }
    if (cache.has(src)) { setPalette(cache.get(src)); return undefined; }

    let alive = true;
    extract(src)
      .then((p) => {
        const result = p || NEUTRAL_PALETTE;
        cache.set(src, result);
        if (!p) console.warn('[Player] Could not read artwork colours, using the neutral tint:', src);
        if (alive) setPalette(result);
      })
      .catch((err) => {
        console.error('[Player] Artwork palette failed:', err);
        if (alive) setPalette(NEUTRAL_PALETTE);
      });
    return () => { alive = false; };
  }, [src]);

  return palette;
}
