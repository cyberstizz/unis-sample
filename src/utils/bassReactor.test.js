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
 * Returns [{ t, kickHit, snareHit, snareSide, energy }] per frame.
 */
function run({ seconds = 8, fps = 60, voices = [], bass = 0, noise = 6, loudness = () => 0.2 }) {
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
    const out = det.process({ bins, rms: loudness(t), dt, nowMs: t * 1000 });
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
const hatsAt = (hits) => voice(hits, 1800, 5000, 170, 0.03); // crack, no body

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

  it('fires on snares and alternates sides so the logo sways', () => {
    const snares = beats(0.5 + BEAT, BEAT * 2, 8);
    const frames = run({ voices: snaresAt(snares) });
    const hitFrames = frames.filter((f) => f.snareHit > 0);
    expect(hitFrames).toHaveLength(snares.length);
    for (let i = 1; i < hitFrames.length; i++) {
      expect(hitFrames[i].snareSide).toBe(-hitFrames[i - 1].snareSide);
    }
  });

  it('does not mistake hi-hats (crack with no body) for snares', () => {
    const frames = run({ voices: [hatsAt(beats(0.5, BEAT / 2, 8))] });
    expect(hitTimes(frames, 'snareHit')).toHaveLength(0);
  });

  it('separates kick and snare in a full boom-bap pattern with hats', () => {
    const kicks = beats(0.5, BEAT * 2, 8);
    const snares = beats(0.5 + BEAT, BEAT * 2, 8);
    const hats = beats(0.5, BEAT / 2, 8);
    const frames = run({ bass: 150, voices: [kicksAt(kicks), ...snaresAt(snares), hatsAt(hats)] });
    const kHits = hitTimes(frames, 'kickHit');
    const sHits = hitTimes(frames, 'snareHit');
    expect(kHits).toHaveLength(kicks.length);
    expect(sHits).toHaveLength(snares.length);
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

  it('reports more energy in the hook than in the verse', () => {
    // 6s quiet verse, then a louder hook.
    const frames = run({ seconds: 10, loudness: (t) => (t < 6 ? 0.1 : 0.25) });
    const verse = frames.find((f) => Math.abs(f.t - 5.5) < 1e-6).energy;
    const hook = frames.find((f) => Math.abs(f.t - 7) < 1e-6).energy;
    expect(hook).toBeGreaterThan(verse + 0.3);
  });

  it('reset() clears state for a new song', () => {
    const det = createBeatDetector({ binHz: BIN_HZ, binCount: BINS });
    const bins = new Uint8Array(BINS).fill(200);
    det.process({ bins, rms: 0.2, dt: 1 / 60, nowMs: 0 });
    det.reset();
    const { kick, snare } = det._bands;
    expect(kick.mean).toBe(0);
    expect(snare.armed).toBe(true);
  });
});
