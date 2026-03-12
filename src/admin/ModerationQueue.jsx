import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import Layout from '../layout';
import './admin.scss';

const ModerationQueue = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dmca');
  const [claims, setClaims] = useState([]);
  const [comments, setComments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'dmca') fetchClaims();
    else fetchComments();
  }, [activeTab, statusFilter]);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiCall({ url: `/v1/admin/dmca/claims${params}`, method: 'get' });
      setClaims(res.data?.content || []);
    } catch (err) {
      console.error('Failed to load claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await apiCall({ url: '/v1/admin/comments/recent', method: 'get' });
      setComments(res.data?.content || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await apiCall({
        url: `/v1/admin/comments/${commentId}`,
        method: 'delete',
        data: { reason: 'Removed by moderator' }
      });
      setComments(prev => prev.filter(c => c.commentId !== commentId));
    } catch (err) {
      alert('Failed to delete comment');
    }
  };

  const statusBadge = (status) => {
    const colors = {
      submitted: '#f59e0b', reviewing: '#3b82f6', upheld: '#ef4444',
      rejected: '#6b7280', counter_pending: '#8b5cf6', resolved: '#22c55e'
    };
    return (
      <span style={{
        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
        background: `${colors[status] || '#6b7280'}22`, color: colors[status] || '#6b7280'
      }}>
        {status}
      </span>
    );
  };

  const tabStyle = (tab) => ({
    padding: '10px 24px', cursor: 'pointer', color: activeTab === tab ? '#fff' : '#A9A9A9',
    borderBottom: activeTab === tab ? '2px solid #163387' : '2px solid transparent',
    background: 'none', border: 'none', fontSize: '15px', fontWeight: activeTab === tab ? '600' : '400'
  });

  return (
    <Layout>
        <div className="admin-page">
        <h1 style={{ color: '#fff', marginBottom: '20px' }}>Moderation Queue</h1>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
          <button style={tabStyle('dmca')} onClick={() => setActiveTab('dmca')}>DMCA Claims</button>
          <button style={tabStyle('comments')} onClick={() => setActiveTab('comments')}>Comments</button>
        </div>

        {activeTab === 'dmca' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="reviewing">Reviewing</option>
                <option value="upheld">Upheld</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {loading ? <p style={{ color: '#A9A9A9' }}>Loading...</p> : (
              claims.length === 0 ? <p style={{ color: '#A9A9A9' }}>No claims found.</p> : (
                claims.map(claim => (
                  <div key={claim.claimId} onClick={() => navigate(`/admin/moderation/dmca/${claim.claimId}`)}
                    style={{
                      background: 'rgba(26,26,26,0.85)', borderRadius: '10px', padding: '16px 20px',
                      marginBottom: '10px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: '500' }}>{claim.claimantName}</div>
                      <div style={{ color: '#A9A9A9', fontSize: '13px', marginTop: '4px' }}>{claim.infringingUrl}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {statusBadge(claim.status)}
                      <span style={{ color: '#A9A9A9', fontSize: '12px' }}>
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}
          </>
        )}

        {activeTab === 'comments' && (
          loading ? <p style={{ color: '#A9A9A9' }}>Loading...</p> : (
            comments.length === 0 ? <p style={{ color: '#A9A9A9' }}>No recent comments.</p> : (
              comments.map(comment => (
                <div key={comment.commentId}
                  style={{
                    background: 'rgba(26,26,26,0.85)', borderRadius: '10px', padding: '16px 20px',
                    marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#A9A9A9', fontSize: '12px', marginBottom: '4px' }}>
                    {comment.user?.username || 'Unknown'} · on "{comment.song?.title || 'Unknown Song'}" · {new Date(comment.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{ color: '#fff', fontSize: '14px' }}>{comment.content}</div>
                  </div>
                  <button onClick={() => handleDeleteComment(comment.commentId)}
                    style={{
                      padding: '6px 14px', background: 'rgba(220,53,69,0.2)', color: '#ff6b7a',
                      border: '1px solid rgba(220,53,69,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                    }}>
                    Delete
                  </button>
                </div>
              ))
            )
          )
        )}
      </div>
    </Layout>
  );
};

export default ModerationQueue;