// src/NowPlayingMix.jsx
//
// Now Playing during a transition (Round 3 design, "Now Playing during a
// Unis Mix"): a card that appears 20 seconds before a mix and stays until the
// incoming song is back at its own tempo.
//
//   UP NEXT · Bass swap in 12 s            [Auto · Bass swap]
//   ─ outgoing lane (waveform, volume curve, bass/filter/echo curve)
//   ─ incoming lane
//   bar numbers under the window
//   style chips (this transition only), then a line saying what's happening
//   Volume levelling, with how much each song is turned up or down
//
// Also exports MixFromLine (the "Mixing from …" line under the song title)
// and MixArtFade (the outgoing artwork dissolving into the incoming one).

import React, { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import MixStrip, { LaneLabel } from './MixStrip';
import playbackEngine, { useEngineSnapshot } from './utils/playbackEngine';
import { usePlaybackSettings } from './utils/playbackSettings';
import { waveformOf } from './utils/songAnalysis';
import { STYLE_NAMES, STYLE_DESC } from './utils/mixPlanner';
import './playback.scss';

const CHIPS = ['auto', 'fade', 'rise', 'bass', 'echo', 'cut'];
const SHOW_BEFORE = 20;   // seconds before the mix the card appears

const fmtDb = (gain) => {
  if (!gain || gain === 1) return '0 dB';
  const db = 20 * Math.log10(gain);
  return `${db > 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} dB`;
};
const lufsText = (a) => (a?.lufs != null ? `${a.lufs.toFixed(1).replace('-', '−')} LUFS` : null);
const laneText = (item, a) => [item?.title, a?.bpm ? `${Math.round(a.bpm)} BPM` : null, a?.camelot].filter(Boolean).join(' · ');

function useLiveTime(active) {
  const [t, setT] = useState(() => playbackEngine.liveTime());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setT(playbackEngine.liveTime()), 200);
    return () => clearInterval(id);
  }, [active]);
  return t;
}

function visible(snap) {
  if (!snap?.plan || snap.phase === 'idle') return false;
  if (snap.mode !== 'mix') return false;
  if (snap.phase === 'armed' && snap.countdown > SHOW_BEFORE) return false;
  return true;
}

