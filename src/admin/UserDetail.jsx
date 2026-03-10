import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import Layout from '../layout';
import './admin.scss';

const UserDetail = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendType, setSuspendType] = useState('temporary');
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchUser(); }, [userId]);

  const fetchUser = async () => {
    try {
      const res = await apiCall({ url: `/v1/admin/users/${userId}`, method: 'get' });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { alert('Reason is required'); return; }
    setActionLoading(true);
    try {
      await apiCall({
        url: `/v1/admin/users/${userId}/suspend`, method: 'post',
        data: { reason: suspendReason, suspensionType: suspendType }
      });
      setShowSuspendForm(false);
      setSuspendReason('');
      fetchUser();
    } catch (err) {
      alert('Suspend failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    setActionLoading(true);
    try {
      await apiCall({
        url: `/v1/admin/users/${userId}/unsuspend`, method: 'post',
        data: { reason: 'Suspension lifted by admin' }
      });
      fetchUser();
    } catch (err) {
      alert('Unsuspend failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('PERMANENTLY delete this user? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await apiCall({ url: `/v1/admin/users/${userId}`, method: 'delete' });
      navigate('/admin/users');
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Layout><div style={{ padding: '40px', color: '#A9A9A9' }}>Loading...</div></Layout>;
  if (!data) return <Layout><div style={{ padding: '40px', color: '#A9A9A9' }}>User not found.</div></Layout>;

  const u = data.user;
  const isSuspended = data.isSuspended;
  const suspensions = data.suspensionHistory || [];
  const adminRole = data.adminRole;

  return (
    <Layout>
        <div className="admin-page">
        <button onClick={() => navigate('/admin/users')}
          style={{ color: '#A9A9A9', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px' }}>
          ← Back to Users
        </button>

        {/* Profile header */}
        <div style={{
          background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '30px',
          border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px',
          display: 'flex', gap: '20px', alignItems: 'center'
        }}>
          <img src={u.photoUrl || '/default-avatar.png'} alt=""
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', background: '#333' }} />
          <div>
            <h2 style={{ color: '#fff', margin: 0 }}>{u.username}</h2>
            <p style={{ color: '#A9A9A9', margin: '4px 0' }}>{u.email}</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <span style={{ color: '#A9A9A9', fontSize: '13px' }}>Role: {u.role}</span>
              <span style={{ color: '#A9A9A9', fontSize: '13px' }}>Score: {u.score || 0}</span>
              <span style={{ color: '#A9A9A9', fontSize: '13px' }}>Level: {u.level || 'silver'}</span>
              {adminRole && <span style={{ color: '#163387', fontSize: '13px', fontWeight: '600' }}>Admin: {adminRole.roleLevel}</span>}
            </div>
            {isSuspended && (
              <div style={{ color: '#ef4444', fontWeight: '600', marginTop: '8px' }}>⚠ ACCOUNT SUSPENDED</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '30px',
          border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '16px' }}>Actions</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {!isSuspended ? (
              <button onClick={() => setShowSuspendForm(!showSuspendForm)}
                style={{ padding: '10px 20px', background: 'rgba(239,68,68,0.2)', color: '#ff6b7a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer' }}>
                Suspend Account
              </button>
            ) : (
              <button onClick={handleUnsuspend} disabled={actionLoading}
                style={{ padding: '10px 20px', background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', cursor: 'pointer' }}>
                Lift Suspension
              </button>
            )}
            {currentUser?.adminRole === 'super_admin' && (
              <button onClick={handleDelete} disabled={actionLoading}
                style={{ padding: '10px 20px', background: 'rgba(220,53,69,0.3)', color: '#ff4757', border: '1px solid rgba(220,53,69,0.5)', borderRadius: '8px', cursor: 'pointer' }}>
                Permanently Delete
              </button>
            )}
          </div>

          {showSuspendForm && (
            <div style={{ marginTop: '20px' }}>
              <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension (required)"
                style={{
                  width: '100%', minHeight: '60px', padding: '12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '12px', resize: 'vertical', boxSizing: 'border-box'
                }} />
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select value={suspendType} onChange={(e) => setSuspendType(e.target.value)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="temporary">Temporary</option>
                  <option value="permanent">Permanent</option>
                </select>
                <button onClick={handleSuspend} disabled={actionLoading}
                  style={{ padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  Confirm Suspension
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Suspension history */}
        {suspensions.length > 0 && (
          <div style={{
            background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '30px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '16px' }}>Suspension History</h3>
            {suspensions.map(s => (
              <div key={s.suspensionId} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#fff', fontSize: '14px' }}>{s.reason}</div>
                <div style={{ color: '#A9A9A9', fontSize: '12px', marginTop: '4px' }}>
                  {s.suspensionType} · {new Date(s.createdAt).toLocaleDateString()}
                  {s.liftedAt && ` · Lifted ${new Date(s.liftedAt).toLocaleDateString()}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UserDetail;