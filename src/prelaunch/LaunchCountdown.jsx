// =============================================================================
// LaunchCountdown.jsx — the "Doors open in" countdown on the Coming soon page.
//
// Built like a track playing toward launch, not a stock timer:
//   • Odometer digits: each digit is a strip that rolls down one notch when it
//     changes (always downward, so 0 → 9 keeps rolling instead of spinning
//     back up). Fixed-width tabular numerals, so nothing on the page shifts.
//   • A waveform scrubber under the digits, drawn from the same equalizer bars
//     as the skyline. The last 30 days before launch are the "track"; the part
//     already played fills with the theme color, and a playhead pulses once a
//     second at today's spot.
//   • At zero it switches to "Doors are open."
//
// Theme-aware (all colors from the --unis-* tokens via ComingSoon.scss's
// .cs-page). Reduced motion: digits swap without rolling and nothing pulses.
// Screen readers get the launch date as text, not a number changing every
// second.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { getLaunchAt } from './prelaunchConfig';
import './LaunchCountdown.scss';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TRACK_SPAN = 30 * DAY; // the scrubber shows the last 30 days before launch
const BAR_COUNT = 56;
// Digits 9 → 0, twice. Rolling "down" a strip = the number going down.
const STRIP = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Re-renders on every whole second (aligned to the clock, so all digits change
// together), and catches up immediately when the tab comes back into view.
function useSecondTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, SECOND - (Date.now() % SECOND) + 8);
    };
    schedule();
    const onVisible = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}

function splitRemaining(ms) {
  const left = Math.max(0, ms);
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MINUTE),
    seconds: Math.floor((left % MINUTE) / SECOND),
  };
}

// Deterministic bar heights (same every visit), shaped like a song: quiet
// intro, a build, and the tallest bars at the end, where the drop is.
function buildWave(count = BAR_COUNT) {
  let seed = 1122;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: count }, (_, i) => {
    const x = i / (count - 1);
    const build = 0.28 + 0.5 * x * x;
    const pulse = 0.18 * Math.abs(Math.sin(i * 0.9));
    return Math.min(1, build + pulse + rand() * 0.22);
  });
}

function RollingDigit({ value }) {
  const [pos, setPos] = useState(9 - value);
  const [rolling, setRolling] = useState(false);
  const prev = useRef(value);
  const snapTimer = useRef(null);

  useEffect(() => {
    if (value === prev.current) return undefined;
    const from = 9 - prev.current;
    const to = 9 - value;
    prev.current = value;

    if (prefersReducedMotion()) {
      setRolling(false);
      setPos(to);
      return undefined;
    }
    // Always roll downward; a wrap (e.g. 0 → 9, or 0 → 5 on the tens of
    // minutes) rolls into the second copy of the strip, then snaps back.
    const target = to >= from ? to : to + 10;
    setRolling(true);
    setPos(target);
    if (target >= 10) {
      clearTimeout(snapTimer.current);
      // Safety net in case transitionend never fires (hidden tab, etc.).
      snapTimer.current = setTimeout(() => {
        setRolling(false);
        setPos(to);
      }, 900);
    }
    return undefined;
  }, [value]);

  useEffect(() => () => clearTimeout(snapTimer.current), []);

  const onTransitionEnd = () => {
    if (pos >= 10) {
      clearTimeout(snapTimer.current);
      setRolling(false);
      setPos(pos - 10);
    }
  };

  return (
    <span className="lc-digit" aria-hidden="true">
      <span
        className={`lc-strip${rolling ? ' is-rolling' : ''}`}
        style={{ '--pos': pos }}
        onTransitionEnd={onTransitionEnd}
      >
        {STRIP.map((d, i) => <span key={i}>{d}</span>)}
      </span>
    </span>
  );
}

function Unit({ value, label }) {
  const padded = String(value).padStart(2, '0');
  return (
    <div className="lc-unit">
      <div className="lc-digits">
        {padded.split('').map((d, i) => (
          // Key by place from the right, so the ones digit stays the same
          // component even if the number of digits changes.
          <RollingDigit key={padded.length - i} value={Number(d)} />
        ))}
      </div>
      <span className="lc-label">{label}</span>
    </div>
  );
}

export default function LaunchCountdown() {
  const launchAt = useMemo(() => getLaunchAt(), []);
  const wave = useMemo(() => buildWave(), []);
  const now = useSecondTick();

  const remaining = launchAt - now;
  const { days, hours, minutes, seconds } = splitRemaining(remaining);
  const progress = Math.min(1, Math.max(0, 1 - remaining / TRACK_SPAN));
  const playedBars = Math.round(progress * BAR_COUNT);

  const launchDate = new Date(launchAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  });
  const shortDate = new Date(launchAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'America/New_York',
  });

  if (remaining <= 0) {
    return (
      <section className="lc lc--live" aria-label="Unis launch">
        <p className="lc-eyebrow"><span className="lc-live-dot" aria-hidden="true" />Doors are open</p>
        <p className="lc-live-line">Unis is live in Harlem.</p>
      </section>
    );
  }

  return (
    <section className="lc" role="timer" aria-label={`Countdown to the Unis launch on ${launchDate}`}>
      <p className="lc-eyebrow">Doors open in</p>
      <p className="lc-sr">Unis launches in Harlem on {launchDate}.</p>

      <div className="lc-clock" aria-hidden="true">
        <Unit value={days} label="Days" />
        <span className="lc-sep">:</span>
        <Unit value={hours} label="Hrs" />
        <span className="lc-sep">:</span>
        <Unit value={minutes} label="Min" />
        <span className="lc-sep">:</span>
        <Unit value={seconds} label="Sec" />
      </div>

      <div className="lc-scrubber" aria-hidden="true">
        <div className="lc-wave">
          {wave.map((h, i) => (
            <span
              key={i}
              className={`lc-bar${i < playedBars ? ' is-played' : ''}`}
              style={{ '--h': h }}
            />
          ))}
          <span className="lc-playhead" style={{ '--p': progress }}>
            {/* Re-keyed every second so the pulse restarts on the beat. */}
            <span key={seconds} className="lc-beat" />
          </span>
        </div>
        <div className="lc-track-meta">
          <span>Pre-launch</span>
          <span className="lc-drop">{shortDate} · Launch</span>
        </div>
      </div>
    </section>
  );
}
