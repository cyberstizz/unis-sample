// ─────────────────────────────────────────────────────────────────────────────
// Unis Plus — /plus (signed in)
//
// The ad-free plan: $4.99 a month through Stripe's hosted checkout (card
// details never touch Unis). Of what's left after Stripe's card and billing
// fees, 15% goes to the member's supported artist whatever they played, and
// 45% to the artists they played that month, by plays (all 60% to the
// supported artist if they played no one); Unis's 40% joins the Community
// Share pot. "Manage plan" opens Stripe's customer portal (change card,
// cancel). Canceling keeps Plus until the paid month ends.
//
// Stripe sends people back here with ?status=success or ?status=canceled.
// After a success the page checks every couple of seconds until Stripe's
// webhook has turned Plus on.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from './layout';
import { apiCall } from './components/axiosInstance';
import { refreshPlusStatus, DEFAULT_PLUS_STATUS } from './utils/plusStatus';
import './plusPage.scss';

const POLL_MS = 2500;
const POLL_TRIES = 12;

const isSafeStripeUrl = (raw) => {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && (u.hostname === 'stripe.com' || u.hostname.endsWith('.stripe.com'));
  } catch {
    return false;
  }
};

const dollars = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

/**
 * Where a month's fee goes: Stripe's card (2.9% + 30¢) and Billing (0.7%)
 * fees, then 15% to the supported artist, 45% to the artists played, and
 * Unis's 40% to the Community Share. Mirrors CommunityShareService.
 */
export const plusSplit = (cents) => {
  const price = Math.max(0, Math.round(Number(cents) || 0));
  const card = Math.ceil((price * 29) / 1000) + 30;
  const billing = Math.ceil((price * 7) / 1000);
  const fees = Math.min(price, card + billing);
  const net = price - fees;
  const supported = Math.floor(net * 0.15);
  const played = Math.floor(net * 0.45);
  const artists = supported + played;
  return { price, fees, net, supported, played, artists, pot: net - artists };
};

const longDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

