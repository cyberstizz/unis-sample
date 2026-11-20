import { useCallback, useEffect, useRef, useState } from 'react';

// useFollowBar — the behavior half of the bar that follows you down a page.
// The frame is components/FollowBar.jsx; read the rules there.
// Returns refs for the page's title and own Play button, the bar's ref,
// whether the bar is shown / its Play docked, and scrollToTop.

const APP_HEADER = 75; // keep in sync with $header-height in header.scss
const HAND_OFF = 70;   // px of scroll the title hand-off takes

export function useFollowBar({ ready = true } = {}) {
  const titleRef = useRef(null);
  const playRef = useRef(null);
  const barRef = useRef(null);
  const [shown, setShown] = useState(false);
  const [docked, setDocked] = useState(false);

  const measure = useCallback(() => {
    const title = titleRef.current;
    const bar = barRef.current;
    if (!title || !bar) return;
    const barH = bar.offsetHeight || 56;
    // 0 while the title sits clear of the header, 1 once it has gone under.
    const top = title.getBoundingClientRect().top;
    const hand = Math.max(0, Math.min(1, (APP_HEADER + 40 - top) / HAND_OFF));
    bar.style.setProperty('--fb-hand', hand.toFixed(3));
    title.style.opacity = String(1 - hand);
    setShown(hand > 0.5);

    const play = playRef.current;
    const playBottom = play ? play.getBoundingClientRect().bottom : -1;
    setDocked(playBottom < APP_HEADER + barH);
  }, []);

  const scroller = useCallback(() => barRef.current?.closest('.layout-content') || null, []);

  useEffect(() => {
    if (!ready) return undefined;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const targets = [window, scroller()].filter(Boolean);
    targets.forEach((t) => t.addEventListener('scroll', onScroll, { passive: true }));
    window.addEventListener('resize', onScroll);
    measure();
    const title = titleRef.current;
    return () => {
      if (frame) cancelAnimationFrame(frame);
      targets.forEach((t) => t.removeEventListener('scroll', onScroll));
      window.removeEventListener('resize', onScroll);
      // Leave the page's title as we found it.
      if (title) title.style.opacity = '';
    };
  }, [ready, measure, scroller]);

  // While the bar is shown, keyboard focus must not land underneath it.
  useEffect(() => {
    if (!shown) return undefined;
    const barH = barRef.current?.offsetHeight || 56;
    const reserve = `${APP_HEADER + barH + 8}px`;
    const els = [document.documentElement, scroller()].filter(Boolean);
    const before = els.map((el) => el.style.scrollPaddingTop);
    els.forEach((el) => { el.style.scrollPaddingTop = reserve; });
    return () => els.forEach((el, i) => { el.style.scrollPaddingTop = before[i]; });
  }, [shown, scroller]);

  const scrollToTop = useCallback(() => {
    const content = scroller();
    if (content && content.scrollTop > 0) content.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scroller]);

  return { titleRef, playRef, barRef, shown, docked, scrollToTop };
}

