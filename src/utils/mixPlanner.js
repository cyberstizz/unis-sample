// src/utils/mixPlanner.js
//
// Decides HOW one song becomes the next, and lays out every curve of it.
// Pure functions: the playback engine runs the plan, the Now Playing strip
// and the Mix editor draw it, and both read the same numbers.
//
// Rules (from the Round 3 design):
//   • Only the outgoing song's OUTRO overlaps. The window starts on a bar line
//     at (or after) the measured outro start, never earlier: no verse is cut.
//   • The incoming song always starts from its beginning (after any silence).
//   • Releases (albums, EPs, mixtapes) play gapless in order unless the
//     listener turned on "Mix inside releases".
//   • Songs under 45 s or without a steady beat get a smooth 3 s fade.
//   • Tempos are only locked when they're within 8% (or half/double).
//
// Styles (t = seconds into the window, q = t / window length):
//   fade  equal-power: outgoing cos(q·π/2), incoming sin(q·π/2)
//   rise  outgoing high-pass 20 Hz → 1.4 kHz, fades over the last 30%;
//         incoming low-pass 500 Hz → 18 kHz, comes up over the first 60%
//   bass  both beat-locked; incoming's lows held at −26 dB; on the middle bar
//         line the lows swap within one beat; outgoing then fades out
//   echo  outgoing's last beat feeds a half-beat echo; it stops on the bar
//         line; the echo dies over 2 bars; incoming starts clean there
//   cut   outgoing stops on a bar line; incoming starts on the same beat
//   none  outgoing plays to its end; incoming starts right after (gapless)

export const STYLE_NAMES = { auto: 'Auto', fade: 'Fade', rise: 'Rise', bass: 'Bass swap', echo: 'Echo out', cut: 'Cut', none: 'None' };
export const STYLES = ['auto', 'fade', 'rise', 'bass', 'echo', 'cut', 'none'];
export const STYLE_DESC = {
  fade: 'Equal-power crossfade across the window',
  rise: 'Filter sweep: the bass thins out, the next song opens up',
  bass: 'Beat-locked, then the basslines swap on a bar line',
  echo: 'The last beat echoes out, the next song starts clean',
  cut: 'Straight switch on a bar line, no overlap',
  none: 'Plays to the end, then straight into the next song',
};

const HPI = Math.PI / 2;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const rmp = (x, a, b) => clamp01((x - a) / (b - a));
const sec = (ms) => (Number.isFinite(ms) ? ms / 1000 : null);

/** Camelot keys that mix without clashing: same key, ±1 on the wheel, or relative major/minor. */
export function keysFit(a, b) {
  const pa = /^(\d{1,2})([AB])$/.exec(a || ''); const pb = /^(\d{1,2})([AB])$/.exec(b || '');
  if (!pa || !pb) return true;   // unknown: don't count it against the mix
  const na = Number(pa[1]); const nb = Number(pb[1]);
  if (pa[2] === pb[2]) { const d = Math.abs(na - nb); return d === 0 || d === 1 || d === 11; }
  return na === nb;
}

/** Effective tempo of B against A (B, double or half), and the playback rate that locks them. */
export function tempoMatch(bpmA, bpmB) {
  if (!bpmA || !bpmB) return null;
  let best = null;
  [bpmB, bpmB * 2, bpmB / 2].forEach((eff) => {
    const rate = bpmA / eff;
    if (!best || Math.abs(rate - 1) < Math.abs(best.rate - 1)) best = { eff, rate };
  });
  return { ...best, within: Math.abs(best.rate - 1) <= 0.08, apart: Math.abs(best.rate - 1) };
}

const steady = (a) => !!(a && a.bpm && (a.bpmConfidence ?? 0) >= 0.15 && Number.isFinite(a.downbeatMs));

/**
 * Plans the transition from A to B.
 *   a, b        song analyses (getAnalysis) — may be null
 *   durA, durB  durations in seconds (from the element or the analysis)
 *   settings    playback settings
 *   override    { style, bars, startShift } from the playlist owner or the listener, or null
 *   sameRelease true when both songs are on the same release
 *
 * Returns null for a plain gapless change, or a plan object.
 */
