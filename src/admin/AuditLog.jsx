import React, { useState, useEffect } from 'react';
import { apiCall } from '../components/axiosInstance';
import Layout from '../layout';

const AuditLog = () => {
  const [actions, setActions] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLog(); }, [page]);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const res = await apiCall({ url: `/v1/admin/audit?page=${page}&size=20`, method: 'get' });
      setActions(res.data?.content || []);
      setTotalPages(res.data?.totalPages || 0);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ padding: '30px 40px', maxWidth: '1200px' }}>
        <h1 style={{ color: '#fff', marginBottom: '20px' }}>Audit Log</h1>

        {loading ? <p style={{ color: '#A9A9A9' }}>Loading...</p> : (
          <>
            {actions.length === 0 ? <p style={{ color: '#A9A9A9' }}>No actions recorded yet.</p> : (
              actions.map(action => (
                <div key={action.actionId}
                  style={{
                    background: 'rgba(26,26,26,0.85)', borderRadius: '10px', padding: '14px 20px',
                    marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#163387', fontWeight: '600', fontSize: '14px' }}>{action.actionType}</span>
                      <span style={{ color: '#A9A9A9', fontSize: '13px', marginLeft: '12px' }}>
                        on {action.targetType} · by {action.performedBy?.username || 'Unknown'}
                      </span>
                    </div>
                    <span style={{ color: '#A9A9A9', fontSize: '12px' }}>
                      {new Date(action.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {action.reason && (
                    <div style={{ color: '#C0C0C0', fontSize: '13px', marginTop: '6px' }}>{action.reason}</div>
                  )}
                </div>
              ))
            )}

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

export default AuditLog;