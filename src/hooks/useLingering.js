// src/hooks/useLingering.js
// Keeps something on screen for a moment after it's told to go away, so it
// can animate out instead of vanishing.
//
//   const { mounted, leaving } = useLingering(open, 220);
//   if (!mounted) return null;
//   <div className={leaving ? 'is-leaving' : ''}>…</div>
//
// With "reduce motion" turned on, it leaves immediately.
import { useEffect, useState } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function useLingering(show, ms = 200) {
  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return undefined;
    }
    if (reducedMotion()) {
      setMounted(false);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [show, ms]);

  return { mounted: show || mounted, leaving: !show && mounted };
}
