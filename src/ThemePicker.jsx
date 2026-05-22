import React from 'react';
import { Check } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import './ThemePicker.scss';

// =============================================================================
// ThemePicker
//
// Drop-in replacement. Same external prop signature (userId).
//
// IMPORTANT — preserves your existing logic:
//   - Uses useAuth() to read `theme` and call `setTheme(themeId, userId)`,
//     exactly like your old ThemePicker did.
//   - Uses your existing theme IDs: blue, orange, red, green, purple, yellow, dianna
//   - Does NOT make any API calls directly — setTheme() handles persistence
//     in your AuthContext.
//   - Does NOT touch theme.scss or its selectors. Your existing theme system
//     is doing all the actual color application.
//
// All this component does is render the new premium UI and forward the
// selection to setTheme().
// =============================================================================

const THEMES = [
  { id: 'blue',   label: 'Blue', hex: '#163387' },
  { id: 'orange', label: 'Orange',    hex: '#C44B0A' },
  { id: 'red',    label: 'Red',       hex: '#B51C24' },
  { id: 'green',  label: 'Green',     hex: '#0F7A3E' },
  { id: 'purple', label: 'Purple',    hex: '#4A1A8C' },
  { id: 'yellow', label: 'Gold',      hex: '#C49A0A' },
  { id: 'dianna', label: 'Dianna',    hex: null }, // cheetah — uses pattern
];

const ThemePicker = ({ userId }) => {
  const { theme, setTheme } = useAuth();

  const handleSelect = (themeId) => {
    if (themeId === theme) return;
    setTheme(themeId, userId);
  };

  return (
    <div className="theme-picker">
      <div className="theme-picker__header">
        <div>
          <div className="theme-picker__title">Pick your palette</div>
          <div className="theme-picker__desc">
            Saved to your account and applied across every device you use UNIS on.
            The atmosphere shifts to match.
          </div>
        </div>
      </div>

      <div className="theme-picker__grid">
        {THEMES.map(t => {
          const isActive = theme === t.id;
          const isCheetah = t.id === 'dianna';

          return (
            <button
              key={t.id}
              className={`theme-swatch ${isActive ? 'is-active' : ''}`}
              onClick={() => handleSelect(t.id)}
              aria-label={`Select ${t.label} theme`}
              aria-pressed={isActive}
            >
              <div
                className={`theme-swatch__dot ${isCheetah ? 'theme-swatch__dot--cheetah' : ''}`}
                style={!isCheetah ? { background: `linear-gradient(135deg, ${t.hex}, ${darken(t.hex, 30)})` } : undefined}
              >
                {isActive && (
                  <div className="theme-swatch__check">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="theme-swatch__name">{t.label}</div>
              <div className="theme-swatch__sub">
                {isActive ? 'Active' : 'Tap to apply'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Tiny helper — darken a hex color by N%. Pure cosmetic gradient on swatches.
function darken(hex, percent) {
  if (!hex) return '#000';
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

export default ThemePicker;