const PlusPage = () => {
  const [params, setParams] = useSearchParams();
  const returned = params.get('status'); // success | canceled | null
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(returned === 'success');

  const load = useCallback(() => refreshPlusStatus().then((s) => { setStatus(s); return s; }), []);

  useEffect(() => { load(); }, [load]);

  // Back from checkout: wait for Stripe's webhook to turn Plus on.
  useEffect(() => {
    if (returned !== 'success') return undefined;
    let tries = 0;
    let timer = null;
    let stopped = false;
    const tick = async () => {
      const s = await load();
      tries += 1;
      if (stopped) return;
      if (s.plus || tries >= POLL_TRIES) { setWaiting(false); return; }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => { stopped = true; clearTimeout(timer); };
  }, [returned, load]);

  const go = async (path, fallback) => {
    setBusy(true);
    setError('');
    try {
      const res = await apiCall({ method: 'post', url: path });
      const url = res?.data?.url;
      if (!isSafeStripeUrl(url)) throw new Error('Not a Stripe address');
      window.location.assign(url);
    } catch (err) {
      console.error('[Plus]', path, err?.response?.status, err?.message);
      setError(errorText(err, fallback));
      setBusy(false);
    }
  };

  const s = status || DEFAULT_PLUS_STATUS;
  const price = s.priceCents || 499;
  const split = plusSplit(price);
  const loaded = status !== null;
  const hasPlan = Boolean(s.status) && s.status !== 'incomplete' && s.status !== 'incomplete_expired';

  const dismiss = () => { params.delete('status'); setParams(params, { replace: true }); };

  return (
    <Layout>
      <div className="plus-page">
        <header className="plus-hero">
          <span className="plus-hero__eyebrow">Unis Plus</span>
          <h1>No ads. Your money backs the artists you play.</h1>
          <p>
            {dollars(price)} a month. Every month, 60% of what&rsquo;s left after Stripe&rsquo;s fees goes to
            artists: 15% to the artist you support, no matter what, and 45% to the artists you play.
          </p>
        </header>

        {returned === 'canceled' && (
          <div className="plus-note" role="status">
            Checkout was canceled. You weren&rsquo;t charged.
            <button type="button" className="plus-note__close" onClick={dismiss} aria-label="Dismiss">×</button>
          </div>
        )}
        {returned === 'success' && (
          <div className={`plus-note ${s.plus ? 'plus-note--good' : ''}`} role="status">
            {s.plus
              ? 'Welcome to Unis Plus. Ads are gone on every device you sign in on.'
              : waiting
                ? 'Payment received. Turning on Unis Plus…'
                : 'Your payment went through. Plus can take a minute to turn on; refresh this page shortly.'}
            <button type="button" className="plus-note__close" onClick={dismiss} aria-label="Dismiss">×</button>
          </div>
        )}
        {error && <div className="plus-note plus-note--bad" role="alert">{error}</div>}

        <section className="plus-card">
          {!loaded ? (
            <p className="plus-muted">Loading…</p>
          ) : s.plus ? (
            <>
              <h2>You&rsquo;re ad-free</h2>
              {s.status === 'past_due' ? (
                <p className="plus-warn">
                  Your last payment didn&rsquo;t go through. Stripe will try your card again over the next
                  few days; update it in Manage plan to keep Plus.
                </p>
              ) : s.cancelAtPeriodEnd ? (
                <p>Your plan is canceled. Plus stays on until {longDate(s.paidThrough)}, and you won&rsquo;t be charged again.</p>
              ) : (
                <p>Your plan renews on {longDate(s.paidThrough)} for {dollars(price)}.</p>
              )}
              <button className="plus-btn plus-btn--ghost" type="button" disabled={busy}
                onClick={() => go('/v1/plus/portal', 'Couldn’t open plan settings. Please try again.')}>
                {busy ? 'Opening…' : 'Manage plan'}
              </button>
              <p className="plus-muted">Change your card, see receipts, or cancel. Stripe runs this page.</p>
            </>
          ) : !s.available ? (
            <>
              <h2>Coming soon</h2>
              <p>Unis Plus isn&rsquo;t on sale yet. Check back soon.</p>
            </>
          ) : (
            <>
              <h2>Go ad-free</h2>
              <ul className="plus-list">
                <li>No ads anywhere on Unis, on every device you sign in on.</li>
                <li>{dollars(split.supported)} of each month goes to the artist you support, and {dollars(split.played)} to the artists you play.</li>
                <li>Cancel any time. Plus stays on until the end of the month you paid for.</li>
              </ul>
              <button className="plus-btn" type="button" disabled={busy}
                onClick={() => go('/v1/plus/checkout', 'Checkout couldn’t start. Please try again.')}>
                {busy ? 'Opening checkout…' : `Get Unis Plus · ${dollars(price)}/month`}
              </button>
              {hasPlan && (
                <button className="plus-btn plus-btn--link" type="button" disabled={busy}
                  onClick={() => go('/v1/plus/portal', 'Couldn’t open plan settings. Please try again.')}>
                  Manage a previous plan
                </button>
              )}
              <p className="plus-muted">
                Payment is handled by Stripe. Unis never sees your card. Renews monthly until you cancel.
              </p>
            </>
          )}
        </section>

        <section className="plus-card">
          <h2>Where your {dollars(price)} goes</h2>
          <table className="plus-split">
            <tbody>
              <tr><td>Stripe (card and billing fees)</td><td>{dollars(split.fees)}</td></tr>
              <tr className="plus-split__hi"><td>The artist you support (15%)</td><td>{dollars(split.supported)}</td></tr>
              <tr className="plus-split__hi"><td>Artists you played that month (45%)</td><td>{dollars(split.played)}</td></tr>
              <tr><td>Unis&rsquo;s part (40%), into the Community Share</td><td>{dollars(split.pot)}</td></tr>
            </tbody>
          </table>
          <p className="plus-muted">
            The artist you support gets their 15% whatever you played. The 45% is split by how much you
            played each artist that month, with the same rules as the Community Share (up to 50 plays a
            day count; your own songs don&rsquo;t), so your supported artist gets part of that too when you
            play them. If you didn&rsquo;t play anyone, all 60% goes to the artist you support. Unis&rsquo;s part joins
            the monthly Community Share, which is shared with supported artists and referrers by
            listening. Amounts are paid when each month closes.
          </p>
        </section>

        <p className="plus-fine">
          Unis Plus renews automatically each month at the price shown until you cancel in Manage plan.
          Canceling stops the next payment; it doesn&rsquo;t refund the current month. See the{' '}
          <Link to="/terms">Terms of Service</Link> (Unis Plus).
        </p>
      </div>
    </Layout>
  );
};

export default PlusPage;
