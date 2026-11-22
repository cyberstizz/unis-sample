import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { useFeedback } from './context/FeedbackContext';
import useRegionProgress from './hooks/useRegionProgress';
import US_STATES_AND_METROS from './data/Usstatesandmetros';
import logo from './assets/unisLogoThree.svg';
import './waitlistPage.scss';

// The visitor sign-up — /waitlist/join. Standalone page (no sidebar/player).
//
// Unis opens city by city. People outside an open area join here and come in
// right away as VISITORS: they can listen, like, make playlists, follow,
// comment and message; voting and uploads wait until their own city opens.
// Every sign-up also counts toward their city's opening number. The server
// makes both the waitlist entry and the account (VisitorService).
//
// The pitch page at /waitlist (WaitlistLanding) and the Harlem sign-up's
// "Not from Harlem?" links pass along: ?ref (whoever told them about Unis),
// ?state and ?metro (the city they checked), ?type=artist.
//
// A referral code is required: everyone hears about Unis from someone, and
// that person gets the credit. A birth date is required too (13 or older),
// because visitors can message people. Email is confirmed before sign-in.

const MIN_AGE = 13;

const cleanCode = (raw) => (raw || '').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 40);

const initialForm = (params) => {
  const state = (params.get('state') || '').toUpperCase();
  const stateCode = US_STATES_AND_METROS[state] ? state : '';
  const metro = params.get('metro') || '';
  const metroRegion = stateCode && US_STATES_AND_METROS[stateCode].metros.includes(metro) ? metro : '';
  return {
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    userType: params.get('type') === 'artist' ? 'ARTIST' : 'LISTENER',
    stateCode,
    metroRegion,
    cityFreetext: '',
    referredByCode: cleanCode(params.get('ref')),
  };
};

