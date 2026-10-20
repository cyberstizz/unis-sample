// ─────────────────────────────────────────────────────────────────────────────
// AdSlot — the one ad space every page uses.
//
//   <AdSlot placement="feed" />                 a banner between sections
//   <AdSlot placement="winners" variant="rail" /> a tall rail beside content
//
// What it shows, in order:
//   1. Nothing, for Unis Plus members, on pages that never carry ads (Messages,
//      Earnings, Settings, Help, sign-in, checkout, Plus, Sponsor, admin…),
//      and in tests.
//   2. A local sponsor running this week in the viewer's area
//      ("Sponsored · Local"), bought on /sponsor by a Harlem business.
//   3. A Google AdSense unit ("Advertisement"), once VITE_ADSENSE_CLIENT and
//      this placement's VITE_ADSENSE_SLOT_… are set in Netlify.
//   4. Otherwise a Unis card: "Go ad-free with Unis Plus" for signed-in
//      members, or "Your business here" (→ /sponsor) for everyone else.
//
// The space is reserved (fixed minimum height) so the page doesn't jump, the
// AdSense unit is pushed once per mount and again on each route change, and
// nobody is paid for seeing or tapping anything here (Google's rules; the
// Community Share follows listening, not ads).
//
// Placement names and their Netlify variables:
//   feed VITE_ADSENSE_SLOT_FEED · song VITE_ADSENSE_SLOT_SONG ·
//   artist VITE_ADSENSE_SLOT_ARTIST · jurisdiction VITE_ADSENSE_SLOT_JURISDICTION ·
//   winners VITE_ADSENSE_SLOT_WINNERS · find VITE_ADSENSE_SLOT_FIND ·
//   playlist VITE_ADSENSE_SLOT_PLAYLIST · discover VITE_ADSENSE_SLOT_DISCOVER
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiCall } from './axiosInstance';
import { buildUrl } from '../utils/buildUrl';
import { usePlusStatus } from '../utils/plusStatus';
import './adSlot.scss';

const ADSENSE_CLIENT = String(import.meta.env.VITE_ADSENSE_CLIENT || '').trim();

// Written out one by one: Vite only fills in import.meta.env.VITE_… names it can see.
const SLOT_IDS = {
  feed: import.meta.env.VITE_ADSENSE_SLOT_FEED,
  song: import.meta.env.VITE_ADSENSE_SLOT_SONG,
  artist: import.meta.env.VITE_ADSENSE_SLOT_ARTIST,
  jurisdiction: import.meta.env.VITE_ADSENSE_SLOT_JURISDICTION,
  winners: import.meta.env.VITE_ADSENSE_SLOT_WINNERS,
  find: import.meta.env.VITE_ADSENSE_SLOT_FIND,
  playlist: import.meta.env.VITE_ADSENSE_SLOT_PLAYLIST,
  discover: import.meta.env.VITE_ADSENSE_SLOT_DISCOVER,
};

/** Pages that never carry ads, even if a slot is placed on them by mistake. */
const NO_AD_PATHS = [
  '/messages', '/earnings', '/profile', '/artistDashboard', '/help', '/login', '/register',
  '/reset-password', '/verify-email', '/plus', '/sponsor', '/admin', '/privacy', '/terms',
  '/cookie', '/report', '/waitlist',
];

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/+$/, '');

/** Where a tap on a sponsor goes: the API counts it, then redirects to the sponsor's link. */
export const sponsorTapUrl = (campaignId) => `${API_BASE}/v1/sponsors/${encodeURIComponent(campaignId)}/go`;

const isNoAdPath = (pathname = '/') =>
  NO_AD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));

const validSponsor = (data) =>
  data && typeof data === 'object' && typeof data.campaignId === 'string' && typeof data.businessName === 'string'
    ? data
    : null;

const formatPrice = (cents) => {
  const n = Number(cents);
  return Number.isFinite(n) && n > 0 ? `$${(n / 100).toFixed(2)}` : '$4.99';
};

// ── Pieces ──────────────────────────────────────────────────────────────────

