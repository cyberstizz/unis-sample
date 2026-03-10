import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import Layout from '../layout';
import './admin.scss';

const DmcaClaimDetail = () => {
  const { claimId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchClaim();
  }, [claimId]);

  const fetchClaim = async () => {
    try {
      const res = await apiCall({ url: `/v1/admin/dmca/claims/${claimId}`, method: 'get' });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load claim:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    setActionLoading(true);
    try {
      await apiCall({
        url: `/v1/admin/dmca/claims/${claimId}/status`,
        method: 'patch',
        data: { status: newStatus, notes }
      });
      if (newStatus === 'upheld') {
        await apiCall({
          url: `/v1/admin/dmca/claims/${claimId}/takedown`,
          method: 'post'
        });
      }
      fetchClaim();
      setNotes('');
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <Layout><div style={{ padding: '40px', color: '#A9A9A9' }}>Loading claim...</div></Layout>;
  }

  if (!data) {
    return <Layout><div style={{ padding: '40px', color: '#A9A9A9' }}>Claim not found.</div></Layout>;
  }

  const claim = data.claim;
  const counterNotice = data.counterNotice;
  const actions = data.actionHistory || [];

  const fieldRow = (label, value) => (
    <div style={{ marginBottom: '12px' }}>
      <span style={{ color: '#A9A9A9', fontSize: '13px' }}>{label}</span>
      <div style={{ color: '#fff', marginTop: '2px' }}>{value || '—'}</div>
    </div>
  );

  return (
    <Layout>
        <div className="admin-page">
        <button onClick={() => navigate('/admin/moderation')}
          style={{ color: '#A9A9A9', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px' }}>
          ← Back to Moderation Queue
        </button>

        <h1 style={{ color: '#fff', marginBottom: '6px' }}>DMCA Claim Detail</h1>
        <p style={{ color: '#A9A9A9', marginBottom: '30px' }}>
          Reference: DMCA-{claimId.substring(0, 8).toUpperCase()}
        </p>

        <div style={{
          background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '30px',
          border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '20px' }}>Claimant Information</h3>
          {fieldRow('Name', claim.claimantName)}
          {fieldRow('Email', claim.claimantEmail)}
          {fieldRow('Phone', claim.claimantPhone)}
          {fieldRow('Company', claim.claimantCompany)}
          {fieldRow('Copyright Owner', claim.copyrightOwner)}
        </div>

        <div style={{
          background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '30px',
          border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '20px' }}>Claim Details</h3>
          {fieldRow('Work Description', claim.workDescription)}
          {fieldRow('Original Work URL', claim.originalWorkUrl)}
          {fieldRow('Infringing URL on Unis', claim.infringingUrl)}
          {fieldRow('Status', claim.status)}
          {fieldRow('Submitted', new Date(claim.createdAt).toLocaleString())}
          {claim.resolvedAt && fieldRow('Resolved', new Date(claim.resolvedAt).toLocaleString())}
          {claim.resolutionNotes && fieldRow('Resolution Notes', claim.resolutionNotes)}
        </div>

        {counterNotice && (
          <div style={{
            background: 'rgba(139,92,246,0.1)', borderRadius: '12px', padding: '30px',
            border: '1px solid rgba(139,92,246,0.3)', marginBottom: '20px'
          }}>
            <h3 style={{ color: '#8b5cf6', marginBottom: '20px' }}>Counter-Notice Filed</h3>
            {fieldRow('Respondent', counterNotice.respondentName)}
            {fieldRow('Statement', counterNotice.statement)}
            {fieldRow('Filed', new Date(counterNotice.filedAt).toLocaleString())}
            {fieldRow('Content Restore Eligible', counterNotice.restoreEligibleAt
              ? new Date(counterNotice.restoreEligibleAt).toLocaleString() : '—')}
          </div>
        )}

        {/* Action buttons */}
        {(claim.status === 'submitted' || claim.status === 'reviewing') && (
          <div style={{
            background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '30px',
            border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '16px' }}>Take Action</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Resolution notes (optional)"
              style={{
                width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                marginBottom: '16px', resize: 'vertical', boxSizing: 'border-box'
              }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              {claim.status === 'submitted' && (
                <button onClick={() => updateStatus('reviewing')} disabled={actionLoading}
                  style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  Start Review
                </button>
              )}
              {claim.status === 'reviewing' && (
                <>
                  <button onClick={() => updateStatus('upheld')} disabled={actionLoading}
                    style={{ padding: '10px 24px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    Uphold (Remove Content)
                  </button>
                  <button onClick={() => updateStatus('rejected')} disabled={actionLoading}
                    style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                    Reject Claim
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action history */}
        {actions.length > 0 && (
          <div style={{
            background: 'rgba(26,26,26,0.85)', borderRadius: '12px', padding: '30px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '16px' }}>Action History</h3>
            {actions.map(action => (
              <div key={action.actionId} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#fff', fontSize: '14px' }}>{action.actionType}</span>
                <span style={{ color: '#A9A9A9', fontSize: '12px', marginLeft: '12px' }}>
                  by {action.performedBy?.username} · {new Date(action.createdAt).toLocaleString()}
                </span>
                {action.reason && <div style={{ color: '#A9A9A9', fontSize: '13px', marginTop: '4px' }}>{action.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DmcaClaimDetail;