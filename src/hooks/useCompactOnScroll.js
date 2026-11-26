// src/hooks/useCompactOnScroll.js
// ─────────────────────────────────────────────────────────────
// The compact mini player (phones and tablets): true once the listener
// scrolls DOWN a page past `downAfter` px, false again when the page is back
// at the top. Scrolling up in between changes nothing; the player only opens
// back up from a tap (player.jsx) or the top of the page.
//
// Manual shrink: setCompact(true) (the ellipsis button) PINS the compact
// state. A pinned player ignores the top-of-page reopen, so it stays small
// until the listener taps it. setCompact(false) unpins it.
//
// Listens in the capture phase on document and only to the page scrollers
// (the window and .layout-content), so shelves, sheets and the queue
// scrolling sideways or inside themselves never shrink the player.
// Returns [compact, setCompact]; turns false whenever it is disabled.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';

const isWindowScroller = (t) =>
  t === document || t === document.documentElement || t === document.body;

export default function useCompactOnScroll({ enabled = true, downAfter = 140, topWithin = 24 } = {}) {
  const [compact, setCompactState] = useState(false);
  const pinnedRef = useRef(false);

  // The setter player.jsx uses. Always a deliberate choice by the listener,
  // so true pins the compact player and false releases it.
  const setCompact = useCallback((value) => {
    pinnedRef.current = !!value;
    setCompactState(!!value);
  }, []);

  useEffect(() => {
    if (!enabled) {
      pinnedRef.current = false;
      setCompactState(false);
      return undefined;
    }
    const last = new WeakMap();

    const onScroll = (e) => {
      const t = e.target;
      const onWindow = isWindowScroller(t);
      if (!onWindow && !(t?.nodeType === 1 && t.classList?.contains('layout-content'))) return;
      const key = onWindow ? document : t;
      const y = onWindow ? (window.scrollY || document.documentElement.scrollTop || 0) : t.scrollTop;
      const prev = last.has(key) ? last.get(key) : y;
      last.set(key, y);
      if (y <= topWithin) {
        if (!pinnedRef.current) setCompactState(false);
      } else if (y > downAfter && y - prev > 3) {
        setCompactState(true);
      }
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [enabled, downAfter, topWithin]);

  return [compact, setCompact];
}