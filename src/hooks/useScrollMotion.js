// src/hooks/useScrollMotion.js
// ─────────────────────────────────────────────────────────────
// True while the listener is scrolling anywhere on the page, and for
// `settleMs` after they stop. The mini player uses it to turn to glass and
// tuck in while you move, then settle back into its tinted card.
//
// Listens in the capture phase on document, so it hears every scroller:
// the window, .layout-content, and inner shelves alike. Scrolling inside
// the player's own surfaces (Now Playing, the queue, comments, lyrics,
// the actions tray) is ignored.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

const OWN_SURFACES = '.unp-np, .unp-tray, .qp-overlay, .player-comments-sheet, .lv';

export default function useScrollMotion({ enabled = true, settleMs = 700 } = {}) {
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setMoving(false);
      return undefined;
    }
    let timer = null;
    let on = false;

    const onScroll = (e) => {
      const t = e.target;
      if (t && t.nodeType === 1 && t.closest?.(OWN_SURFACES)) return;
      if (!on) { on = true; setMoving(true); }
      clearTimeout(timer);
      timer = setTimeout(() => { on = false; setMoving(false); }, settleMs);
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, [enabled, settleMs]);

  return moving;
}
