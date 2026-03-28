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
];

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
                background: t.hex,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive
                  ? `0 0 0 3px #fff, 0 0 0 5px ${t.hex}`
                  : '0 2px 8px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
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