const ageOn = (isoDate) => {
  const dob = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const count = (n) => Number(n || 0).toLocaleString('en-US');

// ─── City meter ──────────────────────────────────────────────────────────────
const CityMeter = ({ city, progress, loading, className = '' }) => {
  if (!city) {
    return (
      <div className={`wlj-meter wlj-meter--empty ${className}`}>
        <p>Pick your city to see how close it is to opening.</p>
      </div>
    );
  }
  const pct = progress ? Math.max(0, Math.min(100, Number(progress.progressPercent) || 0)) : 0;
  const left = progress ? Math.max(0, Number(progress.threshold) - Number(progress.signupCount)) : 0;
  let line;
  if (loading && !progress) line = 'Counting…';
  else if (!progress) line = 'We couldn’t load the count just now.';
  else if (progress.readyToActivate) line = `${city} hit its number. It opens soon.`;
  else line = `${count(left)} more sign-ups and Unis opens in ${city}.`;

  return (
    <div className={`wlj-meter ${className}`}>
      <div className="wlj-meter__top">
        <b>{city}</b>
        {progress && <span>{count(progress.signupCount)} of {count(progress.threshold)}</span>}
      </div>
      <div className="wlj-meter__bar" role="progressbar" aria-label={`${city} sign-ups`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="wlj-meter__line" aria-live="polite">{line}</p>
    </div>
  );
};

const OpenNow = () => (
  <div className="wlj-can">
    <div className="wlj-can__col">
      <h3 className="wlj-can__title wlj-can__title--now">Open to you now</h3>
      <ul>
        <li>Listen to everything</li>
        <li>Like and save</li>
        <li>Make playlists</li>
        <li>Follow and message</li>
        <li>Comment</li>
      </ul>
    </div>
    <div className="wlj-can__col">
      <h3 className="wlj-can__title">When your city opens</h3>
      <ul className="wlj-can__later">
        <li>Voting</li>
        <li>Uploading music (artists)</li>
        <li>Your city&rsquo;s own charts</li>
      </ul>
    </div>
  </div>
);

const HarlemLink = ({ className = '' }) => (
  <p className={`wlj-harlem ${className}`}>
    Live in Harlem? <Link to="/login?signup=1">Harlem is open. Sign up as a resident</Link>
  </p>
);

// ─── Page ────────────────────────────────────────────────────────────────────
const WaitlistPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const feedback = useFeedback();

  const [form, setForm] = useState(() => initialForm(params));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [referralValid, setReferralValid] = useState(null);
  const [referralChecking, setReferralChecking] = useState(false);
  const [referrerName, setReferrerName] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);   // null | 'checking' | 'ok' | 'taken'
  const [resending, setResending] = useState(false);

  const errorRef = useRef(null);

  const selectedState = US_STATES_AND_METROS[form.stateCode];
  const metros = selectedState ? [...selectedState.metros, 'Other'] : [];
  const cityName = form.metroRegion === 'Other' ? form.cityFreetext.trim() : form.metroRegion;

  // The count follows what they type for "Other", without asking on every key.
  const [meterCity, setMeterCity] = useState(cityName);
  useEffect(() => {
    const t = setTimeout(() => setMeterCity(cityName.length >= 2 ? cityName : ''), 400);
    return () => clearTimeout(t);
  }, [cityName]);
  const { loading: meterLoading, progress } = useRegionProgress(form.stateCode, meterCity);

  // After sign-up, the count includes them.
  const done = useRegionProgress(result?.stateCode, result?.metroRegion, { fresh: true });

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'stateCode') {
        updated.metroRegion = '';
        updated.cityFreetext = '';
      }
      if (field === 'metroRegion' && value !== 'Other') updated.cityFreetext = '';
      return updated;
    });
    if (field === 'username') setUsernameStatus(null);
    setError('');
  };

  const checkReferral = useCallback(async (code) => {
    if (!code || code.trim().length < 3) {
      setReferralValid(null);
      setReferrerName('');
      return;
    }
    setReferralChecking(true);
    try {
      const res = await apiCall({
        url: `/v1/waitlist/check-referral/${encodeURIComponent(code.trim())}`,
        method: 'get',
        useCache: false,
      });
      setReferralValid(Boolean(res.data?.valid));
      setReferrerName(res.data?.valid ? res.data.referrerUsername || '' : '');
    } catch (err) {
      console.error('[VisitorSignup] referral check failed:', err?.response?.status, err?.message);
      setReferralValid(null);
      setReferrerName('');
    } finally {
      setReferralChecking(false);
    }
  }, []);

  // A code that arrived in the link is checked right away, as if typed.
  useEffect(() => {
    if (form.referredByCode) checkReferral(form.referredByCode);
    // Only once, for the code the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkUsername = async () => {
    const name = form.username.trim();
    if (name.length < 3) return;
    setUsernameStatus('checking');
    try {
      const res = await apiCall({
        url: `/v1/users/check-username?username=${encodeURIComponent(name)}`
          + (form.email ? `&email=${encodeURIComponent(form.email.trim())}` : ''),
        method: 'get',
        useCache: false,
      });
      setUsernameStatus(res.data?.available ? 'ok' : 'taken');
    } catch (err) {
      console.error('[VisitorSignup] username check failed:', err?.response?.status, err?.message);
      setUsernameStatus(null);
    }
  };

  const fail = (msg) => {
    setError(msg);
    setTimeout(() => errorRef.current?.focus?.(), 30);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.stateCode) return fail('Please pick your state.');
    if (!form.metroRegion) return fail('Please pick your city.');
    if (form.metroRegion === 'Other' && !form.cityFreetext.trim()) return fail('Please type your city.');
    if (!form.email || !form.username || !form.password) return fail('Email, username and password are required.');
    if (form.username.trim().length < 3) return fail('Usernames are at least 3 characters.');
    if (usernameStatus === 'taken') return fail('That username is taken. Try another.');
    if (form.password.length < 8) return fail('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return fail('Passwords don’t match.');
    if (!form.dateOfBirth) return fail('Please enter your date of birth.');
    if (ageOn(form.dateOfBirth) < MIN_AGE) return fail('You need to be 13 or older to join Unis.');
    if (!form.referredByCode.trim()) {
      return fail('A referral code is required. Ask the person who told you about Unis for theirs.');
    }
    if (referralValid === false) return fail('That code isn’t valid. Check it with the person who gave it to you.');

    setLoading(true);
    setError('');
    try {
      const res = await apiCall({
        url: '/v1/waitlist/register',
        method: 'post',
        useCache: false,
        data: {
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          dateOfBirth: form.dateOfBirth,
          userType: form.userType,
          stateCode: form.stateCode,
          stateName: selectedState.name,
          metroRegion: form.metroRegion,
          cityFreetext: form.metroRegion === 'Other' ? form.cityFreetext.trim() : null,
          referredByCode: form.referredByCode.trim(),
        },
      });
      setResult({ ...res.data, email: form.email.trim() });
      feedback.success(res.data?.visitorHeld ? 'You’re on the list' : 'Your visitor account is ready');
      window.scrollTo?.({ top: 0 });
    } catch (err) {
      console.error('[VisitorSignup] register failed:', err?.response?.status, err?.message);
      fail(err?.response?.data?.error || 'We couldn’t create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Success actions ──
  const copyCode = async () => {
    if (!result?.referralCode) return;
    try {
      await navigator.clipboard.writeText(result.referralCode);
      feedback.success(`Copied ${result.referralCode}`);
    } catch {
      feedback.info(`Your code: ${result.referralCode}`);
    }
  };

  const shareCode = async () => {
    if (!result?.referralCode) return;
    const text = `I just joined Unis from ${result.metroRegion}. Use my code ${result.referralCode} to help open it here.`;
    const url = `${window.location.origin}/waitlist?ref=${encodeURIComponent(result.referralCode)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Unis', text, url });
        feedback.success('Shared');
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    copyCode();
  };

  const resendEmail = async () => {
    if (!result?.email) return;
    setResending(true);
    try {
      await apiCall({ url: '/auth/resend-verification', method: 'post', data: { email: result.email }, useCache: false });
      feedback.success('Sent. Check your inbox and spam folder.');
    } catch (err) {
      console.error('[VisitorSignup] resend failed:', err?.response?.status, err?.message);
      feedback.error(err?.response?.data?.message || 'We couldn’t send it just now. Try again in a minute.');
    } finally {
      setResending(false);
    }
  };

  const nycHint = form.stateCode === 'NY' && form.metroRegion === 'New York City';

  // ─── Render ──
  return (
    <div className="wlj">
      <header className="wlj-top">
        <button type="button" className="wlj-top__back" aria-label="Back" onClick={() => navigate('/waitlist')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <Link to="/waitlist" className="wlj-top__brand" aria-label="Unis">
          <img src={logo} alt="" />
        </Link>
        <nav className="wlj-top__nav" aria-label="Unis">
          <Link to="/waitlist">How Unis works</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </header>

      {result ? (
        <main className="wlj-done">
          <p className="wlj-eyebrow">{result.visitorHeld ? 'Your spot is held' : 'Visitor account ready'}</p>
          <h1 className="wlj-done__title">
            {result.visitorHeld ? 'You’re on the list, ' : 'You’re in, '}
            <em>{result.metroRegion}.</em>
          </h1>
          <p className="wlj-lede">
            {result.visitorHeld
              ? `We’re letting out-of-town visitors in a few at a time right now. Your username and your spot are held, and your code already counts for ${result.metroRegion}. We’ll email you the moment you’re in.`
              : `Listen, like, make playlists and message anyone on Unis. Your vote opens the day ${result.metroRegion} does.`}
          </p>

          <div className="wlj-mail">
            <div className="wlj-mail__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6 8.5-6" /></svg>
            </div>
            <div className="wlj-mail__text">
              <b>{result.visitorHeld ? 'Confirm your email now' : 'One step left: confirm your email'}</b>
              <span>We sent a link to {result.email}</span>
            </div>
            <button type="button" className="wlj-btn wlj-btn--ghost wlj-btn--small" onClick={resendEmail} disabled={resending}>
              {resending ? 'Sending…' : 'Resend'}
            </button>
          </div>

          <div className="wlj-code">
            <span className="wlj-code__label">Your referral code</span>
            <span className="wlj-code__value">{result.referralCode}</span>
            <div className="wlj-code__actions">
              <button type="button" className="wlj-btn wlj-btn--ghost" onClick={copyCode}>Copy</button>
              <button type="button" className="wlj-btn wlj-btn--primary" onClick={shareCode}>Share</button>
            </div>
          </div>

          <CityMeter city={result.metroRegion} progress={done.progress} loading={done.loading} />
          {done.progress?.readyToActivate ? (
            <p className="wlj-note">
              {result.metroRegion} opens soon. The day it does, your vote turns on with nothing to redo.
            </p>
          ) : (
            <p className="wlj-note">Everyone who joins with your code brings {result.metroRegion} closer.</p>
          )}

          {!result.visitorHeld && (
            <Link to="/login" className="wlj-btn wlj-btn--primary wlj-btn--block">Sign in to Unis</Link>
          )}
        </main>
      ) : (
        <main className="wlj-main">
          <section className="wlj-pitch" aria-labelledby="wlj-title">
            <p className="wlj-eyebrow">Not in Harlem yet?</p>
            <h1 id="wlj-title" className="wlj-pitch__title">Use Unis from <em>anywhere.</em></h1>
            <p className="wlj-lede">
              Unis opens city by city. Until yours opens, come in as a visitor: the whole app, minus the vote.
              Every sign-up from your city brings it closer.
            </p>
            <CityMeter className="wlj-only-wide" city={meterCity} progress={progress} loading={meterLoading} />
            <OpenNow />
            <HarlemLink className="wlj-only-wide" />
          </section>

          <form className="wlj-card" onSubmit={handleSubmit} noValidate>
            <h2 className="wlj-card__title">Create your visitor account</h2>

            {error && (
              <div className="wlj-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>
            )}

            <div className="wlj-seg" role="group" aria-label="I am a">
              {[['LISTENER', 'Listener'], ['ARTIST', 'Artist']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={form.userType === value}
                  className={form.userType === value ? 'is-on' : ''}
                  onClick={() => handleChange('userType', value)}>
                  {label}
                </button>
              ))}
            </div>

            <fieldset className="wlj-group">
              <legend>Where you live</legend>
              <div className="wlj-row">
                <div className="wlj-field">
                  <label htmlFor="wlj-state">State</label>
                  <select id="wlj-state" value={form.stateCode} onChange={(e) => handleChange('stateCode', e.target.value)}>
                    <option value="">Choose…</option>
                    {Object.entries(US_STATES_AND_METROS)
                      .sort((a, b) => a[1].name.localeCompare(b[1].name))
                      .map(([code, s]) => <option key={code} value={code}>{s.name}</option>)}
                  </select>
                </div>
                <div className="wlj-field">
                  <label htmlFor="wlj-city">City</label>
                  <select id="wlj-city" value={form.metroRegion} disabled={!selectedState}
                    onChange={(e) => handleChange('metroRegion', e.target.value)}>
                    <option value="">{selectedState ? 'Choose…' : 'Pick a state first'}</option>
                    {metros.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              {form.metroRegion === 'Other' && (
                <div className="wlj-field">
                  <label htmlFor="wlj-other">Your city</label>
                  <input id="wlj-other" type="text" maxLength={100} value={form.cityFreetext}
                    onChange={(e) => handleChange('cityFreetext', e.target.value)} />
                </div>
              )}
              {nycHint && (
                <div className="wlj-nyc">
                  <b>Live in Harlem? Harlem is open.</b>
                  <span>Sign up as a resident and vote from day one. Anywhere else in the city, keep going here.</span>
                  <Link to="/login?signup=1">Sign up as a Harlem resident</Link>
                </div>
              )}
              <CityMeter className="wlj-only-narrow" city={meterCity} progress={progress} loading={meterLoading} />
              {!nycHint && <HarlemLink className="wlj-only-narrow" />}
            </fieldset>

            <fieldset className="wlj-group">
              <legend>You</legend>
              <div className="wlj-field">
                <label htmlFor="wlj-email">Email</label>
                <input id="wlj-email" type="email" autoComplete="email" value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)} />
              </div>
              <div className="wlj-field">
                <label htmlFor="wlj-user">Username</label>
                <input id="wlj-user" type="text" autoComplete="username" maxLength={50} value={form.username}
                  aria-invalid={usernameStatus === 'taken'} aria-describedby="wlj-user-help"
                  onChange={(e) => handleChange('username', e.target.value)} onBlur={checkUsername} />
                <span id="wlj-user-help" className={`wlj-help ${usernameStatus === 'ok' ? 'is-ok' : ''} ${usernameStatus === 'taken' ? 'is-bad' : ''}`}>
                  {usernameStatus === 'checking' && 'Checking…'}
                  {usernameStatus === 'ok' && 'Available. It’s yours from today, in any capitalization.'}
                  {usernameStatus === 'taken' && 'That username is taken. Try another.'}
                </span>
              </div>
              <div className="wlj-row">
                <div className="wlj-field">
                  <label htmlFor="wlj-pw">Password</label>
                  <input id="wlj-pw" type="password" autoComplete="new-password" value={form.password}
                    aria-describedby="wlj-pw-help" onChange={(e) => handleChange('password', e.target.value)} />
                  <span id="wlj-pw-help" className="wlj-help">At least 8 characters.</span>
                </div>
                <div className="wlj-field">
                  <label htmlFor="wlj-pw2">Confirm password</label>
                  <input id="wlj-pw2" type="password" autoComplete="new-password" value={form.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)} />
                </div>
              </div>
              <div className="wlj-field">
                <label htmlFor="wlj-dob">Date of birth</label>
                <input id="wlj-dob" type="date" max={todayIso()} value={form.dateOfBirth}
                  aria-describedby="wlj-dob-help" onChange={(e) => handleChange('dateOfBirth', e.target.value)} />
                <span id="wlj-dob-help" className="wlj-help">
                  You need to be 13 or older, same as everywhere on Unis. It&rsquo;s never shown publicly.
                </span>
              </div>
            </fieldset>

            <fieldset className="wlj-group">
              <legend>Who told you about Unis?</legend>
              <div className="wlj-field">
                <label htmlFor="wlj-ref">Referral code</label>
                <input id="wlj-ref" type="text" className="wlj-code-input" value={form.referredByCode}
                  aria-invalid={referralValid === false} aria-describedby="wlj-ref-help"
                  onChange={(e) => { handleChange('referredByCode', cleanCode(e.target.value)); setReferralValid(null); setReferrerName(''); }}
                  onBlur={() => checkReferral(form.referredByCode)} />
                <span id="wlj-ref-help" className={`wlj-help ${referralValid ? 'is-ok' : ''} ${referralValid === false ? 'is-bad' : ''}`}>
                  {referralChecking && 'Checking…'}
                  {!referralChecking && referralValid && (referrerName ? `${referrerName} gets the credit for bringing you.` : 'Code accepted.')}
                  {!referralChecking && referralValid === false && 'That code isn’t valid. Check it with the person who gave it to you.'}
                  {!referralChecking && referralValid === null && 'Ask the person who told you about Unis for theirs.'}
                </span>
              </div>
            </fieldset>

            <button type="submit" className="wlj-btn wlj-btn--primary wlj-btn--block wlj-btn--big" disabled={loading}>
              {loading ? 'Creating your account…' : 'Create my visitor account'}
            </button>
            <p className="wlj-fine">
              We&rsquo;ll email you a link to confirm your address. By joining you agree to the{' '}
              <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </form>
        </main>
      )}
    </div>
  );
};

export default WaitlistPage;
