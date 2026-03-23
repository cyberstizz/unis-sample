import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import {
  DollarSign, Users, TrendingUp, ArrowUpRight,
  Clock, CheckCircle, AlertCircle, ChevronRight, RefreshCw
} from 'lucide-react';
import './earnings.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const Earnings = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const isArtist = user?.role === 'artist' || user?.isArtist;

  useEffect(() => {
    if (!user?.userId) return;
    fetchEarningsData();
  }, [user?.userId]);

  const fetchEarningsData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, referralsRes, historyRes] = await Promise.allSettled([
        apiCall({ url: '/v1/earnings/my-summary', useCache: false }),
        apiCall({ url: '/v1/earnings/my-referrals', useCache: false }),
        apiCall({ url: '/v1/earnings/my-history?days=30', useCache: false }),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (referralsRes.status === 'fulfilled') setReferrals(referralsRes.value.data || []);
      if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data || []);
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
    return `$${num.toFixed(num < 1 && num > 0 ? 4 : 2)}`;
  };

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

  return (
    <Layout backgroundImage={backimage}>
      <div className="earnings-page">

        {/* ── Header ── */}
        <div className="earnings-header">
          <div className="earnings-header-text">
            <h1>Earnings</h1>
            <p>Track your revenue from referrals{isArtist ? ', supporters,' : ''} and community engagement.</p>
          </div>
          <button className="refresh-btn" onClick={fetchEarningsData}>
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
          {/* Total Balance */}
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

          {/* Referral Earnings */}
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

          {/* Supporter Earnings (Artists only) */}
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

          {/* Payout Status */}
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

        {/* ── Tabs ── */}
        <div className="earnings-tabs">
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          <button className={`tab ${activeTab === 'referrals' ? 'active' : ''}`} onClick={() => setActiveTab('referrals')}>
            My Referrals ({referrals.length})
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
              {/* Daily Chart */}
              <div className="chart-card">
                <h3>Last 30 Days</h3>
                {history.length > 0 ? (
                  <div className="mini-chart">
                    {history.map((day, i) => {
                      const maxTotal = Math.max(...history.map(d => parseFloat(d.total) || 0), 0.001);
                      const height = Math.max(4, (parseFloat(day.total) / maxTotal) * 100);
                      return (
                        <div key={i} className="chart-bar-wrap" title={`${day.date}: ${formatMoney(day.total)}`}>
                          <div className="chart-bar" style={{ height: `${height}%` }} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-chart">
                    <p>No earnings activity yet. Share your referral code to start earning!</p>
                  </div>
                )}
              </div>

              {/* Revenue Split Explainer */}
              <div className="split-card">
                <h3>Your Revenue Streams</h3>
                <div className="split-items">
                  <div className="split-item">
                    <div className="split-dot" style={{ background: '#3b82f6' }} />
                    <div className="split-info">
                      <strong>Referral Income (10%)</strong>
                      <p>Every user you refer generates ad revenue. You earn 10% of that revenue — forever.</p>
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
                      <p>Pre-roll ads on songs. Artists earn 60% of net revenue from their streams.</p>
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
                      <img
                        src={ref.photoUrl ? buildUrl(ref.photoUrl) : backimage}
                        alt={ref.username}
                        className="referral-photo"
                      />
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

          {/* How It Works Tab */}
          {activeTab === 'how' && (
            <div className="how-content">
              <div className="how-section">
                <h3>Display Ad Revenue Split</h3>
                <div className="how-visual">
                  <div className="how-bar">
                    <div className="how-segment" style={{ width: '75%', background: '#163387' }}>
                      <span>Unis 75%</span>
                    </div>
                    <div className="how-segment" style={{ width: '15%', background: '#a855f7' }}>
                      <span>Artist 15%</span>
                    </div>
                    <div className="how-segment" style={{ width: '10%', background: '#3b82f6' }}>
                      <span>Referrer 10%</span>
                    </div>
                  </div>
                </div>
                <p className="how-note">Every ad view is tracked and attributed. Your referrer earns when you browse. The artist you support earns when you browse. Everyone wins.</p>
              </div>

              <div className="how-section">
                <h3>Audio Ad Revenue Split (Coming Soon)</h3>
                <div className="how-visual">
                  <div className="how-bar">
                    <div className="how-segment" style={{ width: '60%', background: '#22c55e' }}>
                      <span>Artist 60%</span>
                    </div>
                    <div className="how-segment" style={{ width: '20%', background: '#163387' }}>
                      <span>Unis 20%</span>
                    </div>
                    <div className="how-segment" style={{ width: '20%', background: '#3b82f6' }}>
                      <span>Referral Pool 20%</span>
                    </div>
                  </div>
                </div>
                <p className="how-note">Pre-roll audio ads before songs. After compulsory royalty payments, the net revenue splits 60/20/20. The referral pool is distributed up to 3 levels deep (10% / 5% / 2%), with unclaimed remainder going to Unis.</p>
              </div>

              <div className="how-section">
                <h3>Payout Rules</h3>
                <ul className="how-rules">
                  <li>Minimum payout: <strong>$50.00</strong></li>
                  <li>Payout frequency: <strong>Monthly</strong> (first week of following month)</li>
                  <li>Earnings under $50 roll over — nothing is lost</li>
                  <li>Payment via Stripe Connect (PayPal/direct deposit)</li>
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