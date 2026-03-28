import React from 'react';
import { Check } from 'lucide-react';
import { useAuth } from './context/AuthContext';

const THEMES = [
  { id: 'blue',   label: 'Unis Blue', hex: '#163387' },
  { id: 'orange', label: 'Orange',    hex: '#C44B0A' },
  { id: 'red',    label: 'Red',       hex: '#B51C24' },
  { id: 'green',  label: 'Green',     hex: '#0F7A3E' },
  { id: 'purple', label: 'Purple',    hex: '#4A1A8C' },
  { id: 'yellow', label: 'Gold',      hex: '#C49A0A' },
  { id: 'dianna', label: 'Dianna',    hex: null }, // cheetah — uses pattern, not hex
];

// Cheetah pattern for the swatch circle
const cheetahSwatchStyle = {
  background: `
    radial-gradient(ellipse 6px 4px at 18% 25%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 4px 6px at 35% 60%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 7px 4px at 55% 20%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 4px 5px at 70% 55%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 5px 3px at 82% 30%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 3px 5px at 25% 80%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 6px 3px at 62% 78%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 4px 4px at 88% 72%, #2C1A0E 100%, transparent 100%),
    radial-gradient(ellipse 5px 4px at 10% 55%, #3D2410 100%, transparent 100%),
    radial-gradient(ellipse 3px 6px at 45% 40%, #3D2410 100%, transparent 100%),
    #C8A84B
  `,
};

/**
 * ThemePicker
 * Displays 6 color swatches. Selecting one applies the theme immediately
 * and persists to the backend.
 *
 * Props:
 *   userId — the authenticated user's UUID
 */
const ThemePicker = ({ userId }) => {
  const { theme, setTheme } = useAuth();

  const handleSelect = (themeId) => {
    if (themeId === theme) return;
    setTheme(themeId, userId);
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Color Theme</h3>
      </div>

      <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
        Choose your Unis color theme. Your selection is saved to your account and applied everywhere.
      </p>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        padding: '4px 0 8px',
      }}>
        {THEMES.map(t => {
          const isActive = theme === t.id;
          const isCheetah = t.id === 'dianna';

          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              title={t.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              {/* Swatch circle */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive
                  ? `0 0 0 3px #fff, 0 0 0 5px ${isCheetah ? '#C8A84B' : t.hex}`
                  : '0 2px 8px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
                overflow: 'hidden',
                ...(isCheetah ? cheetahSwatchStyle : { background: t.hex }),
              }}>
                {isActive && <Check size={20} color="#fff" strokeWidth={3} />}
              </div>

              {/* Label */}
              <span style={{
                fontSize: '0.75rem',
                color: isActive ? '#f0f0f2' : '#888',
                fontWeight: isActive ? '600' : '400',
                transition: 'color 0.2s',
              }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemePicker;