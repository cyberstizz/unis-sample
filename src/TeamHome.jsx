// ─────────────────────────────────────────────────────────────────────────────
// A street team member's page: /team/me?t=TOKEN (public, no app chrome)
//
// Every street team email links here with the member's private token:
//   ?t=TOKEN&confirm=1          the confirmation link → POST /v1/team/confirm
//   ?t=TOKEN&m=MEETUP&a=going   "I'm in" / "Can't make it" from an invite. The
//                               answer is only saved when they tap Confirm
//                               here, so email scanners that open links
//                               can't answer for them.
//   ?t=TOKEN                    their page: code, QR, meetups, emails on/off.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { apiCall } from './components/axiosInstance';
import { joinLink } from './utils/referralLink';
import { meetupWhen as when } from './utils/teamTime';
import logo from './assets/unisLogoThree.svg';
import './sponsorLanding.scss';
import './teamPages.scss';

const SIDE = { uptown: 'Uptown', downtown: 'Downtown', either: 'All of Harlem' };

const TeamHome = () => {
  const [params, setParams] = useSearchParams();
  const token = params.get('t') || '';
  const pendingMeetup = params.get('m');
  const pendingAnswer = params.get('a');
  const wantsConfirm = params.get('confirm') === '1';

  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    const previous = document.title;
    document.title = 'Your street team page';
    return () => { document.title = previous; };
  }, []);

  const load = useCallback(async () => {
    if (!token) { setError('This page needs the link from your street team email.'); return; }
    try {
      const res = wantsConfirm
        ? await apiCall({ method: 'post', url: '/v1/team/confirm', data: { t: token }, useCache: false })
        : await apiCall({ method: 'get', url: `/v1/team/me?t=${encodeURIComponent(token)}`, useCache: false });
      setMe(res.data);
      setError('');
      if (wantsConfirm) {
        const next = new URLSearchParams(params);
        next.delete('confirm');
        setParams(next, { replace: true });
        setNote('You’re on the team. Welcome.');
      }
    } catch (err) {
      console.error('[Team] load failed:', err?.message);
      setError(err?.response?.data?.error || 'This page couldn’t load. Try the link again.');
    }
  }, [token, wantsConfirm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const link = me?.referralCode ? joinLink(me.referralCode) : '';

  useEffect(() => {
    if (!link) return undefined;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 520, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch((err) => console.error('[Team] QR failed:', err?.message));
    return () => { cancelled = true; };
  }, [link]);

  const pending = useMemo(() => {
    if (!me || !pendingMeetup || !['going', 'not_going'].includes(pendingAnswer)) return null;
    const meetup = me.meetups?.find((m) => m.meetupId === pendingMeetup);
    return meetup ? { meetup, answer: pendingAnswer } : null;
  }, [me, pendingMeetup, pendingAnswer]);

  const clearPending = () => {
    const next = new URLSearchParams(params);
    next.delete('m');
    next.delete('a');
    setParams(next, { replace: true });
  };

  const reply = async (meetupId, answer) => {
    setBusy(true);
    setNote('');
    try {
      const res = await apiCall({ method: 'post', url: '/v1/team/reply', data: { t: token, meetupId, answer } });
      setMe(res.data);
      setNote(answer === 'going' ? 'You’re in. See you there.' : 'Got it. Thanks for letting us know.');
      if (pendingMeetup === meetupId) clearPending();
    } catch (err) {
      setNote(err?.response?.data?.error || 'That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const setEmails = async (on) => {
    setBusy(true);
    try {
      const res = await apiCall({ method: 'post', url: '/v1/team/emails', data: { t: token, on } });
      setMe(res.data);
      setNote(on ? 'Street team emails are on.' : 'Street team emails are off. Turn them back on any time.');
    } catch (err) {
      setNote(err?.response?.data?.error || 'That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNote('Link copied.');
    } catch {
      window.prompt('Copy your link', link);
    }
  };

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
        {error && <section className="tm-panel"><p className="tm-error" role="alert">{error}</p></section>}
        {!me && !error && <section className="tm-panel"><p className="tm-muted" role="status">Loading…</p></section>}

        {me && (
          <>
            <section className="tm-panel">
              <h1 className="tm-title">Hi {me.name?.split(' ')[0] || me.username}</h1>
              {me.status === 'pending' && (
                <p className="tm-lede">Tap the confirm link in your email to finish joining.</p>
              )}
              {me.status === 'paused' && (
                <p className="tm-lede">
                  Street team emails are off.{' '}
                  <button type="button" className="tm-linkbtn" disabled={busy} onClick={() => setEmails(true)}>Turn them on</button>
                </p>
              )}
              {note && <p className="tm-note" role="status">{note}</p>}

              {pending && (
                <div className="tm-pending">
                  <p>
                    {pending.answer === 'going' ? 'Confirm you’re in for ' : 'Confirm you can’t make '}
                    <strong>{pending.meetup.title}</strong>, {when(pending.meetup)}.
                  </p>
                  <div className="tm-row">
                    <button type="button" className="sl-btn" disabled={busy} onClick={() => reply(pending.meetup.meetupId, pending.answer)}>Confirm</button>
                    <button type="button" className="tm-linkbtn" onClick={clearPending}>Not now</button>
                  </div>
                </div>
              )}
            </section>

            <section className="tm-panel tm-code">
              <div>
                <p className="tm-eyebrow">Your code</p>
                <p className="tm-code__value">{me.referralCode}</p>
                <p className="tm-muted">
                  {me.referrals === 1 ? '1 person has' : `${me.referrals || 0} people have`} joined with it.
                  At a meetup, people scan this QR code with their phone and sign up with your code filled in.
                </p>
                <div className="tm-row">
                  <button type="button" className="sl-btn" onClick={copyLink}>Copy your link</button>
                </div>
              </div>
              {qr && <img className="tm-code__qr" src={qr} alt={`QR code for ${link}`} />}
            </section>

            <section className="tm-panel">
              <h2 className="tm-subtitle">Upcoming meetups</h2>
              {(!me.meetups || me.meetups.length === 0) && (
                <p className="tm-muted">No meetups yet. You&rsquo;ll get an email when one is posted.</p>
              )}
              <ul className="tm-meetups">
                {(me.meetups || []).map((m) => {
                  const full = m.spots != null && m.going >= m.spots && m.myAnswer !== 'going';
                  return (
                    <li key={m.meetupId} className={`tm-meetup${m.status === 'cancelled' ? ' is-cancelled' : ''}`}>
                      <div className="tm-meetup__main">
                        <p className="tm-meetup__title">{m.title}{m.status === 'cancelled' && ' · Cancelled'}</p>
                        <p className="tm-meetup__when">{when(m)}</p>
                        <p className="tm-muted">Meet at {m.meetingPoint} &middot; {SIDE[m.side] || 'Harlem'}</p>
                        {m.notes && <p className="tm-muted">{m.notes}</p>}
                        <p className="tm-muted">
                          {m.going} going{m.spots != null ? ` of ${m.spots}` : ''}
                          {m.myAnswer === 'going' && ' · You’re in'}
                          {m.myAnswer === 'not_going' && ' · You can’t make it'}
                        </p>
                      </div>
                      {m.status !== 'cancelled' && me.status === 'active' && (
                        <div className="tm-row">
                          <button type="button" className={`tm-pill${m.myAnswer === 'going' ? ' is-on' : ''}`}
                            disabled={busy || full} aria-pressed={m.myAnswer === 'going'} onClick={() => reply(m.meetupId, 'going')}>
                            {full ? 'Full' : 'I’m in'}
                          </button>
                          <button type="button" className={`tm-pill${m.myAnswer === 'not_going' ? ' is-on' : ''}`}
                            disabled={busy} aria-pressed={m.myAnswer === 'not_going'} onClick={() => reply(m.meetupId, 'not_going')}>
                            Can&rsquo;t make it
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {me.status === 'active' && (
              <p className="tm-foot-note">
                <button type="button" className="tm-linkbtn" disabled={busy} onClick={() => setEmails(false)}>
                  Turn street team emails off
                </button>
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default TeamHome;