export default function NowPlayingMix({ onOpenSettings }) {
  const snap = useEngineSnapshot();
  const [settings, setSettings] = usePlaybackSettings();
  const lastLevel = useRef(settings.level === 'off' ? 'normal' : settings.level);
  if (settings.level !== 'off') lastLevel.current = settings.level;
  const show = visible(snap);
  const now = useLiveTime(show);
  if (!show) return null;

  const { plan, outgoing, incoming, a, b } = snap;
  const style = plan.style;
  const name = STYLE_NAMES[style] || 'Fade';
  const blended = style === 'fade' || style === 'rise' || style === 'bass';
  let kick = 'UP NEXT';
  let sub = `${name} in ${snap.countdown} s`;
  if (snap.phase === 'mixing') {
    kick = 'MIXING';
    if (blended && plan.bars) sub = `${plan.bars} bars · ${Math.round(plan.bpmA)} → ${Math.round(plan.bpmB)} BPM`;
    else if (style === 'echo') sub = 'Echo out on the bar line';
    else if (style === 'cut') sub = 'Cut on the bar line';
    else sub = `${name} · ${Math.round(plan.win)} s`;
  }
  if (snap.phase === 'easing') {
    kick = 'MIXED';
    sub = plan.rate && plan.rate !== 1 ? `Easing back to ${Math.round(plan.bpmB)} BPM` : 'Now playing';
  }
  const badge = plan.auto ? `Auto · ${name}` : snap.owner ? `${name} · playlist` : name;
  let desc = plan.auto && plan.reason ? `Auto picked ${name}: ${plan.reason}` : STYLE_DESC[style] || '';
  if (snap.phase === 'mixing' && blended && plan.rate && Math.abs(plan.rate - 1) > 0.001) {
    desc = `${incoming?.title || 'The next song'} at ${(plan.rate * 100).toFixed(1)}% speed to lock the beat · pitch kept`;
  }
  const chosen = snap.session || (plan.auto ? 'auto' : null);
  const levelOn = settings.level !== 'off';

  return (
    <section className="npmix" aria-label="Transition to the next song">
      <div className="npmix__head">
        {snap.phase === 'mixing' && <span className="npmix__dot" aria-hidden="true" />}
        <span className="npmix__kick">{kick}</span>
        <span className="npmix__sub">{sub}</span>
        <span className="npmix__badge">{badge}</span>
      </div>
      <MixStrip
        plan={plan}
        wfA={waveformOf(a)}
        wfB={waveformOf(b)}
        durA={a?.durationMs ? a.durationMs / 1000 : null}
        durB={b?.durationMs ? b.durationMs / 1000 : null}
        now={now}
        labelA={<LaneLabel art={outgoing?.artwork || outgoing?.artworkUrl} text={laneText(outgoing, a)} right={lufsText(a)} />}
        labelB={<LaneLabel art={incoming?.artwork || incoming?.artworkUrl} text={laneText(incoming, b)} right={lufsText(b)} />}
      />
      {snap.phase === 'armed' && (
        <div className="npmix__chips" role="radiogroup" aria-label="Mix style for this transition">
          {CHIPS.map((k) => {
            const on = (chosen || 'auto') === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                className={`npmix__chip ${on ? 'is-on' : ''}`}
                onClick={() => playbackEngine.setSessionStyle(k)}
              >
                {STYLE_NAMES[k]}
              </button>
            );
          })}
        </div>
      )}
      <p className="npmix__desc">{desc}</p>
      <div className="npmix__level">
        <button
          type="button"
          role="switch"
          aria-checked={levelOn}
          className="npmix__level-btn"
          onClick={() => setSettings({ level: levelOn ? 'off' : lastLevel.current })}
        >
          <span className="npmix__level-icon"><Volume2 size={18} aria-hidden="true" /></span>
          <span className="npmix__level-text">
            <span>Volume levelling</span>
            <span>
              {levelOn
                ? `${outgoing?.title || 'This song'} ${fmtDb(snap.levelA)} · ${incoming?.title || 'next'} ${fmtDb(snap.levelB)}`
                : 'Off · songs play as uploaded'}
            </span>
          </span>
          <span className={`npmix__switch ${levelOn ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>
        {onOpenSettings && (
          <button type="button" className="npmix__more" onClick={onOpenSettings}>Playback settings</button>
        )}
      </div>
    </section>
  );
}

/** "Mixing from Lenox After Dark" / "Next · Sugar Hill Summer" under the title. */
export function MixFromLine() {
  const snap = useEngineSnapshot();
  if (!visible(snap)) return null;
  const text = snap.phase === 'armed'
    ? `Next · ${snap.incoming?.title || ''}`
    : snap.phase === 'mixing' ? `Mixing from ${snap.outgoing?.title || ''}` : null;
  if (!text) return null;
  return (
    <div className="npmix-from">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M19 12a5 5 0 11-10 0 5 5 0 0110 0zM15 12a5 5 0 11-10 0 5 5 0 0110 0z" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>
      <span>{text}</span>
    </div>
  );
}

/** The outgoing song's artwork, dissolving over the length of the mix. */
export function MixArtFade() {
  const snap = useEngineSnapshot();
  if (snap.phase !== 'mixing' || !snap.outgoing) return null;
  const src = snap.outgoing.artwork || snap.outgoing.artworkUrl;
  if (!src) return null;
  const secs = Math.max(0.6, (snap.plan.windowEnd - Math.max(snap.plan.bStartAt, snap.plan.aStart)) * 0.8);
  return <img key={snap.outgoing.qid} className="unp-np__art npmix-artout" src={src} alt="" style={{ animationDuration: `${secs}s` }} />;
}
