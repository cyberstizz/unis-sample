// src/earnings.jsx
//
// Earnings dashboard — referral income, supporter income (artists), Stripe
// Connect onboarding, and payouts.
//
// QA PASS NOTES (production-readiness checklist):
//   • buildUrl        — now imports the SHARED src/utils/buildUrl.js. The old
//                       local copy only prefixed API_BASE_URL and could not
//                       rewrite private-R2 URLs, so any referral avatar stored
//                       as an r2.cloudflarestorage.com URL rendered broken.
//   • Theme awareness — every hardcoded #163387 (the *blue* theme's primary)
//                       moved out of JSX into earnings.scss behind
//                       var(--unis-primary). The page now recolors with the
//                       user's theme like the rest of the app.
//   • Accessibility   — real tablist/tab/tabpanel semantics with roving
//                       tabindex + arrow-key navigation (matches ListenerPage
//                       and commentSection), live regions for status/errors,
//                       role="progressbar" on the payout meter, decorative
//                       icons hidden from AT.
//   • Security        — Stripe redirect URLs are validated (https + stripe.com)
//                       before navigation; window.open uses noopener,noreferrer.
//   • Logging         — every endpoint logs success/failure individually.
//                       Promise.allSettled rejections used to be swallowed
//                       silently, so a failing endpoint was invisible in prod.
//   • API efficiency  — payout success now refreshes only the 3 financial
//                       endpoints instead of all 5; concurrent fetches are
//                       de-duplicated with an in-flight guard.
//   • PlayChoiceModal — N/A. This page has no play surface; no audio is
//                       started here and no play/points are attributable.
//   • Caching         — deliberately `useCache: false` on every request.
//                       cacheService persists to localStorage, and account
//                       balances must not outlive the session on a shared
//                       device. See QA report finding C-2.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import {
  DollarSign, Users, TrendingUp, ArrowUpRight,
  Clock, CheckCircle, AlertCircle, RefreshCw,
  CreditCard, ExternalLink, Shield, X
} from 'lucide-react';
import './earnings.scss';

// ── Config ──────────────────────────────────────────────────────────────────

const HISTORY_DAYS = 30;

// Fallback only. The authoritative threshold comes from the API
// (summary.payoutThreshold) so a backend policy change does not require a
// frontend deploy.
const DEFAULT_PAYOUT_THRESHOLD = 50;

// Render caps — the referral and payout endpoints are unpaginated, so a user
// with a large downline would otherwise mount thousands of DOM nodes at once.
const REFERRALS_PAGE_SIZE = 25;
const PAYOUTS_PAGE_SIZE = 12;

// Only these hosts may be navigated to from a Stripe API response. Account
// Links and Login Links are always issued on stripe.com; anything else is
// treated as an open-redirect attempt and refused.
const ALLOWED_STRIPE_HOSTS = ['stripe.com'];

// Revenue split copy lives in one place so the marketing numbers can't drift
// between the bar, the legend, and the prose.
const DISPLAY_AD_SPLIT = [
  { key: 'unis',    label: 'Unis 68%',   legend: 'Unis (68%)',                 width: 68, tone: 'brand' },
  { key: 'artist',  label: 'Artist 15%', legend: 'Supported Artist (15%)',     width: 15, tone: 'purple' },
  { key: 'level1',  label: 'L1 10%',     legend: 'Level 1 Referrer (10%)',     width: 10, tone: 'blue' },
  { key: 'level2',  label: 'L2',         legend: 'Level 2 Referrer (5%)',      width: 5,  tone: 'violet' },
  { key: 'level3',  label: '',           legend: 'Level 3 Referrer (2%)',      width: 2,  tone: 'cyan' },
];

