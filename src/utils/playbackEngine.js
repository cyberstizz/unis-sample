// src/utils/playbackEngine.js
//
// The player's sound engine: volume levelling, Crossfade and Unis Mix.
//
// TWO DECKS. The player's own <audio> element (audioRef) always holds the song
// on screen. When a transition comes up, the engine loads the next song on a
// second element (the spare deck), starts it muted a moment early, then runs
// the plan from mixPlanner.js on both lanes of the Web Audio graph
// (audioGraph.js). When the incoming song becomes audible the decks swap:
// audioRef.current now points at the incoming deck and the player moves to
// the next song (the host's advanceTo), without reloading it. The outgoing
// deck keeps playing its outro until the plan says it's gone, then becomes
// the spare.
//
// BEAT LOCK. The incoming deck plays at the plan's rate (pitch kept) so its
// beat matches the outgoing song's, and every tick a drift check nudges the
// rate (±3%) to keep the two in phase. After the outgoing song is gone, the
// rate eases back to 100% over two bars.
//
// LEVELLING. Every song's lane gain is set from its measured loudness and the
// listener's target (playbackSettings). Playing a release levels it as a whole.
//
// SAFETY.
//   • Nothing is routed through Web Audio until the graph is running, so a
//     suspended graph can never silence a song.
//   • If the page is in the background when a blend is due, the engine lets
//     the song end normally (timers are throttled there).
//   • Skipping, seeking or pausing during a blend finishes it at once.
//   • Videos and repeat-one never blend.

import { useSyncExternalStore } from 'react';
import {
  graphSupported, laneFor, resetLane, setLaneLevel, ensureRunning, isRouted, getContext,
} from './audioGraph';
import { getPlaybackSettings, subscribePlaybackSettings, LEVEL_TARGETS } from './playbackSettings';
import { getAnalysis, getAnalysisRecord, loadAnalysis, subscribeAnalysis } from './songAnalysis';
import { planTransition, levelGain, albumLoudness, planLabel, STYLE_NAMES } from './mixPlanner';
import { scheduleBlend } from './mixAutomation';

const TICK_MS = 100;
const PREROLL = 0.6;      // seconds the incoming deck runs muted before it's heard
const PRELOAD = 25;       // seconds before the blend: load the next song

const urlOf = (item) => item?.url || item?.fileUrl || item?.mediaUrl || null;
const idOf = (item) => item?.id || item?.songId || null;
const isSong = (item) => !!item && item.type !== 'video' && !!urlOf(item);
const pairKey = (a, b) => `${a?.qid || idOf(a)}>${b?.qid || idOf(b)}`;

// Stops a deck and lets go of its file. The player's own <audio> keeps its
// <source> child, so it's only paused (unloading it would load that source).
function unload(el) {
  if (!el) return;
  try { el.pause(); } catch { /* noop */ }
  if (el.querySelector && el.querySelector('source')) return;
  try { el.removeAttribute('src'); el.load(); } catch { /* noop */ }
}

// iPhones ignore element.volume; without Web Audio a blend can't be done there.
let volumeOk = null;
function volumeWritable() {
  if (volumeOk !== null) return volumeOk;
  try { const t = document.createElement('audio'); t.volume = 0.5; volumeOk = Math.abs(t.volume - 0.5) < 0.01; } catch { volumeOk = false; }
  return volumeOk;
}

class PlaybackEngine {
  constructor() {
    this.audioRef = null;
    this.host = null;
    this.spare = null;
    this.prep = null;
    this.blend = null;
    this.handoff = null;
    this.sessionOverrides = new Map();
    this.listeners = new Set();
    this.snap = { phase: 'idle' };
    this.timer = null;
    this.tickN = 0;
    if (typeof window !== 'undefined') {
      subscribePlaybackSettings(() => { this.prep = null; this.applyLevels(); this.emit(true); });
      subscribeAnalysis(() => { this.applyLevels(); this.prep = this.prep && this.prep.ready ? this.prep : null; });
    }
  }

  // ------------------------------------------------------------------ wiring

