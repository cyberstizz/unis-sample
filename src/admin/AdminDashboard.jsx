import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import Layout from '../layout';
import CronStatusPanel from './CronStatusPanel';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './admin.scss';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [dauData, setDauData] = useState([]);
  const [waitlistOverview, setWaitlistOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, dauRes, waitlistRes] = await Promise.all([
          apiCall({ url: '/v1/admin/analytics/overview', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/dau', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/waitlist', method: 'get' }),
        ]);
        setOverview(overviewRes.data);
        setWaitlistOverview(waitlistRes.data);

        // Transform DAU map into array for recharts
        const dauMap = dauRes.data || {};
        const chartData = Object.entries(dauMap).map(([date, count]) => ({
          date: date.substring(5), // MM-DD format
          users: count
        }));
        setDauData(chartData);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const StatCard = ({ label, value, sub, accent }) => (
    <div style={{
      background: 'rgba(26, 26, 26, 0.85)', borderRadius: '12px',
      padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
      flex: '1', minWidth: '200px'
    }}>
      <div style={{ color: '#A9A9A9', fontSize: '13px', marginBottom: '8px' }}>{label}</div>
      <div style={{ color: accent || '#fff', fontSize: '28px', fontWeight: '700' }}>{value ?? '—'}</div>
      {sub && <div style={{ color: '#A9A9A9', fontSize: '12px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '40px', color: '#A9A9A9', textAlign: 'center' }}>
          Loading dashboard...
        </div>
      </Layout>
    );
  }

  const dauChange = overview?.dauYesterday > 0
    ? Math.round(((overview.dauToday - overview.dauYesterday) / overview.dauYesterday) * 100)
    : 0;

  const wl = waitlistOverview || {};

  return (
    <Layout>
      <div className="admin-page">
        <h1 style={{ color: '#fff', fontSize: '28px', marginBottom: '8px' }}>Admin Dashboard</h1>
        <p style={{ color: '#A9A9A9', marginBottom: '30px' }}>
          Welcome, {user?.username}. Role: {user?.adminRole}
        </p>

        {/* Quick nav */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/admin/moderation')}
            style={{ padding: '10px 20px', background: '#163387', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Moderation Queue
          </button>
          <button onClick={() => navigate('/admin/playlists')}
            style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
            Official Playlists
          </button>
          <button onClick={() => navigate('/admin/analytics')}
            style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
            Full Analytics
          </button>
          {(user?.adminRole === 'admin' || user?.adminRole === 'super_admin') && (
            <button onClick={() => navigate('/admin/users')}
              style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
              User Management
            </button>
          )}
          {user?.adminRole === 'super_admin' && (
            <>
              <button onClick={() => navigate('/admin/roles')}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                Manage Roles
              </button>
              <button onClick={() => navigate('/admin/audit')}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                Audit Log
              </button>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            WAITLIST BANNER — top-level visibility
           ═══════════════════════════════════════════════════ */}
        {wl.totalPreRegistrations > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(22,51,135,0.2), rgba(22,51,135,0.05))',
            borderRadius: '14px', padding: '24px',
            border: '1px solid rgba(22,51,135,0.35)', marginBottom: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="#163387" strokeWidth="2" fill="none" />
                  <circle cx="10" cy="10" r="3" fill="#163387" />
                </svg>
                <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: '700', margin: 0 }}>
                  National Waitlist
                </h3>
              </div>
              <button
                onClick={() => navigate('/admin/analytics')}
                style={{
                  background: 'rgba(22,51,135,0.3)', color: '#6B8AFF', border: '1px solid rgba(22,51,135,0.5)',
                  borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                View Details
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <StatCard label="Waitlist Total" value={(wl.totalPreRegistrations || 0).toLocaleString()} accent="#163387" />
              <StatCard label="Waitlist Artists" value={(wl.totalArtists || 0).toLocaleString()} accent="#a855f7" />
              <StatCard label="Waitlist Today" value={(wl.signupsToday || 0).toLocaleString()} accent="#ec4899" />
              <StatCard
                label="States Covered"
                value={wl.signupsByState ? Object.keys(wl.signupsByState).length : 0}
                accent="#06b6d4"
              />
            </div>

            {/* Closest to activation */}
            {wl.topRegions && wl.topRegions.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ color: '#A9A9A9', fontSize: '12px', marginBottom: '10px' }}>Closest to Activation:</div>
                {wl.topRegions.slice(0, 3).map((region, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#C0C0C0', fontSize: '13px' }}>
                        {region.metroRegion}, {region.stateCode}
                      </span>
                      <span style={{
                        color: region.progressPercent >= 100 ? '#22c55e' : '#A9A9A9',
                        fontSize: '12px', fontWeight: '600',
                      }}>
                        {region.count}/{region.threshold} ({region.progressPercent}%)
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: '4px',
                      background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(100, region.progressPercent)}%`,
                        height: '100%',
                        background: region.progressPercent >= 100 ? '#22c55e' : '#163387',
                        borderRadius: '2px',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stat cards — existing platform metrics */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <StatCard label="Total Users" value={overview?.totalUsers} />
          <StatCard label="Total Artists" value={overview?.totalArtists} />
          <StatCard label="Total Songs" value={overview?.totalSongs} />
          <StatCard label="DAU Today" value={overview?.dauToday}
            sub={dauChange !== 0 ? `${dauChange > 0 ? '+' : ''}${dauChange}% vs yesterday` : 'Same as yesterday'} />
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <StatCard label="Signups Today" value={overview?.signupsToday} />
          <StatCard label="Plays Today" value={overview?.playsToday} />
          <StatCard label="Open DMCA Claims" value={overview?.openDmcaClaims} />
          <StatCard label="Active Suspensions" value={overview?.activeSuspensions} />
        </div>

        {/* DAU Chart */}
        <div style={{
          background: 'rgba(26, 26, 26, 0.85)', borderRadius: '12px',
          padding: '24px', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '20px' }}>Daily Active Users (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dauData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#A9A9A9" fontSize={12} />
              <YAxis stroke="#A9A9A9" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#163387' }}
              />
              <Line type="monotone" dataKey="users" stroke="#163387" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

         <div style={{ marginTop: '24px' }}>
          <CronStatusPanel />
        </div>
        
      </div>
    </Layout>
  );
};

export default AdminDashboard;