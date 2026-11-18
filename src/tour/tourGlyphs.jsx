// src/tour/tourGlyphs.jsx
// Two small glyphs the tour needs that the Unis icon set doesn't have, drawn
// to the same rules (24 grid, 1.8 stroke, round caps). They take the icon
// set's props (size, tone, active) so the tour can treat every glyph alike.
import React from 'react';

// eslint-disable-next-line no-unused-vars -- tone/active match the icon set's props
export const LiveGlyph = ({ size = 22, tone, active, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" />
    <path d="M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
  </svg>
);

// eslint-disable-next-line no-unused-vars -- tone/active match the icon set's props
export const LensGlyph = ({ size = 22, tone, active, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="M5 16.5v-3M9.7 16.5v-9M14.3 16.5v-6M19 16.5V5.5" />
    <path d="M4 19.5h16" opacity="0.55" />
  </svg>
);
