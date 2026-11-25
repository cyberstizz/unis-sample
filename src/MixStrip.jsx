// src/MixStrip.jsx
//
// The two-lane waveform view of a transition (Round 3 design): the outgoing
// song on top, the incoming song below, lined up on the outgoing song's bar
// grid. Shows the mix window, each song's volume curve (solid) and filter or
// echo curve (dashed), bar numbers, and a playhead.
//
// Everything is drawn from the plan (utils/mixPlanner.js) and the songs'
// measured waveforms, so what you see is exactly what the engine plays.
// Used by Now Playing, the Mix editor (desktop) and the phone editor sheet.

import React, { useMemo } from 'react';
import { peakBetween } from './utils/songAnalysis';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/**
 * plan      the transition plan (A-time seconds)
 * wfA, wfB  waveform peaks (Float32Array 0..1) or null
 * durA, durB song lengths in seconds
 * now       A-time of the playhead, or null to hide it
 * columns   bars per lane
 * height    lane height in px
 * labelA/B  nodes shown above each lane
 * outroAt   A-time where the outro starts (editor: draws an OUTRO flag)
 */
export default function MixStrip({
  plan, wfA, wfB, durA, durB, now = null, columns = 74, height = 34,
  labelA = null, labelB = null, outroAt = null, className = '',
}) {
  const view = useMemo(() => {
    if (!plan) return null;
    const bar = plan.barSec || 2;
    const pad = plan.bars ? 2 * bar : Math.max(2, plan.win * 0.6);
    const x0 = plan.aStart - pad;
    const x1 = Math.max(plan.windowEnd, plan.aEnd) + pad;
    const span = x1 - x0;
    const pct = (x) => ((x - x0) / span) * 100;
    const cv = plan.curves;
    const blended = plan.style === 'fade' || plan.style === 'rise' || plan.style === 'bass' || plan.kind === 'crossfade';
    const aStop = blended ? plan.windowEnd : plan.cutAt;
    const rate = plan.rate || 1;
    const bAt = (x) => plan.bStart + (x - plan.bStartAt) * rate;

    const colsA = []; const colsB = [];
    const dt = span / columns;
    for (let i = 0; i < columns; i++) {
      const x = x0 + (i + 0.5) * dt;
      let ha = 0; let hb = 0;
      if (x <= aStop + dt * 0.5 && x >= 0) {
        ha = wfA ? peakBetween(wfA, durA, x - dt / 2, x + dt / 2) : 0.5 + 0.3 * Math.abs(Math.sin(i * 1.7));
      }
      if (x >= plan.bStartAt) {
        const bt = bAt(x);
        hb = wfB ? peakBetween(wfB, durB, bt - (dt * rate) / 2, bt + (dt * rate) / 2) : 0.5 + 0.3 * Math.abs(Math.sin(i * 2.3));
      }
      colsA.push({ x, h: ha > 0 ? Math.max(2, Math.round(ha * height)) : 0, g: cv.gA(x) });
      colsB.push({ x, h: hb > 0 ? Math.max(2, Math.round(hb * height)) : 0, g: cv.gB(x) });
    }

    const pts = (f, a, b) => {
      if (!f || b <= a) return '';
      const out = [];
      for (let j = 0; j <= 80; j++) {
        const x = a + ((b - a) * j) / 80;
        out.push(`${pct(x).toFixed(2)},${(2 + (1 - clamp(f(x), 0, 1)) * (height - 4)).toFixed(1)}`);
      }
      return out.join(' ');
    };
    const curves = {
      ca: pts(cv.gA, x0, Math.min(x1, aStop + bar * 0.25)),
      cb: pts(cv.gB, Math.max(x0, plan.bStartAt - bar * 0.25), x1),
      fa: cv.fa ? pts(cv.fa, cv.echoEnd ? plan.cutAt - plan.beatSec * 1.5 : x0, cv.echoEnd ? Math.min(x1, cv.echoEnd) : aStop) : '',
      fb: cv.fb ? pts(cv.fb, Math.max(x0, plan.bStartAt), x1) : '',
    };

    const ticks = [];
    if (plan.bars) {
      for (let k = -2; k <= plan.bars + 2; k++) {
        const x = plan.aStart + k * bar;
        if (x < x0 - 0.01 || x > x1 + 0.01) continue;
        let l = '';
        if (k < 0) l = `−${-k}`; else if (k < plan.bars) l = String(k + 1); else if (k > plan.bars) l = `+${k - plan.bars}`;
        ticks.push({ x: pct(x), l });
      }
    }
    return {
      x0, span, pct, colsA, colsB, curves, ticks,
      winL: pct(plan.aStart), winW: pct(plan.windowEnd) - pct(plan.aStart),
      showWin: blended, mark: !blended ? pct(plan.cutAt) : null,
      outro: outroAt != null && outroAt >= x0 && outroAt <= x1 ? pct(outroAt) : null,
    };
  }, [plan, wfA, wfB, durA, durB, columns, height, outroAt]);

  if (!view) return null;
  const head = now == null ? null : clamp(view.pct(now), 0, 100);
  const lane = (cols, color, ca, fa, label, key) => (
    <>
      {label}
      <div className="mxs__lane" style={{ height }}>
        <div className="mxs__bars" aria-hidden="true">
          {cols.map((c, i) => (
            <span
              key={`${key}${i}`}
              style={{
                height: c.h,
                background: color,
                opacity: ((now != null && c.x <= now ? 1 : 0.42) * (0.28 + 0.72 * c.g)).toFixed(2),
              }}
            />
          ))}
        </div>
        <svg className="mxs__svg" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline className="mxs__under" points={ca} />
          <polyline className="mxs__vol" points={ca} />
          <polyline className="mxs__flt" points={fa} />
        </svg>
      </div>
    </>
  );

  return (
    <div className={`mxs ${className}`}>
      <div className="mxs__lanes">
        {view.showWin && <div className="mxs__win" aria-hidden="true" style={{ left: `${view.winL}%`, width: `${view.winW}%` }} />}
        {view.mark != null && <div className="mxs__mark" aria-hidden="true" style={{ left: `${view.mark}%` }} />}
        {view.ticks.map((t, i) => <span key={`g${i}`} className="mxs__grid" aria-hidden="true" style={{ left: `${t.x}%` }} />)}
        {view.outro != null && (
          <div className="mxs__outro" aria-hidden="true" style={{ left: `${view.outro}%` }}><span>OUTRO</span></div>
        )}
        {lane(view.colsA, '#d9dce4', view.curves.ca, view.curves.fa, labelA, 'a')}
        <div style={{ height: 6 }} />
        {lane(view.colsB, 'var(--mx-t2)', view.curves.cb, view.curves.fb, labelB, 'b')}
        {head != null && <div className="mxs__head" aria-hidden="true" style={{ left: `${head}%` }} />}
      </div>
      {view.ticks.length > 0 && (
        <div className="mxs__ticks" aria-hidden="true">
          {view.ticks.map((t, i) => <span key={`t${i}`} style={{ left: `${t.x}%` }}>{t.l}</span>)}
        </div>
      )}
    </div>
  );
}

/** "Lenox After Dark · 92 BPM · 8A" label row above a lane. */
export function LaneLabel({ art, text, right }) {
  return (
    <div className="mxs__label">
      {art ? <img src={art} alt="" /> : <span className="mxs__label-dot" />}
      <span className="mxs__label-text">{text}</span>
      {right && <span className="mxs__label-right">{right}</span>}
    </div>
  );
}
