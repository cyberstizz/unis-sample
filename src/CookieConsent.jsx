// CookieConsent.jsx — the cookie banner and Cookie settings (Nov 2026).
//
// Designed with the Scout → Sketch → Ship process (canvas: "Unis cookie
// settings"). The rules it follows, from the research:
//   • Doesn't block the app: a card above the player, not a wall.
//   • "Only essential" and "Allow all" are the same size and color, side by
//     side. Regulators fine banners that hide or shrink the no.
//   • Nothing is pre-switched on. Analytics and advertising start off.
//   • Asked once; the answer is kept for a year (src/utils/consent.js) and
//     only asked again if Unis adds a new kind of cookie.
//   • A Global Privacy Control signal turns advertising off by itself, and
//     the banner says so (some states require showing it was honored).
//   • Cookie settings opens from the footer of every page and from the
//     Cookie Policy, so a visitor can change their mind any time.
//   • Waits for the launch splash; the first-visit tour waits for this.
//
// Mounted once in App.jsx, next to the routes, so it shows on every page
// (Coming soon included).

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFeedback } from './context/FeedbackContext';
import { onSplashGone } from './boot/bootSplash';
import useModalA11y from './hooks/useModalA11y';
import {
  useConsent, saveConsent, gpcOn, OPEN_COOKIE_SETTINGS,
} from './utils/consent';
import './cookieConsent.scss';

const SHOW_DELAY_MS = 700; // let the page land before the card rises
const SAVED_TAIL = ' Change it any time from Cookie settings at the bottom of any page.';

