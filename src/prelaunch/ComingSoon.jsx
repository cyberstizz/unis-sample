// =============================================================================
// ComingSoon.jsx — what every visitor sees while the pre-launch gate is on.
//
// The one big visual moment is the skyline at the bottom: a Harlem-style
// skyline drawn entirely out of equalizer bars, in the user's theme color. On
// load the bars rise left to right like a sound check, then keep breathing.
// Reduced-motion users get the finished skyline with no movement.
//
// "Sign up" opens the real CreateAccountWizard in place. Closing it (X, Escape,
// or the Done button) leaves the visitor right here — never on the login page.
// =============================================================================

import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreateAccountWizard from '../createAccountWizard';
import UnisMark from '../UnisMark';
import './ComingSoon.scss';

const BAR_COUNT = 96;

// Deterministic pseudo-random (mulberry32) so the skyline is identical on every
// visit and in every test run.
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Tall "buildings" placed along the skyline: [center as 0–1 of width, width in
// bars, height as 0–1 of the skyline area].
const TOWERS = [
  [0.07, 5, 0.62],
  [0.19, 3, 0.48],
  [0.31, 7, 0.86],  // the landmark tower
  [0.46, 4, 0.55],
  [0.58, 6, 0.74],
  [0.71, 3, 0.5],
  [0.83, 8, 0.95],  // the tallest, off to the right
  [0.95, 4, 0.58],
];

export function buildSkyline(count = BAR_COUNT) {
  const rand = seeded(1958); // any fixed seed; this one draws a balanced skyline
  return Array.from({ length: count }, (_, i) => {
    const x = i / (count - 1);
    // Low-rise rooftops: a rolling base with a little noise.
    let h = 0.16 + 0.1 * Math.sin(x * 9.5) + 0.08 * Math.sin(x * 23 + 1.3) + rand() * 0.09;
    for (const [cx, w, th] of TOWERS) {
      const d = Math.abs(i - cx * (count - 1));
      if (d <= w / 2) h = Math.max(h, th - d * 0.035 + rand() * 0.03);
    }
    h = Math.min(1, Math.max(0.08, h));
    return {
      h: Number(h.toFixed(3)),
      rise: Number((x * 1.1).toFixed(3)),            // sound-check sweep delay (s)
      dur: Number((2.4 + rand() * 2.6).toFixed(2)),   // idle breathing length (s)
    };
  });
}

export default function ComingSoon() {
  const { user, logout } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const bars = useMemo(() => buildSkyline(), []);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Unis — opening soon in Harlem';
    return () => { document.title = previous; };
  }, []);

  const handle = user?.username || user?.displayName || null;

  return (
    <div className="cs-page">
      <header className="cs-top">
        <span className="cs-lockup" aria-label="Unis">
          <UnisMark size={30} title="Unis" />
          <span className="cs-wordmark" aria-hidden="true">Unis</span>
        </span>
        <nav className="cs-legal" aria-label="Legal">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </header>

      <main className="cs-main">
        <p className="cs-status">
          <span className="cs-status-dot" aria-hidden="true" />
          Opening soon in Harlem
        </p>

        <h1 className="cs-headline">
          <span className="cs-line">Harlem decides</span>
          <span className="cs-line">what plays next.</span>
        </h1>

        <p className="cs-lede">
          Unis is a music app where local artists get heard and the people
          who live here vote on who&rsquo;s best. Sign up now and your
          account is ready the day we open.
        </p>

        <div className="cs-actions" aria-live="polite">
          {user ? (
            <div className="cs-note">
              <p>
                You&rsquo;re signed up{handle ? <> as <strong>@{handle}</strong></> : null}.
                We&rsquo;ll email you when Unis opens.
              </p>
              <button type="button" className="cs-text-btn" onClick={logout}>
                Sign out
              </button>
            </div>
          ) : justSignedUp ? (
            <div className="cs-note">
              <p>
                Check your inbox and verify your email. That&rsquo;s it &mdash;
                we&rsquo;ll email you when Unis opens.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="cs-signup"
                onClick={() => setShowSignup(true)}
              >
                Sign up
              </button>
              <Link to="/waitlist" className="cs-waitlist">
                Not in Harlem? Join the waitlist
              </Link>
            </>
          )}
        </div>
      </main>

      <div className="cs-skyline" aria-hidden="true">
        {bars.map((b, i) => (
          <span
            key={i}
            className="cs-bar"
            style={{
              '--h': b.h,
              '--rise': `${b.rise}s`,
              '--dur': `${b.dur}s`,
            }}
          />
        ))}
      </div>

      <footer className="cs-foot">
        &copy; {new Date().getFullYear()} Unis Music Corporation
      </footer>

      <CreateAccountWizard
        show={showSignup}
        prelaunch
        onClose={() => setShowSignup(false)}
        onSuccess={() => {
          setShowSignup(false);
          setJustSignedUp(true);
        }}
      />
    </div>
  );
}
