// src/hooks/useFitLine.js
// Keeps a heading on ONE line whatever jurisdiction name is in it.
//
// The element's own CSS sizes its text as `calc(<size> * var(--fit, 1))`.
// This hook measures the line and, when it overflows, lowers --fit (never
// below `min`) until it fits. If it still can't fit at the floor, the CSS
// ellipsis on the name takes over. Re-measures when the box resizes, when
// fonts finish loading, and when `text` changes (e.g. a new jurisdiction).
//
// Used by the feed: "This afternoon in Downtown Harlem" and
// "Trending Today in [Downtown Harlem ▾]".
import { useLayoutEffect } from 'react';

export default function useFitLine(ref, text, { min = 0.7 } = {}) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;

    const fit = () => {
      el.style.setProperty('--fit', '1');
      const room = el.clientWidth;
      // The parts are allowed to shrink (that's how the ellipsis works), so
      // measure the line at its natural width, then put the box back.
      // (flex: none too, or a heading inside a flex row gets squeezed back.)
      const { width, maxWidth, flex } = el.style;
      el.style.width = 'max-content';
      el.style.maxWidth = 'none';
      el.style.flex = 'none';
      const need = el.scrollWidth;
      el.style.width = width;
      el.style.maxWidth = maxWidth;
      el.style.flex = flex;
      if (room > 0 && need > room + 1) {
        const scale = Math.max(min, Math.floor((room / need) * 100) / 100);
        el.style.setProperty('--fit', String(scale));
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    fit();
    let ro;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(schedule);
      ro.observe(el);
    }
    document.fonts?.ready?.then(schedule).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [ref, text, min]);
}
