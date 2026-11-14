// ─────────────────────────────────────────────────────────────────────────────
// Unis Plus — /plus (signed in)
//
// The ad-free plan: $4.99 a month through Stripe's hosted checkout (card
// details never touch Unis). Half of each payment ($2.50) goes first to the
// member's supported artist, whatever they played. Of the rest after Stripe's
// card and billing fees, half ($1.00) goes to the artists they played that
// month, by plays (to the supported artist too if they played no one), and
// half joins the Community Share pot. "Manage plan" opens Stripe's customer
// portal (change card, cancel). Canceling keeps Plus until the paid month ends.
//
// The page is built around the member's supported artist: their photo is
// worked into the hero (same recipe as the jurisdiction hero), the headline
// and the split table name them, and a member sees what their plan has
// credited that artist so far. With no supported artist, the page offers the
// SupportedArtistPicker in place.
//
// Stripe sends people back here with ?status=success or ?status=canceled.
// After a success the page checks every couple of seconds until Stripe's
// webhook has turned Plus on.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from './layout';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { useFeedback } from './context/FeedbackContext';
import { refreshPlusStatus, DEFAULT_PLUS_STATUS } from './utils/plusStatus';
import { buildUrl } from './utils/buildUrl';
import PlusMark from './components/PlusMark';
import SupportedArtistPicker from './SupportedArtistPicker';
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
 * Where a month's fee goes, in cents. Mirrors CommunityShareService on the
 * backend (plusSupportedPart / plusPlayedPart); change both together.
 *   1. Stripe's card (2.9% + 30¢) and Billing (0.7%) fees.
 *   2. The supported artist: half of what was paid, to the cent, never more
 *      than what's left after fees.
 *   3. Of the rest: half to the artists played (rounded down), and what's
 *      left to the Community Share.
 * On $4.99: fees 49¢, supported $2.50, played $1.00, Community Share $1.00.
 */
export const plusSplit = (cents) => {
  const price = Math.max(0, Math.round(Number(cents) || 0));
  const card = Math.ceil((price * 29) / 1000) + 30;
  const billing = Math.ceil((price * 7) / 1000);
  const fees = Math.min(price, card + billing);
  const net = price - fees;
  const supported = Math.max(0, Math.min(net, Math.round(price / 2)));
  const rest = Math.max(0, net - supported);
  const played = Math.floor(rest / 2);
  return { price, fees, net, supported, played, artists: supported + played, pot: rest - played };
};

const longDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

/**
 * The supported artist, for the hero: name, photo, area, genre, and their
 * home-area rank this week. The profile read is the same cached one the ad
 * card makes; the default song is read only when the artist has no photo
 * (its artwork becomes the backdrop); the territory rank is optional. Any
 * extra read failing just leaves that detail out.
 *
 * state: idle (no artist) | loading | ready | failed
 */
const useSupportedArtist = (artistId) => {
  const [artist, setArtist] = useState(null);
  const [state, setState] = useState(artistId ? 'loading' : 'idle');

  useEffect(() => {
    if (!artistId) {
      setArtist(null);
      setState('idle');
      return undefined;
    }
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const [profileRes, rankRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/users/profile/${artistId}` }),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/territory-rank` }).catch(() => null),
        ]);
        const p = profileRes?.data;
        if (!p?.username) throw new Error('No artist profile');

        const photo = buildUrl(p.photoUrl) || null;
        let artwork = null;
        if (!photo) {
          const songRes = await apiCall({ method: 'get', url: `/v1/users/${artistId}/default-song` }).catch(() => null);
          artwork = buildUrl(songRes?.data?.artworkUrl) || null;
        }

        // Home row of this week's territory chain: "#3 in Harlem this week".
        const week = rankRes?.data?.periods?.week;
        const home = Array.isArray(week) ? week[0] : null;

        if (cancelled) return;
        setArtist({
          userId: artistId,
          name: p.username,
          photo,
          backdrop: photo || artwork,
          area: home?.jurisdictionName || p.jurisdiction?.name || '',
          genre: p.genre?.name || '',
          weekRank: home && home.overallRank != null ? home.overallRank : null,
        });
        setState('ready');
      } catch (err) {
        console.error('[Plus] action=load_artist artistId=%s status=%s err=%s',
          artistId, err?.response?.status, err?.message);
        if (!cancelled) {
          setArtist(null);
          setState('failed');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [artistId]);

  return { artist, state };
};

