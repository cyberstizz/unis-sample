// src/components/LyricsView.jsx
// ─────────────────────────────────────────────────────────────
// The listener's lyrics view, opened from the player's mic button.
//
//   • Timed lyrics move with the song (LyricsLines). Tap a line to jump.
//   • Words without timing show still, with a short note.
//   • No words: says so.
// The backdrop is the listener's theme colour with white lines (dark lines
// on the yellow theme), from .lyrics-stage.
//
// On computers it fills the screen above the player bar, so the bar's own
// controls stay in reach. On phones (and over the expanded player) it fills
// the whole screen and brings its own play / skip / progress controls.
// Rendered inside .player, so it sits above the page and below nothing.
// Esc closes it.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fetchLyrics } from '../utils/lyricsCache';
import LyricsLines from './LyricsLines';
import { parseLrc, wordsToLines, formatClock } from '../utils/lrc';
import './lyricsView.scss';

export default function LyricsView({
  media,
  mediaRef,
  isPlaying,
  currentTime,
  duration,
  full = false,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onClose,
}) {
  const songId = media?.id || media?.songId;
  const [data, setData] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    fetchLyrics(songId).then((d) => { if (alive) setData(d || { lyrics: '', syncedLyrics: '' }); });
    return () => { alive = false; };
  }, [songId]);

  // Focus the close button on open; Esc closes.
  useEffect(() => {
    const before = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      try { before?.focus?.({ preventScroll: true }); } catch { /* gone */ }
    };
  }, [onClose]);

  const timed = useMemo(() => parseLrc(data?.syncedLyrics), [data]);
  const plain = useMemo(() => wordsToLines(data?.lyrics).map((text) => ({ text, t: null })), [data]);
  const mode = !data ? 'loading' : timed.length ? 'timed' : plain.length ? 'plain' : 'none';
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const seekFromBar = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (duration) onSeek?.(((e.clientX - r.left) / r.width) * duration);
  };

  return (
    <div
      className={`lv lyrics-stage ${full ? 'lv--full' : ''}`}
      role="dialog"
      aria-label={`Lyrics: ${media?.title || 'this song'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="lv__head">
        {media?.artwork && <img className="lv__art" src={media.artwork} alt="" />}
        <div className="lv__who">
          <strong>{media?.title}</strong>
          <span>{media?.artist}</span>
        </div>
        <button ref={closeRef} type="button" className="lv__close" onClick={onClose} aria-label="Close lyrics">
          <ChevronDown size={22} />
        </button>
      </header>

      <div className="lv__body">
        {mode === 'loading' && <p className="lv__msg">Loading lyrics…</p>}
        {mode === 'timed' && (
          <LyricsLines
            lines={timed}
            mediaRef={mediaRef}
            size="lg"
            playing={isPlaying}
            onSeek={(t) => { onSeek?.(t); if (!isPlaying) onTogglePlay?.(); }}
            label={`Lyrics for ${media?.title || 'this song'}`}
            className="lv__lines"
          />
        )}
        {mode === 'plain' && (
          <>
            <p className="lv__note">These lyrics aren’t timed yet, so they don’t move with the song.</p>
            <LyricsLines lines={plain} timed={false} size="lg" className="lv__lines" />
          </>
        )}
        {mode === 'none' && (
          <div className="lv__empty">
            <p className="lv__empty-title">No lyrics for this song yet.</p>
            <p className="lv__msg">When the artist adds them, they’ll show here.</p>
          </div>
        )}
      </div>

      <footer className="lv__foot">
        <div className="lv__bar" onClick={seekFromBar} aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="lv__times">
          <span>{formatClock(currentTime)}</span>
          <span>{formatClock(duration)}</span>
        </div>
        <div className="lv__controls">
          <button type="button" onClick={onPrev} aria-label="Previous">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
          </button>
          <button type="button" className="lv__play" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button type="button" onClick={onNext} aria-label="Next">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
