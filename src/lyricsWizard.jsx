// src/lyricsWizard.jsx
// =============================================================================
// LyricsWizard — words, then timing, so fans can sing along.
//
//   1  Words      paste the lyrics (or import an .lrc file that's already timed)
//   2  Tap along  the song plays; the artist taps as each line starts
//   3  Check      watch it play back, nudge any line, stamp lines that changed
//
// Saves through PATCH /v1/media/song/:id/lyrics with { lyrics, syncedLyrics }
// (backend MediaService.saveLyrics). The plain words keep their blank lines
// for the song page; the timed version is LRC text ([mm:ss.xx]line).
//
// Editing words after a song is timed keeps the time of every line that
// didn't change; only new or changed lines need a time again.
// "Save words only" keeps the timing when the words are unchanged and clears
// it when they changed (timing for old words would be wrong).
//
// Keys in Tap along: Space or Enter taps (the tap pad has focus), Backspace
// undoes the last tap.
// =============================================================================
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X, AlertCircle, Play, Pause, Undo2, RotateCcw, Upload, HelpCircle, ChevronLeft, Check } from 'lucide-react';
import './lyricsWizard.scss';
import { apiCall } from './components/axiosInstance';
import { useFeedback } from './context/FeedbackContext';
import { PlayerContext } from './context/playercontext';
import useModalA11y from './hooks/useModalA11y';
import { buildUrl } from './utils/buildUrl';
import { forgetLyrics } from './utils/lyricsCache';
import LyricsLines from './components/LyricsLines';
import useActiveLine from './hooks/useActiveLine';
import {
  parseLrc, toLrc, looksLikeLrc, wordsToLines, carryTimes,
  formatStamp, formatClock, firstOutOfOrder,
} from './utils/lrc';

const REACTION = 0.1;   // people tap a touch late; start each line this much earlier
const NUDGE = 0.1;

const STEPS = [
  { id: 'words', label: 'Words' },
  { id: 'tap', label: 'Tap along' },
  { id: 'check', label: 'Check' },
];