const Avatar = ({ artist, size = '' }) => (
  <span className={`plus-av ${size ? `plus-av--${size}` : ''}`.trim()} aria-hidden="true">
    {artist?.photo
      ? <img src={artist.photo} alt="" loading="lazy" />
      : <span className="plus-av__initial">{(artist?.name || '?').charAt(0).toUpperCase()}</span>}
  </span>
);

const PlusPage = () => {
  const [params, setParams] = useSearchParams();
  const returned = params.get('status'); // success | canceled | null
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(returned === 'success');
  const [picking, setPicking] = useState(false);
  const feedback = useFeedback();
  const { user, refreshUser } = useAuth();

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
      if (s.plus) {
        setWaiting(false);
        feedback.success('Unis Plus is on — no more ads, and your artist earns more');
        return;
      }
      if (tries >= POLL_TRIES) {
        setWaiting(false);
        // Stripe took the payment but its webhook hasn't landed yet. Saying
        // so beats a page that just stops spinning.
        feedback.info('Payment received — Plus will switch on here shortly.');
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => { stopped = true; clearTimeout(timer); };
  }, [returned, load, feedback]);

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

  // The live supported artist comes from the signed-in user (it updates the
  // moment they pick one); the status answer is the fallback.
  const artistId = user?.supportedArtistId || s.supportedArtistId || null;
  const { artist, state: artistState } = useSupportedArtist(artistId);
  const withArtist = Boolean(artistId) && artistState !== 'failed';
  const name = artist?.name || 'your artist';
  // Only show the credited total for the artist it was counted for.
  const credited = s.supportedArtistId && s.supportedArtistId === artistId
    ? Number(s.creditedToSupportedCents || 0)
    : 0;

  const chipSub = artist
    ? [artist.area, artist.genre, artist.weekRank != null ? `#${artist.weekRank} this week` : '']
      .filter(Boolean).join(' · ')
    : '';

  const dismiss = () => { params.delete('status'); setParams(params, { replace: true }); };

  const picked = () => {
    refreshUser?.();
    load();
  };

  return (
    <Layout>
      <div className="plus-page">
        <header className={`plus-hero ${withArtist ? 'plus-hero--artist' : ''} ${s.plus ? 'plus-hero--member' : ''}`.trim()}>
          {withArtist && artist?.backdrop && (
            <div
              className="plus-hero__photo"
              aria-hidden="true"
              style={{ backgroundImage: `url(${JSON.stringify(artist.backdrop)})` }}
            />
          )}
          <div className="plus-hero__inner">
            <div className="plus-hero__brand">
              <PlusMark height={40} />
              {loaded && s.plus && <span className="plus-hero__chip">Member</span>}
            </div>

            {withArtist ? (
              <>
                <h1>
                  {s.plus ? <>You&rsquo;re backing </> : 'Back '}
                  <em>{name}</em>
                  {s.plus ? '' : ' every month.'}
                </h1>
                <p>
                  {s.plus ? (
                    <>
                      {dollars(split.supported)}, half of your {dollars(price)}, reaches {name} every month,
                      whatever you play &mdash; and {dollars(split.played)} goes to the artists you do play.
                    </>
                  ) : (
                    <>
                      {dollars(price)} a month, no ads &mdash; and half of it, {dollars(split.supported)}, goes
                      straight to {name} every month, whatever you play.
                    </>
                  )}
                </p>
                {artist ? (
                  <Link className="plus-artist" to={`/artist/${artist.userId}`} aria-label={`${artist.name} — view their page`}>
                    <Avatar artist={artist} />
                    <span className="plus-artist__txt">
                      <strong className="plus-artist__name">{artist.name}</strong>
                      {chipSub && <span className="plus-artist__sub">{chipSub}</span>}
                    </span>
                    <span className="plus-artist__go" aria-hidden="true">&rsaquo;</span>
                  </Link>
                ) : (
                  <span className="plus-artist plus-artist--loading" aria-hidden="true">
                    <span className="plus-av" />
                    <span className="plus-artist__txt">
                      <span className="plus-skel plus-skel--name" />
                      <span className="plus-skel plus-skel--sub" />
                    </span>
                  </span>
                )}
              </>
            ) : (
              <>
                <h1>No ads. Your money backs <em>the artists you play.</em></h1>
                <p>
                  {dollars(price)} a month. Half of it goes straight to the artist you support, whatever you
                  play. Of the rest after Stripe&rsquo;s fees, half goes to the artists you play and half to the
                  Community Share.
                </p>
                {user && artistState === 'idle' && (
                  <button type="button" className="plus-artist plus-artist--pick" onClick={() => setPicking(true)}>
                    <span className="plus-av plus-av--empty" aria-hidden="true">+</span>
                    <span className="plus-artist__txt">
                      <strong className="plus-artist__name">Pick an artist to support</strong>
                      <span className="plus-artist__sub">
                        They&rsquo;d get {dollars(split.supported)} of every month, whatever you play
                      </span>
                    </span>
                    <span className="plus-artist__go" aria-hidden="true">&rsaquo;</span>
                  </button>
                )}
              </>
            )}
          </div>
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
                <p>Ads are gone on every device you sign in on. Your plan renews on {longDate(s.paidThrough)} for {dollars(price)}.</p>
              )}
              {artist && credited > 0 && (
                <div className="plus-credited">
                  <Avatar artist={artist} size="sm" />
                  <span className="plus-credited__n">{dollars(credited)}</span>
                  <span className="plus-credited__l">credited to {artist.name} from your plan so far</span>
                </div>
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
                <li>
                  {dollars(split.supported)} of every month goes to {withArtist ? name : 'the artist you support'},
                  whatever you play, and {dollars(split.played)} to the artists you play.
                </li>
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

        {artist && (
          <section className="plus-card">
            <h2>What your support does</h2>
            <ol className="plus-why">
              <li>
                <strong>They get paid every month.</strong> {dollars(split.supported)} reaches {artist.name} whether
                or not you press play. It doesn&rsquo;t depend on streams, ads or anyone&rsquo;s algorithm.
              </li>
              <li>
                <strong>Your plays move them up the chart.</strong> The subscription pays them; the listening ranks
                them. Every play you give {artist.name} counts toward their standing
                {artist.area ? ` in ${artist.area}` : ''}.
              </li>
              <li>
                <strong>Direct, and ongoing.</strong> Not a one-night ticket with the promoter keeping the door
                &mdash; the same amount reaches them every month until you stop.
              </li>
            </ol>
          </section>
        )}

        <section className="plus-card">
          <h2>Where your {dollars(price)} goes</h2>
          <table className="plus-split">
            <tbody>
              <tr className="plus-split__hi">
                <td>
                  <span className="plus-split__who">
                    {artist ? <><Avatar artist={artist} size="xs" /><span className="plus-split__name">{artist.name}</span></> : 'The artist you support'}
                  </span>
                  <span className="plus-split__why">half of what you pay</span>
                </td>
                <td>{dollars(split.supported)}</td>
              </tr>
              <tr><td>Stripe (card and billing fees)</td><td>{dollars(split.fees)}</td></tr>
              <tr className="plus-split__hi">
                <td>Artists you play that month <span className="plus-split__why">half of the rest</span></td>
                <td>{dollars(split.played)}</td>
              </tr>
              <tr>
                <td>Unis&rsquo;s part, into the Community Share <span className="plus-split__why">the other half</span></td>
                <td>{dollars(split.pot)}</td>
              </tr>
            </tbody>
          </table>
          <p className="plus-muted">
            {artist ? artist.name : 'The artist you support'} gets that half whatever you played. The
            artists&rsquo; half of the rest is split by how much you played each artist that month, with the same
            rules as the Community Share (up to 50 plays a day count; your own songs don&rsquo;t), so{' '}
            {artist ? artist.name : 'your supported artist'} gets part of that too when you play them. If you
            didn&rsquo;t play anyone, it goes to {artist ? artist.name : 'your supported artist'} as well. If you
            don&rsquo;t support anyone, their half is split by your plays instead. To be paid, an artist needs a
            verified phone number. Unis&rsquo;s part joins the monthly Community Share, which is shared with
            supported artists and referrers by listening. Amounts are credited when each month closes.
          </p>
        </section>

        <p className="plus-fine">
          Unis Plus renews automatically each month at the price shown until you cancel in Manage plan.
          Canceling stops the next payment; it doesn&rsquo;t refund the current month. See the{' '}
          <Link to="/terms">Terms of Service</Link> (Unis Plus).
        </p>
      </div>

      {user && (
        <SupportedArtistPicker
          show={picking}
          onClose={() => setPicking(false)}
          userId={user.userId}
          currentArtistId={artistId}
          userJurisdictionId={user.jurisdiction?.jurisdictionId}
          userJurisdictionName={user.jurisdiction?.name}
          onSuccess={picked}
        />
      )}
    </Layout>
  );
};

export default PlusPage;
