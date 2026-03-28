import React, { useState, useEffect } from 'react';
import { Copy, Check, Gift } from 'lucide-react';
import { apiCall } from './components/axiosInstance';

/**
 * ReferralCodeCard
 * Displays a user's referral code with copy-to-clipboard.
 * Used in both Profile.jsx (listeners) and ArtistDashboard.jsx (artists).
 *
 * Props:
 *   userId  — the authenticated user's UUID
 *   isArtist — boolean — shows artist-specific earn copy if true
 */
const ReferralCodeCard = ({ userId, isArtist = false }) => {
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    apiCall({ url: `/v1/users/referral-code/${userId}`, method: 'get', useCache: false })
      .then(res => {
        // Backend returns either a plain string or { referralCode: '...' }
        const code = typeof res.data === 'string'
          ? res.data
          : res.data?.referralCode || res.data?.code || '';
        setReferralCode(code);
      })
      .catch(err => console.error('Failed to fetch referral code:', err))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleCopy = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="card referral-code-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Gift size={20} style={{ color: 'var(--unis-primary)' }} />
        <h3 style={{ margin: 0 }}>Your Referral Code</h3>
      </div>

      <div style={{ padding: '16px 0 8px' }}>
        <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
          {isArtist
            ? 'Share this code with listeners and other artists. You earn +5 points for every listener and +2 points for every artist who joins with your code.'
            : 'Share this code with friends. You earn +5 points for every listener who joins Unis using your referral code.'}
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '14px 16px',
        }}>
          {loading ? (
            <span style={{ color: '#666', fontFamily: 'monospace', fontSize: '1.1rem' }}>
              Loading...
            </span>
          ) : (
            <span style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '1.2rem',
              fontWeight: '700',
              color: 'var(--unis-primary)',
              letterSpacing: '0.08em',
              wordBreak: 'break-all',
            }}>
              {referralCode || '—'}
            </span>
          )}

          <button
            onClick={handleCopy}
            disabled={!referralCode || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: copied ? 'rgba(15, 122, 62, 0.15)' : 'var(--unis-primary)',
              border: copied ? '1px solid #0F7A3E' : 'none',
              borderRadius: '8px',
              color: copied ? '#0F7A3E' : '#fff',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: referralCode ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {copied
              ? <><Check size={14} /> Copied!</>
              : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralCodeCard;