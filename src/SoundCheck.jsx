// src/SoundCheck.jsx
//
// The upload wizard's last screen for a song (Round 3 design, "Measured on
// upload"): what Unis measured — tempo, key, loudness, true peak, where the
// intro and outro are — and what levelling will do with it. The server
// measures in the background right after the upload; this polls until it's
// done (usually a few seconds).

import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { waitForAnalysis, waveformOf } from './utils/songAnalysis';
import { levelGain } from './utils/mixPlanner';
import './playback.scss';

const mmss = (ms) => { const v = Math.max(0, Math.round((ms || 0) / 1000)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
const minus = (n, d = 1) => (n == null ? '—' : n.toFixed(d).replace('-', '−'));

export default function SoundCheck({ songId, title, onDone }) {
  const [state, setState] = useState({ status: 'measuring', a: null });

  useEffect(() => {
    if (!songId) { setState({ status: 'later', a: null }); return undefined; }
    const ctrl = new AbortController();
    waitForAnalysis(songId, { signal: ctrl.signal, timeoutMs: 60000 })
      .then((a) => { if (!ctrl.signal.aborted) setState({ status: a ? 'ready' : 'later', a }); });
    return () => ctrl.abort();
  }, [songId]);

  const a = state.a;
  const wf = waveformOf(a);
  const bars = 64;
  const peaks = wf ? Array.from({ length: bars }, (_, i) => {
    const s = Math.floor((i / bars) * wf.length); const e = Math.floor(((i + 1) / bars) * wf.length);
    let m = 0; for (let k = s; k < e; k++) m = Math.max(m, wf[k]); return m;
  }) : [];
  const dur = a?.durationMs || 1;
  const introPct = a ? Math.max(0, ((a.introEndMs || 0) - (a.leadSilenceMs || 0)) / dur) * 100 : 0;
  const outroPct = a ? Math.max(0, ((a.tailSilenceMs || dur) - (a.outroStartMs || dur)) / dur) * 100 : 0;
  const gain = a ? levelGain({ analysis: a, target: -14 }) : 1;
  const db = 20 * Math.log10(gain || 1);
  const message = !a ? null : Math.abs(db) < 0.5
    ? 'On Normal, listeners hear it just as you mastered it. It already sits level with everything else.'
    : db < 0
      ? <>On Normal, listeners hear this <b>{Math.abs(db).toFixed(1)} dB quieter</b>, level with everything else. Mastering louder won’t make it louder on Unis.</>
      : <>On Normal, listeners hear this <b>{db.toFixed(1)} dB louder</b>, level with everything else, without pushing past its peaks.</>;

  return (
    <div className="sck">
      <p className="uw__step-intro">
        <CheckCircle size={15} aria-hidden="true" /> <strong style={{ color: 'var(--unis-text)' }}>“{title}”</strong> is uploaded.
      </p>
      <section className="sck-card" aria-labelledby="sck-title" aria-busy={state.status === 'measuring'}>
        <h3 id="sck-title">Sound <em>check</em></h3>
        {state.status === 'measuring' && (
          <>
            <div className="sck-wave is-loading" aria-hidden="true">
              {Array.from({ length: bars }, (_, i) => <span key={i} style={{ height: `${20 + 60 * Math.abs(Math.sin(i * 0.7))}%` }} />)}
            </div>
            <p className="sck-note">Measuring tempo, key and loudness… this takes a few seconds.</p>
          </>
        )}
        {state.status === 'later' && (
          <p className="sck-note">Still measuring. It’ll be ready in a few minutes, and there’s nothing you need to do.</p>
        )}
        {state.status === 'ready' && a && (
          <>
            <div className="sck-wave" aria-hidden="true">
              {introPct > 0.5 && <i className="sck-zone sck-zone--intro" style={{ left: `${((a.leadSilenceMs || 0) / dur) * 100}%`, width: `${introPct}%` }} />}
              {outroPct > 0.5 && <i className="sck-zone sck-zone--outro" style={{ left: `${((a.outroStartMs || dur) / dur) * 100}%`, width: `${outroPct}%` }} />}
              {peaks.map((p, i) => <span key={i} style={{ height: `${Math.max(6, p * 100)}%` }} />)}
            </div>
            <div className="sck-zones">
              <span>{introPct > 0.5 ? `Intro ${mmss(a.leadSilenceMs)}–${mmss(a.introEndMs)}` : 'No intro'}</span>
              <span>{outroPct > 0.5 ? `Outro ${mmss(a.outroStartMs)}–${mmss(a.tailSilenceMs)}` : 'Ends cold'}</span>
            </div>
            <div className="sck-stats">
              <div><strong>{a.bpm ? Math.round(a.bpm) : '—'}</strong><span>BPM</span></div>
              <div><strong>{a.key ? a.key.replace(' major', '').replace(' minor', ' minor') : '—'}</strong><span>Key{a.camelot ? ` · ${a.camelot}` : ''}</span></div>
              <div><strong>{minus(a.lufs)}</strong><span>LUFS (loudness)</span></div>
              <div><strong>{a.truePeak != null ? `${a.truePeak > 0 ? '+' : ''}${minus(a.truePeak)}` : '—'}</strong><span>dB true peak</span></div>
            </div>
            <p className="sck-msg">{message}</p>
          </>
        )}
      </section>
      <button type="button" className="uw__btn uw__btn--upload" style={{ width: '100%' }} onClick={onDone}>Done</button>
    </div>
  );
}
