// Draws a winner's share card on a canvas, from the card data
// GET /v1/awards/{id}/card returns. Used by the award page (/award/:id) and
// Admin → Announcements.
//
// Two shapes:
//   story  1080×1920 (9:16), for Instagram/TikTok stories. Everything sits
//          inside the middle, clear of the ~250px top and bottom strips the
//          apps cover with their own buttons.
//   post   1080×1350 (4:5), Instagram's portrait post.
// The colours follow the viewer's theme (the same seven as the app), with
// that theme's wordmark.
//
// The picture: a song's cover art, or the artist's photo in a ring. Winners
// under 17 have no photo (the server leaves it out), so they get their first
// initial on a theme-coloured tile; so does anyone whose picture can't load.
// Pictures come from the media bucket, whose CORS rules allow the Unis sites,
// so they're fetched with crossOrigin and the card can still be saved.

import { buildUrl } from './buildUrl';

export const CARD_W = 1080;
export const CARD_H = 1350;
export const STORY_H = 1920;

const THEMES = {
  blue: '#163387',
  orange: '#C44B0A',
  red: '#B51C24',
  green: '#0F7A3E',
  purple: '#4A1A8C',
  yellow: '#C49A0A',
  dianna: '#5d4703',
};

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "Inter, Arial, sans-serif";

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const toward = (rgb, target, k) => rgb.map((c, i) => Math.round(c + (target[i] - c) * k));
const rgba = (rgb, a = 1) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