const AUDIO_AD_SPLIT = [
  { key: 'artist',  label: 'Artist 60%', legend: 'Artist (60%)',               width: 60, tone: 'green' },
  { key: 'unis',    label: 'Unis 23%',   legend: 'Unis (23%)',                 width: 23, tone: 'brand' },
  { key: 'level1',  label: 'L1 10%',     legend: 'Level 1 Referrer (10%)',     width: 10, tone: 'blue' },
  { key: 'level2',  label: 'L2',         legend: 'Level 2 Referrer (5%)',      width: 5,  tone: 'violet' },
  { key: 'level3',  label: '',           legend: 'Level 3 Referrer (2%)',      width: 2,  tone: 'cyan' },
];

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'referrals', label: 'My Referrals' },
  { id: 'payouts',   label: 'Payouts' },
  { id: 'how',       label: 'How It Works' },
];

// ── Logging ─────────────────────────────────────────────────────────────────
// Single prefixed logger so earnings activity is greppable in a production
// console session alongside [Cache] and [PlayTracker].

const log = (msg, ...rest) => console.log(`[Earnings] ${msg}`, ...rest);
const logWarn = (msg, ...rest) => console.warn(`[Earnings] ${msg}`, ...rest);
const logError = (msg, ...rest) => console.error(`[Earnings] ${msg}`, ...rest);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Guard against open redirects. The backend is trusted, but a compromised or
 * misconfigured response should never be able to send a signed-in user to an
 * arbitrary origin — this is the one place in the page that hands control of
 * the browser to a server-supplied string.
 */
function isSafeStripeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_STRIPE_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

