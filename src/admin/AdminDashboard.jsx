import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import Layout from '../layout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './admin.scss';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [dauData, setDauData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, dauRes] = await Promise.all([
          apiCall({ url: '/v1/admin/analytics/overview', method: 'get' }),
          apiCall({ url: '/v1/admin/analytics/dau', method: 'get' })
        ]);
        setOverview(overviewRes.data);

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

  const StatCard = ({ label, value, sub }) => (
    <div style={{
      background: 'rgba(26, 26, 26, 0.85)', borderRadius: '12px',
      padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
      flex: '1', minWidth: '200px'
    }}>
      <div style={{ color: '#A9A9A9', fontSize: '13px', marginBottom: '8px' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '28px', fontWeight: '700' }}>{value ?? '—'}</div>
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

        {/* Stat cards */}
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
      </div>
    </Layout>
  );
};

export default AdminDashboard;