/** A local sponsor's card. Also used as the live preview on /sponsor. */
export const SponsorCard = ({ sponsor, href, preview = false }) => {
  const logo = sponsor?.logoUrl ? (sponsor.logoUrl.startsWith('blob:') ? sponsor.logoUrl : buildUrl(sponsor.logoUrl)) : null;
  const name = sponsor?.businessName || 'Your business';
  const line = sponsor?.headline || 'Your line of text goes here.';
  const content = (
    <>
      {logo ? (
        <img className="ad-sponsor__logo" src={logo} alt="" loading="lazy" />
      ) : (
        <span className="ad-sponsor__initial" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || 'U'}</span>
      )}
      <span className="ad-sponsor__text">
        <span className="ad-sponsor__name">{name}</span>
        <span className="ad-sponsor__line">{line}</span>
      </span>
      <span className="ad-sponsor__cta" aria-hidden="true">Visit</span>
    </>
  );
  if (preview) return <div className="ad-sponsor ad-sponsor--preview">{content}</div>;
  return (
    <a className="ad-sponsor" href={href} target="_blank" rel="sponsored noopener noreferrer"
      aria-label={`${name}: ${line} (sponsored, opens in a new tab)`}>
      {content}
    </a>
  );
};

/** One AdSense unit. Re-mounted (key) on each route change, which asks Google for a fresh ad. */
const AdSenseUnit = ({ slot }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getAttribute('data-adsbygoogle-status')) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn('[Ads] AdSense push failed:', e?.message);
    }
  }, []);
  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
};

const HouseCard = ({ kind, priceCents }) => {
  if (kind === 'plus') {
    return (
      <Link className="ad-house" to="/plus">
        <span className="ad-house__title">Go ad-free with Unis Plus</span>
        <span className="ad-house__body">
          {formatPrice(priceCents)} a month. 60% goes to the artists you play.
        </span>
        <span className="ad-house__cta">See Unis Plus</span>
      </Link>
    );
  }
  return (
    <Link className="ad-house ad-house--sponsor" to="/sponsor">
      <span className="ad-house__title">Your business here</span>
      <span className="ad-house__body">Harlem shops: reach people listening in your neighborhood, from $25 a week.</span>
      <span className="ad-house__cta">Sponsor Harlem</span>
    </Link>
  );
};

// ── The slot ────────────────────────────────────────────────────────────────

// Tests render pages without a server; no ad, no requests, no hooks.
const TEST_MODE = import.meta.env.MODE === 'test';

const AdSlot = (props) => (TEST_MODE ? null : <LiveAdSlot {...props} />);

const LiveAdSlot = ({ placement, variant = 'banner', className = '' }) => {
  const { pathname } = useLocation();
  const { user, authLoaded } = useAuth();
  const userId = user?.userId || null;
  const { status: plus, loaded: plusLoaded } = usePlusStatus(userId);
  const jurisdictionId = user?.jurisdiction?.jurisdictionId || '';
  const [sponsor, setSponsor] = useState(undefined); // undefined = still asking
  // Signed-in members mostly see the Plus card; now and then the sponsor one.
  const [houseKind] = useState(() => (Math.random() < 0.75 ? 'plus' : 'sponsor'));

  const blocked = isNoAdPath(pathname) || Boolean(plus.plus);

  useEffect(() => {
    if (blocked) return undefined;
    let cancelled = false;
    setSponsor(undefined);
    const q = jurisdictionId ? `?jurisdictionId=${encodeURIComponent(jurisdictionId)}` : '';
    apiCall({ method: 'get', url: `/v1/sponsors/serve${q}`, useCache: false })
      .then((res) => { if (!cancelled) setSponsor(res?.status === 204 ? null : validSponsor(res?.data)); })
      .catch(() => { if (!cancelled) setSponsor(null); });
    return () => { cancelled = true; };
  }, [blocked, pathname, jurisdictionId]);

  if (blocked) return null;
  // Members: wait for the Plus answer (cached after the first page) so a Plus
  // member never sees an ad flash. Guests are never Plus.
  if (!authLoaded || (userId && !plusLoaded)) return null;

  const slotId = SLOT_IDS[placement];
  const adsenseOn = Boolean(ADSENSE_CLIENT && slotId);
  const classes = `ad-slot ad-slot--${variant} ${className}`.trim();

  let label = '';
  let body = null;
  if (sponsor === undefined) {
    body = <div className="ad-slot__placeholder" aria-hidden="true" />;
  } else if (sponsor) {
    label = 'Sponsored · Local';
    body = <SponsorCard sponsor={sponsor} href={sponsorTapUrl(sponsor.campaignId)} />;
  } else if (adsenseOn) {
    label = 'Advertisement';
    body = <AdSenseUnit key={pathname} slot={slotId} />;
  } else {
    const kind = userId && plus.available ? houseKind : 'sponsor';
    label = 'From Unis';
    body = <HouseCard kind={kind} priceCents={plus.priceCents} />;
  }

  return (
    <aside className={classes} aria-label={label || 'Advertisement'} data-placement={placement}>
      <span className="ad-slot__label">{label || ' '}</span>
      <div className="ad-slot__body">{body}</div>
    </aside>
  );
};

export default AdSlot;
