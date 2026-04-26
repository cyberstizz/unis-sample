import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import {
  DollarSign, Users, TrendingUp, ArrowUpRight,
  Clock, CheckCircle, AlertCircle, RefreshCw,
  CreditCard, ExternalLink, Shield
} from 'lucide-react';
import './earnings.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const Earnings = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [history, setHistory] = useState([]);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');

  const isArtist = user?.role === 'artist' || user?.isArtist;

  // Check for Stripe return URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeParam = params.get('stripe');
    if (stripeParam === 'complete') {
      setActiveTab('payouts');
      // Clean URL
      window.history.replaceState({}, '', '/earnings');
    } else if (stripeParam === 'refresh') {
      // User needs to restart onboarding
      setError('Stripe onboarding was not completed. Please try again.');
      window.history.replaceState({}, '', '/earnings');
    }
  }, []);

  useEffect(() => {
    if (!user?.userId) return;
    fetchAllData();
  }, [user?.userId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [summaryRes, referralsRes, historyRes, stripeRes, payoutsRes] = await Promise.allSettled([
        apiCall({ url: '/v1/earnings/my-summary', useCache: false }),
        apiCall({ url: '/v1/earnings/my-referrals', useCache: false }),
        apiCall({ url: '/v1/earnings/my-history?days=30', useCache: false }),
        apiCall({ url: '/v1/stripe/status', useCache: false }),
        apiCall({ url: '/v1/stripe/payouts', useCache: false }),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (referralsRes.status === 'fulfilled') setReferrals(referralsRes.value.data || []);
      if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data || []);
      if (stripeRes.status === 'fulfilled') setStripeStatus(stripeRes.value.data);
      if (payoutsRes.status === 'fulfilled') setPayouts(payoutsRes.value.data || []);
      // Only clear a pre-existing error after a successful load. Clearing it
      // preemptively at the top would clobber the ?stripe=refresh error set
      // by the mount effect.
      setError((prev) => (prev === 'Failed to load earnings data.' ? '' : prev));
    } catch (err) {
      console.error('Failed to load earnings:', err);
      setError('Failed to load earnings data.');
    } finally {
      setLoading(false);
    }
  };

  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  const formatMoney = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    const num = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return `$${num.toFixed(num < 0.01 && num > 0 ? 6 : num < 1 && num > 0 ? 4 : 2)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Stripe Actions ──

  const handleStartOnboarding = async () => {
    setStripeLoading(true);
    try {
      const res = await apiCall({ url: '/v1/stripe/onboard', method: 'post' });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      setError('Failed to start Stripe setup. Please try again.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    setPayoutLoading(true);
    setPayoutMessage('');
    try {
      const res = await apiCall({ url: '/v1/stripe/payout', method: 'post' });
      if (res.data?.success) {
        setPayoutMessage(`Payout of ${formatMoney(res.data.amount)} initiated successfully!`);
        fetchAllData(); // Refresh everything
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Payout request failed.';
      setPayoutMessage(msg);
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    try {
      const res = await apiCall({ url: '/v1/stripe/dashboard-link', useCache: false });
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } catch (err) {
      setError('Failed to open Stripe dashboard.');
    }
  };

  // ── Loading ──

  if (loading) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="earnings-page">
          <div className="earnings-loading">
            <RefreshCw size={32} className="spin" />
            <p>Loading your earnings...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const payoutProgress = summary
    ? Math.min(100, (parseFloat(summary.currentBalance) / parseFloat(summary.payoutThreshold)) * 100)
    : 0;

  const stripeReady = stripeStatus?.onboardingComplete && stripeStatus?.payoutsEnabled;
  const availableBalance = parseFloat(summary?.currentBalance || 0);

  return (
    <Layout backgroundImage={backimage}>
      <div className="earnings-page">

        {/* ── Header ── */}
        <div className="earnings-header">
          <div className="earnings-header-text">
            <h1>Earnings</h1>
            <p>Track your revenue from referrals{isArtist ? ', supporters,' : ''} and community engagement.</p>
          </div>
          <button className="refresh-btn" onClick={fetchAllData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {error && (
          <div className="earnings-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── Summary Cards ── */}
        <div className="earnings-summary-grid">
          <div className="summary-card summary-card-highlight">
            <div className="card-icon-wrap card-icon-green">
              <DollarSign size={24} />
            </div>
            <div className="card-body">
              <p className="card-label">Current Balance</p>
              <h2 className="card-value">{formatMoney(summary?.currentBalance)}</h2>
              <p className="card-sub">This month: {formatMoney(summary?.totalEarnings?.thisMonth)}</p>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon-wrap card-icon-blue">
              <Users size={24} />
            </div>
            <div className="card-body">
              <p className="card-label">Referral Earnings</p>
              <h2 className="card-value">{formatMoney(summary?.referralEarnings?.lifetime)}</h2>
              <p className="card-sub">{summary?.referralCount || 0} referrals · {summary?.referralViewsThisMonth || 0} views this month</p>
            </div>
          </div>

          {isArtist && (
            <div className="summary-card">
              <div className="card-icon-wrap card-icon-purple">
                <TrendingUp size={24} />
              </div>
              <div className="card-body">
                <p className="card-label">Supporter Earnings</p>
                <h2 className="card-value">{formatMoney(summary?.supporterEarnings?.lifetime)}</h2>
                <p className="card-sub">{summary?.supporterCount || 0} supporters backing you</p>
              </div>
            </div>
          )}

          <div className="summary-card">
            <div className="card-icon-wrap card-icon-gold">
              {summary?.payoutReady ? <CheckCircle size={24} /> : <Clock size={24} />}
            </div>
            <div className="card-body">
              <p className="card-label">Payout Status</p>
              <h2 className="card-value">{summary?.payoutReady ? 'Ready!' : 'Building...'}</h2>
              <div className="payout-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${payoutProgress}%` }} />
                </div>
                <p className="progress-text">
                  {formatMoney(summary?.currentBalance)} / {formatMoney(summary?.payoutThreshold)}
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
                <CreditCard size={24} />
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
                <ExternalLink size={14} />
              </button>
            </div>
          ) : !stripeReady ? (
            <div className="stripe-banner-content stripe-banner-pending">
              <div className="stripe-banner-info">
                <Clock size={24} />
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
                <ExternalLink size={14} />
              </button>
            </div>
          ) : (
            <div className="stripe-banner-content stripe-banner-ready">
              <div className="stripe-banner-info">
                <Shield size={24} />
                <div>
                  <h3>Payouts Enabled</h3>
                  <p>Your bank account is connected. Earnings above $50 can be withdrawn.</p>
                </div>
              </div>
              <div className="stripe-actions">
                {availableBalance >= 50 && (
                  <button
                    className="stripe-btn stripe-btn-payout"
                    onClick={handleRequestPayout}
                    disabled={payoutLoading}
                  >
                    {payoutLoading ? 'Processing...' : `Withdraw ${formatMoney(availableBalance)}`}
                  </button>
                )}
                <button className="stripe-btn-secondary" onClick={handleOpenStripeDashboard}>
                  Stripe Dashboard <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
          {payoutMessage && (
            <div className={`payout-message ${payoutMessage.includes('success') ? 'success' : 'error'}`}>
              {payoutMessage}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="earnings-tabs">
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          <button className={`tab ${activeTab === 'referrals' ? 'active' : ''}`} onClick={() => setActiveTab('referrals')}>
            My Referrals ({referrals.length})
          </button>
          <button className={`tab ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>
            Payouts ({payouts.length})
          </button>
          <button className={`tab ${activeTab === 'how' ? 'active' : ''}`} onClick={() => setActiveTab('how')}>
            How It Works
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div className="earnings-tab-content">

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-content">
              <div className="chart-card">
                <h3>Referral Earnings by Level</h3>
                <div className="level-breakdown">
                  <div className="level-row">
                    <div className="level-label">
                      <span className="level-dot" style={{ background: '#3b82f6' }} />
                      <span className="level-name">Level 1 — Direct Referrals</span>
                      <span className="level-pct">10%</span>
                    </div>
                    <span className="level-amount">{formatMoney(summary?.referralEarnings?.level1?.lifetime)}</span>
                  </div>
                  <div className="level-row">
                    <div className="level-label">
                      <span className="level-dot" style={{ background: '#8b5cf6' }} />
                      <span className="level-name">Level 2 — Your Referrals' Referrals</span>
                      <span className="level-pct">5%</span>
                    </div>
                    <span className="level-amount">{formatMoney(summary?.referralEarnings?.level2?.lifetime)}</span>
                  </div>
                  <div className="level-row">
                    <div className="level-label">
                      <span className="level-dot" style={{ background: '#06b6d4' }} />
                      <span className="level-name">Level 3 — Third Degree</span>
                      <span className="level-pct">2%</span>
                    </div>
                    <span className="level-amount">{formatMoney(summary?.referralEarnings?.level3?.lifetime)}</span>
                  </div>
                </div>
              </div>

              <div className="chart-card">
                <h3>Last 30 Days</h3>
                {history.length > 0 ? (
                  <div className="mini-chart">
                    {(() => {
                      const values = history.map(d => parseFloat(d.total) || 0);
                      const maxVal = Math.max(...values);
                      const minVal = Math.min(...values);
                      const range = maxVal - minVal;
                      return history.map((day, i) => {
                        const val = parseFloat(day.total) || 0;
                        const height = range === 0 ? 50 : Math.max(6, ((val - minVal) / range) * 90 + 10);
                        return (
                          <div key={i} className="chart-bar-wrap" title={`${day.date}: ${formatMoney(day.total)}`}>
                            <div className="chart-bar" style={{ height: `${height}%` }} />
                            <span className="chart-date">{day.date.slice(5)}</span>
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
                    <div className="split-dot" style={{ background: '#3b82f6' }} />
                    <div className="split-info">
                      <strong>Referral Income (up to 17%)</strong>
                      <p>Level 1: 10% from users you directly referred. Level 2: 5% from their referrals. Level 3: 2% from their referrals' referrals. Lifetime passive income — forever.</p>
                    </div>
                  </div>
                  {isArtist && (
                    <div className="split-item">
                      <div className="split-dot" style={{ background: '#a855f7' }} />
                      <div className="split-info">
                        <strong>Supporter Income (15%)</strong>
                        <p>Users who chose to support you contribute 15% of their ad revenue to your career.</p>
                      </div>
                    </div>
                  )}
                  <div className="split-item">
                    <div className="split-dot" style={{ background: '#f59e0b' }} />
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
            <div className="referrals-content">
              {referrals.length > 0 ? (
                <div className="referral-list">
                  {referrals.map((ref, i) => (
                    <div key={ref.userId || i} className="referral-item">
                      <img src={ref.photoUrl ? buildUrl(ref.photoUrl) : backimage} alt={ref.username} className="referral-photo" />
                      <div className="referral-info">
                        <span className="referral-name">{ref.username}</span>
                        <span className="referral-views">{ref.adViews || 0} ad views</span>
                      </div>
                      <div className="referral-earnings">
                        <span className="referral-amount">{formatMoney(ref.earnings)}</span>
                        <ArrowUpRight size={14} className="referral-arrow" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-referrals">
                  <Users size={48} />
                  <h3>No Referrals Yet</h3>
                  <p>Share your referral code to invite friends. Every person you bring earns you passive income — for life.</p>
                </div>
              )}
            </div>
          )}

          {/* Payouts Tab */}
          {activeTab === 'payouts' && (
            <div className="payouts-content">
              {!stripeReady && (
                <div className="payouts-setup-prompt">
                  <CreditCard size={40} />
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
                  {payouts.map((p, i) => (
                    <div key={p.payoutId || i} className="payout-item">
                      <div className="payout-item-left">
                        <div className={`payout-status-dot ${p.status}`} />
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
                    </div>
                  ))}
                </div>
              ) : stripeReady ? (
                <div className="empty-payouts">
                  <DollarSign size={48} />
                  <h3>No Payouts Yet</h3>
                  <p>Once your balance reaches $50, you can request a withdrawal here.</p>
                </div>
              ) : null}
            </div>
          )}

          {/* How It Works Tab */}
          {activeTab === 'how' && (
            <div className="how-content">
              <div className="how-section">
                <h3>Display Ad Revenue Split</h3>
                <div className="how-visual">
                  <div className="how-bar">
                    <div className="how-segment" style={{ width: '68%', background: '#163387' }}><span>Unis 68%</span></div>
                    <div className="how-segment" style={{ width: '15%', background: '#a855f7' }}><span>Artist 15%</span></div>
                    <div className="how-segment" style={{ width: '10%', background: '#3b82f6' }}><span>L1 10%</span></div>
                    <div className="how-segment" style={{ width: '5%', background: '#8b5cf6' }}><span>L2</span></div>
                    <div className="how-segment" style={{ width: '2%', background: '#06b6d4' }}><span></span></div>
                  </div>
                  <div className="how-legend">
                    <span><span className="legend-dot" style={{ background: '#163387' }} /> Unis (68%)</span>
                    <span><span className="legend-dot" style={{ background: '#a855f7' }} /> Supported Artist (15%)</span>
                    <span><span className="legend-dot" style={{ background: '#3b82f6' }} /> Level 1 Referrer (10%)</span>
                    <span><span className="legend-dot" style={{ background: '#8b5cf6' }} /> Level 2 Referrer (5%)</span>
                    <span><span className="legend-dot" style={{ background: '#06b6d4' }} /> Level 3 Referrer (2%)</span>
                  </div>
                </div>
                <p className="how-note">Every ad view is tracked and attributed. If any referral level doesn't exist, that share goes to Unis.</p>
              </div>

              <div className="how-section">
                <h3>Audio Ad Revenue Split (Coming Soon)</h3>
                <div className="how-visual">
                  <div className="how-bar">
                    <div className="how-segment" style={{ width: '60%', background: '#22c55e' }}><span>Artist 60%</span></div>
                    <div className="how-segment" style={{ width: '23%', background: '#163387' }}><span>Unis 23%</span></div>
                    <div className="how-segment" style={{ width: '10%', background: '#3b82f6' }}><span>L1 10%</span></div>
                    <div className="how-segment" style={{ width: '5%', background: '#8b5cf6' }}><span>L2</span></div>
                    <div className="how-segment" style={{ width: '2%', background: '#06b6d4' }}><span></span></div>
                  </div>
                </div>
                <p className="how-note">Pre-roll audio ads before songs. After compulsory royalty payments, net revenue splits across the artist, Unis, and the 3-level referral chain.</p>
              </div>

              <div className="how-section">
                <h3>3-Level Referral Chain</h3>
                <div className="chain-visual">
                  <div className="chain-node chain-you">YOU</div>
                  <div className="chain-arrow">↓ refers</div>
                  <div className="chain-node chain-l1">User A <span className="chain-tag">You earn 10%</span></div>
                  <div className="chain-arrow">↓ refers</div>
                  <div className="chain-node chain-l2">User B <span className="chain-tag">You earn 5%</span></div>
                  <div className="chain-arrow">↓ refers</div>
                  <div className="chain-node chain-l3">User C <span className="chain-tag">You earn 2%</span></div>
                </div>
                <p className="how-note">When anyone in your 3-level chain browses Unis and sees ads, you earn. This is lifetime passive income.</p>
              </div>

              <div className="how-section">
                <h3>Payout Rules</h3>
                <ul className="how-rules">
                  <li>Minimum payout: <strong>$50.00</strong></li>
                  <li>Payout frequency: <strong>Monthly</strong> (first week of following month)</li>
                  <li>Earnings under $50 roll over — nothing is lost</li>
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