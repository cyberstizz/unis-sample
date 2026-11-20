import React from 'react';
import './followBar.scss';

// =============================================================================
// FollowBar — the bar that follows you down a page (Nov 2026).
//
// Designed with Scout → Sketch → Ship (canvases: "Unis artist page — scroll
// bar", "Unis song page — scroll bar"). This file is the SHARED part: where
// the bar sits, its blurred backdrop and theme tint, and how it behaves on
// scroll. Each page fills it with its own content (artwork, text, buttons),
// so every page is still designed on its own.
//
// The rules it follows, from the research:
//   • Hand-off, not a pop-in: the page's big title fades as it slides under
//     the app header, and the bar fades in with the scroll.
//   • Play docks late: a .fb-dock button only appears once the page's own
//     Play has gone under the bar, so there are never two on screen
//     (Spotify's bar shows up early and overlaps its own Play).
//   • Solid enough to read: never see-through over the page.
//   • Small: 68px on desktop, 56px on phones.
//   • Keyboard focus never lands under the bar (WCAG 2.4.11): while the bar
//     is shown, the page reserves its height when scrolling to a control.
//   • Hidden means hidden: while the bar is off, its buttons can't be tabbed.
//   • Reduce motion: a plain fade.
//
// The page scrolls the window on some layouts and .layout-content on
// others, so both are watched (the first artist bar only watched one,
// which is why it stopped showing).
//
// Usage:
//   import { useFollowBar } from '../hooks/useFollowBar';
//   const bar = useFollowBar({ ready: !loading });
//   <h1 ref={bar.titleRef}>…</h1>          // the title that hands off
//   <button ref={bar.playRef}>…</button>   // the page's own Play
//   <FollowBar bar={bar} backdrop={artUrl} label="Song">…content…</FollowBar>
// =============================================================================

export default function FollowBar({ bar, backdrop, label, className = '', children }) {
  return (
    <div
      ref={bar.barRef}
      className={`fb${bar.shown ? ' is-shown' : ''}${bar.docked ? ' is-docked' : ''}${className ? ` ${className}` : ''}`}
      role="region"
      aria-label={label}
      aria-hidden={!bar.shown}
      inert={!bar.shown}
    >
      {backdrop && <img src={backdrop} alt="" className="fb__backdrop" />}
      <div className="fb__tint" />
      <div className="fb__inner">{children}</div>
    </div>
  );
}