const images = new Map();
const loadImage = (src, cors = false) => {
  if (!src) return Promise.resolve(null);
  const key = `${cors ? 'c' : 'n'}:${src}`;
  if (!images.has(key)) {
    images.set(key, new Promise((resolve) => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return images.get(key);
};

// A bucket image the browser already holds from a plain <img> may come back
// without its CORS headers; a query string gives the canvas its own copy.
const corsUrl = (url) => (url ? `${url}${url.includes('?') ? '&' : '?'}card=1` : null);

const wordmarkFor = (theme) => `/brand/splash/wordmark-${theme}.${theme === 'blue' ? 'svg' : 'png'}`;

const loadFonts = async () => {
  try {
    if (!document.fonts?.load) return;
    await Promise.all([
      document.fonts.load(`400 120px ${SERIF}`),
      document.fonts.load(`600 40px ${SANS}`),
      document.fonts.load(`700 40px ${SANS}`),
      document.fonts.load(`800 40px ${SANS}`),
    ]);
  } catch {
    // Fallback fonts are fine.
  }
};

/** Splits text into lines that fit maxWidth at the current font, at most maxLines (the last one ellipsized). */
const wrap = (ctx, text, maxWidth, maxLines) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
};

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** Draws an image to fill a box (cropping the overflow), like object-fit: cover. */
const drawCover = (ctx, img, x, y, w, h) => {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
};

/**
 * Draws the card for `card` onto `canvas`.
 * options: host (shown at the foot), theme (one of the seven; default blue),
 *          format ('story' | 'post'; default post).
 */
export async function drawAwardCard(canvas, card, { host = window.location.host, theme = 'blue', format = 'post' } = {}) {
  const safeTheme = THEMES[theme] ? theme : 'blue';
  const story = format === 'story';
  const W = CARD_W;
  const H = story ? STORY_H : CARD_H;

  const isSong = card.targetType === 'song';
  const pictureUrl = buildUrl(isSong ? card.artworkUrl : card.photoUrl) || null;
  await loadFonts();
  const [mark, picture] = await Promise.all([
    loadImage(wordmarkFor(safeTheme)),
    loadImage(corsUrl(pictureUrl), true),
  ]);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const accent = hex(THEMES[safeTheme]);
  const black = [7, 8, 12];
  const white = [255, 255, 255];
  const onAccent = safeTheme === 'yellow' ? '#111318' : '#ffffff';

  // Night sky that deepens into the theme colour, with a glow behind the picture.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, rgba(black));
  bg.addColorStop(1, rgba(toward(black, accent, 0.5)));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const gy = H * (story ? 0.4 : 0.36);
  const glow = ctx.createRadialGradient(W / 2, gy, 30, W / 2, gy, W * 0.75);
  glow.addColorStop(0, rgba(toward(accent, white, 0.2), 0.55));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Equalizer bars along the foot, the Unis skyline.
  ctx.fillStyle = rgba(toward(accent, white, 0.15), 0.26);
  const bars = 36;
  const barW = W / bars;
  for (let i = 0; i < bars; i += 1) {
    const h = 40 + ((Math.sin(i * 1.7) + 1) / 2) * 120 + ((i * 37) % 50);
    ctx.fillRect(i * barW + 3, H - h, barW - 6, h);
  }

  // The safe area everything sits in.
  const top = story ? 250 : 84;
  const bottom = story ? H - 250 : H - 70;
  const pad = 96;
  const inner = W - pad * 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Wordmark, top centre.
  const markW = story ? 300 : 250;
  const markH = mark ? (markW * mark.naturalHeight) / mark.naturalWidth : 56;
  if (mark) {
    ctx.drawImage(mark, (W - markW) / 2, top, markW, markH);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 52px ${SANS}`;
    ctx.fillText('UNIS', W / 2, top + 52);
  }

  // Where to hear it, bottom centre.
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText(host, W / 2, bottom);

  // ── The middle block, measured first so it can be centred ──
  const kind = isSong ? 'Song' : 'Artist';
  const award = `${kind} of the ${card.unit || 'Day'}`.toUpperCase();
  const name = isSong ? `“${card.songTitle || ''}”` : String(card.username || '');
  const meta = [card.jurisdiction, card.genre, card.periodLabel].filter(Boolean).join(' · ');
  const decided = `Decided by ${card.jurisdiction || 'the neighborhood'}’s votes, plays and likes`;

  const pic = story ? 560 : 400;
  let size = story ? 120 : 96;
  let nameLines = [];
  for (; size >= 54; size -= 4) {
    ctx.font = `400 ${size}px ${SERIF}`;
    nameLines = wrap(ctx, name, inner, 99);
    if (nameLines.length <= 2) break;
  }
  ctx.font = `400 ${size}px ${SERIF}`;
  nameLines = wrap(ctx, name, inner, 2);
  const lineH = size * 1.02;

  const gap = story ? 44 : 30;
  const blocks = [
    { h: 34, draw: (y) => {
      ctx.fillStyle = rgba(toward(accent, white, 0.62));
      ctx.font = `800 ${story ? 34 : 30}px ${SANS}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
      ctx.fillText(award, W / 2, y + 30);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    } },
    { h: pic, draw: (y) => {
      const x = (W - pic) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 20;
      if (isSong && picture) {
        roundRect(ctx, x, y, pic, pic, 34);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.clip();
        drawCover(ctx, picture, x, y, pic, pic);
      } else if (!isSong && picture) {
        ctx.beginPath();
        ctx.arc(W / 2, y + pic / 2, pic / 2 + 10, 0, Math.PI * 2);
        ctx.fillStyle = rgba(accent);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.arc(W / 2, y + pic / 2, pic / 2 - 4, 0, Math.PI * 2);
        ctx.clip();
        drawCover(ctx, picture, x, y, pic, pic);
      } else {
        // No picture: the first initial on a theme tile (square for a song,
        // round for an artist).
        if (isSong) roundRect(ctx, x, y, pic, pic, 34);
        else { ctx.beginPath(); ctx.arc(W / 2, y + pic / 2, pic / 2, 0, Math.PI * 2); }
        ctx.fillStyle = rgba(accent);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        const letter = String(isSong ? card.songTitle : card.username || '?').trim().charAt(0).toUpperCase() || '?';
        ctx.fillStyle = onAccent;
        ctx.font = `400 ${Math.round(pic * 0.56)}px ${SERIF}`;
        ctx.fillText(letter, W / 2, y + pic / 2 + pic * 0.19);
      }
      ctx.restore();
    } },
    { h: nameLines.length * lineH, draw: (y) => {
      ctx.fillStyle = '#ffffff';
      ctx.font = `400 ${size}px ${SERIF}`;
      nameLines.forEach((line, i) => ctx.fillText(line, W / 2, y + size * 0.82 + i * lineH));
    } },
  ];
  if (isSong) {
    blocks.push({ h: 48, draw: (y) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.font = `600 ${story ? 46 : 40}px ${SANS}`;
      ctx.fillText(wrap(ctx, `by ${card.username}`, inner, 1)[0], W / 2, y + 40);
    } });
  }
  blocks.push({ h: story ? 84 : 76, draw: (y) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
    ctx.font = `600 ${story ? 32 : 30}px ${SANS}`;
    ctx.fillText(wrap(ctx, meta, inner, 1)[0] || '', W / 2, y + 30);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.56)';
    ctx.font = `400 ${story ? 28 : 26}px ${SANS}`;
    ctx.fillText(wrap(ctx, decided, inner, 1)[0], W / 2, y + (story ? 76 : 68));
  } });

  // Fit: shrink the gaps (never the picture) if the block runs long.
  const areaTop = top + markH + (story ? 60 : 40);
  const areaBottom = bottom - (story ? 80 : 60);
  const total = blocks.reduce((s, b) => s + b.h, 0);
  const room = areaBottom - areaTop;
  const g = Math.max(12, Math.min(gap, (room - total) / (blocks.length - 1)));
  let y = areaTop + Math.max(0, (room - total - g * (blocks.length - 1)) / 2);
  for (const b of blocks) {
    b.draw(y);
    y += b.h + g;
  }

  ctx.textAlign = 'left';
  return canvas;
}

/** A PNG Blob of the card. */
export function cardBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** A file name like unis-uptown-harlem-rap-artist-of-the-day-rapking-story.png */
export function cardFileName(card, format) {
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const suffix = format === 'story' ? '-story' : '';
  return `unis-${slug(card.title)}-${slug(card.username)}${suffix}.png`.replace(/-+/g, '-');
}
