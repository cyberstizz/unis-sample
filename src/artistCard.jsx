import React, { useEffect, useRef, useState } from 'react';

const UNIS_BLUE       = '#163387';
const UNIS_BLUE_LIGHT = '#2E5AAC';
const SILVER          = '#C0C0C0';

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

function lerpInt(a, b, t) {
  return Math.round(a + (b - a) * t);
}

const ArtistCard = ({ artist, onPress, onViewPress, index = 0 }) => {
  const locationName = artist.jurisdictionName || 'Your Area';
  const pulse = usePulse(2000);

  // Slide-in from right, staggered by index
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), index * 150 + 16);
    return () => clearTimeout(id);
  }, [index]);

  // Interpolate glow border color: rgba(22,51,135,0.4) → rgba(46,90,172,1.0)
  const r = lerpInt(22,  46,  pulse);
  const g = lerpInt(51,  90,  pulse);
  const b = lerpInt(135, 172, pulse);
  const a = (0.4 + pulse * 0.6).toFixed(2);
  const glowBorderColor = `rgba(${r},${g},${b},${a})`;
  const glowShadow = `0 0 12px rgba(22,51,135,${(0.2 + pulse * 0.5).toFixed(2)})`;

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

          {/* Ambient blue radial glow — bottom-left */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 70% 80% at 0% 100%, rgba(22,51,135,0.35) 0%, rgba(22,51,135,0.10) 50%, rgba(22,51,135,0.00) 100%)',
          }} />

          {/* Score badge — top right */}
          {artist.score != null && (
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}>
              <div style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: 'rgba(0,0,0,0.7)',
                border: '1px solid rgba(22,51,135,0.5)',
                borderRadius: 20,
                padding: '3px 8px',
                boxShadow: '0 0 8px rgba(22,51,135,0.5)',
              }}>
                <span style={{ color: UNIS_BLUE_LIGHT, fontSize: 10 }}>★</span>
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
                  backgroundColor: UNIS_BLUE_LIGHT,
                  boxShadow: `0 0 4px ${UNIS_BLUE}`,
                  flexShrink: 0,
                }} />
                <span style={{
                  color: UNIS_BLUE_LIGHT, fontSize: 10, fontWeight: 700,
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
                backgroundColor: UNIS_BLUE,
                marginTop: 8, borderRadius: 1,
                boxShadow: '0 0 4px rgba(22,51,135,0.6)',
              }} />
            </div>

            {/* VIEW button */}
            <button
              onClick={(e) => { e.stopPropagation(); onViewPress(); }}
              style={{
                background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                border: '1px solid rgba(22,51,135,0.5)',
                borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 0 8px rgba(22,51,135,0.3)',
              }}
            >
              <div style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                background: 'linear-gradient(to right, rgba(22,51,135,0.15), rgba(22,51,135,0.05))',
              }}>
                <span style={{ color: SILVER, fontSize: 11, fontWeight: 800, letterSpacing: '2px' }}>VIEW</span>
                <span style={{ color: UNIS_BLUE_LIGHT, fontSize: 14, fontWeight: 300 }}>→</span>
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ArtistCard;