export function planTransition({ a, b, durA, durB, settings, override = null, sameRelease = false }) {
  const mode = settings?.transitions || 'off';
  if (mode === 'off') return null;
  if (sameRelease && !settings?.mixReleases) return null;
  const dA = durA || sec(a?.durationMs) || 0;
  const dB = durB || sec(b?.durationMs) || 0;
  if (dA < 4 || dB < 4) return null;

  const leadB = sec(b?.leadSilenceMs) ?? 0;
  const tailA = Math.min(dA, sec(a?.tailSilenceMs) ?? dA);

  // Crossfade: a plain fade of the chosen length at the end of the music.
  if (mode === 'crossfade') {
    const xf = Math.min(settings.crossfadeSec || 6, Math.max(1, dA / 4), Math.max(1, dB / 4));
    return fadePlan({ aStart: Math.max(0, tailA - xf), len: xf, bStart: leadB, kind: 'crossfade', reason: `Crossfade · ${Math.round(xf)} s` });
  }

  // ---- Unis Mix ----
  const shortOrLoose = dA < 45 || dB < 45 || !steady(a) || !steady(b);
  const want = override && override.style && override.style !== 'auto' ? override.style : null;
  if (want === 'none') return null;
  if (shortOrLoose) {
    if (want === 'cut') return cutPlan({ aCut: tailA, bStart: leadB, reason: 'Cut' });
    return fadePlan({ aStart: Math.max(0, tailA - 3), len: 3, bStart: leadB, kind: 'mix', style: 'fade', reason: dA < 45 || dB < 45 ? 'Fade · short song' : 'Fade · no steady beat', auto: !want });
  }

  const bpmA = a.bpm; const bpmB = b.bpm;
  const beatA = 60 / bpmA; const barA = 4 * beatA;
  const downA = sec(a.downbeatMs);
  const outroA = Math.max(sec(a.outroStartMs) ?? tailA, downA);
  const match = tempoMatch(bpmA, bpmB);
  const fit = keysFit(a.camelot, b.camelot);

  // Bar grid of A: first bar line at or after the outro start.
  const k0 = Math.max(0, Math.ceil((outroA - downA) / barA - 0.05));
  const outroBar0 = downA + k0 * barA;
  const outroBars = Math.max(0, Math.floor((tailA - outroBar0) / barA + 0.05));

  let style = want;
  let bars = override?.bars || null;
  let reason = '';
  const introBarsB = (sec(b.introEndMs) ?? leadB) - leadB > 0 ? ((sec(b.introEndMs) - leadB) / (4 * 60 / bpmB)) : 0;
  if (!style) {
    if (outroBars < 1) { style = 'cut'; bars = 1; reason = 'the outgoing song ends cold'; }
    else if (!match.within) { style = 'echo'; bars = 2; reason = 'the tempos are far apart'; }
    else if (!fit) { style = 'fade'; bars = 2; reason = 'the keys clash'; }
    else if (introBarsB >= 4) { style = 'rise'; bars = outroBars >= 12 ? 8 : 4; reason = 'the next song opens quiet'; }
    else { style = 'bass'; bars = outroBars >= 12 ? 8 : 4; reason = `tempos ${Math.round(match.apart * 100)}% apart and the keys fit`; }
  }
  if (!bars) bars = style === 'echo' || style === 'cut' ? 2 : 4;

  // Fit the window inside the outro: never earlier than the outro's first bar.
  const shift = Math.max(0, override?.startShift || 0);
  let aStart = outroBar0 + shift * barA;
  while (bars > 1 && aStart + bars * barA > tailA + 0.05) bars = Math.max(1, bars / 2);
  if (aStart + bars * barA > tailA + 0.05) aStart = Math.max(outroBar0, tailA - bars * barA);
  if (outroBars < 1) { aStart = Math.max(downA, tailA - barA); bars = 1; }
  const win = bars * barA;
  const blended = style === 'fade' || style === 'rise' || style === 'bass';
  const half = Math.max(1, Math.round(bars / 2));
  const cutAt = style === 'cut' && outroBars < 1 ? tailA : aStart + (blended ? 0 : half * barA);

  // B's first downbeat lands on A's bar line. B may start a little early to
  // play its pickup, unless its intro before the first beat is long.
  const rate = blended && match.within ? match.rate : 1;
  const downB = sec(b.downbeatMs) ?? leadB;
  const pickup = Math.max(0, downB - leadB);
  const alignPoint = blended ? aStart : cutAt;
  const pickupReal = pickup / rate;
  const aligned = pickupReal <= 2 * barA;
  const bStartAt = aligned ? alignPoint - pickupReal : alignPoint;   // A-time when B starts

  const plan = {
    kind: 'mix', style, auto: !want, reason: want ? '' : reason,
    bars, barSec: barA, beatSec: beatA, aStart, aEnd: blended ? aStart + win : cutAt, cutAt, win,
    windowEnd: aStart + win,
    bStart: leadB, bStartAt, rate, glideSec: rate !== 1 ? 2 * barA : 0,
    bpmA, bpmB, effB: match.eff, keyFit: fit, tempoApart: match.apart,
  };
  plan.curves = curvesFor(plan);
  return plan;
}

function fadePlan({ aStart, len, bStart, kind, style = 'fade', reason = '', auto = true }) {
  const plan = {
    kind, style, auto, reason, bars: 0, barSec: len, beatSec: len / 4, aStart, aEnd: aStart + len, cutAt: aStart + len,
    win: len, windowEnd: aStart + len, bStart, bStartAt: aStart, rate: 1, glideSec: 0,
  };
  plan.curves = curvesFor(plan);
  return plan;
}

