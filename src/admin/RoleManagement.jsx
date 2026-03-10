import React, { useState, useEffect } from 'react';
import { apiCall } from '../components/axiosInstance';
import Layout from '../layout';

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [showGrant, setShowGrant] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantLevel, setGrantLevel] = useState('moderator');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    try {
      const res = await apiCall({ url: '/v1/admin/roles', method: 'get' });
      setRoles(res.data || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGrant = async () => {
    if (!grantUserId.trim()) { alert('User ID is required'); return; }
    setActionLoading(true);
    try {
      await apiCall({
        url: '/v1/admin/roles', method: 'post',
        data: { userId: grantUserId, roleLevel: grantLevel }
      });
      setShowGrant(false);
      setGrantUserId('');
      fetchRoles();
    } catch (err) {
      alert('Grant failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (adminRoleId, username) => {
    if (!window.confirm(`Revoke admin role from ${username}?`)) return;
    try {
      await apiCall({ url: `/v1/admin/roles/${adminRoleId}`, method: 'delete' });
      fetchRoles();
    } catch (err) {
      alert('Revoke failed: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <Layout>
      <div style={{ padding: '30px 40px', maxWidth: '900px' }}>
        <h1 style={{ color: '#fff', marginBottom: '20px' }}>Role Management</h1>

        <button onClick={() => setShowGrant(!showGrant)}
          style={{ padding: '10px 20px', background: '#163387', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', marginBottom: '20px' }}>
          {showGrant ? 'Cancel' : 'Grant Role'}
        </button>

        {showGrant && (
          <div style={{
            background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#A9A9A9', display: 'block', marginBottom: '6px' }}>User ID</label>
              <input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)}
                placeholder="Paste user UUID"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)', boxSizing: 'border-box'
                }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#A9A9A9', display: 'block', marginBottom: '6px' }}>Role Level</label>
              <select value={grantLevel} onChange={(e) => setGrantLevel(e.target.value)}
                style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button onClick={handleGrant} disabled={actionLoading}
              style={{ padding: '10px 24px', background: '#163387', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Grant Role
            </button>
          </div>
        )}

        {loading ? <p style={{ color: '#A9A9A9' }}>Loading...</p> : (
          roles.length === 0 ? <p style={{ color: '#A9A9A9' }}>No admin roles assigned.</p> : (
            roles.map(role => (
              <div key={role.adminRoleId}
                style={{
                  background: 'rgba(26,26,26,0.85)', borderRadius: '10px', padding: '16px 20px',
                  marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                <div>
                  <span style={{ color: '#fff', fontWeight: '500' }}>{role.user?.username || 'Unknown'}</span>
                  <span style={{ color: '#163387', fontSize: '13px', marginLeft: '12px', fontWeight: '600' }}>
                    {role.roleLevel}
                  </span>
                  {role.isProtected && (
                    <span style={{ color: '#f59e0b', fontSize: '12px', marginLeft: '8px' }}>Protected</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#A9A9A9', fontSize: '12px' }}>
                    Since {new Date(role.createdAt).toLocaleDateString()}
                  </span>
                  {role.roleLevel !== 'super_admin' && !role.isProtected && (
                    <button onClick={() => handleRevoke(role.adminRoleId, role.user?.username)}
                      style={{
                        padding: '6px 14px', background: 'rgba(220,53,69,0.2)', color: '#ff6b7a',
                        border: '1px solid rgba(220,53,69,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                      }}>
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>
    </Layout>
  );
};

export default RoleManagement;