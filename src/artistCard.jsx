import React, { useEffect, useRef, useState } from 'react';

const SILVER = '#C0C0C0';

// Fallback if the theme vars haven't loaded yet (matches the original blue theme)
const DEFAULT_PRIMARY       = [22, 51, 135];   // #163387
const DEFAULT_PRIMARY_LIGHT = [46, 90, 172];   // #2E5AAC

// ──────────────────────────────────────────────────────────────
//  Color utilities
// ──────────────────────────────────────────────────────────────

// Parse a CSS color value ("#abc", "#aabbcc", "rgb(...)", "rgba(...)") → [r,g,b]
function parseColor(value) {
  if (!value) return null;
  const trimmed = value.trim();

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b].some(isNaN) ? null : [r, g, b];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b].some(isNaN) ? null : [r, g, b];
    }
    return null;
  }

  const m = trimmed.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  return null;
}

// Bump lightness in HSL by `amount` (0–1) so we get a hue-preserving lighter variant.
function lightenHsl([r, g, b], amount = 0.13) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  let l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }

  l = Math.min(1, l + amount);

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function lerpInt(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// ──────────────────────────────────────────────────────────────
//  Hooks
// ──────────────────────────────────────────────────────────────

// Smooth sinusoidal pulse 0 → 1 → 0
function usePulse(period = 2000) {
  const [t, setT] = useState(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    let raf;
    const tick = (now) => {
      const elapsed = (now - startRef.current) % (period * 2);
      const phase = elapsed < period
        ? elapsed / period
        : 1 - (elapsed - period) / period;
      setT(phase);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [period]);

  return t;
}

// Reads --unis-primary off <html> and tracks theme switches.
// Derives a hue-preserving light variant so we only need one CSS var.
function useThemeColors() {
  const [colors, setColors] = useState({
    primary: DEFAULT_PRIMARY,
    primaryLight: DEFAULT_PRIMARY_LIGHT,
  });

  useEffect(() => {
    const root = document.documentElement;

    const read = () => {
      const styles = getComputedStyle(root);
      const primary =
        parseColor(styles.getPropertyValue('--unis-primary')) || DEFAULT_PRIMARY;
      // Prefer an explicit light var if the theme system exposes one; otherwise derive.
      const primaryLight =
        parseColor(styles.getPropertyValue('--unis-primary-light')) ||
        lightenHsl(primary, 0.13);
      setColors({ primary, primaryLight });
    };

    read();

    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}

// ──────────────────────────────────────────────────────────────
//  Component
// ──────────────────────────────────────────────────────────────

const ArtistCard = ({ artist, onPress, onViewPress, index = 0 }) => {
  const locationName = artist.jurisdictionName || 'Your Area';
  const pulse = usePulse(2000);
  const { primary, primaryLight } = useThemeColors();

  // Pre-format reusable color strings from the active theme
  const primaryRgb      = `${primary[0]},${primary[1]},${primary[2]}`;
  const primaryHex      = `rgb(${primaryRgb})`;
  const primaryLightHex = `rgb(${primaryLight[0]},${primaryLight[1]},${primaryLight[2]})`;

  // Slide-in from right, staggered by index
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), index * 150 + 16);
    return () => clearTimeout(id);
  }, [index]);

  // Interpolate glow border between primary and primaryLight
  const r = lerpInt(primary[0], primaryLight[0], pulse);
  const g = lerpInt(primary[1], primaryLight[1], pulse);
  const b = lerpInt(primary[2], primaryLight[2], pulse);
  const a = (0.4 + pulse * 0.6).toFixed(2);
  const glowBorderColor = `rgba(${r},${g},${b},${a})`;
  const glowShadow      = `0 0 12px rgba(${primaryRgb},${(0.2 + pulse * 0.5).toFixed(2)})`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      marginBottom: 2,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(80px)',
      transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${index * 150}ms,
                   transform 700ms cubic-bezier(0.16,1,0.3,1) ${index * 150}ms`,
      willChange: 'opacity, transform',
    }}>

      {/* Pulsing left accent border */}
      <div style={{
        width: 3,
        flexShrink: 0,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
        backgroundColor: glowBorderColor,
        boxShadow: glowShadow,
        transition: 'background-color 50ms linear, box-shadow 50ms linear',
      }} />

      {/* Card */}
      <div
        onClick={onPress}
        style={{
          flex: 1,
          height: 240,
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
          cursor: 'pointer',
        }}
      >
        {/* Full-bleed photo */}
        <div style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url(${artist.photoUrl || 'https://picsum.photos/400/300'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>

          {/* Cinematic right-fade gradient */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)',
          }} />

          {/* Bottom depth gradient */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)',
          }} />

          {/* Ambient themed radial glow — bottom-left */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse 70% 80% at 0% 100%, rgba(${primaryRgb},0.35) 0%, rgba(${primaryRgb},0.10) 50%, rgba(${primaryRgb},0.00) 100%)`,
          }} />

          {/* Score badge — top right */}
          {artist.score != null && (
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}>
              <div style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: 'rgba(0,0,0,0.7)',
                border: `1px solid rgba(${primaryRgb},0.5)`,
                borderRadius: 20,
                padding: '3px 8px',
                boxShadow: `0 0 8px rgba(${primaryRgb},0.5)`,
              }}>
                <span style={{ color: primaryLightHex, fontSize: 10 }}>★</span>
                <span style={{ color: SILVER, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>
                  {artist.score.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Bottom content row */}
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'flex', flexDirection: 'row',
            alignItems: 'flex-end', justifyContent: 'space-between',
            padding: '0 14px 14px 14px',
          }}>

            {/* Left: jurisdiction + name + separator */}
            <div style={{ flex: 1, marginRight: 12, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: primaryLightHex,
                  boxShadow: `0 0 4px ${primaryHex}`,
                  flexShrink: 0,
                }} />
                <span style={{
                  color: primaryLightHex, fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '2px',
                }}>
                  {locationName}
                </span>
              </div>

              <div style={{
                color: '#fff', fontSize: 22, fontWeight: 800,
                letterSpacing: '0.5px', lineHeight: '26px',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {artist.username}
              </div>

              <div style={{
                width: 40, height: 2,
                backgroundColor: primaryHex,
                marginTop: 8, borderRadius: 1,
                boxShadow: `0 0 4px rgba(${primaryRgb},0.6)`,
              }} />
            </div>

            {/* VIEW button */}
            <button
              onClick={(e) => { e.stopPropagation(); onViewPress(); }}
              style={{
                background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                border: `1px solid rgba(${primaryRgb},0.5)`,
                borderRadius: 8, overflow: 'hidden',
                boxShadow: `0 0 8px rgba(${primaryRgb},0.3)`,
              }}
            >
              <div style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                background: `linear-gradient(to right, rgba(${primaryRgb},0.15), rgba(${primaryRgb},0.05))`,
              }}>
                <span style={{ color: SILVER, fontSize: 11, fontWeight: 800, letterSpacing: '2px' }}>VIEW</span>
                <span style={{ color: primaryLightHex, fontSize: 14, fontWeight: 300 }}>→</span>
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ArtistCard;