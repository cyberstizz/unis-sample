// Draws the "My vote for …" share image (1080×1920, an Instagram/TikTok story)
// on a canvas, after someone votes. Same family as the award card
// (utils/awardCard.js): night background, Instrument Serif name, the Unis
// equalizer skyline along the foot — but in the voter's theme colour and built
// around the pick's artwork.
//
// Artwork: songs and photos come from cdn.unismusic.com, whose CORS policy
// allows unismusic.com (and dev), so loading with crossOrigin="anonymous"
// keeps the canvas exportable. If the artwork still fails to load, the card is
// drawn without it rather than not at all.
//
// Instagram covers roughly the top 250px and bottom 250px of a story with its
// own buttons, so nothing important is drawn there.
import logo from '../assets/unisLogoThree.svg';

export const VOTE_CARD_W = 1080;
export const VOTE_CARD_H = 1920;

// The voter's themed logo (the same file the header shows). Every theme's
// logo is a wordmark in the middle band of a transparent square, so it's
// trimmed to its visible letters before drawing. The blue SVG is the fallback.
const findMarkBox = (img) => {
  try {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    const { data } = g.getImageData(0, 0, S, S);
    let minX = S; let minY = S; let maxX = -1; let maxY = -1;
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        if (data[(y * S + x) * 4 + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    const k = img.naturalWidth / S;
    const kh = img.naturalHeight / S;
    return { sx: minX * k, sy: minY * kh, sw: (maxX - minX + 1) * k, sh: (maxY - minY + 1) * kh };
  } catch {
    return null; // can't read pixels — draw the whole image instead
  }
};

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = 'Inter, Arial, sans-serif';

const loadImage = (src, { cors = false } = {}) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  if (cors) img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const loadFonts = async () => {
  try {
    if (!document.fonts?.load) return;
    await Promise.all([
      document.fonts.load(`italic 400 200px ${SERIF}`),
      document.fonts.load(`600 40px ${SANS}`),
      document.fonts.load(`800 40px ${SANS}`),
    ]);
  } catch {
    // Fallback fonts are fine.
  }
};

/** '#4A1A8C' / 'rgb(74, 26, 140)' → [r, g, b]; null if unreadable. */
export const parseColor = (value) => {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgb ? [rgb[1], rgb[2], rgb[3]].map(Number) : null;
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

/** Splits text into lines that fit maxWidth, at most maxLines (last one ellipsized). */
const wrap = (ctx, text, maxWidth, maxLines) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
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

/** Draws `img` covering the box (like object-fit: cover). */
const drawCover = (ctx, img, x, y, w, h) => {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
};

/**
 * Draws the card onto `canvas` (resized to 1080×1920).
 *
 * vote: {
 *   kind: 'artist' | 'song',
 *   name,            // artist name, or song title
 *   artistName,      // song votes: who made it
 *   award,           // "Artist of the Week"
 *   place,           // "Downtown Harlem"
 *   genre,           // "Rap"
 *   closes,          // "Voting for this week closes Sunday at midnight"
 *   artworkUrl,      // the pick's artwork / photo
 *   themeColor,      // the voter's --unis-primary
 *   logoSrc,         // the voter's themed logo (LOGO_MAP[theme])
 * }
 */
export async function drawVoteCard(canvas, vote, { host = window.location.host } = {}) {
  const [, mark, art] = await Promise.all([
    loadFonts(),
    loadImage(vote.logoSrc || logo),
    loadImage(vote.artworkUrl, { cors: true }),
  ]);

  canvas.width = VOTE_CARD_W;
  canvas.height = VOTE_CARD_H;
  const ctx = canvas.getContext('2d');
  const W = VOTE_CARD_W;
  const H = VOTE_CARD_H;
  const pad = 96;
  const inner = W - pad * 2;

  const night = [7, 8, 12];
  const theme = parseColor(vote.themeColor) || [22, 51, 135];
  const light = mix(theme, [255, 255, 255], 0.62);
  const mid = mix(theme, [255, 255, 255], 0.3);
  const isSong = vote.kind === 'song';

  // Night sky, fading into the theme colour at the foot.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, css(night));
  bg.addColorStop(1, css(mix(night, theme, 0.22)));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // The artwork, blown up and blurred, glowing behind the cover.
  // Skipped where canvas blur isn't supported (an unblurred copy looks wrong).
  if (art && 'filter' in ctx) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.filter = 'blur(120px)';
    drawCover(ctx, art, 140, 330, 800, 800);
    ctx.restore();
  }

  // Theme glow, top right.
  const glow = ctx.createRadialGradient(W * 0.8, 110, 40, W * 0.8, 110, 900);
  glow.addColorStop(0, css(theme, 0.55));
  glow.addColorStop(1, css(theme, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Equalizer skyline along the foot (same bars as the award card).
  ctx.fillStyle = css(mid, 0.3);
  const bars = 36;
  const barW = W / bars;
  for (let i = 0; i < bars; i += 1) {
    const h = 40 + ((Math.sin(i * 1.7) + 1) / 2) * 120 + ((i * 37) % 50);
    ctx.fillRect(i * barW + 3, H - h, barW - 6, h);
  }

  // Wordmark + where to vote.
  const topY = 150;
  const box = mark ? (findMarkBox(mark) || { sx: 0, sy: 0, sw: mark.naturalWidth, sh: mark.naturalHeight }) : null;
  if (mark && box.sw > 0 && box.sh > 0) {
    const h = Math.min(64, (260 * box.sh) / box.sw);
    const w = (h * box.sw) / box.sh;
    ctx.drawImage(mark, box.sx, box.sy, box.sw, box.sh, pad, topY - h / 2, w, h);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 54px ${SANS}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('UNIS', pad, topY);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `700 32px ${SANS}`;
  ctx.fillText(host, W - pad, topY);

  // The pick: 600px cover (circle for artists, rounded square for songs),
  // a theme ring around it, the check seal on its corner.
  const size = 600;
  const cx = W / 2;
  const top = 330;
  const left = cx - size / 2;
  const radius = isSong ? 56 : size / 2;

  ctx.save();
  ctx.strokeStyle = css(mid, 0.55);
  ctx.lineWidth = 4;
  roundRect(ctx, left - 22, top - 22, size + 44, size + 44, isSong ? 72 : (size + 44) / 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 90;
  ctx.shadowOffsetY = 40;
  roundRect(ctx, left, top, size, size, radius);
  ctx.fillStyle = css(mix(night, theme, 0.35));
  ctx.fill();
  ctx.restore();

  if (art) {
    ctx.save();
    roundRect(ctx, left, top, size, size, radius);
    ctx.clip();
    drawCover(ctx, art, left, top, size, size);
    ctx.restore();
  }

  const sealR = 75;
  const sealX = isSong ? left + size + 30 - sealR : left + size - 10 - sealR;
  const sealY = isSong ? top + size + 30 - sealR : top + size - 10 - sealR;
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0c14';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR - 10, 0, Math.PI * 2);
  ctx.fillStyle = css(theme);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sealX - 28, sealY + 2);
  ctx.lineTo(sealX - 8, sealY + 22);
  ctx.lineTo(sealX + 30, sealY - 20);
  ctx.stroke();

  // The words.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = 1050;

  ctx.fillStyle = css(light);
  ctx.font = `700 34px ${SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '7px';
  ctx.fillText(wrap(ctx, `MY VOTE FOR ${String(vote.award || '').toUpperCase()}`, inner, 1)[0] || '', cx, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // The name, as big as fits in two lines.
  const text = String(vote.name || '');
  let fontSize = 230;
  let lines = [];
  for (; fontSize >= 90; fontSize -= 6) {
    ctx.font = `italic 400 ${fontSize}px ${SERIF}`;
    lines = wrap(ctx, text, inner, 99);
    if (lines.length <= 2 && lines.length * fontSize * 0.98 <= 380) break;
  }
  ctx.font = `italic 400 ${fontSize}px ${SERIF}`;
  lines = wrap(ctx, text, inner, 2);
  ctx.fillStyle = '#ffffff';
  y += 30 + fontSize * 0.8;
  lines.forEach((line, i) => ctx.fillText(line, cx, y + i * fontSize * 0.98));
  y += (lines.length - 1) * fontSize * 0.98;

  if (isSong && vote.artistName) {
    y += 76;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = `600 46px ${SANS}`;
    ctx.fillText(wrap(ctx, `by ${vote.artistName}`, inner, 1)[0], cx, y);
  }

  const where = [vote.place, vote.genre].filter(Boolean).join(' · ');
  if (where) {
    y += 76;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.font = `600 40px ${SANS}`;
    ctx.fillText(wrap(ctx, where, inner, 1)[0], cx, y);
  }

  // Call to action, above Instagram's reply bar.
  const pillY = H - 300 - 96 - 50;
  ctx.font = `800 38px ${SANS}`;
  const label = 'Cast yours on Unis  →';
  const pillW = ctx.measureText(label).width + 88;
  roundRect(ctx, cx - pillW / 2, pillY, pillW, 96, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#0a0c14';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, pillY + 50);

  if (vote.closes) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `600 32px ${SANS}`;
    ctx.fillText(wrap(ctx, vote.closes, inner, 1)[0], cx, pillY + 96 + 50);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return canvas;
}

/** A PNG Blob of the card. */
export function voteCardBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** A file name like unis-my-vote-artist-of-the-week-stizz.png */
export function voteCardFileName(vote) {
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `unis-my-vote-${slug(vote.award)}-${slug(vote.name)}.png`.replace(/-+/g, '-');
}
