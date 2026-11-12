// ─────────────────────────────────────────────────────────────────────────────
// PlusMark — the Unis Plus brand lockup: the UNIS wordmark with a superscript
// "+" cut from the same material (chrome top half, the user's theme colour on
// the bottom half — the same split the S and the i-dot use).
//
//   <PlusMark height={40} />            hero size; follows the user's theme
//   <PlusMark height={14} />            ad-card / inline size
//   <PlusMark height={28} theme="blue" /> force a theme (emails, previews)
//
// `height` is the cap height of the letters in px; the lockup is about
// 5.3× that wide. The wordmark is the same per-theme asset the header shows,
// cropped to the letters, so the two always match. The "+" is inline SVG that
// reads --unis-primary, so it re-colours with the theme on its own.
//
// A static blue version lives at /public/brand/unis-plus.svg (and .png) for
// emails, social posts and anything outside the app.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useId } from 'react';
import { useAuth } from '../context/AuthContext';
import logoblue from '../assets/unisLogoThree.svg';
import logoorange from '../assets/logo-orange.png';
import logored from '../assets/logo-red.png';
import logogreen from '../assets/logo-green.png';
import logopurple from '../assets/logo-purple.png';
import logoyellow from '../assets/logo-gold.png';
import logodianna from '../assets/logo-dianna.png';
import './plusMark.scss';

// Where the letters sit inside each source image, as fractions of the image
// side (all sources are square). Measured once; used to crop to the letters.
const SVG_CROP = { x: 47 / 1024, y: 370.5 / 1024, w: 930 / 1024, h: 205 / 1024 };
const PNG_CROP = { x: 59 / 1280, y: 463 / 1280, w: 1164 / 1280, h: 257 / 1280 };

const WORDMARKS = {
  blue: { src: logoblue, crop: SVG_CROP },
  orange: { src: logoorange, crop: PNG_CROP },
  red: { src: logored, crop: PNG_CROP },
  green: { src: logogreen, crop: PNG_CROP },
  purple: { src: logopurple, crop: PNG_CROP },
  yellow: { src: logoyellow, crop: PNG_CROP },
  dianna: { src: logodianna, crop: PNG_CROP },
};

// The "+" glyph: 112 units square, 32-unit arms, 7-unit corners (the letters'
// stroke is ~45 units on a 205-unit cap, so this sits a step lighter).
const S = 112;
const T = 32;
const R = 7;
const rrect = (x, y, w, h, r) =>
  `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} ` +
  `h-${w - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${h - 2 * r} a${r},${r} 0 0 1 ${r},-${r} Z`;
const PLUS_PATH = `${rrect((S - T) / 2, 0, T, S, R)} ${rrect(0, (S - T) / 2, S, T, R)}`;

const PlusMark = ({ height = 28, theme: forcedTheme, className = '', title = 'Unis Plus' }) => {
  const { theme, isGuest } = useAuth();
  const key = forcedTheme || (isGuest ? 'blue' : theme);
  const mark = WORDMARKS[key] || WORDMARKS.blue;
  const { crop } = mark;
  const uid = useId().replace(/:/g, '');

  // Crop the square source down to the letters: scale it so the letter band is
  // `height` tall, then shift it so the band's top-left lands at 0,0.
  const scale = height / crop.h; // rendered side of the full source image
  const wordStyle = {
    width: `${crop.w * scale}px`,
    height: `${height}px`,
    backgroundImage: `url(${mark.src})`,
    backgroundSize: `${scale}px ${scale}px`,
    backgroundPosition: `${-crop.x * scale}px ${-crop.y * scale}px`,
  };

  return (
    <span className={`plus-mark ${className}`.trim()} role="img" aria-label={title}
      style={{ '--pm-h': `${height}px` }}>
      <span className="plus-mark__word" style={wordStyle} aria-hidden="true" />
      <svg className="plus-mark__plus" viewBox={`0 0 ${S} ${S}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}-chrome`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eceef0" />
            <stop offset="0.6" stopColor="#cfd1d5" />
            <stop offset="1" stopColor="#b6b9bf" />
          </linearGradient>
          <linearGradient id={`${uid}-tint`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--unis-primary-2, #1476d0)' }} />
            <stop offset="0.4" style={{ stopColor: 'var(--unis-primary, #0b4fa8)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--unis-primary, #083d8c), black 22%)' }} />
          </linearGradient>
          <clipPath id={`${uid}-top`}><rect x={-S} y={-S} width={3 * S} height={1.5 * S} /></clipPath>
          <clipPath id={`${uid}-bot`}><rect x={-S} y={S / 2} width={3 * S} height={S} /></clipPath>
          <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <path d={PLUS_PATH} className="plus-mark__glow" filter={`url(#${uid}-glow)`} />
        <path d={PLUS_PATH} fill={`url(#${uid}-chrome)`} clipPath={`url(#${uid}-top)`} />
        <path d={PLUS_PATH} fill={`url(#${uid}-tint)`} clipPath={`url(#${uid}-bot)`} />
        <rect x="0" y={S / 2 - 2} width={S} height="2.5" fill="#fff" opacity="0.5" clipPath={`url(#${uid}-top)`} />
        <path d={PLUS_PATH} fill="none" stroke="#2b3340" strokeOpacity="0.55" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

export default PlusMark;
