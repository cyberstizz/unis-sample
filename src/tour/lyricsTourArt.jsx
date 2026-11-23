// src/tour/lyricsTourArt.jsx
// Small moving pictures for the lyric-timing tour (lyricsTourSteps.jsx).
// Pure CSS loops, drawn in the user's theme colour. They hold still when the
// device asks for reduced motion. Decorative only (the card's text says it all).
import React from 'react';
import { Mic2, Sparkles } from 'lucide-react';
import './lyricsTourArt.scss';

// Glyphs for the card's badge, matching the welcome tour's (size, tone) props.
// eslint-disable-next-line no-unused-vars -- tone/active match the icon set's props
export const MicGlyph = ({ size = 20, tone, active, ...props }) => <Mic2 size={size} {...props} />;
// eslint-disable-next-line no-unused-vars -- tone/active match the icon set's props
export const SparkGlyph = ({ size = 20, tone, active, ...props }) => <Sparkles size={size} {...props} />;

const LINES = ['Streetlights hum on Lenox', 'Corner store still open late', 'Every block a different song', 'Turn it up, we’re singing back'];

/** Four lines lighting up in turn, on the theme-coloured stage. */
export const KaraokeArt = () => (
  <div className="lta lta-karaoke lyrics-stage">
    {LINES.map((l, i) => (
      <span key={l} className="lta-karaoke__line" style={{ '--i': i }}>{l}</span>
    ))}
  </div>
);

/** A ruled lyric sheet with lines being written in. */
export const WordsArt = () => (
  <div className="lta lta-sheet">
    {[78, 92, 64, 0, 86].map((w, i) => (
      <span key={i} className="lta-sheet__row" style={{ '--i': i }}>
        <i className="lta-sheet__n">{w ? i + 1 - (i > 3 ? 1 : 0) : ''}</i>
        {w > 0 && <b className="lta-sheet__ink" style={{ '--w': `${w}%` }} />}
      </span>
    ))}
  </div>
);

/** The tap pad pulsing, with a stamp landing on the song's timeline each beat. */
export const TapArt = () => (
  <div className="lta lta-tap">
    <span className="lta-tap__pad"><span className="lta-tap__ring" />Tap</span>
    <span className="lta-tap__track">
      {[0, 1, 2, 3].map((i) => <i key={i} className="lta-tap__tick" style={{ '--i': i }} />)}
      <span className="lta-tap__head" />
    </span>
  </div>
);

/** Timed rows with nudge buttons, the playing row lit. */
export const CheckArt = () => (
  <div className="lta lta-check">
    {['0:12.4', '0:15.9', '0:19.2'].map((t, i) => (
      <span key={t} className="lta-check__row" style={{ '--i': i }}>
        <i className="lta-check__time">{t}</i>
        <i className="lta-check__nudge">− +</i>
        <b className="lta-check__words" />
      </span>
    ))}
  </div>
);
