import { useEffect } from 'react';

// =============================================================================
// useArtHero — the "poster front" shared by the playlist and song pages
// (Nov 2026, Scout → Sketch → Ship; canvas "Unis playlist & song pages").
//
// What it does:
//   • Writes --art-par (parallax offset) and --art-dim (0 → 0.62) on the hero
//     element as the page scrolls, so the artwork drifts up slower than the
//     page and dims. Reduce motion: no drift, the dim still follows.
//   • Tells the app header it sits over artwork: body.unis-art-page turns the
//     phone header to glass, body.unis-art-scrolled fills it with the art's
//     deep colour once the artwork has scrolled away (header.scss).
//   • Publishes that deep colour as --unis-art-deep on <html>.
//
// The page scrolls the window on some layouts and .layout-content on others,
// so scroll is listened to on the document in the capture phase (both reach
// it). Work is batched to one update per frame.
// =============================================================================

const PHONE = '(max-width: 767px)';
const HEADER_PHONE = 72;   // header.scss: 72px under 768px
const HEADER_DESKTOP = 75; // header.scss: $header-height

export default function useArtHero(ref, { deep, ready = true } = {}) {
  // The colour the header takes once the art is gone.
  useEffect(() => {
    if (!ready || !deep) return undefined;
    const root = document.documentElement;
    root.style.setProperty('--unis-art-deep', deep);
    return () => root.style.removeProperty('--unis-art-deep');
  }, [deep, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const body = document.body;
    body.classList.add('unis-art-page');

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    let raf = 0;

    const update = () => {
      raf = 0;
      const phone = !!window.matchMedia?.(PHONE)?.matches;
      // On phones the art starts under the header (top 0); on desktop it
      // starts right below it.
      const anchor = phone ? 0 : HEADER_DESKTOP;
      const top = el.getBoundingClientRect().top;
      const y = Math.max(0, anchor - top);
      el.style.setProperty('--art-par', reduce ? '0px' : `${Math.round(Math.min(y, 700) * 0.42)}px`);
      el.style.setProperty('--art-dim', Math.min(0.62, y / 640).toFixed(3));
      const header = phone ? HEADER_PHONE : HEADER_DESKTOP;
      body.classList.toggle('unis-art-scrolled', el.getBoundingClientRect().bottom < header + 40);
    };

    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

    update();
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      body.classList.remove('unis-art-page', 'unis-art-scrolled');
    };
  }, [ref, ready]);
}
