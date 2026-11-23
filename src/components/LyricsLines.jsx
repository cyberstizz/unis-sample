// src/components/LyricsLines.jsx
// ─────────────────────────────────────────────────────────────
// The moving lyrics: the line being sung is lit, the ones ahead wait dimmed,
// and the list glides so the current line sits a little above the middle.
// Tap a line to jump the song there (when onSeek is given).
//
// Used by the player's lyrics view, the lyrics wizard's Check step and the
// song page. Put it inside a `.lyrics-stage` (the theme-coloured backdrop
// that sets the line colours) or give it the `lyrics-stage` class itself.
//
// The clock is the media element itself (mediaRef), read every frame, so the
// highlight lands with the voice instead of the player's 4-per-second
// timeupdate. React only re-renders when the line changes.
//
// If the listener scrolls by hand, following stops and a "Back to the song"
// pill appears; tapping it snaps back.
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import useActiveLine from '../hooks/useActiveLine';
import './lyricsLines.scss';

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export default function LyricsLines({
  lines,
  mediaRef,
  timed = true,
  onSeek,
  size = 'lg',
  className = '',
  label = 'Lyrics',
  playing = true,
}) {
  const boxRef = useRef(null);
  const lineRefs = useRef([]);
  const [away, setAway] = useState(false);
  const index = useActiveLine(mediaRef, lines, timed);
  const reduced = useRef(reducedMotion()).current;

  // Keep the current line in view, unless the listener scrolled away.
  useEffect(() => {
    if (!timed || away) return;
    const box = boxRef.current;
    const el = lineRefs.current[Math.max(index, 0)];
    if (!box || !el) return;
    const top = el.offsetTop - box.clientHeight * 0.36 + el.offsetHeight / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }, [index, away, timed, reduced]);

  // Hand scrolling (wheel, drag, keys) pauses following.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !timed) return undefined;
    const leave = () => setAway(true);
    const onKey = (e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) leave(); };
    box.addEventListener('wheel', leave, { passive: true });
    box.addEventListener('touchmove', leave, { passive: true });
    box.addEventListener('keydown', onKey);
    return () => {
      box.removeEventListener('wheel', leave);
      box.removeEventListener('touchmove', leave);
      box.removeEventListener('keydown', onKey);
    };
  }, [timed]);

  const jump = (line) => {
    if (!onSeek || line.t == null) return;
    setAway(false);
    onSeek(line.t);
  };

  return (
    <div className={`ll-wrap ${className}`}>
      <div
        ref={boxRef}
        className={`ll ll--${size} ${timed ? 'll--timed' : 'll--static'}`}
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <div className="ll__pad" aria-hidden="true" />
        {lines.map((line, i) => {
          const state = !timed ? 'static' : i === index ? 'now' : i < index ? 'past' : 'next';
          const canJump = timed && onSeek && line.t != null;
          const Tag = canJump ? 'button' : 'p';
          return (
            <Tag
              key={`${i}-${line.text}`}
              ref={(el) => { lineRefs.current[i] = el; }}
              type={canJump ? 'button' : undefined}
              className={`ll__line is-${state}`}
              aria-current={state === 'now' ? 'true' : undefined}
              onClick={canJump ? () => jump(line) : undefined}
            >
              {line.text}
            </Tag>
          );
        })}
        <div className="ll__pad ll__pad--end" aria-hidden="true" />
      </div>
      {timed && away && playing && (
        <button type="button" className="ll__back" onClick={() => setAway(false)}>
          Back to the song
        </button>
      )}
    </div>
  );
}
