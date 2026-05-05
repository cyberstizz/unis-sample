import React, { useState, useEffect } from 'react';
import { Copy, Check, Twitter, Instagram, Link2, Sparkles } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './ReferralCodeCard.scss';

// =============================================================================
// ReferralCodeCard
//
// Drop-in replacement. Same external props (userId, isArtist).
//
// IMPORTANT — preserves your existing logic:
//   - Uses your existing endpoint: GET /v1/users/referral-code/${userId}
//   - Handles all three response shapes your old component handled:
//       a plain string, { referralCode }, or { code }
//   - No fake/placeholder stats — when you eventually add a referral-stats
//     endpoint, drop it into the `useEffect` and uncomment the stats block
//     in the JSX (search for "STATS BLOCK" below).
// =============================================================================

const ReferralCodeCard = ({ userId, isArtist = false }) => {
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    apiCall({
      url: `/v1/users/referral-code/${userId}`,
      method: 'get',
      useCache: false,
    })
      .then(res => {
        // Backend returns either a plain string or { referralCode: '...' } / { code: '...' }
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

  const handleShare = (platform) => {
    if (!referralCode) return;
    const shareUrl = `${window.location.origin}/?ref=${referralCode}`;
    const message = `Join me on UNIS — vote for the artists shaping your neighborhood. Use my code ${referralCode} when you sign up.`;

    switch (platform) {
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank',
          'noopener,noreferrer'
        );
        return;
      case 'instagram':
        // Instagram has no direct web share — copy formatted message to clipboard
        navigator.clipboard?.writeText(`${message} ${shareUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      case 'link':
      default:
        navigator.clipboard?.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="referral-card referral-card--loading">
        <div className="referral-card__skeleton" />
      </div>
    );
  }

  return (
    <div className="referral-card">
      <div className="referral-card__left">
        <div className="referral-card__eyebrow">Your Code</div>
        <h3 className="referral-card__title">
          Bring friends in. <em>Earn points.</em>
        </h3>
        <p className="referral-card__desc">
          {isArtist
            ? <>Share this code with listeners and other artists. Earn <strong>+5 points</strong> for every listener and <strong>+2</strong> for every artist who joins with your code.</>
            : <>Every listener who joins UNIS with your code adds <strong>+5 points</strong> to your score and helps your home jurisdiction climb the rankings.</>}
        </p>

        <div className="referral-card__code-row">
          <div className="referral-card__code">
            {referralCode || '—'}
          </div>
          <button
            className={`referral-card__copy ${copied ? 'is-copied' : ''}`}
            onClick={handleCopy}
            disabled={!referralCode}
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="referral-card__share-row">
          <button
            className="referral-card__share-pill"
            onClick={() => handleShare('twitter')}
            disabled={!referralCode}
          >
            <Twitter size={13} /> Twitter / X
          </button>
          <button
            className="referral-card__share-pill"
            onClick={() => handleShare('instagram')}
            disabled={!referralCode}
          >
            <Instagram size={13} /> Instagram
          </button>
          <button
            className="referral-card__share-pill"
            onClick={() => handleShare('link')}
            disabled={!referralCode}
          >
            <Link2 size={13} /> Direct link
          </button>
        </div>
      </div>

      {/* RIGHT — informational sidebar (no fake stats) */}
      <div className="referral-card__right">
        <div className="referral-card__icon">
          <Sparkles size={32} strokeWidth={1.5} />
        </div>
        <div className="referral-card__how-title">How it works</div>
        <ul className="referral-card__how-list">
          {isArtist ? (
            <>
              <li><strong>+5</strong> points per listener signup</li>
              <li><strong>+2</strong> points per artist signup</li>
              <li>Boosts your reach across jurisdictions</li>
              <li>No expiration — share anytime</li>
            </>
          ) : (
            <>
              <li><strong>+5</strong> points per friend who joins</li>
              <li>Boost your jurisdiction's ranking</li>
              <li>No expiration — share anytime</li>
            </>
          )}
        </ul>

        {/*
          ============================================================
          STATS BLOCK — uncomment once you add a referral-stats endpoint.
          Suggested shape from /v1/users/${userId}/referral-stats:
            { referralsJoined: number, pointsEarned: number, pending: number }

          <div className="referral-card__stat-big">{stats.referralsJoined}</div>
          <div className="referral-card__stat-label">Friends Joined</div>
          ============================================================
        */}
      </div>
    </div>
  );
};

export default ReferralCodeCard;