const LyricsWizard = ({ show, onClose, song, onSuccess, onHelp }) => {
  const feedback = useFeedback();
  const player = useContext(PlayerContext);
  const songId = song?.songId || song?.id;

  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState(null);
  const [savedWords, setSavedWords] = useState('');
  const [savedTimed, setSavedTimed] = useState([]);
  const [words, setWords] = useState('');
  const [step, setStep] = useState('words');
  const [lines, setLines] = useState([]);       // [{ text, t|null }]
  const [cursor, setCursor] = useState(0);      // next line to tap
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const modalRef = useRef(null);
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const tapRef = useRef(null);
  const gutterRef = useRef(null);

  // ── Load what's saved ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!show || !songId) return undefined;
    let alive = true;
    setLoading(true);
    setStep('words');
    setLines([]);
    setCursor(0);
    setError(null);
    setConfirmClose(false);
    setAudioFailed(false);
    const fallbackUrl = song?.url || buildUrl(song?.fileUrl) || null;
    apiCall({ method: 'get', url: `/v1/media/song/${songId}`, useCache: false })
      .then((res) => {
        if (!alive) return;
        const d = res?.data || {};
        const timed = parseLrc(d.syncedLyrics);
        const w = d.lyrics || song?.lyrics || timed.map((l) => l.text).join('\n') || '';
        setSavedWords(w);
        setWords(w);
        setSavedTimed(timed);
        setAudioUrl(buildUrl(d.fileUrl) || fallbackUrl);
      })
      .catch(() => {
        if (!alive) return;
        const w = song?.lyrics || '';
        setSavedWords(w);
        setWords(w);
        setSavedTimed([]);
        setAudioUrl(fallbackUrl);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [show, songId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop our audio whenever the wizard goes away.
  useEffect(() => () => audioRef.current?.pause(), []);

  // ── Close (asks first if there's unsaved timing) ──────────────────────────
  const hasUnsavedTiming = step !== 'words' && lines.some((l) => l.t != null);
  const closeRef = useRef(null);
  closeRef.current = () => {
    if (hasUnsavedTiming && !confirmClose) { setConfirmClose(true); return; }
    audioRef.current?.pause();
    onClose?.();
  };
  const requestClose = useCallback(() => closeRef.current(), []);
  useModalA11y({ active: show, onClose: requestClose, modalRef });

  // ── Audio ─────────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    player?.audioRef?.current?.pause?.(); // one song at a time
    a.play().catch(() => setAudioFailed(true));
  }, [player]);
  const pause = () => audioRef.current?.pause();
  const seek = (t) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(t, a.duration || t));
    setNow(a.currentTime);
  };
  const seekFromBar = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (duration) seek(((e.clientX - r.left) / r.width) * duration);
  };

  // ── Steps ─────────────────────────────────────────────────────────────────
  const wordLines = useMemo(() => wordsToLines(words), [words]);
  const carried = useMemo(() => carryTimes(wordLines, savedTimed), [wordLines, savedTimed]);
  const isTimed = savedTimed.length > 0;
  const changedCount = isTimed ? carried.filter((l) => l.t == null).length : 0;
  const wordsChanged = words.trim() !== savedWords.trim();

  const goTo = (id) => {
    setError(null);
    setConfirmClose(false);
    setStep(id);
  };

  const startTapping = (forLines) => {
    setLines(forLines.map((l) => ({ text: l.text, t: null })));
    setCursor(0);
    seek(0);
    goTo('tap');
  };

  const nextFromWords = () => {
    let text = words;
    let base = savedTimed;
    if (looksLikeLrc(words)) {
      const parsed = parseLrc(words);
      if (parsed.length) {
        base = parsed;
        text = parsed.map((l) => l.text).join('\n');
        setWords(text);
      }
    }
    const ls = wordsToLines(text);
    if (!ls.length) { setError('Add the words first, one line for each line you sing.'); return; }
    const withTimes = carryTimes(ls, base);
    if (withTimes.some((l) => l.t != null)) {
      setLines(withTimes);
      goTo('check');
    } else {
      startTapping(withTimes);
    }
  };

  const importLrc = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseLrc(text);
      if (!parsed.length) { setError('That file has no timed lines in it.'); return; }
      setWords(parsed.map((l) => l.text).join('\n'));
      setLines(parsed);
      goTo('check');
      feedback.info(`Imported ${parsed.length} timed lines. Play it back to check.`);
    } catch {
      setError('Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Tap along ─────────────────────────────────────────────────────────────
  const tap = () => {
    const a = audioRef.current;
    if (!a || audioFailed) return;
    if (a.paused) { play(); return; }
    if (cursor >= lines.length) return;
    const prev = cursor > 0 ? lines[cursor - 1].t : 0;
    const t = Math.max(prev ?? 0, a.currentTime - REACTION);
    const at = cursor;
    setLines((ls) => ls.map((l, i) => (i === at ? { ...l, t } : l)));
    setCursor(at + 1);
    if (at + 1 >= lines.length) setTimeout(() => goTo('check'), 500);
  };

  const undo = () => {
    if (cursor === 0) return;
    const c = cursor - 1;
    const t = lines[c].t ?? 0;
    setLines((ls) => ls.map((l, i) => (i >= c ? { ...l, t: null } : l)));
    setCursor(c);
    seek(Math.max(0, t - 2.5)); // a run-up to tap it again
    tapRef.current?.focus();
  };

  const startOver = () => startTapping(lines);

  const undoRef = useRef(undo);
  undoRef.current = undo;
  useEffect(() => {
    if (step !== 'tap') return undefined;
    const t = setTimeout(() => tapRef.current?.focus(), 80);
    const onKey = (e) => {
      if (e.key === 'Backspace') { e.preventDefault(); undoRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [step]);

  // ── Check ─────────────────────────────────────────────────────────────────
  const clockLines = useMemo(() => lines.map((l) => ({ ...l, t: l.t ?? Infinity })), [lines]);
  const checkIndex = useActiveLine(audioRef, clockLines, step === 'check');
  const timedLines = useMemo(() => lines.filter((l) => l.t != null), [lines]);
  const missing = lines.filter((l) => l.t == null).length;
  const badOrder = firstOutOfOrder(lines);

  const setTime = (i, t) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, t: Math.max(0, Math.round(t * 100) / 100) } : l)));
  const nudge = (i, d) => setTime(i, (lines[i].t ?? 0) + d);
  const stampNow = (i) => {
    const a = audioRef.current;
    if (!a) return;
    setTime(i, a.currentTime - REACTION);
  };
  const playFrom = (t) => { seek(Math.max(0, t - 0.6)); play(); };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async (wordsOnly) => {
    if (saving) return;
    const lyrics = words.trim();
    const body = { lyrics };
    let clearedTiming = false;
    if (!lyrics) {
      body.syncedLyrics = '';
    } else if (wordsOnly) {
      if (isTimed) {
        const all = carried.every((l) => l.t != null);
        body.syncedLyrics = all ? toLrc(carried) : '';
        clearedTiming = !all;
      }
    } else {
      body.syncedLyrics = toLrc(lines);
    }

    setSaving(true);
    setError(null);
    try {
      await apiCall({ method: 'patch', url: `/v1/media/song/${songId}/lyrics`, data: body });
      forgetLyrics(songId);
      audioRef.current?.pause();
      const title = `“${song.title}”`;
      if (!lyrics) feedback.success(`Lyrics cleared for ${title}`);
      else if (!wordsOnly) feedback.success(`Timed lyrics saved for ${title}. Listeners can sing along now.`);
      else if (clearedTiming) feedback.success(`Lyrics saved for ${title}. The timing was cleared because the words changed.`);
      else feedback.success(`Lyrics saved for ${title}`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save the lyrics. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!show || !song) return null;

  const art = song.artwork || buildUrl(song.artworkUrl) || null;
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const progress = duration ? Math.min(100, (now / duration) * 100) : 0;

  const transport = (
    <div className="lw-transport">
      <button
        type="button"
        className="lw-transport__play"
        onClick={playing ? pause : play}
        aria-label={playing ? 'Pause' : 'Play'}
        disabled={!audioUrl || audioFailed}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="lw-transport__time">{formatClock(now)}</span>
      <div
        className="lw-transport__bar"
        onClick={seekFromBar}
        role="slider"
        tabIndex={0}
        aria-label="Song position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(now)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); seek(now + 5); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); seek(now - 5); }
        }}
      >
        <span className="lw-transport__fill" style={{ width: `${progress}%` }} />
        {duration > 0 && lines.map((l, i) => (l.t != null ? (
          <i key={i} className="lw-transport__tick" style={{ left: `${(l.t / duration) * 100}%` }} />
        ) : null))}
      </div>
      <span className="lw-transport__time">{formatClock(duration)}</span>
    </div>
  );

  return (
    <div className="lw-overlay" onClick={requestClose}>
      <div
        className={`lw lw--${step}`}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lw-title"
        onClick={(e) => e.stopPropagation()}
      >
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onError={() => setAudioFailed(true)}
          />
        )}

        {/* ── Header ── */}
        <header className="lw__header">
          <span className="lw__art" aria-hidden="true">
            {art ? <img src={art} alt="" /> : <span className="lw__art-blank" />}
          </span>
          <div className="lw__titles">
            <span className="lw__eyebrow">Timed lyrics</span>
            <h2 id="lw-title">{song.title}</h2>
          </div>
          {onHelp && (
            <button
              type="button"
              className="lw__help"
              onClick={() => { audioRef.current?.pause(); onClose?.(); onHelp(); }}
            >
              <HelpCircle size={15} aria-hidden="true" /> How it works
            </button>
          )}
          <button className="lw__close" onClick={requestClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {/* ── Step rail ── */}
        <ol className="lw-rail" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`lw-rail__step ${i === stepIndex ? 'is-now' : ''} ${i < stepIndex ? 'is-done' : ''}`}
              aria-current={i === stepIndex ? 'step' : undefined}
            >
              <span className="lw-rail__n">{i < stepIndex ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
              <span className="lw-rail__label">{s.label}</span>
            </li>
          ))}
        </ol>

        {/* ── Body ── */}
        <div className="lw__body">
          {error && (
            <div className="lw__error" role="alert">
              <AlertCircle size={15} aria-hidden="true" /> {error}
            </div>
          )}

          {loading && <p className="lw__loading">Loading the song…</p>}

          {!loading && step === 'words' && (
            <>
              <p className="lw__lede">
                Paste the words, one line for each line you sing. Leave a blank line between verses.
              </p>
              {isTimed && (
                <p className={`lw__note ${changedCount ? 'is-warn' : ''}`}>
                  {changedCount === 0
                    ? 'This song is already timed. Next takes you to Check.'
                    : `${changedCount} ${changedCount === 1 ? 'line has' : 'lines have'} changed since you timed this song. Only ${changedCount === 1 ? 'that line needs' : 'those need'} a new time.`}
                </p>
              )}
              <div className="lw-sheet">
                <div className="lw-sheet__gutter" ref={gutterRef} aria-hidden="true">
                  {words.split('\n').map((l, i) => (
                    <span key={i} className={l.trim() ? '' : 'is-blank'}>{i + 1}</span>
                  ))}
                </div>
                <label className="sr-only" htmlFor="lw-textarea">Lyrics</label>
                <textarea
                  id="lw-textarea"
                  className="lw-sheet__text"
                  value={words}
                  wrap="off"
                  spellCheck={false}
                  onChange={(e) => setWords(e.target.value)}
                  onScroll={(e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; }}
                  placeholder={'Streetlights hum on Lenox\nCorner store still open late\n\nSecond verse starts here…'}
                />
              </div>
              <div className="lw__row">
                <span className="lw__count">
                  {wordLines.length ? `${wordLines.length} ${wordLines.length === 1 ? 'line' : 'lines'}` : 'No words yet'}
                </span>
                <button type="button" className="lw-chip" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} aria-hidden="true" /> Import an .lrc file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".lrc,.txt,text/plain"
                  hidden
                  onChange={(e) => importLrc(e.target.files?.[0])}
                />
              </div>
            </>
          )}

          {!loading && step === 'tap' && (
            <>
              <div className="lw-stage lyrics-stage">
                <div className="lw-stage__lines" aria-live="polite">
                  {cursor > 0 && <p className="lw-stage__line is-past">{lines[cursor - 1].text}</p>}
                  {cursor < lines.length ? (
                    <>
                      <p className="lw-stage__cue">{playing ? 'Tap as this line starts' : 'Press play, then tap as this line starts'}</p>
                      <p className="lw-stage__line is-now">{lines[cursor].text}</p>
                      {lines[cursor + 1] && <p className="lw-stage__line is-next">{lines[cursor + 1].text}</p>}
                      {lines[cursor + 2] && <p className="lw-stage__line is-next is-far">{lines[cursor + 2].text}</p>}
                    </>
                  ) : (
                    <p className="lw-stage__line is-now">Every line has a time.</p>
                  )}
                </div>
                <button
                  ref={tapRef}
                  type="button"
                  className={`lw-tap ${playing ? 'is-live' : ''}`}
                  onClick={tap}
                  disabled={!audioUrl || audioFailed || cursor >= lines.length}
                  aria-label={playing ? `Tap: line ${cursor + 1} starts now` : 'Play the song'}
                >
                  <span className="lw-tap__ring" aria-hidden="true" />
                  <span className="lw-tap__label">{playing ? 'Tap' : <Play size={26} fill="currentColor" />}</span>
                </button>
                <p className="lw-stage__count">{Math.min(cursor, lines.length)} of {lines.length} lines</p>
              </div>
              {audioFailed && (
                <p className="lw__note is-warn">This song’s audio couldn’t play here. You can still import an .lrc file from the Words step.</p>
              )}
              {transport}
              <div className="lw__row lw__row--center">
                <button type="button" className="lw-chip" onClick={undo} disabled={cursor === 0}>
                  <Undo2 size={13} aria-hidden="true" /> Undo last tap
                </button>
                <button type="button" className="lw-chip" onClick={startOver} disabled={cursor === 0}>
                  <RotateCcw size={13} aria-hidden="true" /> Start over
                </button>
              </div>
              <p className="lw__keys">Space or Enter taps · Backspace undoes</p>
            </>
          )}

          {!loading && step === 'check' && (
            <>
              <div className="lw-preview lyrics-stage">
                {timedLines.length ? (
                  <LyricsLines
                    lines={timedLines}
                    mediaRef={audioRef}
                    size="md"
                    playing={playing}
                    onSeek={(t) => { seek(t); play(); }}
                    label="Preview of the timed lyrics"
                  />
                ) : (
                  <p className="lw-preview__empty">Lines show here once they have a time.</p>
                )}
              </div>
              {transport}
              {missing > 0 && (
                <p className="lw__note is-warn">
                  {missing} {missing === 1 ? 'line needs' : 'lines need'} a time. Play the song and press <strong>Stamp</strong> as {missing === 1 ? 'it starts' : 'each one starts'}.
                </p>
              )}
              {badOrder > -1 && (
                <p className="lw__note is-warn">Line {badOrder + 1} starts before the line above it. Nudge one of them so they go in order.</p>
              )}
              <ol className="lw-list">
                {lines.map((l, i) => (
                  <li
                    key={`${i}-${l.text}`}
                    className={`lw-list__row ${i === checkIndex ? 'is-now' : ''} ${l.t == null ? 'is-missing' : ''} ${i === badOrder ? 'is-bad' : ''}`}
                  >
                    {l.t != null ? (
                      <>
                        <button type="button" className="lw-list__play" onClick={() => playFrom(l.t)} aria-label={`Play from line ${i + 1}`}>
                          <Play size={12} fill="currentColor" />
                        </button>
                        <span className="lw-list__time">{formatStamp(l.t)}</span>
                        <span className="lw-list__nudge">
                          <button type="button" onClick={() => nudge(i, -NUDGE)} aria-label={`Line ${i + 1} a little earlier`}>−</button>
                          <button type="button" onClick={() => nudge(i, NUDGE)} aria-label={`Line ${i + 1} a little later`}>+</button>
                        </span>
                      </>
                    ) : (
                      <button type="button" className="lw-list__stamp" onClick={() => stampNow(i)} disabled={!playing}>
                        Stamp
                      </button>
                    )}
                    <span className="lw-list__text">{l.text}</span>
                  </li>
                ))}
              </ol>
              <div className="lw__row lw__row--center">
                <button type="button" className="lw-chip" onClick={() => startTapping(lines)}>
                  <RotateCcw size={13} aria-hidden="true" /> Tap them all again
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="lw__footer">
          {confirmClose ? (
            <div className="lw__confirm" role="alert">
              <span>Your timing isn’t saved yet.</span>
              <button type="button" className="lw__btn lw__btn--ghost" onClick={() => setConfirmClose(false)}>Keep working</button>
              <button type="button" className="lw__btn lw__btn--danger" onClick={() => { setConfirmClose(true); audioRef.current?.pause(); onClose?.(); }}>
                Close without saving
              </button>
            </div>
          ) : (
            <>
              {step === 'words' && (
                <>
                  <div className="lw__footer-side">
                    <button
                      type="button"
                      className="lw__btn lw__btn--ghost"
                      onClick={() => save(true)}
                      disabled={saving || loading || !wordsChanged}
                    >
                      {words.trim() ? 'Save words only' : 'Clear lyrics'}
                    </button>
                    {isTimed && changedCount > 0 && (
                      <span className="lw__footer-hint">Saving words only clears this song’s timing.</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="lw__btn lw__btn--primary"
                    onClick={nextFromWords}
                    disabled={loading || !words.trim()}
                  >
                    {isTimed ? 'Next: check timing' : 'Next: tap along'}
                  </button>
                </>
              )}
              {step === 'tap' && (
                <>
                  <button type="button" className="lw__btn lw__btn--ghost" onClick={() => { pause(); goTo('words'); }}>
                    <ChevronLeft size={15} aria-hidden="true" /> Words
                  </button>
                  <button
                    type="button"
                    className="lw__btn lw__btn--primary"
                    onClick={() => goTo('check')}
                    disabled={cursor < lines.length}
                  >
                    Next: check
                  </button>
                </>
              )}
              {step === 'check' && (
                <>
                  <button type="button" className="lw__btn lw__btn--ghost" onClick={() => { pause(); goTo('words'); }}>
                    <ChevronLeft size={15} aria-hidden="true" /> Words
                  </button>
                  <button
                    type="button"
                    className="lw__btn lw__btn--primary"
                    onClick={() => save(false)}
                    disabled={saving || missing > 0 || badOrder > -1}
                  >
                    {saving ? 'Saving…' : 'Save lyrics'}
                  </button>
                </>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

export default LyricsWizard;
