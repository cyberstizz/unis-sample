import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  ShoppingBag,
  Share2,
  Heart,
  ChevronDown,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import CashoutPanel from './CashoutPanel';
import './revenueSection.scss';

// ---------------------------------------------------------------------------
// Money helpers. Sales come back as integer cents; the earnings summary
// returns decimal dollars (BigDecimal). Everything is normalised to cents
// internally so the UI formats one way.
// ---------------------------------------------------------------------------
const money = (cents) =>
  `$${(Number(cents || 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toCents = (dollars) => Math.round(Number(dollars || 0) * 100);

const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// A single labelled value row inside an expanded stream detail.
// ---------------------------------------------------------------------------
const DetailRow = ({ label, sub, value, accent = false }) => (
  <div className={`rev-detail__row ${accent ? 'rev-detail__row--accent' : ''}`}>
    <div className="rev-detail__row-label">
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
    <strong>{value}</strong>
  </div>
);

const RevenueSection = ({
  artistId,
  artistPhoto,                 // ★ ambient backdrop (already a built URL from the dashboard)
  earningsSummary,             // /v1/earnings/my-summary payload
  stripeStatus,
  payoutHistory = [],
  isStripeReady = false,
  onPayoutSuccess,             // refresh parent stats after a payout
}) => {
  const [salesTotal, setSalesTotal] = useState(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [openStream, setOpenStream] = useState(null); // null | 'sales' | 'referrals' | 'supporters'

  // -- artist-level sales aggregate (new endpoint; per-song detail still lives
  //    in SongSalesModal, reachable from each catalog card) --
  useEffect(() => {
    if (!artistId) return;
    let cancelled = false;
    setSalesLoading(true);
    apiCall({
      url: `/v1/artist-analytics/artist/${artistId}/sales-total`,
      method: 'get',
      useCache: false,
    })
      .then((res) => { if (!cancelled) setSalesTotal(res.data || null); })
      .catch(() => { if (!cancelled) setSalesTotal(null); })
      .finally(() => { if (!cancelled) setSalesLoading(false); });
    return () => { cancelled = true; };
  }, [artistId]);

  // -- cashout handlers (lifted verbatim from the old inline revenue block) --
  const handleRequestPayout = useCallback(async () => {
    const res = await apiCall({ url: '/v1/stripe/payout', method: 'post' });
    if (res.data?.success) onPayoutSuccess?.();
  }, [onPayoutSuccess]);

  const handleConnectStripe = useCallback(async () => {
    const res = await apiCall({ url: '/v1/stripe/onboard', method: 'post' });
    if (res.data?.url) window.location.href = res.data.url;
  }, []);

  // -- derive the three streams (all in cents) --
  const copies = Number(salesTotal?.copies || 0);
  const salesGrossCents = Number(salesTotal?.grossCents || 0);
  const salesNetCents = Number(salesTotal?.netCents || 0);

  const ref = earningsSummary?.referralEarnings || {};
  const referralCents = toCents(ref.lifetime);
  const referralMonthCents = toCents(ref.thisMonth);
  const l1 = ref.level1 || {};
  const l2 = ref.level2 || {};
  const l3 = ref.level3 || {};
  const referralCount = Number(earningsSummary?.referralCount || 0);
  const referralViews = Number(earningsSummary?.referralViewsThisMonth || 0);

  const sup = earningsSummary?.supporterEarnings || {};
  const supporterCents = toCents(sup.lifetime);
  const supporterMonthCents = toCents(sup.thisMonth);
  const supporterCount = Number(earningsSummary?.supporterCount || 0);

  const balanceCents = toCents(earningsSummary?.currentBalance);
  const minimumPayoutCents = toCents(earningsSummary?.payoutThreshold) || 5000;

  const streams = [
    {
      key: 'sales',
      label: 'Sales',
      icon: ShoppingBag,
      amount: salesNetCents,
      loading: salesLoading,
      sub: copies > 0 ? plural(copies, 'copy sold', 'copies sold') : 'No sales yet',
    },
    {
      key: 'referrals',
      label: 'Referrals',
      icon: Share2,
      amount: referralCents,
      loading: false,
      sub: plural(referralCount, 'referral', 'referrals'),
    },
    {
      key: 'supporters',
      label: 'Supporters',
      icon: Heart,
      amount: supporterCents,
      loading: false,
      sub: plural(supporterCount, 'supporter', 'supporters'),
    },
  ];

  const toggle = (key) => setOpenStream((cur) => (cur === key ? null : key));

  return (
    <section id="nav-revenue" className="rev-section">
      {/* ★ ambient: blurred profile image, same recipe as the collapsibles */}
      {artistPhoto && (
        <div
          className="rev-ambient"
          style={{ backgroundImage: `url(${artistPhoto})` }}
          aria-hidden="true"
        />
      )}

      <div className="rev-head">
        <div>
          <span className="artist-section__eyebrow">Revenue</span>
          <h2>Earnings <em>&amp; cashout</em></h2>
        </div>
        <div className={`rev-status-pill ${isStripeReady ? 'is-ready' : ''}`}>
          <DollarSign size={13} />
          {isStripeReady ? 'Payout ready' : 'Setup needed'}
        </div>
      </div>

      <p className="rev-intro">
        Your three income streams at a glance. Tap any one to see how it breaks down.
      </p>

      {/* ── the three top-level streams ── */}
      <div className="rev-streams">
        {streams.map(({ key, label, icon: Icon, amount, sub, loading }) => {
          const isOpen = openStream === key;
          return (
            <button
              key={key}
              type="button"
              className={`rev-stream ${isOpen ? 'is-open' : ''}`}
              onClick={() => toggle(key)}
              aria-expanded={isOpen}
            >
              <div className="rev-stream__top">
                <span className="rev-stream__icon"><Icon size={17} /></span>
                <ChevronDown size={16} className="rev-stream__chev" />
              </div>
              <span className="rev-stream__label">{label}</span>
              <strong className="rev-stream__amount">
                {loading ? <span className="rev-stream__skeleton" /> : money(amount)}
              </strong>
              <span className="rev-stream__sub">{sub}</span>
            </button>
          );
        })}
      </div>

      {/* ── expanded detail for the open stream ── */}
      {openStream === 'sales' && (
        <div className="rev-detail">
          <DetailRow label="Copies sold" value={copies.toLocaleString()} />
          <DetailRow label="Gross sales" sub="Before platform fee" value={money(salesGrossCents)} />
          <DetailRow label="Your cut" sub="Net to you" value={money(salesNetCents)} accent />
          <p className="rev-detail__note">
            <TrendingUp size={13} />
            Open any track in your catalog for its day-by-day sales trend.
          </p>
        </div>
      )}

      {openStream === 'referrals' && (
        <div className="rev-detail">
          <DetailRow
            label="Tier 1 · direct"
            sub="10% of referred ad revenue"
            value={money(toCents(l1.lifetime))}
          />
          <DetailRow
            label="Tier 2"
            sub="5% of their referrals"
            value={money(toCents(l2.lifetime))}
          />
          <DetailRow
            label="Tier 3"
            sub="2%, one level deeper"
            value={money(toCents(l3.lifetime))}
          />
          <DetailRow label="This month" value={money(referralMonthCents)} accent />
          <p className="rev-detail__note">
            <ArrowUpRight size={13} />
            {plural(referralCount, 'person in your network', 'people in your network')}
            {referralViews > 0 ? ` · ${referralViews.toLocaleString()} ad-views this month` : ''}
          </p>
        </div>
      )}

      {openStream === 'supporters' && (
        <div className="rev-detail">
          <DetailRow label="Lifetime" value={money(supporterCents)} />
          <DetailRow label="This month" value={money(supporterMonthCents)} accent />
          <DetailRow label="Backed by" value={plural(supporterCount, 'supporter', 'supporters')} />
          <p className="rev-detail__note">
            <Heart size={13} />
            You earn 15% of the ad revenue from listeners who name you as their artist.
          </p>
        </div>
      )}

      {/* ── balance + cashout (themed, working tracker preserved) ── */}
      <div className="rev-cashout">
        <CashoutPanel
          balance={balanceCents}
          pendingBalance={0}
          minimumPayout={minimumPayoutCents}
          stripeConnected={isStripeReady}
          onRequestPayout={handleRequestPayout}
          onConnectStripe={handleConnectStripe}
          payoutHistory={(payoutHistory || []).map((p) => ({
            id: p.payoutId,
            amount: Math.round(parseFloat(p.amount || 0) * 100),
            status: p.status || 'pending',
            date: p.createdAt,
          }))}
        />
      </div>
    </section>
  );
};

export default RevenueSection;