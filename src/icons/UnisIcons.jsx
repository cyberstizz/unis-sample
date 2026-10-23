// src/icons/UnisIcons.jsx
// ─────────────────────────────────────────────────────────────
// Unis "Glow" icon set — original Unis icons (no third-party icon library).
//
// Style rules (keep new icons consistent with these):
//   • 24 × 24 grid, 1.8 stroke, round caps + round joins.
//   • Outlines use currentColor, so each icon picks up its container's
//     text colour (muted, hover, primary-2…) exactly like Lucide did.
//   • Every icon has one "heart" detail painted with the theme gradient.
//   • active={true} fills the main shape with the gradient and turns the
//     heart white.
//   • tone="on" draws everything in currentColor (no gradient) for icons
//     that sit on a coloured button, e.g. the Sign In pill.
//
// The gradient is built from --unis-primary, so it follows every theme
// (and the guest-blue reset on .app-header--guest) automatically.
//
// Usage:
//   import { FindIcon } from './icons/UnisIcons';
//   <FindIcon size={15} active={isActive} className="nav-icon" />
// ─────────────────────────────────────────────────────────────
import React, { useId } from 'react';

const STROKE = 1.8;
const GLOW_LIGHT = 'color-mix(in srgb, var(--unis-primary, #163387), white 62%)';
const GLOW_DEEP = 'color-mix(in srgb, var(--unis-primary, #163387), white 18%)';

// One gradient per icon instance, so an icon inside a hidden element can
// never break another icon that points at the same gradient id.
function useGlowId() {
  const raw = useId();
  return `unis-glow-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

// How each kind of part is painted for the current state.
function paints(active, tone, gradientId) {
  const grad = `url(#${gradientId})`;
  if (tone === 'on') {
    return {
      bodyFill: 'none',
      bodyStroke: 'currentColor',
      heart: 'currentColor',
      accent: 'currentColor',
      line: 'currentColor',
      knob: 'currentColor',
    };
  }
  return {
    bodyFill: active ? grad : 'none',       // main shape
    bodyStroke: active ? grad : 'currentColor',
    heart: active ? '#ffffff' : grad,       // detail that sits inside the main shape
    accent: grad,                           // gradient detail that sits outside a filled shape
    line: active ? grad : 'currentColor',   // secondary outlines
    knob: active ? '#ffffff' : 'currentColor',
  };
}

function IconFrame({ gradientId, size, className, title, style, children, ...rest }) {
  const a11y = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': 'true' };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className}
      // Inline so stylesheet rules like `.mobile-search-trigger svg { stroke-width }`
      // can't thicken the set.
      style={{ strokeWidth: STROKE, ...style }}
      {...a11y}
      {...rest}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" style={{ stopColor: GLOW_LIGHT }} />
          <stop offset="1" style={{ stopColor: GLOW_DEEP }} />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

// ── Navigation ───────────────────────────────────────────────

export function FindIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <path d="M12 21.3C9.6 19.5 4.6 15.1 4.6 9.9a7.4 7.4 0 0 1 14.8 0c0 5.2-5 9.6-7.4 11.4z" fill={p.bodyFill} stroke={p.bodyStroke} />
      <circle cx="12" cy="9.9" r="2.6" fill={p.heart} stroke="none" />
    </IconFrame>
  );
}

export function VoteIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <path d="M9.39 13L7.53 5.55A1.6 1.6 0 0 1 8.69 3.61L12.77 2.59A1.6 1.6 0 0 1 14.71 3.76L17.01 13" fill={p.bodyFill} stroke={p.bodyStroke} />
      <path d="M9.98 7.93L11.67 8.95L13.42 5.63" fill="none" stroke={p.heart} />
      <path d="M3.2 13h17.6v5.6a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2z" fill="none" stroke={p.line} />
    </IconFrame>
  );
}

export function AwardsIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <path d="M10.4 9.7 7 3.4h3.8l1.2 2.4 1.2-2.4H17l-3.4 6.3" fill="none" stroke={p.line} />
      <circle cx="12" cy="15.1" r="5.7" fill={p.bodyFill} stroke={p.bodyStroke} />
      <path d="M12 12.3l.95 1.95 2.15.3-1.55 1.5.37 2.13L12 17.17l-1.92 1.01.37-2.13-1.55-1.5 2.15-.3z" fill={p.heart} stroke="none" />
    </IconFrame>
  );
}

export function EarningsIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <circle cx="12" cy="12" r="8.6" fill={p.bodyFill} stroke={p.bodyStroke} />
      <path d="M14.6 9.5c-.3-1.1-1.3-1.7-2.6-1.7-1.6 0-2.6.8-2.6 2 0 2.7 5.3 1.6 5.3 4.3 0 1.2-1.1 2-2.7 2-1.4 0-2.4-.7-2.7-1.8M12 6.2v1.6M12 16.1v1.7" fill="none" stroke={p.heart} />
    </IconFrame>
  );
}

// ── Header controls ──────────────────────────────────────────

export function MenuIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <path d="M4 6.8h16M4 17.2h16" fill="none" stroke={p.line} />
      <path d="M4 12h16" fill="none" stroke={p.accent} />
    </IconFrame>
  );
}

export function SearchIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <circle cx="10.6" cy="10.6" r="6.6" fill={p.bodyFill} stroke={p.bodyStroke} />
      <path d="M15.5 15.5 20.2 20.2" fill="none" stroke={p.line} />
      <path d="M7.12 9.33A3.7 3.7 0 0 1 10.08 6.94" fill="none" stroke={p.heart} />
    </IconFrame>
  );
}

export function SignInIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <path d="M12.4 20.5V8.4a4.05 4.05 0 0 1 8.1 0v12.1z" fill={p.bodyFill} stroke={p.bodyStroke} />
      <circle cx="14.7" cy="13.4" r="1" fill={p.knob} stroke="none" />
      <path d="M3.5 12.6h6.4M7.2 9.4l3.2 3.2-3.2 3.2" fill="none" stroke={p.accent} />
    </IconFrame>
  );
}

export function SignOutIcon({ active = false, tone = 'default', size = 24, ...props }) {
  const id = useGlowId();
  const p = paints(active, tone, id);
  return (
    <IconFrame gradientId={id} size={size} {...props}>
      <path d="M3.5 20.5V8.4a4.05 4.05 0 0 1 8.1 0v12.1z" fill={p.bodyFill} stroke={p.bodyStroke} />
      <circle cx="9.3" cy="13.4" r="1" fill={p.knob} stroke="none" />
      <path d="M13.6 12.6h6.6M17 9.4l3.2 3.2-3.2 3.2" fill="none" stroke={p.accent} />
    </IconFrame>
  );
}
