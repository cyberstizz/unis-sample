// src/MixEditor.jsx
//
// The playlist Mix editor (Round 3 design): one transition between two songs
// of a playlist, drawn from the songs' real waveforms and beat grids.
//
//   Style   Auto · Fade · Rise · Bass swap · Echo out · Cut · None
//   Length  2 · 4 · 8 · 16 bars (lengths longer than the outro are off)
//   Start   1 bar earlier / later, never before the outro begins
//   Preview plays it exactly as the player will; Save keeps it for everyone
//           with Unis Mix on; Reset goes back to Auto.
//
// variant 'page'  — the desktop editor page (/playlist/:id/mix/:index)
// variant 'sheet' — the phone sheet over the playlist

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Play, Pause, X } from 'lucide-react';
import MixStrip, { LaneLabel } from './MixStrip';
import { apiCall } from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { PlayerContext } from './context/playercontext';
import { loadAnalysis, getAnalysis, subscribeAnalysis, waveformOf } from './utils/songAnalysis';
import {
  planTransition, STYLES, STYLE_NAMES, keysFit, tempoMatch, levelGain,
} from './utils/mixPlanner';
import { getPlaybackSettings, LEVEL_TARGETS } from './utils/playbackSettings';
import { startPreview, stopPreview } from './utils/mixPreview';
import './playback.scss';

