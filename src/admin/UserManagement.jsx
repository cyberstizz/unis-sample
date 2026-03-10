import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import Layout from '../layout';
import './admin.scss';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = `/v1/admin/users?page=${page}&size=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (roleFilter) url += `&role=${roleFilter}`;
      const res = await apiCall({ url, method: 'get' });
      setUsers(res.data?.content || []);
      setTotalPages(res.data?.totalPages || 0);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  return (
    <Layout>
        <div className="admin-page">
        <h1 style={{ color: '#fff', marginBottom: '20px' }}>User Management</h1>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or email..."
              style={{
                flex: 1, padding: '10px 16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)'
              }} />
            <button type="submit"
              style={{ padding: '10px 20px', background: '#163387', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Search
            </button>
          </form>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
            style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
            <option value="">All Roles</option>
            <option value="artist">Artists</option>
            <option value="listener">Listeners</option>
          </select>
        </div>

        {loading ? <p style={{ color: '#A9A9A9' }}>Loading...</p> : (
          <>
            {users.map(u => (
              <div key={u.userId} onClick={() => navigate(`/admin/users/${u.userId}`)}
                style={{
                  background: 'rgba(26,26,26,0.85)', borderRadius: '10px', padding: '14px 20px',
                  marginBottom: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                <img src={u.photoUrl || '/default-avatar.png'} alt=""
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#333' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: '500' }}>{u.username}</div>
                  <div style={{ color: '#A9A9A9', fontSize: '13px' }}>{u.email}</div>
                </div>
                <span style={{ color: '#A9A9A9', fontSize: '13px' }}>{u.role}</span>
                <span style={{ color: '#A9A9A9', fontSize: '12px' }}>Score: {u.score || 0}</span>
              </div>
            ))}

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: page === 0 ? 'not-allowed' : 'pointer' }}>
                  Previous
                </button>
                <span style={{ color: '#A9A9A9', padding: '8px' }}>Page {page + 1} of {totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer' }}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default UserManagement;