  /**
   * host.current = {
   *   getCurrent()          the queue item on screen
   *   getQueueItems()       the whole queue (for analysis prefetch and album levelling)
   *   peekNext()            { item, index, autoplay } the song next() would play, or null
   *   advanceTo(next)       move the player to it (same as next(), without reloading)
   *   overrideFor(a, b)     a playlist owner's saved transition for this pair, or null
   *   onOutgoingFinished(a) the outgoing song counts as played to the end
   *   isRepeatOne()
   * }
   */
  attach(audioRef, host) {
    this.audioRef = audioRef;
    this.host = host;
    if (!this.timer && typeof window !== 'undefined') this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  getSnapshot() { return this.snap; }

  emit(force = false) {
    const s = this.computeSnap();
    if (!force && sameSnap(s, this.snap)) return;
    this.snap = s;
    this.listeners.forEach((fn) => { try { fn(s); } catch (e) { console.error('[engine] listener failed:', e); } });
  }

  /** A-clock time of the outgoing song while armed/mixing (for the strip's playhead). */
  liveTime() {
    if (this.blend) return this.blend.A.currentTime;
    const el = this.audioRef?.current;
    return el ? el.currentTime : 0;
  }

  // ------------------------------------------------------------------ player hooks

  /**
   * Player calls this at the top of its "load the new track" effect. True
   * means the engine already has this item playing on the active deck: skip
   * the reload.
   */
  consumeHandoff(item) {
    const h = this.handoff;
    if (!h) return false;
    this.handoff = null;
    const el = this.audioRef?.current;
    return !!(el && el === h.el && (item?.qid ? item.qid === h.qid : idOf(item) === h.id));
  }

  /** Player: a new track was loaded the normal way (not a handoff). */
  onTrackChange() {
    if (this.blend) this.finishBlend(true);
    this.dropPrep();
    this.pauseIdleDecks();
    this.applyLevels();
    const items = this.host?.current?.getQueueItems?.() || [];
    if (items.length) loadAnalysis(items.slice(0, 120));
    this.emit(true);
  }

  /** Player: skip, previous, seek or a pick from the queue. */
  onUserJump() {
    if (this.blend) this.finishBlend(true);
    this.dropPrep();
  }

  /** Player: the active deck paused. A blend in progress finishes at once. */
  onPause() {
    if (this.blend) this.finishBlend(true);
  }

  /** Now Playing chips: this listener's style for the coming transition (this session only). */
  setSessionStyle(style) {
    const cur = this.host?.current?.getCurrent?.();
    const nxt = this.host?.current?.peekNext?.();
    if (!cur || !nxt?.item) return;
    const k = pairKey(cur, nxt.item);
    if (!style || style === 'auto') this.sessionOverrides.delete(k); else this.sessionOverrides.set(k, style);
    if (!this.blend) this.dropPrep();
    this.emit(true);
  }

  // ------------------------------------------------------------------ levelling

  gainFor(item) {
    const target = LEVEL_TARGETS[getPlaybackSettings().level];
    if (target == null || !isSong(item)) return 1;
    const a = getAnalysis(item);
    if (!a) return 1;
    let album = null;
    const origin = item.origin;
    if (origin?.type === 'playlist' && a.releaseId && a.releaseId === origin.playlistId && origin.batchId) {
      const mates = (this.host?.current?.getQueueItems?.() || []).filter((q) => q.origin?.batchId === origin.batchId);
      album = albumLoudness(mates.map((q) => getAnalysis(q)));
    }
    return levelGain({ analysis: a, target, albumLufs: album?.lufs ?? null, albumPeak: album?.peak ?? null });
  }

  applyLevels() {
    const el = this.audioRef?.current;
    const item = this.host?.current?.getCurrent?.();
    if (!el || !item || item.type === 'video') return;
    const gain = this.gainFor(item);
    if (this.blend) return;   // a running blend owns both lanes' levels
    if (gain === 1 && !isRouted(el)) return;   // nothing to change: leave the element as it is
    ensureRunning().then((ok) => {
      if (!ok || this.audioRef?.current !== el) return;
      const lane = laneFor(el);
      if (lane) setLaneLevel(lane, gain, isRouted(el) ? 1.2 : 0.05);
    });
  }

  // ------------------------------------------------------------------ the loop

  tick() {
    this.tickN++;
    const el = this.audioRef?.current;
    if (!el) { this.pauseAllDecks(); if (this.blend) this.finishBlend(true); return; }
    if (this.blend) { this.stepBlend(); if (this.tickN % 2 === 0) this.emit(); return; }

    const host = this.host?.current;
    const cur = host?.getCurrent?.();
    const settings = getPlaybackSettings();
    if (!cur || !isSong(cur) || settings.transitions === 'off' || host?.isRepeatOne?.() || el.paused || !Number.isFinite(el.duration)) {
      if (this.prep) this.dropPrep();
      if (this.tickN % 3 === 0) this.emit();
      return;
    }

    const t = el.currentTime;
    const remaining = el.duration - t;
    if (remaining > 150) { if (this.tickN % 5 === 0) this.emit(); return; }

    // Plan (or re-plan) the coming transition.
    const nxt = host.peekNext?.();
    if (!nxt?.item || !isSong(nxt.item)) { if (this.prep) this.dropPrep(); this.emit(); return; }
    const key = pairKey(cur, nxt.item);
    if (!this.prep || this.prep.key !== key) {
      this.dropPrep();
      const a = getAnalysis(cur); const b = getAnalysis(nxt.item);
      if (!getAnalysisRecord(cur) || !getAnalysisRecord(nxt.item)) loadAnalysis([cur, nxt.item]);
      const recA = getAnalysisRecord(cur); const recB = getAnalysisRecord(nxt.item);
      const sameRelease = !!(recA?.releaseId && recA.releaseId === recB?.releaseId);
      const session = this.sessionOverrides.get(key);
      const owner = host.overrideFor?.(cur, nxt.item) || null;
      const override = session ? { style: session } : owner;
      const plan = planTransition({
        a, b, durA: el.duration, durB: b?.durationMs ? b.durationMs / 1000 : (nxt.item.duration > 1000 ? nxt.item.duration / 1000 : null) || 180,
        settings, override, sameRelease,
      });
      this.prep = { key, plan, next: nxt, ready: !!(a && b), loaded: false, outgoing: cur, override, owner: !!owner && !session, session: session || null };
    }
    const prep = this.prep;
    const plan = prep.plan;
    if (!plan) { this.emit(); return; }

    // Load the next song on the spare deck.
    if (!prep.loaded && t >= plan.bStartAt - PRELOAD) {
      const deck = this.deck();
      deck.src = urlOf(prep.next.item);
      deck.preload = 'auto';
      try { deck.load(); } catch { /* noop */ }
      prep.loaded = true;
      ensureRunning();   // wake the graph now, so the blend can use it
    }

    // Start the blend.
    const lead = plan.bStartAt - t;
    if (prep.loaded && lead <= PREROLL && lead > -0.25) {
      if (typeof document !== 'undefined' && document.hidden) {
        // Background: let the song end on its own (no blend).
        this.dropPrep(true);
      } else {
        this.startBlend(prep);
      }
    } else if (lead <= -0.25 && !this.blend) {
      // Missed it (seeked past, or a slow tick): play on normally.
      this.dropPrep(true);
    }
    this.emit();
  }

  deck() {
    if (!this.spare || this.spare === this.audioRef?.current) {
      const el = document.createElement('audio');
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.className = 'hidden-media unis-deck';
      el.style.display = 'none';
      document.body.appendChild(el);
      this.spare = el;
    }
    return this.spare;
  }

  dropPrep(keepDeck = false) {
    if (this.prep?.loaded && !keepDeck && this.spare && this.spare !== this.audioRef?.current) unload(this.spare);
    this.prep = keepDeck ? { ...this.prep, plan: null, dead: true } : null;
  }

  pauseIdleDecks() {
    const active = this.audioRef?.current;
    [this.spare, this.blend?.A].forEach((d) => { if (d && d !== active && !d.paused) { try { d.pause(); } catch { /* noop */ } } });
  }

  pauseAllDecks() {
    [this.spare, this.blend?.A, this.blend?.B].forEach((d) => { if (d && !d.paused) { try { d.pause(); } catch { /* noop */ } } });
  }

  // ------------------------------------------------------------------ blends

  startBlend(prep) {
    const A = this.audioRef.current;
    const B = this.spare;
    const plan = prep.plan;
    if (!A || !B || B === A) { this.dropPrep(); return; }
    const useGraph = graphSupported() && getContext()?.state === 'running';
    const laneA = useGraph ? laneFor(A) : null;
    const laneB = useGraph ? laneFor(B) : null;
    const viaGraph = !!(laneA && laneB);
    if (!viaGraph && !volumeWritable()) { this.dropPrep(true); return; }

    B.volume = A.volume;
    B.muted = A.muted;
    try { B.preservesPitch = true; B.mozPreservesPitch = true; B.webkitPreservesPitch = true; } catch { /* noop */ }
    B.playbackRate = plan.rate || 1;

    const aNow = A.currentTime;
    const lead = Math.max(0, plan.bStartAt - aNow);
    // B reaches plan.bStart exactly when A reaches plan.bStartAt.
    const startDelay = Math.max(0, lead - plan.bStart / (plan.rate || 1));
    B.currentTime = Math.max(0, plan.bStart - (lead - startDelay) * (plan.rate || 1));

    const blend = {
      plan, A, B, laneA, laneB, viaGraph, prep,
      outgoing: prep.outgoing, incoming: prep.next.item, next: prep.next,
      swapped: false, bStarted: false, finishedA: false, volA: A.volume,
      gainA: this.gainFor(prep.outgoing), gainB: this.gainFor(prep.next.item),
    };
    this.blend = blend;
    this.prep = null;

    if (viaGraph) {
      scheduleBlend(laneA, laneB, plan, aNow, blend.gainB);
    } else {
      B.volume = 0;   // element-volume fallback (no Web Audio): gains applied each tick
    }

    const go = () => {
      if (this.blend !== blend) return;
      B.play().then(() => { blend.bStarted = true; }).catch((err) => {
        console.warn('[engine] the next song would not start; playing on normally:', err?.message || err);
        if (this.blend === blend) this.abortBlend();
      });
    };
    if (startDelay > 0.01) setTimeout(go, startDelay * 1000); else go();
  }

  stepBlend() {
    const bl = this.blend;
    const { plan, A, B } = bl;
    const x = A.currentTime;
    const cv = plan.curves;

    // The incoming song becomes the one on screen as soon as it's heard.
    if (!bl.swapped && bl.bStarted && (x >= plan.bStartAt - 0.02 || A.ended)) {
      bl.swapped = true;
      this.handoff = { el: B, qid: bl.incoming.qid, id: idOf(bl.incoming) };
      this.audioRef.current = B;
      try { this.host?.current?.onOutgoingFinished?.(bl.outgoing); } catch (e) { console.error(e); }
      try { this.host?.current?.advanceTo?.(bl.next); } catch (e) { console.error(e); }
    }

    // Element-volume fallback: apply the gain curves by hand.
    if (!bl.viaGraph) {
      const ua = Math.max(0, Math.min(1, cv.gA(x)));
      const ub = Math.max(0, Math.min(1, cv.gB(x)));
      try { if (!bl.finishedA) A.volume = bl.volA * ua; } catch { /* iOS: read-only */ }
      try { B.volume = bl.volA * ub; } catch { /* noop */ }
    }

    // Beat lock: keep B where A says it should be.
    if (bl.bStarted && !bl.finishedA && plan.rate && x >= plan.bStartAt && x < plan.aEnd) {
      const expected = plan.bStart + (x - plan.bStartAt) * plan.rate;
      const err = B.currentTime - expected;
      if (Math.abs(err) > 0.3) { try { B.currentTime = expected; } catch { /* noop */ } }
      else B.playbackRate = plan.rate * (1 - Math.max(-0.03, Math.min(0.03, err * 0.8)));
    }

    // Outgoing song done: stop it, then ease the incoming back to 100%.
    if (!bl.finishedA && (x >= plan.aEnd || A.ended)) {
      bl.finishedA = true;
      bl.glideFrom = B.playbackRate;
      bl.glideStart = performance.now();
      try { A.pause(); } catch { /* noop */ }   // an echo keeps ringing in the graph's delay line
    }
    if (bl.finishedA) {
      const dur = (plan.glideSec || 0) * 1000;
      const k = dur > 0 ? Math.min(1, (performance.now() - bl.glideStart) / dur) : 1;
      if (B.playbackRate !== 1) B.playbackRate = bl.glideFrom + (1 - bl.glideFrom) * k;
      const echoDone = !plan.curves.echoEnd || (performance.now() - bl.glideStart) / 1000 > 2 * plan.barSec;
      if (k >= 1 && echoDone) this.endBlend();
    }
  }

  /** Normal end: the outgoing deck becomes the spare, lanes back to neutral. */
  endBlend() {
    const bl = this.blend;
    if (!bl) return;
    this.blend = null;
    const { A, B } = bl;
    unload(A);
    try { A.volume = bl.volA; } catch { /* noop */ }
    if (bl.laneA) resetLane(bl.laneA);
    if (bl.laneB) resetLane(bl.laneB);
    try { B.playbackRate = 1; } catch { /* noop */ }
    if (!bl.viaGraph) { try { B.volume = bl.volA; } catch { /* noop */ } }
    if (!bl.swapped) {
      // Never became audible: nothing changed for the player.
      unload(B);
      this.spare = B;
    } else {
      this.spare = A;
      this.applyLevels();
    }
    this.emit(true);
  }

  /** Skip/seek/pause during a blend: finish it now. */
  finishBlend() {
    const bl = this.blend;
    if (!bl) return;
    if (!bl.swapped) { this.abortBlend(); return; }
    bl.finishedA = true;
    bl.glideFrom = 1;
    bl.plan = { ...bl.plan, glideSec: 0, curves: { ...bl.plan.curves, echoEnd: null } };
    this.endBlend();
  }

  /** The incoming song never started: put everything back, play on. */
  abortBlend() {
    const bl = this.blend;
    if (!bl) return;
    this.blend = null;
    unload(bl.B);
    if (bl.laneA) { resetLane(bl.laneA); setLaneLevel(bl.laneA, bl.gainA, 0.05); }
    if (bl.laneB) resetLane(bl.laneB);
    try { bl.A.volume = bl.volA; } catch { /* noop */ }
    this.spare = bl.B;
    this.emit(true);
  }

  // ------------------------------------------------------------------ UI snapshot

  computeSnap() {
    const settings = getPlaybackSettings();
    if (this.blend) {
      const bl = this.blend;
      return {
        phase: bl.finishedA ? 'easing' : 'mixing', mode: settings.transitions,
        plan: bl.plan, outgoing: bl.outgoing, incoming: bl.incoming,
        label: planLabel(bl.plan), styleName: STYLE_NAMES[bl.plan.style] || 'Fade',
        auto: bl.plan.auto, owner: !!bl.prep?.owner, countdown: 0,
        a: getAnalysis(bl.outgoing), b: getAnalysis(bl.incoming),
        levelA: bl.gainA, levelB: bl.gainB,
      };
    }
    const p = this.prep;
    const el = this.audioRef?.current;
    if (p?.plan && el && !p.dead) {
      return {
        phase: 'armed', mode: settings.transitions,
        plan: p.plan, outgoing: p.outgoing, incoming: p.next.item,
        label: planLabel(p.plan), styleName: STYLE_NAMES[p.plan.style] || 'Fade',
        auto: p.plan.auto, owner: !!p.owner, session: p.session,
        countdown: Math.max(0, Math.ceil(p.plan.bStartAt - el.currentTime)),
        a: getAnalysis(p.outgoing), b: getAnalysis(p.next.item),
        levelA: this.gainFor(p.outgoing), levelB: this.gainFor(p.next.item),
      };
    }
    return { phase: 'idle', mode: settings.transitions };
  }
}

function sameSnap(a, b) {
  return a.phase === b.phase && a.countdown === b.countdown && a.label === b.label
    && a.incoming?.qid === b.incoming?.qid && a.outgoing?.qid === b.outgoing?.qid && a.mode === b.mode
    && a.a === b.a && a.b === b.b && a.levelA === b.levelA && a.levelB === b.levelB;
}

export const playbackEngine = new PlaybackEngine();
export default playbackEngine;

/** React: the engine's state (phase, plan, songs, countdown) for Now Playing and the queue. */
export function useEngineSnapshot() {
  return useSyncExternalStore(
    (fn) => playbackEngine.subscribe(fn),
    () => playbackEngine.getSnapshot(),
    () => playbackEngine.getSnapshot(),
  );
}
