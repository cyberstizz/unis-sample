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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dau, signups, plays, votes, referrals, dmca] = await Promise.all([
          apiCall({ url: '/v1/admin/analytics/dau', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/signups', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/plays', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/votes', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/referrals', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/dmca', method: 'get' }),
        ]);

        const toChartArray = (obj) => Object.entries(obj || {}).map(([key, val]) => ({ date: key.substring(5), value: val }));

        setDauData(toChartArray(dau.data));
        setSignupData(toChartArray(signups.data));
        setPlayData(toChartArray(plays.data));

        const voteArr = Object.entries(votes.data || {}).map(([name, count]) => ({ name, count }));
        setVoteData(voteArr);

        setReferralStats(referrals.data);
        setDmcaStats(dmca.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const ChartCard = ({ title, children }) => (
    <div style={{
      background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '24px',
      border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px'
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

  return (
    <Layout>
        <div className="admin-page">
        <h1 style={{ color: '#fff', marginBottom: '30px' }}>Analytics</h1>

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