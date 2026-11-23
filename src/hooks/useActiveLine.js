// src/hooks/useActiveLine.js
// Index of the lyric line being sung, read from a media element's own clock
// every frame. React re-renders only when the line changes. Used by
// LyricsLines (the moving lyrics) and the lyrics wizard's Check step.
import { useEffect, useState } from 'react';
import { activeIndex } from '../utils/lrc';

/** Index of the line being sung, from a media element's clock. */
export default function useActiveLine(mediaRef, lines, enabled = true) {
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    if (!enabled || !lines?.length) { setIndex(-1); return undefined; }
    let raf = 0;
    let last = -2;
    const tick = () => {
      const media = mediaRef?.current;
      const i = media ? activeIndex(lines, media.currentTime) : -1;
      if (i !== last) { last = i; setIndex(i); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mediaRef, lines, enabled]);
  return index;
}

