// ─────────────────────────────────────────────────────────────────────────────
// Join the street team: /team/join (public, no app chrome, no login)
//
// POST /v1/team/join, then "check your email": the server always answers the
// same way, so this form can't reveal who has a Unis account. The email that
// arrives either confirms their spot, or (no account yet) links to sign-up.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import logo from './assets/unisLogoThree.svg';
import './sponsorLanding.scss';
import './teamPages.scss';

const ROLES = [
  { key: 'in_person', label: 'In person', hint: 'Meetups at the developments, venues and blocks' },
  { key: 'network', label: 'Your network', hint: 'Sharing with people you already know' },
];

const SLOTS = [
  { key: 'weekday_day', label: 'Weekdays, daytime' },
  { key: 'weekday_evening', label: 'Weekday evenings' },
  { key: 'weekend_day', label: 'Weekends, daytime' },
  { key: 'weekend_evening', label: 'Weekend evenings' },
];

const SIDES = [
  { key: 'uptown', label: 'Uptown' },
  { key: 'downtown', label: 'Downtown' },
  { key: 'either', label: 'Either' },
];

const toggle = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

const TeamJoin = () => {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', roles: ['in_person'], availability: [], side: 'either',
    adult: false, acceptedRules: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [signupCode, setSignupCode] = useState(null);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Join the Unis street team';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiCall({ method: 'get', url: '/v1/team/info', useCache: false })
      .then((res) => { if (!cancelled) setSignupCode(res?.data?.signupCode || null); })
      .catch(() => { /* the plain /join link still works */ });
    return () => { cancelled = true; };
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.roles.length) { setError('Pick at least one way to help.'); return; }
    if (!form.adult) { setError('The street team is for people 18 and older.'); return; }
    if (!form.acceptedRules) { setError('Please read and accept the rules.'); return; }
    setBusy(true);
    try {
      await apiCall({
        method: 'post',
        url: '/v1/team/join',
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          roles: form.roles,
          availability: form.availability,
          side: form.side,
          adult: form.adult,
          acceptedRules: form.acceptedRules,
        },
      });
      setSent(true);
    } catch (err) {
      console.error('[Team] join failed:', err?.message);
      setError(err?.response?.data?.error || 'That didn’t go through. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const signupHref = signupCode ? `/join/${encodeURIComponent(signupCode)}` : '/join';

  return (
    <div className="sl-page tm-page">
      <header className="sl-top">
        <Link to="/team" className="sl-top__brand" aria-label="The Unis street team">
          <img src={logo} alt="" />
        </Link>
        <nav className="sl-top__nav" aria-label="Street team page">
          <a href="/team#rules">Rules</a>
        </nav>
      </header>

      <main className="tm-main">
        {sent ? (
          <section className="tm-panel" role="status">
            <h1 className="tm-title">Check your email</h1>
            <p className="tm-lede">
              We sent a message to <strong>{form.email.trim()}</strong>. Tap the link in it to confirm your spot.
              If there&rsquo;s no Unis account with that email yet, the message has a link to make one.
            </p>
            <p className="tm-muted">Nothing there after a few minutes? Check spam, or <button type="button" className="tm-linkbtn" onClick={() => setSent(false)}>try again</button>.</p>
          </section>
        ) : (
          <form className="tm-panel tm-form" onSubmit={submit} noValidate>
            <h1 className="tm-title">Join the street team</h1>
            <p className="tm-lede">
              Two minutes. No shifts and no quotas: you come to the meetups that fit your week.
            </p>

            <label className="tm-field">
              <span>Your name</span>
              <input value={form.name} maxLength={80} autoComplete="name" required
                onChange={(e) => set('name', e.target.value)} />
            </label>

            <label className="tm-field">
              <span>The email on your Unis account</span>
              <input type="email" value={form.email} maxLength={120} autoComplete="email" required
                onChange={(e) => set('email', e.target.value)} />
              <small>No account yet? <Link to={signupHref}>Make one first</Link>, then come back.</small>
            </label>

            <label className="tm-field">
              <span>Phone (optional)</span>
              <input type="tel" value={form.phone} maxLength={24} autoComplete="tel"
                onChange={(e) => set('phone', e.target.value)} />
              <small>Only Unis sees it, to reach you about meetups.</small>
            </label>

            <fieldset className="tm-group">
              <legend>How do you want to help?</legend>
              {ROLES.map((r) => (
                <label key={r.key} className="tm-check">
                  <input type="checkbox" checked={form.roles.includes(r.key)}
                    onChange={() => set('roles', toggle(form.roles, r.key))} />
                  <span><strong>{r.label}</strong><small>{r.hint}</small></span>
                </label>
              ))}
            </fieldset>

            <fieldset className="tm-group">
              <legend>When are you usually free?</legend>
              <div className="tm-chips">
                {SLOTS.map((s) => (
                  <label key={s.key} className={`tm-chip${form.availability.includes(s.key) ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={form.availability.includes(s.key)}
                      onChange={() => set('availability', toggle(form.availability, s.key))} />
                    {s.label}
                  </label>
                ))}
              </div>
              <small className="tm-muted">Leave these blank and you&rsquo;ll hear about every meetup.</small>
            </fieldset>

            <fieldset className="tm-group">
              <legend>Which side of Harlem?</legend>
              <div className="tm-chips">
                {SIDES.map((s) => (
                  <label key={s.key} className={`tm-chip${form.side === s.key ? ' is-on' : ''}`}>
                    <input type="radio" name="side" checked={form.side === s.key} onChange={() => set('side', s.key)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="tm-check">
              <input type="checkbox" checked={form.adult} onChange={(e) => set('adult', e.target.checked)} />
              <span>I&rsquo;m 18 or older.</span>
            </label>
            <label className="tm-check">
              <input type="checkbox" checked={form.acceptedRules} onChange={(e) => set('acceptedRules', e.target.checked)} />
              <span>
                I&rsquo;ve read the <a href="/team#rules">street team rules</a>, and I understand this
                isn&rsquo;t a job: no shifts, no quotas, no pay. I earn only through my referral code, like every member.
              </span>
            </label>

            {error && <p className="tm-error" role="alert">{error}</p>}

            <button className="sl-btn tm-submit" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Join the street team'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};

export default TeamJoin;
