// ─────────────────────────────────────────────────────────────────────────────
// Bring Unis to your city, the pitch page: /waitlist (public, no app chrome)
//
// What people outside Harlem see first: from "Not in Harlem? Join the
// waitlist" on the Coming Soon page, from the sign-up wizard, from the Find
// page, and from friends' share links (/waitlist?ref=CODE). The one big
// moment is the city meter: pick your state and city, and the same equalizer
// bars as the Coming Soon skyline fill up to how close that city is to opening
// (GET /api/v1/waitlist/region-progress, public).
//
// "Join the waitlist" opens the real form at /waitlist/join, carrying the
// friend's ?ref code and the city picked here so the visitor doesn't pick it
// twice. "Join as an artist" also sets the account type.
//
// The opening numbers (1,000 / 500 / 250 sign-ups) are the ones the server
// uses (PreRegistrationService.getThresholdForRegion).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { buildSkyline } from './prelaunch/ComingSoon';
import US_STATES_AND_METROS from './data/Usstatesandmetros';
import logo from './assets/unisLogoThree.svg';
import './waitlistLanding.scss';

const METER_BARS = 44;

const cleanRef = (raw) => (raw || '').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 40);
const count = (n) => Number(n || 0).toLocaleString('en-US');

const STATES = Object.entries(US_STATES_AND_METROS)
  .map(([code, s]) => ({ code, name: s.name, metros: s.metros }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** The city meter: bars light up to the share of sign-ups the city needs. */
const CityMeter = ({ stateCode, metro, onState, onMetro, progress, loading }) => {
  const bars = useMemo(() => buildSkyline(METER_BARS), []);
  const state = STATES.find((s) => s.code === stateCode);
  const pct = progress ? Math.max(0, Math.min(100, Number(progress.progressPercent) || 0)) : 0;
  const lit = progress
    ? Math.min(METER_BARS, Math.max(Number(progress.signupCount) > 0 ? 1 : 0, Math.round((pct / 100) * METER_BARS)))
    : 0;

  let headline;
  let detail;
  if (!metro) {
    headline = 'How close is your city?';
    detail = 'Pick your state and city to see how many people have signed up there.';
  } else if (loading) {
    headline = metro;
    detail = 'Counting…';
  } else if (progress) {
    const left = Math.max(0, Number(progress.threshold) - Number(progress.signupCount));
    headline = progress.readyToActivate
      ? `${metro} has reached ${count(progress.threshold)}.`
      : `${count(progress.signupCount)} of ${count(progress.threshold)} in ${metro}`;
    detail = progress.readyToActivate
      ? 'Join now and you’ll be there on day one.'
      : `${count(left)} more ${left === 1 ? 'sign-up' : 'sign-ups'} and Unis opens there.`;
  } else {
    headline = metro;
    detail = 'We couldn’t load the count just now. Your sign-up still counts.';
  }

  return (
    <div className="wl-meter">
      <div className="wl-meter__pickers">
        <label>
          <span>State</span>
          <select value={stateCode} onChange={(e) => onState(e.target.value)}>
            <option value="">Choose</option>
            {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span>City</span>
          <select value={metro} onChange={(e) => onMetro(e.target.value)} disabled={!state}>
            <option value="">{state ? 'Choose' : 'Pick a state first'}</option>
            {state?.metros.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      <div className={`wl-meter__bars ${progress ? 'has-count' : ''}`} aria-hidden="true">
        {bars.map((b, i) => (
          <span
            key={i}
            className={`wl-meter__bar ${i < lit ? 'is-lit' : ''}`}
            style={{ '--h': b.h, '--i': i }}
          />
        ))}
      </div>

      <div className="wl-meter__readout" aria-live="polite">
        <p className="wl-meter__headline">{headline}</p>
        <p className="wl-meter__detail">{detail}</p>
      </div>
    </div>
  );
};

const WaitlistLanding = () => {
  const [params] = useSearchParams();
  const ref = cleanRef(params.get('ref'));
  const [stateCode, setStateCode] = useState('');
  const [metro, setMetro] = useState('');
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Bring Unis to your city';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    setProgress(null);
    if (!stateCode || !metro) return undefined;
    let cancelled = false;
    setLoading(true);
    apiCall({
      method: 'get',
      url: `/v1/waitlist/region-progress?state=${encodeURIComponent(stateCode)}&metro=${encodeURIComponent(metro)}`,
      useCache: false,
    })
      .then((res) => {
        const d = res?.data;
        if (!cancelled && d && typeof d === 'object' && 'threshold' in d) setProgress(d);
      })
      .catch(() => { /* the readout says the count didn't load */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [stateCode, metro]);

  const joinHref = (type) => {
    const q = new URLSearchParams();
    if (ref) q.set('ref', ref);
    if (stateCode) q.set('state', stateCode);
    if (stateCode && metro) q.set('metro', metro);
    if (type) q.set('type', type);
    const s = q.toString();
    return `/waitlist/join${s ? `?${s}` : ''}`;
  };

  return (
    <div className="wl-page">
      <header className="wl-top">
        <Link to="/" className="wl-top__brand" aria-label="Unis home">
          <img src={logo} alt="" />
        </Link>
        <nav className="wl-top__nav" aria-label="Waitlist page">
          <Link to="/help">How Unis works</Link>
          <Link className="wl-top__cta" to={joinHref()}>Join the waitlist</Link>
        </nav>
      </header>

      <main>
        <section className="wl-hero">
          <div className="wl-hero__copy">
            <p className="wl-hero__status">
              <span className="wl-hero__dot" aria-hidden="true" />
              Opening first in Harlem
            </p>
            <h1 className="wl-hero__headline">
              <span>Your city</span>
              <span>could be next.</span>
            </h1>
            <p className="wl-hero__lede">
              Unis is a music app where local artists get heard first and the neighborhood decides
              who&rsquo;s best. It opens one city at a time, and the waitlist decides which city is next.
            </p>
            <div className="wl-actions">
              <Link className="wl-btn" to={joinHref()}>Join the waitlist</Link>
              <a className="wl-textlink" href="#how">How a city opens</a>
            </div>
            {ref && <p className="wl-ref">Invited with code <strong>{ref}</strong></p>}
          </div>

          <CityMeter
            stateCode={stateCode}
            metro={metro}
            onState={(code) => { setStateCode(code); setMetro(''); }}
            onMetro={setMetro}
            progress={progress}
            loading={loading}
          />
        </section>

        <section className="wl-what" aria-labelledby="wl-what-title">
          <h2 id="wl-what-title" className="wl-section-title">What you&rsquo;re signing up for</h2>
          <div className="wl-what__list">
            <div className="wl-what__item">
              <h3>Your neighborhood&rsquo;s own charts</h3>
              <p>
                Every area has its own songs and artists of the day, week and month, made by the people who
                live there, not an algorithm in another city.
              </p>
            </div>
            <div className="wl-what__item">
              <h3>You pick the winners</h3>
              <p>
                Listen, then vote. Daily and weekly winners are decided by votes and listening from the
                neighborhood itself.
              </p>
            </div>
            <div className="wl-what__item">
              <h3>Listening gives back</h3>
              <p>
                Every month Unis shares what it earns with the community: the artist you choose to support,
                and the people who brought new listeners in.
              </p>
            </div>
          </div>
        </section>

        <section className="wl-how" id="how" aria-labelledby="wl-how-title">
          <h2 id="wl-how-title" className="wl-section-title">How a city opens</h2>
          <ol className="wl-steps">
            <li>
              <h3>Join the list</h3>
              <p>Pick your city and your username. It&rsquo;s held for you until Unis opens there.</p>
            </li>
            <li>
              <h3>Bring your people</h3>
              <p>You get a code to share. Every friend who joins in your city brings it closer to opening.</p>
            </li>
            <li>
              <h3>Hit the number</h3>
              <p>
                Big cities open at {count(1000)} sign-ups, mid-size cities at {count(500)}, and everywhere
                else at {count(250)}.
              </p>
            </li>
            <li>
              <h3>Unis opens</h3>
              <p>Unis goes live in your city, and the username you picked is waiting for you.</p>
            </li>
          </ol>
        </section>

        <section className="wl-artists" aria-labelledby="wl-artists-title">
          <div className="wl-artists__inner">
            <h2 id="wl-artists-title" className="wl-artists__title">Make music? Be on the first chart.</h2>
            <p>
              Join as an artist and your name is held for the day your city opens. When the first charts
              go up, your songs are already there to be found, played and voted on.
            </p>
            <Link className="wl-btn wl-btn--light" to={joinHref('artist')}>Join as an artist</Link>
          </div>
        </section>

        <section className="wl-final">
          <h2 className="wl-final__title">Put your city on the map.</h2>
          <p>It takes a minute, and it&rsquo;s free.</p>
          <div className="wl-actions">
            <Link className="wl-btn" to={joinHref()}>Join the waitlist</Link>
            <Link className="wl-textlink" to="/help">Read how Unis works</Link>
          </div>
        </section>
      </main>

      <footer className="wl-foot">
        <span>&copy; {new Date().getFullYear()} Unis Music Corporation</span>
        <nav aria-label="Legal">
          <Link to="/help">Help</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
};

export default WaitlistLanding;
