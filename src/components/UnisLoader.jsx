// src/components/UnisLoader.jsx
// ─────────────────────────────────────────────────────────────
// The in-app loader: what shows where a page's content is about to appear,
// while the header, sidebar and player stay put.
//
// The look: the UNIS wordmark is written in by a glowing band of light
// sweeping in from the right, holds for a beat, then a second band sweeps
// through and wipes it away, on a loop. The glow is the user's theme colour
// with its two neighbouring hues on either side, so it shimmers through a
// small range of colour without ever leaving the theme. (Inspired by the
// way Suno's loader writes its logo in and out.)
//
// It fades in only after a short pause, so a fast load never flashes it.
// With reduced motion on it shows the still logo and the label.
//
// Props
//   label     the line under the logo, e.g. "Loading your feed..."
//   size      'page'    (fills the content area; for a whole page loading)
//             'section' (a shorter block; for one part of a page)
//   className extra classes for the wrapper
//
// Styles: components/unisLoader.scss. The wordmark files are the launch
// splash's (public/brand/splash/), so the logo always matches the theme.
// ─────────────────────────────────────────────────────────────
import React from 'react';
import './unisLoader.scss';

export default function UnisLoader({ label = 'Loading...', size = 'page', className = '' }) {
  return (
    <div
      className={`unis-loader unis-loader--${size} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="unis-loader__mark" aria-hidden="true">
        <span className="unis-loader__glow"><i /></span>
        <span className="unis-loader__word" />
        <span className="unis-loader__edge" />
      </div>
      {label ? (
        <p className="unis-loader__label">{label}</p>
      ) : (
        <span className="unis-loader__sr">Loading</span>
      )}
    </div>
  );
}
