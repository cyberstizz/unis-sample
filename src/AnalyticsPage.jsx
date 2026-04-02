import React, { useState, useEffect } from 'react';
import { apiCall } from '../components/axiosInstance';
import Layout from '../layout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './admin.scss';

const AnalyticsPage = () => {
  const [dauData, setDauData] = useState([]);
  const [signupData, setSignupData] = useState([]);
  const [playData, setPlayData] = useState([]);
  const [voteData, setVoteData] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [dmcaStats, setDmcaStats] = useState(null);
  const [waitlistOverview, setWaitlistOverview] = useState(null);
  const [waitlistDailyData, setWaitlistDailyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dau, signups, plays, votes, referrals, dmca, waitlist, waitlistDaily] = await Promise.all([
          apiCall({ url: '/v1/admin/analytics/dau', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/signups', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/plays', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/votes', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/referrals', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/dmca', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/waitlist', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/waitlist/daily?days=30', method: 'get' }),
        ]);

        const toChartArray = (obj) => Object.entries(obj || {}).map(([key, val]) => ({ date: key.substring(5), value: val }));

        setDauData(toChartArray(dau.data));
        setSignupData(toChartArray(signups.data));
        setPlayData(toChartArray(plays.data));

        const voteArr = Object.entries(votes.data || {}).map(([name, count]) => ({ name, count }));
        setVoteData(voteArr);

        setReferralStats(referrals.data);
        setDmcaStats(dmca.data);
        setWaitlistOverview(waitlist.data);
        setWaitlistDailyData(toChartArray(waitlistDaily.data));
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const ChartCard = ({ title, children, style: extraStyle }) => (
    <div style={{
      background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '24px',
      border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px',
      ...extraStyle,
    }}>
      <h3 style={{ color: '#fff', marginBottom: '20px' }}>{title}</h3>
      {children}
    </div>
  );

  const tooltipStyle = {
    contentStyle: { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' },
    labelStyle: { color: '#fff' }, itemStyle: { color: '#163387' }
  };

  if (loading) {
    return <Layout><div style={{ padding: '40px', color: '#A9A9A9', textAlign: 'center' }}>Loading analytics...</div></Layout>;
  }

  const wl = waitlistOverview || {};

  return (
    <Layout>
      <div className="admin-page">
        <h1 style={{ color: '#fff', marginBottom: '30px' }}>Analytics</h1>

        {/* ═══════════════════════════════════════════════════
            WAITLIST SECTION — Placed first for visibility
           ═══════════════════════════════════════════════════ */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(22,51,135,0.15), rgba(22,51,135,0.05))',
          borderRadius: '16px', padding: '28px',
          border: '1px solid rgba(22,51,135,0.3)', marginBottom: '30px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#163387" strokeWidth="2" fill="none" />
              <path d="M12 6v6l4 2" stroke="#163387" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 }}>
              National Waitlist
            </h2>
            <span style={{
              background: 'rgba(22,51,135,0.3)', color: '#6B8AFF', fontSize: '12px',
              padding: '4px 10px', borderRadius: '20px', fontWeight: '600',
            }}>
              LIVE
            </span>
          </div>

          {/* Waitlist stat cards */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Pre-Registrations', value: wl.totalPreRegistrations || 0, color: '#163387' },
              { label: 'Pending Activation', value: wl.totalPending || 0, color: '#f59e0b' },
              { label: 'Converted', value: wl.totalConverted || 0, color: '#22c55e' },
              { label: 'Artists', value: wl.totalArtists || 0, color: '#a855f7' },
              { label: 'Listeners', value: wl.totalListeners || 0, color: '#06b6d4' },
              { label: 'Today', value: wl.signupsToday || 0, color: '#ec4899' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(10,10,12,0.6)', borderRadius: '10px', padding: '16px 20px',
                border: '1px solid rgba(255,255,255,0.06)', flex: '1', minWidth: '140px',
              }}>
                <div style={{ color: '#A9A9A9', fontSize: '12px', marginBottom: '6px' }}>{stat.label}</div>
                <div style={{ color: stat.color, fontSize: '26px', fontWeight: '700' }}>{stat.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Waitlist daily signups chart */}
          {waitlistDailyData.length > 0 && (
            <div style={{
              background: 'rgba(10,10,12,0.6)', borderRadius: '12px', padding: '20px',
              border: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px',
            }}>
              <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '16px', fontWeight: '600' }}>
                Waitlist Signups (Last 30 Days)
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={waitlistDailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#555" fontSize={11} />
                  <YAxis stroke="#555" fontSize={11} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="#163387" strokeWidth={2} dot={false} name="Signups" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top regions with progress bars */}
          {wl.topRegions && wl.topRegions.length > 0 && (
            <div style={{
              background: 'rgba(10,10,12,0.6)', borderRadius: '12px', padding: '20px',
              border: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px',
            }}>
              <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '16px', fontWeight: '600' }}>
                Top Regions — Activation Progress
              </h4>
              {wl.topRegions.map((region, i) => (
                <div key={i} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#C0C0C0', fontSize: '13px' }}>
                      {region.metroRegion}, {region.stateCode}
                    </span>
                    <span style={{ color: '#A9A9A9', fontSize: '12px' }}>
                      {region.count} / {region.threshold}
                      <span style={{
                        marginLeft: '8px',
                        color: region.progressPercent >= 100 ? '#22c55e' : '#163387',
                        fontWeight: '600',
                      }}>
                        {region.progressPercent}%
                      </span>
                    </span>
                  </div>
                  <div style={{
                    width: '100%', height: '6px',
                    background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(100, region.progressPercent)}%`,
                      height: '100%',
                      background: region.progressPercent >= 100
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : region.progressPercent >= 75
                          ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                          : 'linear-gradient(90deg, #163387, #2952cc)',
                      borderRadius: '3px',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  {region.progressPercent >= 100 && (
                    <div style={{
                      color: '#22c55e', fontSize: '11px', fontWeight: '600',
                      marginTop: '4px', letterSpacing: '0.5px',
                    }}>
                      READY TO ACTIVATE
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Waitlist referral leaders */}
          {wl.topReferrers && wl.topReferrers.length > 0 && (
            <div style={{
              background: 'rgba(10,10,12,0.6)', borderRadius: '12px', padding: '20px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '16px', fontWeight: '600' }}>
                Waitlist Referral Leaders
              </h4>
              {wl.topReferrers.map((ref, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: i < wl.topReferrers.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <div>
                    <span style={{ color: '#555', fontSize: '13px', marginRight: '10px' }}>{i + 1}.</span>
                    <span style={{ color: '#fff', fontSize: '14px' }}>{ref.username}</span>
                    <span style={{ color: '#555', fontSize: '12px', marginLeft: '8px' }}>
                      {ref.metroRegion}, {ref.stateCode}
                    </span>
                  </div>
                  <span style={{ color: '#163387', fontSize: '14px', fontWeight: '600' }}>
                    {ref.referralCount} referrals
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* States represented */}
          {wl.signupsByState && Object.keys(wl.signupsByState).length > 0 && (
            <div style={{
              background: 'rgba(10,10,12,0.6)', borderRadius: '12px', padding: '20px',
              border: '1px solid rgba(255,255,255,0.06)', marginTop: '24px',
            }}>
              <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '16px', fontWeight: '600' }}>
                Signups by State ({Object.keys(wl.signupsByState).length} states)
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(wl.signupsByState)
                  .sort((a, b) => b[1] - a[1])
                  .map(([state, count]) => (
                    <div key={state} style={{
                      background: 'rgba(22,51,135,0.15)', border: '1px solid rgba(22,51,135,0.3)',
                      borderRadius: '8px', padding: '8px 12px', fontSize: '13px',
                    }}>
                      <span style={{ color: '#fff', fontWeight: '600' }}>{state}</span>
                      <span style={{ color: '#A9A9A9', marginLeft: '6px' }}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            EXISTING ANALYTICS — unchanged below
           ═══════════════════════════════════════════════════ */}

        <ChartCard title="Daily Active Users">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dauData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#A9A9A9" fontSize={12} />
              <YAxis stroke="#A9A9A9" fontSize={12} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#163387" strokeWidth={2} dot={false} name="Users" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="New Signups">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={signupData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#A9A9A9" fontSize={12} />
              <YAxis stroke="#A9A9A9" fontSize={12} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} name="Signups" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Play Counts">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={playData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#A9A9A9" fontSize={12} />
              <YAxis stroke="#A9A9A9" fontSize={12} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} name="Plays" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Votes by Jurisdiction">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={voteData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#A9A9A9" fontSize={12} />
              <YAxis stroke="#A9A9A9" fontSize={12} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#163387" radius={[4, 4, 0, 0]} name="Votes" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <ChartCard title="Referral Stats">
            <div style={{ color: '#fff' }}>
              <p>Total Referrals: <strong>{referralStats?.totalReferrals || 0}</strong></p>
              <p>Max Chain Depth: <strong>{referralStats?.maxChainDepth || 0}</strong></p>
              {referralStats?.topReferrers?.length > 0 && (
                <>
                  <p style={{ marginTop: '16px', color: '#A9A9A9', fontSize: '13px' }}>Top Referrers:</p>
                  {referralStats.topReferrers.map((r, i) => (
                    <div key={i} style={{ color: '#C0C0C0', fontSize: '14px', padding: '4px 0' }}>
                      {i + 1}. {r.username} — {r.referral_count} referrals
                    </div>
                  ))}
                </>
              )}
            </div>
          </ChartCard>

          <ChartCard title="DMCA Stats">
            <div style={{ color: '#fff' }}>
              <p>Avg Resolution: <strong>{dmcaStats?.averageResolutionDays ? `${dmcaStats.averageResolutionDays.toFixed(1)} days` : 'N/A'}</strong></p>
              {dmcaStats?.claimsByStatus && Object.entries(dmcaStats.claimsByStatus).map(([status, count]) => (
                <div key={status} style={{ color: '#C0C0C0', fontSize: '14px', padding: '4px 0' }}>
                  {status}: {count}
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>
    </Layout>
  );
};

export default AnalyticsPage;