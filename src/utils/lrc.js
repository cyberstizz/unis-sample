// src/utils/lrc.js
// ─────────────────────────────────────────────────────────────
// Timed lyrics helpers. Timed lyrics are stored as LRC text, one line per
// lyric line with its start time:  [01:02.35]Corner store still open late
// (songs.synced_lyrics, see backend sql/V2026_11d). The plain words stay in
// songs.lyrics.
//
//   parseLrc(text)          → [{ t, text }] sorted by time (seconds)
//   toLrc(lines)            → LRC text from [{ t, text }]
//   looksLikeLrc(text)      → true when most lines carry a time
//   wordsToLines(words)     → the non-blank lines of plain words
//   carryTimes(lines, old)  → [{ text, t|null }] keeping the time of every
//                             line whose words didn't change
//   activeIndex(lines, now) → index of the line being sung at `now`, or -1
//   formatStamp(t)          → "1:02.3"
// ─────────────────────────────────────────────────────────────

const TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET = /^\[offset:\s*([+-]?\d+)\s*\]$/i;

/** Lines start a hair early so the highlight lands with the voice. */
export const LEAD_SECONDS = 0.15;

export function parseLrc(text) {
  if (!text) return [];
  let offset = 0;
  const out = [];
  for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const off = line.match(OFFSET);
    if (off) { offset = Number(off[1]) / 1000; continue; }
    const times = [];
    let rest = line;
    TAG.lastIndex = 0;
    let m;
    // A line may carry several times: [00:12.00][00:58.10]Chorus line
    while ((m = TAG.exec(line)) && m.index === line.length - rest.length) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      times.push(Number(m[1]) * 60 + Number(m[2]) + frac);
      rest = line.slice(TAG.lastIndex);
    }
    if (!times.length) continue; // metadata like [ar:Name] or an untimed line
    const words = rest.trim();
    for (const t of times) out.push({ t: Math.max(0, t - offset), text: words });
  }
  return out.filter((l) => l.text).sort((a, b) => a.t - b.t);
}

const two = (n) => String(n).padStart(2, '0');

function stamp(t) {
  const cs = Math.max(0, Math.round(t * 100));
  return `[${two(Math.floor(cs / 6000))}:${two(Math.floor(cs / 100) % 60)}.${two(cs % 100)}]`;
}

export function toLrc(lines) {
  return lines
    .filter((l) => l.text && l.t != null)
    .map((l) => `${stamp(l.t)}${l.text}`)
    .join('\n');
}

export function looksLikeLrc(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return false;
  const timed = lines.filter((l) => /^\[\d{1,3}:\d{1,2}([.:]\d{1,3})?\]/.test(l)).length;
  return timed >= Math.max(1, lines.length * 0.5);
}

export function wordsToLines(words) {
  return String(words || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Lines whose words match an old timed line (in order) keep its time;
 * new or changed lines come back with t = null.
 */
export function carryTimes(lines, oldTimed) {
  const old = oldTimed || [];
  let from = 0;
  return lines.map((text) => {
    for (let i = from; i < old.length; i += 1) {
      if (old[i].text === text) {
        from = i + 1;
        return { text, t: old[i].t };
      }
    }
    return { text, t: null };
  });
}

export function activeIndex(lines, now) {
  if (!lines.length || now == null) return -1;
  const at = now + LEAD_SECONDS;
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t != null && lines[mid].t <= at) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

export function formatStamp(t) {
  if (t == null || Number.isNaN(t)) return '–:––';
  const tenths = Math.max(0, Math.round(t * 10));
  return `${Math.floor(tenths / 600)}:${two(Math.floor(tenths / 10) % 60)}.${tenths % 10}`;
}

export function formatClock(t) {
  if (!t || Number.isNaN(t)) return '0:00';
  return `${Math.floor(t / 60)}:${two(Math.floor(t % 60))}`;
}

/** Index of the first line whose time is earlier than the line before it, or -1. */
export function firstOutOfOrder(lines) {
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].t != null && lines[i - 1].t != null && lines[i].t < lines[i - 1].t) return i;
  }
  return -1;
}