function cutPlan({ aCut, bStart, reason }) {
  const plan = {
    kind: 'mix', style: 'cut', auto: false, reason, bars: 1, barSec: 2, beatSec: 0.5, aStart: aCut - 2, aEnd: aCut, cutAt: aCut,
    win: 2, windowEnd: aCut, bStart, bStartAt: aCut, rate: 1, glideSec: 0,
  };
  plan.curves = curvesFor(plan);
  return plan;
}

/**
 * Every automation as a function of A-time (seconds on the outgoing song's
 * clock). Values: gains 0..1, lows 0..1 (1 = full bass), hp/lp in Hz,
 * send/feedback 0..1. `fa`/`fb` are the dashed "filter" lines the strip draws.
 */
export function curvesFor(p) {
  const s = p.style;
  const W0 = p.aStart; const W1 = p.windowEnd; const CUT = p.cutAt; const bar = p.barSec; const beat = p.beatSec;
  const q = (x) => rmp(x, W0, W1);
  const sw = p.bars ? 0.25 / p.bars : 0.05;
  const blended = s === 'fade' || s === 'rise' || s === 'bass';
  const gA = (x) => {
    if (s === 'echo' || s === 'cut') return x < CUT ? 1 : 0;
    if (x < W0) return 1;
    if (x >= W1) return 0;
    const v = q(x);
    if (s === 'rise') return v < 0.7 ? 1 : Math.cos(rmp(v, 0.7, 1) * HPI);
    if (s === 'bass') return v < 0.5 ? 1 : Math.cos(rmp(v, 0.5, 1) * HPI);
    return Math.cos(v * HPI);
  };
  const gB = (x) => {
    if (!blended) return x >= p.bStartAt ? 1 : 0;
    if (x < W0) return 0;
    const v = q(x);
    if (s === 'rise') return Math.sin(rmp(v, 0, 0.6) * HPI);
    if (s === 'bass') return Math.sin(rmp(v, 0, 0.25) * HPI);
    return Math.sin(v * HPI);
  };
  const loA = (x) => (s === 'bass' ? 1 - rmp(q(x), 0.5, 0.5 + sw) : 1);
  const loB = (x) => (s === 'bass' ? rmp(q(x), 0.5, 0.5 + sw) : 1);
  const hpA = (x) => (s === 'rise' ? 20 * Math.pow(70, q(x)) : 10);
  const lpB = (x) => (s === 'rise' ? 500 * Math.pow(36, rmp(q(x), 0, 0.9)) : 20000);
  const snA = (x) => (s === 'echo' && x >= CUT - beat && x < CUT ? 0.85 : 0);
  const fbA = (x) => (s === 'echo' ? (x < CUT ? 0.55 : 0.55 * (1 - rmp(x, CUT, CUT + 2 * bar))) : 0);
  let fa = null; let fb = null;
  if (s === 'bass') { fa = loA; fb = loB; }
  if (s === 'rise') { fa = (x) => 1 - q(x); fb = (x) => rmp(q(x), 0, 0.9); }
  if (s === 'echo') fa = (x) => (x < CUT - beat ? 0 : x < CUT ? 1 : 1 - rmp(x, CUT, CUT + 2 * bar));
  return { gA, gB, loA, loB, hpA, lpB, snA, fbA, fa, fb, echoEnd: s === 'echo' ? CUT + 2 * bar : null };
}

/** "Bass swap · 4 bars" style label for chips and the queue. */
export function planLabel(plan) {
  if (!plan) return 'None';
  if (plan.kind === 'crossfade') return plan.reason;
  const name = STYLE_NAMES[plan.style] || 'Fade';
  if (!plan.bars) return name;
  return `${name} · ${plan.bars} ${plan.bars === 1 ? 'bar' : 'bars'}`;
}

/** Levelling gain (linear) for a song, or for a whole release (album mode). */
export function levelGain({ analysis, target, albumLufs = null, albumPeak = null }) {
  if (target == null || !analysis || analysis.lufs == null) return 1;
  const lufs = albumLufs ?? analysis.lufs;
  const peak = albumPeak ?? analysis.truePeak ?? 0;
  let db = target - lufs;
  // Turning up stops 1 dB short of the song's peaks. Loud may go further:
  // the limiter after the mix catches the peaks (as Spotify's Loud does).
  if (db > 0 && target > -12) db = Math.min(db, 6);
  else if (db > 0) db = Math.min(db, Math.max(0, -1 - peak));
  db = Math.max(-24, Math.min(12, db));
  return Math.pow(10, db / 20);
}

/** Loudness of a whole release (energy average weighted by length) and its loudest peak. */
export function albumLoudness(analyses) {
  const rows = (analyses || []).filter((x) => x && x.lufs != null && x.durationMs);
  if (rows.length < 2) return null;
  let e = 0; let d = 0; let peak = -120;
  rows.forEach((x) => { e += x.durationMs * Math.pow(10, x.lufs / 10); d += x.durationMs; peak = Math.max(peak, x.truePeak ?? -120); });
  return { lufs: 10 * Math.log10(e / d), peak };
}
