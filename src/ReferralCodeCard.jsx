import React, { useState } from 'react';
import { Copy, Check, Twitter, Instagram, Link2, Sparkles } from 'lucide-react';
import './ReferralCodeCard.scss';

// =============================================================================
// ReferralCodeCard
//
// Refactored to receive `referralCode` and `username` as props from Profile,
// rather than fetching them itself. This eliminates the cache-drift bug where
// this card would sometimes render without a code, because it now has the
// exact same data as the rest of the page (one fetch, one source of truth).
//
// External prop signature:
//   - referralCode: string  (required — from ProfileSummaryDto.referralCode)
//   - username:     string  (optional — used in share message)
//   - isArtist:     boolean (optional, defaults false)
//
// Loading and error states are handled by the parent (Profile.jsx), so this
// component only ever renders when data is available. No internal fetch.
// =============================================================================

const ReferralCodeCard = ({ referralCode = '', username = '', isArtist = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('[ReferralCodeCard] action=copy status=fail err=', err);
    });
  };

  const handleShare = (platform) => {
    if (!referralCode) return;
    const shareUrl = `${window.location.origin}/?ref=${referralCode}`;
    const namePart = username ? ` — ${username} thinks you'd vibe with this` : '';
    const message = `Join me on UNIS${namePart}. Use code ${referralCode} when you sign up.`;

    switch (platform) {
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank',
          'noopener,noreferrer'
        );
        return;
      case 'instagram':
        // Instagram has no direct web share — copy formatted message instead
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
          <div className="referral-card__code" aria-label={`Your referral code: ${referralCode || 'not assigned'}`}>
            {referralCode || '—'}
          </div>
          <button
            type="button"
            className={`referral-card__copy ${copied ? 'is-copied' : ''}`}
            onClick={handleCopy}
            disabled={!referralCode}
            aria-label={copied ? 'Copied' : 'Copy referral code to clipboard'}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="referral-card__share-row">
          <button
            type="button"
            className="referral-card__share-pill"
            onClick={() => handleShare('twitter')}
            disabled={!referralCode}
            aria-label="Share on Twitter / X"
          >
            <Twitter size={13} aria-hidden="true" /> Twitter / X
          </button>
          <button
            type="button"
            className="referral-card__share-pill"
            onClick={() => handleShare('instagram')}
            disabled={!referralCode}
            aria-label="Copy share message for Instagram"
          >
            <Instagram size={13} aria-hidden="true" /> Instagram
          </button>
          <button
            type="button"
            className="referral-card__share-pill"
            onClick={() => handleShare('link')}
            disabled={!referralCode}
            aria-label="Copy direct referral link"
          >
            <Link2 size={13} aria-hidden="true" /> Direct link
          </button>
        </div>
      </div>

      <div className="referral-card__right">
        <div className="referral-card__icon" aria-hidden="true">
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
          STATS BLOCK — uncomment once you add referral stats to
          ProfileSummaryDto. Suggested addition to backend:
            ProfileSummaryDto.ReferralStats {
              long referralsJoined;
              int pointsEarned;
            }
          Then pass them down as props from Profile.jsx.
          ============================================================
        */}
      </div>
    </div>
  );
};

export default ReferralCodeCard;