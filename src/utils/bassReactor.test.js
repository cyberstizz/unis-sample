// Unit tests for the v2 beat detector. No Web Audio here: we synthesize
// analyser-style byte spectra (kick, snare, hi-hat, sustained 808, noise)
// and check the detector fires on the right drums and nothing else.
import { describe, it, expect } from 'vitest';
import { createBeatDetector } from './bassReactor';

const SAMPLE_RATE = 48000;
const FFT = 2048;
const BIN_HZ = SAMPLE_RATE / FFT;
const BINS = FFT / 2;
const bin = (hz) => Math.round(hz / BIN_HZ);

// Deterministic PRNG so noise is identical every run.
function rng(seed = 7) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// A drum voice: jumps to `peak` at its onset, decays exponentially.
function voice(hits, loHz, hiHz, peak, decaySec) {
  return { hits, lo: bin(loHz), hi: bin(hiHz), peak, decaySec };
}

/**
 * Render a pattern and run it through a fresh detector.
 * Returns [{ t, kickHit, snareHit }] per frame.
 */
function run({ seconds = 8, fps = 60, voices = [], bass = 0, noise = 6 }) {
  const det = createBeatDetector({ binHz: BIN_HZ, binCount: BINS });
  const rand = rng();
  const frames = [];
  const dt = 1 / fps;
  const bins = new Uint8Array(BINS);
  for (let f = 0; f < seconds * fps; f++) {
    const t = f * dt;
    const spec = new Float32Array(BINS).fill(40);
    if (bass) for (let i = bin(40); i <= bin(130); i++) spec[i] = bass;
    for (const v of voices) {
      const last = v.hits.filter((h) => h <= t + 1e-9).pop();
      if (last === undefined) continue;
      const level = v.peak * Math.exp(-(t - last) / v.decaySec);
      for (let i = v.lo; i <= v.hi; i++) spec[i] = Math.max(spec[i], level);
    }
    for (let i = 0; i < BINS; i++) {
      bins[i] = Math.max(0, Math.min(255, Math.round(spec[i] + (rand() - 0.5) * 2 * noise)));
    }
    const out = det.process({ bins, dt, nowMs: t * 1000 });
    frames.push({ t, ...out });
  }
  return frames;
}

const BEAT = 60 / 90; // 90 BPM
const beats = (from, every, until) => {
  const out = [];
  for (let t = from; t < until; t += every) out.push(+t.toFixed(4));
  return out;
};
const kicksAt = (hits) => voice(hits, 40, 130, 235, 0.12);
const snaresAt = (hits) => [voice(hits, 1800, 5000, 210, 0.08), voice(hits, 180, 400, 190, 0.08)];
// Hats: sizzle up top plus some crack, but no snare body.
const hatsAt = (hits) => [voice(hits, 6000, 14000, 190, 0.03), voice(hits, 1800, 5000, 150, 0.03)];

const hitTimes = (frames, key) => frames.filter((f) => f[key] > 0).map((f) => f.t);
const nearest = (times, t) => Math.min(...times.map((x) => Math.abs(x - t)));

describe('bassReactor beat detector', () => {
  it('stays silent on silence', () => {
    const frames = run({ noise: 0 });
    expect(hitTimes(frames, 'kickHit')).toHaveLength(0);
    expect(hitTimes(frames, 'snareHit')).toHaveLength(0);
  });

  it('ignores a sustained 808/bassline (the v1 failure mode)', () => {
    const frames = run({ bass: 200 });
    expect(hitTimes(frames, 'kickHit')).toHaveLength(0);
  });

  it('fires once per kick, on the frame it lands, even over a sustained bass', () => {
    const kicks = beats(0.5, BEAT * 2, 8);
    const frames = run({ bass: 150, voices: [kicksAt(kicks)] });
    const hits = hitTimes(frames, 'kickHit');
    expect(hits).toHaveLength(kicks.length);
    for (const k of kicks) expect(nearest(hits, k)).toBeLessThanOrEqual(1 / 60 + 1e-6);
  });

  it('fires once per snare, on the frame it lands', () => {
    const snares = beats(0.5 + BEAT, BEAT * 2, 8);
    const hits = hitTimes(run({ voices: snaresAt(snares) }), 'snareHit');
    expect(hits).toHaveLength(snares.length);
    for (const s of snares) expect(nearest(hits, s)).toBeLessThanOrEqual(1 / 60 + 1e-6);
  });

  it('does not mistake hi-hats (crack with no body) for snares', () => {
    const frames = run({ voices: hatsAt(beats(0.5, BEAT / 2, 8)) });
    expect(hitTimes(frames, 'snareHit')).toHaveLength(0);
  });

  it('fires once per hi-hat, on the frame it lands', () => {
    const hats = beats(0.5, BEAT / 2, 8); // 8th notes
    const hits = hitTimes(run({ voices: hatsAt(hats) }), 'hatHit');
    expect(hits).toHaveLength(hats.length);
    for (const h of hats) expect(nearest(hits, h)).toBeLessThanOrEqual(1 / 60 + 1e-6);
  });

  it('does not fire the hi-hat on kicks', () => {
    const frames = run({ bass: 150, voices: [kicksAt(beats(0.5, BEAT, 8))] });
    expect(hitTimes(frames, 'hatHit')).toHaveLength(0);
  });

  it('catches kick, snare and hats separately in a full boom-bap pattern', () => {
    const kicks = beats(0.5, BEAT * 2, 8);
    const snares = beats(0.5 + BEAT, BEAT * 2, 8);
    const hats = beats(0.5, BEAT / 2, 8);
    const frames = run({ bass: 150, voices: [kicksAt(kicks), ...snaresAt(snares), ...hatsAt(hats)] });
    const kHits = hitTimes(frames, 'kickHit');
    const sHits = hitTimes(frames, 'snareHit');
    const hHits = hitTimes(frames, 'hatHit');
    expect(kHits).toHaveLength(kicks.length);
    expect(sHits).toHaveLength(snares.length);
    expect(hHits).toHaveLength(hats.length);
    for (const s of sHits) expect(nearest(kicks, s)).toBeGreaterThan(0.2); // no kick→snare bleed
  });

  it('gives every detected hit a visible minimum strength', () => {
    const frames = run({ bass: 150, voices: [kicksAt(beats(0.5, BEAT, 8))] });
    for (const f of frames.filter((x) => x.kickHit > 0)) {
      expect(f.kickHit).toBeGreaterThanOrEqual(0.35);
      expect(f.kickHit).toBeLessThanOrEqual(1);
    }
  });

  it('behaves the same at 120 Hz as at 60 Hz (ProMotion screens)', () => {
    const kicks = beats(0.5, BEAT, 8);
    const snares = beats(0.5 + BEAT / 2, BEAT, 8);
    const voices = [kicksAt(kicks), ...snaresAt(snares)];
    const at60 = run({ fps: 60, bass: 150, voices });
    const at120 = run({ fps: 120, bass: 150, voices });
    expect(hitTimes(at120, 'kickHit')).toHaveLength(hitTimes(at60, 'kickHit').length);
    expect(hitTimes(at120, 'snareHit')).toHaveLength(hitTimes(at60, 'snareHit').length);
  });

  it('reset() clears state for a new song', () => {
    const det = createBeatDetector({ binHz: BIN_HZ, binCount: BINS });
    const bins = new Uint8Array(BINS).fill(200);
    det.process({ bins, dt: 1 / 60, nowMs: 0 });
    det.reset();
    const { kick, snare } = det._bands;
    expect(kick.mean).toBe(0);
    expect(snare.armed).toBe(true);
  });
});
