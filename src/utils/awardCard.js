// Draws a winner's share card (1080×1350, Instagram's 4:5 portrait) on a
// canvas, from the card data GET /v1/awards/{id}/card returns. Used by the
// award page (/award/:id) and Admin → Announcements.
//
// Text and the Unis wordmark only, no photo: photos live on another domain
// (R2), and drawing one would block the image download. The award page shows
// the photo next to the card instead.
import logo from '../assets/unisLogoThree.svg';

export const CARD_W = 1080;
export const CARD_H = 1350;

// The wordmark sits in a 1024-unit square SVG; this is its box inside it.
const MARK = { x: 40, y: 360, w: 950, h: 224, unit: 1024 };

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "Inter, Arial, sans-serif";

let logoPromise = null;
const loadLogo = () => {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = logo;
    });
  }
  return logoPromise;
};

const loadFonts = async () => {
  try {
    if (!document.fonts?.load) return;
    await Promise.all([
      document.fonts.load(`400 120px ${SERIF}`),
      document.fonts.load(`600 40px ${SANS}`),
      document.fonts.load(`700 40px ${SANS}`),
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

/** Draws the card for `card` onto `canvas` (resized to 1080×1350). */
export async function drawAwardCard(canvas, card, { host = window.location.host } = {}) {
  await loadFonts();
  const mark = await loadLogo();
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const pad = 88;
  const inner = CARD_W - pad * 2;

  // Night background with a blue glow, like the Coming soon page.
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#07080c');
  bg.addColorStop(1, '#0c1430');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W * 0.78, 120, 40, CARD_W * 0.78, 120, 900);
  glow.addColorStop(0, 'rgba(30, 80, 235, 0.55)');
  glow.addColorStop(1, 'rgba(30, 80, 235, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Equalizer bars along the foot, the Unis skyline.
  ctx.fillStyle = 'rgba(30, 80, 235, 0.28)';
  const bars = 36;
  const barW = CARD_W / bars;
  for (let i = 0; i < bars; i += 1) {
    const h = 40 + ((Math.sin(i * 1.7) + 1) / 2) * 120 + ((i * 37) % 50);
    ctx.fillRect(i * barW + 3, CARD_H - h, barW - 6, h);
  }

  // Wordmark.
  if (mark) {
    const scale = mark.naturalWidth / MARK.unit || 1;
    const w = 260;
    const h = (w * MARK.h) / MARK.w;
    ctx.drawImage(mark, MARK.x * scale, MARK.y * scale, MARK.w * scale, MARK.h * scale, pad, pad, w, h);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 56px ${SANS}`;
    ctx.textBaseline = 'top';
    ctx.fillText('UNIS', pad, pad);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // The award, in small capitals: ARTIST OF THE DAY.
  const kind = card.targetType === 'song' ? 'Song' : 'Artist';
  const award = `${kind} of the ${card.unit || 'Day'}`.toUpperCase();
  ctx.fillStyle = '#8fa8ff';
  ctx.font = `700 34px ${SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText(award, pad, 360);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // Where and what: Uptown Harlem · Rap
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.font = `600 40px ${SANS}`;
  const where = [card.jurisdiction, card.genre].filter(Boolean).join(' · ');
  ctx.fillText(wrap(ctx, where, inner, 1)[0] || '', pad, 420);

  // The winner, as big as it fits between the labels above and the dates below.
  const top = 476;
  const bottom = 968;
  const song = card.targetType === 'song' && card.songTitle;
  const text = song ? `\u201c${card.songTitle}\u201d` : String(card.username || '');
  const maxLines = song ? 3 : 2;
  const room = bottom - top - (song ? 72 : 0);
  let size = song ? 150 : 190;
  let lines = [];
  for (; size >= 60; size -= 4) {
    ctx.font = `400 ${size}px ${SERIF}`;
    lines = wrap(ctx, text, inner, 99);
    if (lines.length <= maxLines && size * 0.8 + (lines.length - 1) * size * 1.02 + size * 0.25 <= room) break;
  }
  ctx.font = `400 ${size}px ${SERIF}`;
  lines = wrap(ctx, text, inner, maxLines);
  ctx.fillStyle = '#ffffff';
  let y = top + size * 0.8;
  lines.forEach((line, i) => ctx.fillText(line, pad, y + i * size * 1.02));
  if (song) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.font = `600 48px ${SANS}`;
    const byY = y + (lines.length - 1) * size * 1.02 + size * 0.25 + 56;
    ctx.fillText(wrap(ctx, `by ${card.username}`, inner, 1)[0], pad, byY);
  }

  // When, and who decided it.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
  ctx.font = `600 38px ${SANS}`;
  ctx.fillText(wrap(ctx, card.periodLabel ? `For ${card.periodLabel}` : '', inner, 1)[0] || '', pad, 1036);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.font = `400 34px ${SANS}`;
  const decided = `Decided by ${card.jurisdiction || 'the neighborhood'}'s votes, plays and likes`;
  wrap(ctx, decided, inner, 2).forEach((line, i) => ctx.fillText(line, pad, 1084 + i * 44));

  // Where to hear it.
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 34px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText(host, CARD_W - pad, pad + 44);
  ctx.textAlign = 'left';
  return canvas;
}

/** A PNG Blob of the card. */
export function cardBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** A file name like unis-uptown-harlem-rap-artist-of-the-day-rapking.png */
export function cardFileName(card) {
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `unis-${slug(card.title)}-${slug(card.username)}.png`.replace(/-+/g, '-');
}
