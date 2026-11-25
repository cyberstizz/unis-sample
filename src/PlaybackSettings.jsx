// src/PlaybackSettings.jsx
//
// Settings → Playback (Round 3 design, "Settings → Playback"):
//   Volume levelling   Off · Quiet · Normal · Loud
//   Song transitions   Off · Crossfade (1–12 s) · Unis Mix
//                      Mix inside releases (off: albums, EPs and mixtapes play gapless)
//   Autoplay           keep going with similar songs, local artists first
// Saved on this device (utils/playbackSettings.js), so a phone and a computer
// can sound different.
//
// Also exports PlaybackSettingsLink, the card in the Settings tabs of the
// listener page and the artist dashboard that opens this page.

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Gauge, Infinity as InfinityIcon } from 'lucide-react';
import Layout from './layout';
import { usePlaybackSettings, LEVEL_LABELS, LEVEL_TARGETS } from './utils/playbackSettings';
import { graphSupported } from './utils/audioGraph';
import { useFeedback } from './context/FeedbackContext';
import './playback.scss';

const LEVEL_NOTES = {
  off: 'Songs play exactly as they were uploaded.',
  quiet: 'Quiet: −19 LUFS. Good for quiet rooms and late nights.',
  normal: 'Normal: −14 LUFS. Albums and EPs are levelled as a whole, so quiet songs stay quiet.',
  loud: 'Loud: −11 LUFS, with a limiter. Good for noisy places; it can squash a song’s dynamics a little.',
};

const TRANSITIONS = [
  { k: 'off', label: 'Off', sub: 'Songs play back to back.' },
  { k: 'crossfade', label: 'Crossfade', sub: 'A plain fade between songs.' },
  { k: 'mix', label: 'Unis Mix', sub: 'Beat-matched blends between songs, like a DJ. Playlist owners can fine-tune each one.' },
];

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`pbs-switch ${on ? 'is-on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function PlaybackControls() {
  const [s, set] = usePlaybackSettings();
  const feedback = useFeedback();
  const supported = graphSupported();
  const save = (patch, msg) => { set(patch); if (msg) feedback.success(msg, { id: 'pbs-save' }); };

  return (
    <div className="pbs">
      {!supported && (
        <p className="pbs-warn">
          This browser can’t change song volume from a website, so levelling and mixing are off here. On an iPhone, update to iOS 17 or later.
        </p>
      )}

      <section className="pbs-card" aria-labelledby="pbs-level">
        <h2 id="pbs-level">Volume <em>levelling</em></h2>
        <p className="pbs-lead">Every song plays at about the same volume, so you never reach for the volume between songs.</p>
        <div className="pbs-seg" role="radiogroup" aria-label="Volume levelling">
          {Object.keys(LEVEL_TARGETS).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={s.level === k}
              className={s.level === k ? 'is-on' : ''}
              onClick={() => save({ level: k }, k === 'off' ? 'Levelling off' : `Levelling: ${LEVEL_LABELS[k]}`)}
              disabled={!supported && k !== 'off'}
            >
              {LEVEL_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="pbs-note">{LEVEL_NOTES[s.level]}</p>
      </section>

      <section className="pbs-card" aria-labelledby="pbs-trans">
        <h2 id="pbs-trans">Song <em>transitions</em></h2>
        <div role="radiogroup" aria-label="Song transitions">
          {TRANSITIONS.map((t) => {
            const on = s.transitions === t.k;
            return (
              <div key={t.k} className={`pbs-radio ${on ? 'is-on' : ''}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => save({ transitions: t.k }, t.k === 'off' ? 'Transitions off' : `${t.label} on`)}
                >
                  <span className="pbs-dot" aria-hidden="true"><span /></span>
                  <span className="pbs-radio-text">
                    <strong>{t.label}</strong>
                    <span>{t.sub}</span>
                  </span>
                </button>
                {t.k === 'crossfade' && (
                  <div className={`pbs-slider ${on ? '' : 'is-dim'}`}>
                    <span>1 s</span>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      step="1"
                      value={s.crossfadeSec}
                      disabled={!on}
                      aria-label="Crossfade length in seconds"
                      aria-valuetext={`${s.crossfadeSec} seconds`}
                      onChange={(e) => set({ crossfadeSec: Number(e.target.value) })}
                      onPointerUp={() => feedback.success(`Crossfade: ${s.crossfadeSec} seconds`, { id: 'pbs-save' })}
                      style={{ '--p': `${((s.crossfadeSec - 1) / 11) * 100}%` }}
                    />
                    <span>12 s</span>
                    <b>{s.crossfadeSec} s</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="pbs-sep" />
        <div className="pbs-row">
          <div>
            <strong>Mix inside releases</strong>
            <span>Albums, EPs and mixtapes play gapless, the way the artist made them.</span>
          </div>
          <Toggle
            on={s.mixReleases}
            label="Mix inside releases"
            onChange={(v) => save({ mixReleases: v }, v ? 'Releases will mix too' : 'Releases play gapless')}
          />
        </div>
      </section>

      <section className="pbs-card" aria-labelledby="pbs-auto">
        <div className="pbs-row">
          <span className="pbs-icon" aria-hidden="true"><InfinityIcon size={22} /></span>
          <div>
            <strong id="pbs-auto">Autoplay</strong>
            <span>When your music ends, keep going with similar songs. Local artists first. Turn it off and the music stops at the end.</span>
          </div>
          <Toggle on={s.autoplay} label="Autoplay" onChange={(v) => save({ autoplay: v }, v ? 'Autoplay on' : 'Autoplay off')} />
        </div>
      </section>

      <p className="pbs-foot">Saved on this device, so your phone and your computer can sound different. The sleep timer is the moon button in the player.</p>
    </div>
  );
}

export default function PlaybackSettingsPage() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="pbs-page">
        <div className="pbs-top">
          <button type="button" className="pbs-back" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <h1>Playback</h1>
        </div>
        <PlaybackControls />
      </div>
    </Layout>
  );
}

/** The Settings-tab card that opens Settings → Playback. */
export function PlaybackSettingsLink() {
  const [s] = usePlaybackSettings();
  const t = s.transitions === 'mix' ? 'Unis Mix' : s.transitions === 'crossfade' ? `Crossfade ${s.crossfadeSec} s` : 'No transitions';
  const summary = `Levelling ${LEVEL_LABELS[s.level].toLowerCase()} · ${t} · Autoplay ${s.autoplay ? 'on' : 'off'}`;
  return (
    <section className="ad-panel" aria-labelledby="pbs-link-title">
      <div className="ad-panel__head">
        <h3 id="pbs-link-title">Play<em>back</em></h3>
      </div>
      <Link to="/settings/playback" className="pbs-link">
        <span className="pbs-icon" aria-hidden="true"><Gauge size={20} /></span>
        <span className="pbs-link-text">
          <strong>Levelling, transitions and Autoplay</strong>
          <span>{summary}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