const toNumber = (value, fallback = 0) => {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

const Earnings = () => {
  const { user, authLoaded } = useAuth();

  const [summary, setSummary] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [history, setHistory] = useState([]);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [payouts, setPayouts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // error = { source: 'load' | 'stripe', message } — the source matters because
  // a ?stripe=refresh warning must survive the data load that follows it.
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  // payoutStatus is tracked separately from the message. The old code inferred
  // success by testing whether the message string contained "success", so an
  // API error mentioning that word rendered in green.
  const [payoutMessage, setPayoutMessage] = useState('');
  const [payoutStatus, setPayoutStatus] = useState(null); // 'success' | 'error'
  const [visibleReferrals, setVisibleReferrals] = useState(REFERRALS_PAGE_SIZE);
  const [visiblePayouts, setVisiblePayouts] = useState(PAYOUTS_PAGE_SIZE);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const tabRefs = useRef({});

  const isArtist = user?.role === 'artist' || user?.isArtist;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Stripe return-trip params ─────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeParam = params.get('stripe');
    if (!stripeParam) return;

    // Preserve the real path instead of hardcoding '/earnings' — the old
    // version rewrote the URL to a literal path, which would be wrong under
    // any base path or aliased route.
    const cleanPath = `${window.location.pathname}${window.location.hash || ''}`;

    if (stripeParam === 'complete') {
      log('Returned from Stripe onboarding — showing Payouts tab');
      setActiveTab('payouts');
      window.history.replaceState({}, '', cleanPath);
    } else if (stripeParam === 'refresh') {
      logWarn('Returned from Stripe onboarding without completing it');
      setError({
        source: 'stripe',
        message: 'Stripe onboarding was not completed. Please try again.',
      });
      window.history.replaceState({}, '', cleanPath);
    }
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  /**
   * @param {'full'|'financial'} scope
   *   'full'      — all five endpoints (mount, manual refresh)
   *   'financial' — balance, Stripe status and payout list only. Referrals and
   *                 30-day history cannot change as a result of a withdrawal,
   *                 so a payout no longer costs five round trips.
   */
  const fetchAllData = useCallback(async (scope = 'full') => {
    if (!user?.userId) return;

    if (inFlightRef.current) {
      log('Fetch already in flight — ignoring duplicate request');
      return;
    }
    inFlightRef.current = true;

    const requests = [
      { key: 'summary',      url: '/v1/earnings/my-summary',  apply: (d) => setSummary(d ?? null) },
      { key: 'stripeStatus', url: '/v1/stripe/status',        apply: (d) => setStripeStatus(d ?? null) },
      { key: 'payouts',      url: '/v1/stripe/payouts',       apply: (d) => setPayouts(d || []) },
    ];

    if (scope === 'full') {
      requests.push(
        { key: 'referrals', url: '/v1/earnings/my-referrals', apply: (d) => setReferrals(d || []) },
        { key: 'history',   url: `/v1/earnings/my-history?days=${HISTORY_DAYS}`, apply: (d) => setHistory(d || []) },
      );
    }

    log(`Loading earnings (scope: ${scope}, ${requests.length} endpoints)`);

    try {
      // useCache: false on all of these is deliberate — see the header note.
      const results = await Promise.allSettled(
        requests.map((req) => apiCall({ url: req.url, useCache: false }))
      );

      if (!mountedRef.current) {
        log('Component unmounted before load finished — discarding response');
        return;
      }

      const failed = [];
      results.forEach((result, index) => {
        const { key, apply } = requests[index];
        if (result.status === 'fulfilled') {
          apply(result.value?.data);
          log(`✓ ${key} loaded`);
        } else {
          failed.push(key);
          // Previously these rejections were dropped on the floor: allSettled
          // never throws, so the outer catch never ran and a broken endpoint
          // was completely silent in production.
          logError(
            `✗ ${key} failed (status ${result.reason?.response?.status ?? 'n/a'})`,
            result.reason?.message || result.reason
          );
        }
      });

      if (failed.length === requests.length) {
        setError({ source: 'load', message: 'Failed to load earnings data.' });
        logError('All earnings endpoints failed');
      } else {
        if (failed.length > 0) {
          logWarn(`Partial load — degraded sections: ${failed.join(', ')}`);
        } else {
          log('All earnings endpoints loaded successfully');
        }
        // Only clear a previous *load* error. Clearing unconditionally would
        // wipe the ?stripe=refresh warning set by the mount effect.
        setError((prev) => (prev?.source === 'load' ? null : prev));
      }
    } catch (err) {
      // allSettled shouldn't reject, but a synchronous throw while building the
      // request list would land here.
      logError('Unexpected failure while loading earnings', err);
      if (mountedRef.current) {
        setError({ source: 'load', message: 'Failed to load earnings data.' });
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.userId]);

  useEffect(() => {
    if (!user?.userId) {
      // Auth has resolved and there is no session: the route guard will bounce
      // this render, but don't leave a permanent spinner behind if it doesn't.
      if (authLoaded) setLoading(false);
      return;
    }
    fetchAllData('full');
  }, [user?.userId, authLoaded, fetchAllData]);

  const handleRefresh = () => {
    if (refreshing || inFlightRef.current) return;
    setRefreshing(true);
    fetchAllData('full');
  };

  // ── Formatting ────────────────────────────────────────────────────────────

  /**
   * Micro-earnings are real on this platform — a single ad view can be worth a
   * fraction of a cent — so the precision scales with the magnitude rather than
   * rounding small balances to $0.00.
   */
  const formatMoney = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    const num = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(num < 0.01 && num > 0 ? 6 : num < 1 && num > 0 ? 4 : 2)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Stripe actions ────────────────────────────────────────────────────────

  const handleStartOnboarding = async () => {
    if (stripeLoading) return;
    setStripeLoading(true);
    log('Requesting Stripe onboarding link');
    try {
      const res = await apiCall({ url: '/v1/stripe/onboard', method: 'post' });
      const url = res?.data?.url;

      if (!url) {
        // The old code silently did nothing here — the button just re-enabled.
        logError('Onboarding response contained no URL', res?.data);
        setError({ source: 'stripe', message: 'Failed to start Stripe setup. Please try again.' });
        return;
      }
      if (!isSafeStripeUrl(url)) {
        logError('Refused to navigate to non-Stripe onboarding URL', url);
        setError({ source: 'stripe', message: 'Failed to start Stripe setup. Please try again.' });
        return;
      }

      log('Onboarding link received — redirecting to Stripe');
      window.location.href = url;
    } catch (err) {
      logError('Stripe onboarding request failed', err?.response?.status, err?.message);
      setError({ source: 'stripe', message: 'Failed to start Stripe setup. Please try again.' });
    } finally {
      if (mountedRef.current) setStripeLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (payoutLoading) return;
    setPayoutLoading(true);
    setPayoutMessage('');
    setPayoutStatus(null);
    log('Requesting payout');
    try {
      const res = await apiCall({ url: '/v1/stripe/payout', method: 'post' });

      if (res?.data?.success) {
        const amount = formatMoney(res.data.amount);
        log(`Payout initiated for ${amount}`);
        setPayoutMessage(`Payout of ${amount} initiated successfully!`);
        setPayoutStatus('success');
        // Balance, Stripe status and the payout list changed. Referrals and the
        // 30-day history did not — 3 calls instead of 5.
        fetchAllData('financial');
      } else {
        // A 200 with success:false previously produced no feedback at all.
        const msg = res?.data?.error || 'Payout request failed.';
        logWarn('Payout was not accepted by the server', res?.data);
        setPayoutMessage(msg);
        setPayoutStatus('error');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'Payout request failed.';
      logError('Payout request failed', err?.response?.status, msg);
      setPayoutMessage(msg);
      setPayoutStatus('error');
    } finally {
      if (mountedRef.current) setPayoutLoading(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    log('Requesting Stripe dashboard link');
    try {
      const res = await apiCall({ url: '/v1/stripe/dashboard-link', useCache: false });
      const url = res?.data?.url;

      if (!url || !isSafeStripeUrl(url)) {
        logError('Dashboard link missing or not a Stripe URL', url);
        setError({ source: 'stripe', message: 'Failed to open Stripe dashboard.' });
        return;
      }

      log('Opening Stripe dashboard in a new tab');
      // noopener,noreferrer prevents the opened page from reaching back through
      // window.opener (reverse tabnabbing) and strips the referrer.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logError('Stripe dashboard link request failed', err?.response?.status, err?.message);
      setError({ source: 'stripe', message: 'Failed to open Stripe dashboard.' });
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const payoutThreshold = useMemo(() => {
    const fromApi = toNumber(summary?.payoutThreshold, 0);
    return fromApi > 0 ? fromApi : DEFAULT_PAYOUT_THRESHOLD;
  }, [summary?.payoutThreshold]);

  const availableBalance = toNumber(summary?.currentBalance, 0);

  // Guarded against a zero/absent threshold, which used to produce
  // style={{ width: 'NaN%' }} — an invalid declaration the browser drops,
  // leaving the bar stuck at full width.
  const payoutProgress = useMemo(() => {
    if (!summary || payoutThreshold <= 0) return 0;
    const pct = (availableBalance / payoutThreshold) * 100;
    if (!Number.isFinite(pct) || pct < 0) return 0;
    return Math.round(Math.min(100, pct) * 10) / 10;
  }, [summary, availableBalance, payoutThreshold]);

  const stripeReady = stripeStatus?.onboardingComplete && stripeStatus?.payoutsEnabled;
  const canWithdraw = stripeReady && availableBalance >= payoutThreshold;

  const chartSummary = useMemo(() => {
    if (!history.length) return '';
    const total = history.reduce((sum, day) => sum + toNumber(day.total, 0), 0);
    return `Daily earnings for the last ${history.length} days. Total ${formatMoney(total)}.`;
  }, [history]);

  // ── Tab keyboard navigation (WAI-ARIA tabs pattern) ───────────────────────

  const handleTabKeyDown = (event) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    let nextIndex = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const tabCount = (tabId) => {
    if (tabId === 'referrals') return referrals.length;
    if (tabId === 'payouts') return payouts.length;
    return null;
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="earnings-page">
          <div className="earnings-loading" role="status" aria-live="polite">
            <RefreshCw size={32} className="spin" aria-hidden="true" />
            <p>Loading your earnings...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundImage={backimage}>
      <div className="earnings-page">

        {/* ── Header ── */}
        <div className="earnings-header">
          <div className="earnings-header-text">
            <h1>Earnings</h1>
            <p>Track your revenue from referrals{isArtist ? ', supporters,' : ''} and community engagement.</p>
          </div>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={refreshing ? 'Refreshing earnings' : 'Refresh earnings'}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} aria-hidden="true" />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="earnings-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span className="earnings-error-text">{error.message}</span>
            <button
              type="button"
              className="earnings-error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss message"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Summary Cards ── */}
        <div className="earnings-summary-grid">
          <div className="summary-card summary-card-highlight">
            <div className="card-icon-wrap card-icon-green" aria-hidden="true">
              <DollarSign size={24} />
            </div>
            <div className="card-body">
              <p className="card-label" id="card-label-balance">Current Balance</p>
              <h2 className="card-value" aria-describedby="card-label-balance">{formatMoney(summary?.currentBalance)}</h2>
              <p className="card-sub">This month: {formatMoney(summary?.totalEarnings?.thisMonth)}</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon-wrap card-icon-blue" aria-hidden="true">
              <Users size={24} />
            </div>
            <div className="card-body">
              <p className="card-label" id="card-label-referral">Referral Earnings</p>
              <h2 className="card-value" aria-describedby="card-label-referral">{formatMoney(summary?.referralEarnings?.lifetime)}</h2>
              <p className="card-sub">{summary?.referralCount || 0} referrals · {summary?.referralViewsThisMonth || 0} views this month</p>
            </div>
          </div>

          {isArtist && (
            <div className="summary-card">
              <div className="card-icon-wrap card-icon-purple" aria-hidden="true">
                <TrendingUp size={24} />
              </div>
              <div className="card-body">
                <p className="card-label" id="card-label-supporter">Supporter Earnings</p>
                <h2 className="card-value" aria-describedby="card-label-supporter">{formatMoney(summary?.supporterEarnings?.lifetime)}</h2>
                <p className="card-sub">{summary?.supporterCount || 0} supporters backing you</p>
              </div>
            </div>
          )}

          <div className="summary-card">
            <div className="card-icon-wrap card-icon-gold" aria-hidden="true">
              {summary?.payoutReady ? <CheckCircle size={24} /> : <Clock size={24} />}
            </div>
            <div className="card-body">
              <p className="card-label" id="card-label-payout">Payout Status</p>
              <h2 className="card-value" aria-describedby="card-label-payout">{summary?.payoutReady ? 'Ready!' : 'Building...'}</h2>
              <div className="payout-progress">
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={payoutProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress toward the ${formatMoney(payoutThreshold)} payout minimum`}
                >
                  <div className="progress-fill" style={{ width: `${payoutProgress}%` }} />
                </div>
                <p className="progress-text">
                  {formatMoney(summary?.currentBalance)} / {formatMoney(payoutThreshold)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stripe Connect Banner ── */}
        <div className="stripe-banner">
          {!stripeStatus?.hasAccount ? (
            <div className="stripe-banner-content">
              <div className="stripe-banner-info">
                <CreditCard size={24} aria-hidden="true" />
                <div>
                  <h3>Set Up Payouts</h3>
                  <p>Connect your bank account through Stripe to receive earnings. Takes about 3 minutes.</p>
                </div>
              </div>
              <button
                className="stripe-btn"
                onClick={handleStartOnboarding}
                disabled={stripeLoading}
              >
                {stripeLoading ? 'Setting up...' : 'Get Started'}
                <ExternalLink size={14} aria-hidden="true" />
              </button>
            </div>
          ) : !stripeReady ? (
            <div className="stripe-banner-content stripe-banner-pending">
              <div className="stripe-banner-info">
                <Clock size={24} aria-hidden="true" />
                <div>
                  <h3>Complete Your Setup</h3>
                  <p>Your Stripe account is created but onboarding is incomplete. Finish setup to enable payouts.</p>
                </div>
              </div>
              <button
                className="stripe-btn"
                onClick={handleStartOnboarding}
                disabled={stripeLoading}
              >
                {stripeLoading ? 'Loading...' : 'Continue Setup'}
                <ExternalLink size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="stripe-banner-content stripe-banner-ready">
              <div className="stripe-banner-info">
                <Shield size={24} aria-hidden="true" />
                <div>
                  <h3>Payouts Enabled</h3>
                  <p>Your bank account is connected. Earnings above {formatMoney(payoutThreshold)} can be withdrawn.</p>
                </div>
              </div>
              <div className="stripe-actions">
                {canWithdraw && (
                  <button
                    className="stripe-btn stripe-btn-payout"
                    onClick={handleRequestPayout}
                    disabled={payoutLoading}
                  >
                    {payoutLoading ? 'Processing...' : `Withdraw ${formatMoney(availableBalance)}`}
                  </button>
                )}
                <button className="stripe-btn-secondary" onClick={handleOpenStripeDashboard}>
                  Stripe Dashboard
                  <ExternalLink size={12} aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </button>
              </div>
            </div>
          )}
          {payoutMessage && (
            <div
              className={`payout-message ${payoutStatus === 'success' ? 'success' : 'error'}`}
              role="status"
              aria-live="polite"
            >
              {payoutMessage}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div
          className="earnings-tabs"
          role="tablist"
          aria-label="Earnings sections"
          onKeyDown={handleTabKeyDown}
        >
          {TABS.map((tab) => {
            const count = tabCount(tab.id);
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`earnings-tab-${tab.id}`}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                className={`tab ${isActive ? 'active' : ''}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`earnings-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
              >
                {count === null ? tab.label : `${tab.label} (${count})`}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div className="earnings-tab-content">

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div
              className="overview-content"
              role="tabpanel"
              id="earnings-panel-overview"
              aria-labelledby="earnings-tab-overview"
              tabIndex={0}
            >
              <div className="chart-card">
                <h3>Referral Earnings by Level</h3>
                <div className="level-breakdown">
                  <div className="level-row">
                    <div className="level-label">
                      <span className="level-dot level-dot-1" aria-hidden="true" />
                      <span className="level-name">Level 1 — Direct Referrals</span>
                      <span className="level-pct">10%</span>
                    </div>
                    <span className="level-amount">{formatMoney(summary?.referralEarnings?.level1?.lifetime)}</span>
                  </div>
                  <div className="level-row">
                    <div className="level-label">
                      <span className="level-dot level-dot-2" aria-hidden="true" />
                      <span className="level-name">Level 2 — Your Referrals' Referrals</span>
                      <span className="level-pct">5%</span>
                    </div>
                    <span className="level-amount">{formatMoney(summary?.referralEarnings?.level2?.lifetime)}</span>
                  </div>
                  <div className="level-row">
                    <div className="level-label">
                      <span className="level-dot level-dot-3" aria-hidden="true" />
                      <span className="level-name">Level 3 — Third Degree</span>
                      <span className="level-pct">2%</span>
                    </div>
                    <span className="level-amount">{formatMoney(summary?.referralEarnings?.level3?.lifetime)}</span>
                  </div>
                </div>
              </div>

              <div className="chart-card">
                <h3>Last {HISTORY_DAYS} Days</h3>
                {history.length > 0 ? (
                  <div className="mini-chart" role="img" aria-label={chartSummary}>
                    {(() => {
                      const values = history.map((d) => toNumber(d.total, 0));
                      const maxVal = Math.max(...values);
                      const minVal = Math.min(...values);
                      const range = maxVal - minVal;
                      return history.map((day, i) => {
                        const val = toNumber(day.total, 0);
                        const height = range === 0 ? 50 : Math.max(6, ((val - minVal) / range) * 90 + 10);
                        return (
                          <div
                            key={day.date || i}
                            className="chart-bar-wrap"
                            title={`${day.date}: ${formatMoney(day.total)}`}
                            aria-hidden="true"
                          >
                            <div className="chart-bar" style={{ height: `${height}%` }} />
                            <span className="chart-date">{String(day.date || '').slice(5)}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="empty-chart">
                    <p>No earnings activity yet. Share your referral code to start earning!</p>
                  </div>
                )}
              </div>

              <div className="split-card">
                <h3>Your Revenue Streams</h3>
                <div className="split-items">
                  <div className="split-item">
                    <div className="split-dot split-dot-blue" aria-hidden="true" />
                    <div className="split-info">
                      <strong>Referral Income (up to 17%)</strong>
                      <p>Level 1: 10% from users you directly referred. Level 2: 5% from their referrals. Level 3: 2% from their referrals' referrals. Lifetime passive income — forever.</p>
                    </div>
                  </div>
                  {isArtist && (
                    <div className="split-item">
                      <div className="split-dot split-dot-purple" aria-hidden="true" />
                      <div className="split-info">
                        <strong>Supporter Income (15%)</strong>
                        <p>Users who chose to support you contribute 15% of their ad revenue to your career.</p>
                      </div>
                    </div>
                  )}
                  <div className="split-item">
                    <div className="split-dot split-dot-gold" aria-hidden="true" />
                    <div className="split-info">
                      <strong>Audio Ad Revenue (Coming Soon)</strong>
                      <p>Pre-roll ads on songs. Artists earn 60% of net revenue. Referral pool splits 10/5/2% across 3 levels.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Referrals Tab */}
          {activeTab === 'referrals' && (
            <div
              className="referrals-content"
              role="tabpanel"
              id="earnings-panel-referrals"
              aria-labelledby="earnings-tab-referrals"
              tabIndex={0}
            >
              {referrals.length > 0 ? (
                <>
                  <ul className="referral-list">
                    {referrals.slice(0, visibleReferrals).map((ref, i) => (
                      <li key={ref.userId || i} className="referral-item">
                        <img
                          src={buildUrl(ref.photoUrl) || backimage}
                          alt={ref.username}
                          className="referral-photo"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { e.currentTarget.src = backimage; }}
                        />
                        <div className="referral-info">
                          <span className="referral-name">{ref.username}</span>
                          <span className="referral-views">{ref.adViews || 0} ad views</span>
                        </div>
                        <div className="referral-earnings">
                          <span className="referral-amount">{formatMoney(ref.earnings)}</span>
                          <ArrowUpRight size={14} className="referral-arrow" aria-hidden="true" />
                        </div>
                      </li>
                    ))}
                  </ul>
                  {referrals.length > visibleReferrals && (
                    <button
                      type="button"
                      className="load-more-btn"
                      onClick={() => setVisibleReferrals((n) => n + REFERRALS_PAGE_SIZE)}
                    >
                      Show more referrals ({referrals.length - visibleReferrals} remaining)
                    </button>
                  )}
                </>
              ) : (
                <div className="empty-referrals">
                  <Users size={48} aria-hidden="true" />
                  <h3>No Referrals Yet</h3>
                  <p>Share your referral code to invite friends. Every person you bring earns you passive income — for life.</p>
                </div>
              )}
            </div>
          )}

          {/* Payouts Tab */}
          {activeTab === 'payouts' && (
            <div
              className="payouts-content"
              role="tabpanel"
              id="earnings-panel-payouts"
              aria-labelledby="earnings-tab-payouts"
              tabIndex={0}
            >
              {!stripeReady && (
                <div className="payouts-setup-prompt">
                  <CreditCard size={40} aria-hidden="true" />
                  <h3>Set Up Stripe to Receive Payouts</h3>
                  <p>Connect your bank account through Stripe to withdraw your earnings. It only takes a few minutes.</p>
                  <button className="stripe-btn" onClick={handleStartOnboarding} disabled={stripeLoading}>
                    {stripeLoading ? 'Setting up...' : 'Set Up Now'}
                  </button>
                </div>
              )}

              {payouts.length > 0 ? (
                <div className="payout-list">
                  <h3>Payout History</h3>
                  <ul className="payout-list-items">
                    {payouts.slice(0, visiblePayouts).map((p, i) => (
                      <li key={p.payoutId || i} className="payout-item">
                        <div className="payout-item-left">
                          <div className={`payout-status-dot ${p.status}`} aria-hidden="true" />
                          <div className="payout-item-info">
                            <span className="payout-item-amount">{formatMoney(p.amount)}</span>
                            <span className="payout-item-period">
                              {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                            </span>
                          </div>
                        </div>
                        <div className="payout-item-right">
                          <span className={`payout-item-status ${p.status}`}>{p.status}</span>
                          <span className="payout-item-date">{formatDate(p.createdAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {payouts.length > visiblePayouts && (
                    <button
                      type="button"
                      className="load-more-btn"
                      onClick={() => setVisiblePayouts((n) => n + PAYOUTS_PAGE_SIZE)}
                    >
                      Show more payouts ({payouts.length - visiblePayouts} remaining)
                    </button>
                  )}
                </div>
              ) : stripeReady ? (
                <div className="empty-payouts">
                  <DollarSign size={48} aria-hidden="true" />
                  <h3>No Payouts Yet</h3>
                  <p>Once your balance reaches {formatMoney(payoutThreshold)}, you can request a withdrawal here.</p>
                </div>
              ) : null}
            </div>
          )}

          {/* How It Works Tab */}
          {activeTab === 'how' && (
            <div
              className="how-content"
              role="tabpanel"
              id="earnings-panel-how"
              aria-labelledby="earnings-tab-how"
              tabIndex={0}
            >
              <div className="how-section">
                <h3>Display Ad Revenue Split</h3>
                <div className="how-visual">
                  {/* The bar is decorative — the legend below carries the same
                      information as text, so meaning is never colour-only. */}
                  <div className="how-bar" aria-hidden="true">
                    {DISPLAY_AD_SPLIT.map((seg) => (
                      <div
                        key={seg.key}
                        className={`how-segment how-segment-${seg.tone}`}
                        style={{ width: `${seg.width}%` }}
                      >
                        <span>{seg.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="how-legend">
                    {DISPLAY_AD_SPLIT.map((seg) => (
                      <span key={seg.key}>
                        <span className={`legend-dot legend-dot-${seg.tone}`} aria-hidden="true" /> {seg.legend}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="how-note">Every ad view is tracked and attributed. If any referral level doesn't exist, that share goes to Unis.</p>
              </div>

              <div className="how-section">
                <h3>Audio Ad Revenue Split (Coming Soon)</h3>
                <div className="how-visual">
                  <div className="how-bar" aria-hidden="true">
                    {AUDIO_AD_SPLIT.map((seg) => (
                      <div
                        key={seg.key}
                        className={`how-segment how-segment-${seg.tone}`}
                        style={{ width: `${seg.width}%` }}
                      >
                        <span>{seg.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Added — the audio bar previously had no text equivalent at
                      all, so its breakdown was invisible to screen readers. */}
                  <div className="how-legend">
                    {AUDIO_AD_SPLIT.map((seg) => (
                      <span key={seg.key}>
                        <span className={`legend-dot legend-dot-${seg.tone}`} aria-hidden="true" /> {seg.legend}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="how-note">Pre-roll audio ads before songs. After compulsory royalty payments, net revenue splits across the artist, Unis, and the 3-level referral chain.</p>
              </div>

              <div className="how-section">
                <h3>3-Level Referral Chain</h3>
                <div className="chain-visual">
                  <div className="chain-node chain-you">YOU</div>
                  <div className="chain-arrow" aria-hidden="true">↓ refers</div>
                  <div className="chain-node chain-l1">User A <span className="chain-tag">You earn 10%</span></div>
                  <div className="chain-arrow" aria-hidden="true">↓ refers</div>
                  <div className="chain-node chain-l2">User B <span className="chain-tag">You earn 5%</span></div>
                  <div className="chain-arrow" aria-hidden="true">↓ refers</div>
                  <div className="chain-node chain-l3">User C <span className="chain-tag">You earn 2%</span></div>
                </div>
                <p className="how-note">When anyone in your 3-level chain browses Unis and sees ads, you earn. This is lifetime passive income.</p>
              </div>

              <div className="how-section">
                <h3>Payout Rules</h3>
                <ul className="how-rules">
                  <li>Minimum payout: <strong>{formatMoney(payoutThreshold)}</strong></li>
                  <li>Payout frequency: <strong>Monthly</strong> (first week of following month)</li>
                  <li>Earnings under {formatMoney(payoutThreshold)} roll over — nothing is lost</li>
                  <li>Payment via Stripe Connect (direct bank deposit)</li>
                  <li>1099-NEC issued for US users earning over $600/year</li>
                </ul>
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default Earnings;