const LENS = [2, 4, 8, 16];
const MIX_ON = { transitions: 'mix', mixReleases: true };
const idOf = (t) => t?.songId || t?.id;
const urlOf = (t) => t?.url || t?.fileUrl || null;
const mmss = (s) => { const v = Math.max(0, Math.floor(s || 0)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
const dbText = (g) => { const d = 20 * Math.log10(g || 1); return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} dB`; };
const lufs = (a) => (a?.lufs != null ? `${a.lufs.toFixed(1).replace('-', '−')} LUFS` : '— LUFS');
const bpmText = (a) => (a?.bpm ? `${Math.round(a.bpm)} BPM` : '— BPM');
const keyText = (a) => (a?.key ? `${a.key} · ${a.camelot}` : 'Key —');

function what(style, plan) {
  const n = plan?.bars || 0;
  const half = Math.max(1, Math.round(n / 2));
  const bb = (x) => `${x} ${x === 1 ? 'bar' : 'bars'}`;
  switch (style) {
    case 'fade': return [`Fades out over ${bb(n || 1)}, following a smooth curve.`, `Fades in over the same ${bb(n || 1)}, equal-power, so the middle never dips.`];
    case 'rise': return ['A filter sweeps up and thins out its bass, then it fades in the last part.', `Comes in muffled and opens up to full brightness by bar ${Math.max(1, Math.round(n * 0.9))}.`];
    case 'echo': return [`Its last beat feeds an echo, it stops on bar ${half + 1}, and the echo dies away over 2 bars.`, 'Starts clean on that bar line, at its own speed.'];
    case 'cut': return [`Stops dead on bar ${half + 1}.`, 'Starts on the same beat. No overlap.'];
    case 'none': return ['Plays all the way to its end.', 'Starts right after, with no gap and no blend.'];
    default: return [`Plays at full volume, beat-locked. Loses its bass on bar ${half + 1}, then fades out.`, `Comes in without its bass, and gets it on bar ${half + 1} when the basslines swap.`];
  }
}

export default function MixEditor({
  playlistId, playlistName, tracks, index, mix, canEdit, variant = 'page',
  onClose, onNavigatePair, onSaved, ownerName,
}) {
  const feedback = useFeedback();
  const { audioRef } = useContext(PlayerContext) || {};
  const a = tracks[index];
  const b = tracks[index + 1];
  const [, bump] = useState(0);
  useEffect(() => subscribeAnalysis(() => bump((n) => n + 1)), []);
  useEffect(() => { if (a && b) loadAnalysis([a, b]); }, [a, b]);

  const saved = useMemo(() => (mix?.transitions || []).find((t) => t.fromSongId === idOf(a) && t.toSongId === idOf(b)) || null, [mix, a, b]);
  const [style, setStyle] = useState('auto');
  const [bars, setBars] = useState(null);
  const [shift, setShift] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [px, setPx] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStyle(saved?.style || 'auto');
    setBars(saved && saved.style !== 'auto' ? saved.bars : null);
    setShift(saved?.startShift || 0);
    setDirty(false);
    stopPreview();
    setPreviewing(false);
    setPx(null);
  }, [index, saved]);
  useEffect(() => () => stopPreview(), []);

  const anA = getAnalysis(a);
  const anB = getAnalysis(b);
  const durA = anA?.durationMs ? anA.durationMs / 1000 : (a?.duration > 1000 ? a.duration / 1000 : 200);
  const durB = anB?.durationMs ? anB.durationMs / 1000 : (b?.duration > 1000 ? b.duration / 1000 : 200);

  const autoPlan = useMemo(() => planTransition({ a: anA, b: anB, durA, durB, settings: MIX_ON }), [anA, anB, durA, durB]);
  const effStyle = style === 'auto' ? (autoPlan?.style || 'fade') : style;
  const plan = useMemo(() => {
    if (style === 'none') return null;
    const override = style === 'auto' && bars == null && shift === 0 ? null
      : { style: effStyle, bars: bars || autoPlan?.bars || 4, startShift: shift };
    return planTransition({ a: anA, b: anB, durA, durB, settings: MIX_ON, override });
  }, [style, effStyle, bars, shift, anA, anB, durA, durB, autoPlan]);

  // How many whole bars the outgoing song's outro has.
  const outro = useMemo(() => {
    if (!anA?.bpm || anA.downbeatMs == null) return { bars: 0, start: null, bar: 2 };
    const bar = 240 / anA.bpm;
    const down = anA.downbeatMs / 1000;
    const tail = (anA.tailSilenceMs ?? durA * 1000) / 1000;
    const o = Math.max(anA.outroStartMs != null ? anA.outroStartMs / 1000 : tail, down);
    const start = down + Math.max(0, Math.ceil((o - down) / bar - 0.05)) * bar;
    return { bars: Math.max(0, Math.floor((tail - start) / bar + 0.05)), start, bar, outroAt: o };
  }, [anA, durA]);

  const currentBars = plan?.bars || bars || autoPlan?.bars || 4;
  const maxShift = Math.max(0, outro.bars - currentBars);
  const match = anA?.bpm && anB?.bpm ? tempoMatch(anA.bpm, anB.bpm) : null;
  const fit = keysFit(anA?.camelot, anB?.camelot);
  const target = LEVEL_TARGETS[getPlaybackSettings().level];
  const gA = levelGain({ analysis: anA, target });
  const gB = levelGain({ analysis: anB, target });
  const [wA, wB] = what(effStyle, plan);
  const fLabel = effStyle === 'bass' ? 'Bass' : effStyle === 'rise' ? 'Filter' : effStyle === 'echo' ? 'Echo' : null;
  const blended = effStyle === 'fade' || effStyle === 'rise' || effStyle === 'bass';

  const pickStyle = (k) => {
    if (!canEdit) return;
    setDirty(true);
    if (k === 'auto') { setStyle('auto'); setBars(null); setShift(0); return; }
    setStyle(k);
  };
  const pickBars = (n) => {
    if (!canEdit) return;
    if (n > outro.bars && outro.bars > 0) { feedback.info(`${n} bars needs a ${Math.round(n * outro.bar)} s outro; this one is ${Math.round(outro.bars * outro.bar)} s`, { id: 'mx-len' }); return; }
    setDirty(true);
    if (style === 'auto') setStyle(effStyle);
    setBars(n);
    setShift((s) => Math.min(s, Math.max(0, outro.bars - n)));
  };
  const nudge = (d) => {
    if (!canEdit) return;
    if (d < 0 && shift <= 0) { feedback.info('It can’t start before the outro: it would talk over the last verse', { id: 'mx-start' }); return; }
    if (d > 0 && shift >= maxShift) { feedback.info('That’s as late as it goes: the song ends right after', { id: 'mx-start' }); return; }
    setDirty(true);
    if (style === 'auto') setStyle(effStyle);
    if (!bars) setBars(currentBars);
    setShift(shift + d);
  };

  const togglePreview = async () => {
    if (previewing) { stopPreview(); setPreviewing(false); return; }
    if (!plan || !urlOf(a) || !urlOf(b)) { feedback.info(style === 'none' ? 'With None, the songs just play back to back.' : 'This mix can’t be previewed yet.', { id: 'mx-prev' }); return; }
    try { audioRef?.current?.pause(); } catch { /* noop */ }
    setPreviewing(true);
    await startPreview({
      urlA: urlOf(a), urlB: urlOf(b), plan, gainA: gA, gainB: gB,
      onTime: (x) => setPx(x),
      onEnd: () => { setPreviewing(false); },
      onError: (m) => feedback.error(m, { id: 'mx-prev' }),
    });
  };

  const save = async () => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const res = await apiCall({
        method: 'put',
        url: `/v1/playlists/${playlistId}/mix/transition`,
        data: { fromSongId: idOf(a), toSongId: idOf(b), style, bars: style === 'auto' ? 4 : (bars || currentBars), startShift: shift },
      });
      onSaved?.(res.data);
      window.dispatchEvent(new CustomEvent('unis:playlist-mix-changed', { detail: { playlistId } }));
      setDirty(false);
      feedback.success('Transition saved · everyone with Unis Mix on hears it', { id: 'mx-save' });
    } catch (err) {
      feedback.error(errorMessage(err, 'Couldn’t save the transition. Try again.'), { id: 'mx-save' });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!canEdit || busy) return;
    setStyle('auto'); setBars(null); setShift(0);
    if (!saved) { setDirty(false); feedback.info('Back to Auto', { id: 'mx-save' }); return; }
    setBusy(true);
    try {
      const res = await apiCall({ method: 'delete', url: `/v1/playlists/${playlistId}/mix/transition?from=${idOf(a)}&to=${idOf(b)}` });
      onSaved?.(res.data);
      window.dispatchEvent(new CustomEvent('unis:playlist-mix-changed', { detail: { playlistId } }));
      setDirty(false);
      feedback.success('Back to Auto', { id: 'mx-save' });
    } catch (err) {
      feedback.error(errorMessage(err, 'Couldn’t reset the transition.'), { id: 'mx-save' });
    } finally {
      setBusy(false);
    }
  };

  const goPair = useCallback((d) => { stopPreview(); onNavigatePair?.(index + d); }, [index, onNavigatePair]);

  if (!a || !b) return null;
  const total = tracks.length - 1;
  const autoNote = style === 'auto' && autoPlan
    ? `Auto picked ${STYLE_NAMES[autoPlan.style]}${autoPlan.bars ? ` · ${autoPlan.bars} bars` : ''}${autoPlan.reason ? `: ${autoPlan.reason}` : ''}.`
    : dirty ? 'Your edit. Reset to go back to Auto.' : saved ? `Set by ${ownerName || 'the playlist owner'}.` : '';
  const startSec = plan ? plan.aStart : outro.start;
  const startText = plan && plan.bars
    ? (shift === 0 ? `Starts at ${mmss(startSec)}, right where the outro begins` : `Starts at ${mmss(startSec)}, ${shift} ${shift === 1 ? 'bar' : 'bars'} into the outro`)
    : 'Starts at the end of the song';
  const phase = px == null || !plan ? null : px < plan.aStart ? 'Before the mix' : px < plan.windowEnd ? `Mixing · bar ${Math.min(plan.bars || 1, Math.floor((px - plan.aStart) / plan.barSec) + 1)} of ${plan.bars || 1}` : 'After the mix';
  const clock = px == null || !plan ? null : px < plan.bStartAt ? `${a.title} ${mmss(px)}` : `${b.title} ${mmss(plan.bStart + (px - plan.bStartAt) * (plan.rate || 1))}`;
  const rateText = blended && plan?.rate && Math.abs(plan.rate - 1) > 0.001
    ? `${b.title} plays at ${(plan.rate * 100).toFixed(1)}% during the mix (pitch kept), then eases back to ${Math.round(anB.bpm)} BPM over 2 bars.`
    : 'No speed change: the two songs never play over each other.';
  const matchTitle = !anA || !anB ? 'Measuring…' : `${fit ? 'Keys fit' : 'Keys clash'} · ${match ? (match.within ? `${Math.round(match.apart * 100)}% apart` : 'tempos far apart') : 'no steady beat'}`;

  const strip = plan ? (
    <MixStrip
      plan={plan}
      wfA={waveformOf(anA)}
      wfB={waveformOf(anB)}
      durA={durA}
      durB={durB}
      now={px}
      columns={variant === 'page' ? 184 : 80}
      height={variant === 'page' ? 84 : 30}
      outroAt={variant === 'page' ? outro.outroAt : null}
      labelA={<LaneLabel art={a.artworkUrl || a.artwork} text={variant === 'page' ? `${a.title} · outgoing · ${bpmText(anA)}` : `${a.title} · ${bpmText(anA)} · ${anA?.camelot || ''}`} right={variant === 'page' ? (outro.start != null ? `outro ${mmss(outro.start)} – ${mmss((anA?.tailSilenceMs ?? durA * 1000) / 1000)}` : null) : 'out'} />}
      labelB={<LaneLabel art={b.artworkUrl || b.artwork} text={variant === 'page' ? `${b.title} · incoming · ${bpmText(anB)}` : `${b.title} · ${bpmText(anB)} · ${anB?.camelot || ''}`} right={variant === 'page' ? 'starts from 0:00' : 'in'} />}
    />
  ) : (
    <div className="mxe-none">No mix: {a.title} plays to its end, then {b.title} starts right after.</div>
  );

  const styleChips = (
    <div className="mxe-styles" role="radiogroup" aria-label="Transition style">
      {STYLES.map((k) => {
        const on = style === k;
        return (
          <button key={k} type="button" role="radio" aria-checked={on} className={`mxe-chip ${on ? 'is-on' : ''}`} onClick={() => pickStyle(k)} disabled={!canEdit && !on}>
            {STYLE_NAMES[k]}
          </button>
        );
      })}
    </div>
  );
  const lens = (
    <div className="mxe-seg" role="radiogroup" aria-label="Length in bars">
      {LENS.map((n) => {
        const on = currentBars === n && style !== 'none';
        const dis = outro.bars > 0 && n > outro.bars;
        return (
          <button key={n} type="button" role="radio" aria-checked={on} aria-disabled={dis} className={`${on ? 'is-on' : ''} ${dis ? 'is-dis' : ''}`} onClick={() => pickBars(n)} disabled={!canEdit}>
            {n}
          </button>
        );
      })}
    </div>
  );
  const playBtn = (
    <button type="button" className="mxe-preview" onClick={togglePreview} aria-label={previewing ? 'Pause preview' : 'Preview'}>
      {previewing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
      {previewing ? 'Pause' : 'Preview'}
    </button>
  );

  if (variant === 'sheet') {
    return (
      <div className="mxe-sheet-wrap">
        <button type="button" className="mxe-backdrop" aria-label="Close" onClick={() => { stopPreview(); onClose?.(); }} />
        <div className="mxe mxe--sheet" role="dialog" aria-modal="true" aria-label="Edit transition">
          <span className="mxe-grip" aria-hidden="true" />
          <div className="mxe-sheet-head">
            <div>
              <div className="mxe-kicker">TRANSITION {index + 1} OF {total}</div>
              <div className="mxe-sheet-title">{a.title} → {b.title}</div>
              {autoNote && <div className="mxe-auto">{autoNote}</div>}
            </div>
            <button type="button" className="mxe-x" onClick={() => { stopPreview(); onClose?.(); }} aria-label="Close"><X size={20} aria-hidden="true" /></button>
          </div>
          <div className="mxe-panel mxe-panel--sheet">{strip}</div>
          <div className="mxe-lbl">STYLE</div>
          {styleChips}
          <div className="mxe-row">
            <div className="mxe-col">
              <div className="mxe-lbl">LENGTH (BARS)</div>
              {lens}
            </div>
            <div>
              <div className="mxe-lbl">START</div>
              <div className="mxe-nudge">
                <button type="button" onClick={() => nudge(-1)} aria-label="1 bar earlier" disabled={!canEdit}><ChevronLeft size={16} aria-hidden="true" /></button>
                <button type="button" onClick={() => nudge(1)} aria-label="1 bar later" disabled={!canEdit}><ChevronRight size={16} aria-hidden="true" /></button>
              </div>
            </div>
          </div>
          <div className="mxe-sheet-actions">
            {playBtn}
            {canEdit
              ? <button type="button" className="mxe-save" onClick={save} disabled={busy}><Check size={18} aria-hidden="true" /> Save</button>
              : <p className="mxe-readonly">Only the playlist’s owner can change this mix.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mxe mxe--page">
      <div className="mxe-top">
        <button type="button" className="mxe-round" onClick={() => { stopPreview(); onClose?.(); }} aria-label={`Back to ${playlistName || 'the playlist'}`}>
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
        <div className="mxe-top-text">
          <div className="mxe-kicker">{(playlistName || 'PLAYLIST').toUpperCase()} · MIX · TRANSITION {index + 1} OF {total}</div>
          <h1>{a.title} <em>into</em> {b.title}</h1>
        </div>
        <button type="button" className="mxe-ghost" onClick={() => goPair(-1)} disabled={index <= 0}><ChevronLeft size={16} aria-hidden="true" /> Previous</button>
        <button type="button" className="mxe-ghost" onClick={() => goPair(1)} disabled={index >= total - 1}>Next transition <ChevronRight size={16} aria-hidden="true" /></button>
      </div>

      <div className="mxe-cards">
        <SongCard kick="OUTGOING" track={a} an={anA} />
        <div className="mxe-match">
          <span className="mxe-match-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 12a5 5 0 11-10 0 5 5 0 0110 0zM15 12a5 5 0 11-10 0 5 5 0 0110 0z" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>
          </span>
          <strong>{matchTitle}</strong>
          <span>{rateText}</span>
        </div>
        <SongCard kick="INCOMING" track={b} an={anB} />
      </div>

      <section className="mxe-panel" aria-label="Transition waveforms">
        <div className="mxe-panel-head">
          <strong>{phase || (plan ? `${STYLE_NAMES[effStyle]}${plan.bars ? ` · ${plan.bars} bars` : ''}` : 'Straight through')}</strong>
          <span>{clock || ''}</span>
        </div>
        {strip}
        <div className="mxe-legend">
          <span><i className="mxe-leg-vol" /> Volume</span>
          {fLabel && <span><i className="mxe-leg-flt" /> {fLabel}</span>}
          <span><i className="mxe-leg-win" /> The mix</span>
          <span className="mxe-legend-r">
            {target == null ? 'Levelling off' : `Levelled to ${target} LUFS · ${a.title} ${dbText(gA)} · ${b.title} ${dbText(gB)}`.replace(/-/g, '−')}
          </span>
        </div>
      </section>

      <div className="mxe-controls">
        <div>
          <div className="mxe-lbl">STYLE</div>
          {styleChips}
          <div className="mxe-auto">{autoNote}</div>
        </div>
        <div>
          <div className="mxe-lbl">LENGTH (BARS)</div>
          {lens}
          <div className="mxe-lbl mxe-lbl--gap">START</div>
          <div className="mxe-nudge mxe-nudge--wide">
            <button type="button" onClick={() => nudge(-1)} disabled={!canEdit}><ChevronLeft size={15} aria-hidden="true" /> 1 bar earlier</button>
            <button type="button" onClick={() => nudge(1)} disabled={!canEdit}>1 bar later <ChevronRight size={15} aria-hidden="true" /></button>
          </div>
          <div className="mxe-start">{startText}</div>
        </div>
        <div className="mxe-hear">
          <div className="mxe-lbl">HEAR IT</div>
          {playBtn}
          {canEdit ? (
            <div className="mxe-hear-row">
              <button type="button" className="mxe-ghost mxe-ghost--full" onClick={reset} disabled={busy}>Reset to Auto</button>
              <button type="button" className="mxe-save" onClick={save} disabled={busy}><Check size={16} aria-hidden="true" /> Save</button>
            </div>
          ) : (
            <p className="mxe-readonly">Only {ownerName || 'the playlist’s owner'} can change this mix.</p>
          )}
        </div>
      </div>

      <div className="mxe-what">
        <div><img src={a.artworkUrl || a.artwork || '/assets/placeholder.jpg'} alt="" /><p><b>{a.title}.</b> {wA}</p></div>
        <div><img src={b.artworkUrl || b.artwork || '/assets/placeholder.jpg'} alt="" /><p><b>{b.title}.</b> {wB}</p></div>
      </div>
    </div>
  );
}

function SongCard({ kick, track, an }) {
  return (
    <div className="mxe-song">
      <img src={track.artworkUrl || track.artwork || '/assets/placeholder.jpg'} alt="" />
      <div className="mxe-song-text">
        <div className="mxe-kicker">{kick}</div>
        <div className="mxe-song-title">{track.title}</div>
        <div className="mxe-song-artist">{track.artist}</div>
        <div className="mxe-song-chips">
          <span>{bpmText(an)}</span><span>{keyText(an)}</span><span>{lufs(an)}</span>
        </div>
      </div>
    </div>
  );
}