// A record with a bite out of it. Its label is a cookie; it spins slowly.
const CookieRecord = ({ size = 58 }) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg className="ck-record" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <mask id={`ck-bite-${id}`}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="100" cy="21" r="18" fill="#000" />
          <circle cx="113" cy="40" r="13" fill="#000" />
          <circle cx="83" cy="9" r="13" fill="#000" />
        </mask>
        <radialGradient id={`ck-vinyl-${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#2a2d3a" />
          <stop offset="1" stopColor="#0a0b10" />
        </radialGradient>
      </defs>
      <g mask={`url(#ck-bite-${id})`}>
        <circle cx="60" cy="60" r="56" fill={`url(#ck-vinyl-${id})`} />
        <g className="ck-record__spin">
          <circle cx="60" cy="60" r="49" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="35" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="23" className="ck-record__ring" />
          <circle cx="60" cy="60" r="19" fill="#c98b4f" />
          <circle cx="53" cy="53" r="2.6" fill="#5a3418" />
          <circle cx="66" cy="51" r="2.2" fill="#5a3418" />
          <circle cx="68" cy="65" r="2.6" fill="#5a3418" />
          <circle cx="52" cy="67" r="2.1" fill="#5a3418" />
          <circle cx="60" cy="60" r="2.4" fill="#07090f" />
        </g>
        <path d="M24 34 A44 44 0 0 1 52 17" stroke="rgba(255,255,255,0.16)" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
};

// A switch whose knob plays a little equalizer while it's on.
const Switch = ({ on, label, onChange, locked = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={locked ? `${label}, locked off` : label}
    aria-disabled={locked || undefined}
    className={`ck-switch${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
    onClick={() => { if (!locked) onChange(!on); }}
  >
    <span className="ck-switch__knob" aria-hidden="true">
      {locked ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#07090f" strokeWidth="2.6" strokeLinecap="round">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      ) : on ? (<><i /><i /><i /></>) : null}
    </span>
  </button>
);

const ShieldGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export default function CookieConsent() {
  const feedback = useFeedback();
  const consent = useConsent();
  const gpc = gpcOn();

  const [splashGone, setSplashGone] = useState(false);
  const [view, setView] = useState('closed'); // closed | banner | settings
  const [draft, setDraft] = useState({ analytics: false, advertising: false });
  const sheetRef = useRef(null);

  useEffect(() => onSplashGone(() => setSplashGone(true)), []);

  // First visit (or a choice that has expired): the banner rises.
  useEffect(() => {
    if (!splashGone || consent) return undefined;
    const t = setTimeout(() => setView((v) => (v === 'closed' ? 'banner' : v)), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [splashGone, consent]);

  const openSettings = useCallback(() => {
    setDraft({
      analytics: Boolean(consent?.analytics),
      advertising: Boolean(consent?.advertising) && !gpc,
    });
    setView('settings');
  }, [consent, gpc]);

  // Footer and Cookie Policy page open Cookie settings from anywhere.
  useEffect(() => {
    window.addEventListener(OPEN_COOKIE_SETTINGS, openSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, openSettings);
  }, [openSettings]);

  const closeSettings = useCallback(() => {
    // Not decided yet? Back to the banner; it doesn't go away unanswered.
    setView(consent ? 'closed' : 'banner');
  }, [consent]);

  useModalA11y({ active: view === 'settings', onClose: closeSettings, modalRef: sheetRef });

  const decide = (choice, what) => {
    saveConsent(choice);
    setView('closed');
    feedback.success(`${what}${SAVED_TAIL}`);
  };

  const onlyEssential = () => decide({ analytics: false, advertising: false }, 'Only essential cookies.');
  const allowAll = () => decide(
    { analytics: true, advertising: !gpc },
    gpc ? 'Analytics on. Advertising stays off for your browser’s privacy signal.' : 'All cookies on.',
  );
  const saveChoices = () => decide({ analytics: draft.analytics, advertising: draft.advertising && !gpc }, 'Choices saved.');

  if (view === 'closed') return null;

  return (
    <div className="ck-root">
      {view === 'banner' && (
        <section className="ck-banner" role="region" aria-label="Cookie choices">
          {gpc && (
            <span className="ck-chip">
              <ShieldGlyph />
              Your browser&rsquo;s privacy signal is on
            </span>
          )}
          <div className="ck-banner__top">
            <CookieRecord />
            <div className="ck-banner__copy">
              <h2 className="ck-title">A <em>quick</em> word on cookies</h2>
              <p className="ck-text">
                {gpc
                  ? 'We’ve already turned advertising cookies off for you. Unis keeps you signed in and remembers your theme. Analytics only runs if you say so.'
                  : 'Unis keeps you signed in and remembers your theme. That part’s essential. Analytics and ads only run if you say so.'}
              </p>
            </div>
          </div>
          <div className="ck-pair">
            <button type="button" className="ck-btn" onClick={onlyEssential}>Only essential</button>
            <button type="button" className="ck-btn" onClick={allowAll}>{gpc ? 'Allow analytics' : 'Allow all'}</button>
          </div>
          <div className="ck-banner__links">
            <button type="button" className="ck-textbtn" onClick={openSettings}>Cookie settings</button>
            <Link to="/cookie" className="ck-policy">Cookie Policy</Link>
          </div>
        </section>
      )}

      {view === 'settings' && (
        <div className="ck-layer">
          <div className="ck-scrim" onClick={closeSettings} aria-hidden="true" />
          <section
            ref={sheetRef}
            className="ck-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ck-settings-title"
          >
            <span className="ck-sheet__grab" aria-hidden="true" />
            <div className="ck-sheet__head">
              <h2 id="ck-settings-title" className="ck-title ck-title--lg">Cookie <em>settings</em></h2>
              <button type="button" className="ck-close" onClick={closeSettings} aria-label="Close cookie settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <p className="ck-text">Pick what Unis can use on this device. You can change it any time.</p>

            <div className="ck-row">
              <div className="ck-row__copy">
                <span className="ck-row__name">Essential</span>
                <span className="ck-row__desc">Keeps you signed in and remembers your theme, your queue and this choice.</span>
              </div>
              <span className="ck-always">Always on</span>
            </div>

            <div className="ck-row">
              <div className="ck-row__copy">
                <span className="ck-row__name">Analytics</span>
                <span className="ck-row__desc">Shows us which pages work and which don&rsquo;t, counted without your name.</span>
              </div>
              <Switch
                label="Analytics"
                on={draft.analytics}
                onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
              />
            </div>

            <div className="ck-row">
              <div className="ck-row__copy">
                <span className="ck-row__name">Advertising</span>
                <span className="ck-row__desc">
                  {gpc
                    ? 'Off because your browser sent a Global Privacy Control signal. Turn the signal off in your browser to change this.'
                    : 'Lets Google pick ads for free accounts from your visits here and on other sites. Off, you still see ads, just not personalised ones. Unis Plus has no ads.'}
                </span>
              </div>
              <Switch
                label="Advertising"
                on={draft.advertising && !gpc}
                locked={gpc}
                onChange={(v) => setDraft((d) => ({ ...d, advertising: v }))}
              />
            </div>

            <button type="button" className="ck-btn ck-btn--wide" onClick={saveChoices}>Save my choices</button>
            <div className="ck-pair">
              <button type="button" className="ck-ghost" onClick={onlyEssential}>Only essential</button>
              <button type="button" className="ck-ghost" onClick={allowAll}>{gpc ? 'Allow analytics' : 'Allow all'}</button>
            </div>
            <Link to="/cookie" className="ck-policy ck-policy--center" onClick={closeSettings}>Read the Cookie Policy</Link>
          </section>
        </div>
      )}
    </div>
  );
}
