import React, { useState, useEffect, useCallback } from 'react';
import { History, Music, User, ArrowRight } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import VoteHistoryModal from './voteHistoryModal';
import './VoteHistorySection.scss';

// =============================================================================
// VoteHistorySection
//
// Owns the vote-history read path. Fetches GET /v1/vote/history ONCE, shows the
// two most recent votes as a premium preview, and opens VoteHistoryModal (fed
// the already-fetched full list -- no second fetch) when the user wants more.
//
// This is a deliberate separate fetch from the profile summary: the summary
// can't cheaply resolve nominee names/images/intervals, but /vote/history
// already does. The modal stays purely presentational.
//
// Props:
//   userId: UUID
// =============================================================================
const PREVIEW_COUNT = 2;

const VoteHistorySection = ({ userId }) => {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const startedAt = performance.now();
    try {
      const res = await apiCall({ url: '/v1/vote/history' });
      const list = Array.isArray(res.data) ? res.data : [];
      setVotes(list);
      const ms = Math.round(performance.now() - startedAt);
      console.log(`[VoteHistory] action=fetch status=ok count=${list.length} durationMs=${ms}`);
    } catch (err) {
      const ms = Math.round(performance.now() - startedAt);
      console.error(`[VoteHistory] action=fetch status=fail durationMs=${ms} err=`, err);
      setError('Could not load your vote history.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const preview = votes.slice(0, PREVIEW_COUNT);
  const remaining = Math.max(0, votes.length - PREVIEW_COUNT);

  // ---- States ----
  if (loading) {
    return (
      <div className="vhs">
        <div className="vhs-skeleton" aria-hidden="true">
          <div className="vhs-skeleton__row" />
          <div className="vhs-skeleton__row" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vhs">
        <div className="vhs-empty" role="alert">
          <p>{error}</p>
          <button type="button" className="vhs-retry" onClick={fetchHistory}>Retry</button>
        </div>
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className="vhs">
        <div className="vhs-empty">
          <History size={32} aria-hidden="true" />
          <p className="vhs-empty__title">No votes yet</p>
          <span className="vhs-empty__sub">Go back your favorite artists and songs.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="vhs">
      <div className="vhs-count">
        <span className="vhs-count__num">{votes.length}</span>
        <span className="vhs-count__label">total {votes.length === 1 ? 'vote' : 'votes'} cast</span>
      </div>

      <div className="vhs-preview">
        {preview.map((vote) => {
          const img = buildUrl(vote.nomineeImage);
          const isArtist = vote.targetType === 'artist';
          return (
            <div key={vote.voteId} className="vhs-row">
              <div className="vhs-row__media">
                {img ? (
                  <img src={img} alt="" className="vhs-row__img" />
                ) : (
                  <div className="vhs-row__img vhs-row__img--ph" aria-hidden="true">
                    {isArtist ? <User size={18} /> : <Music size={18} />}
                  </div>
                )}
              </div>
              <div className="vhs-row__info">
                <span className="vhs-row__name">{vote.nomineeName || 'Unknown'}</span>
                <span className="vhs-row__type">{isArtist ? 'Artist' : 'Song'}</span>
              </div>
              <span className="vhs-row__date">{formatDate(vote.voteDate)}</span>
            </div>
          );
        })}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          className="vhs-viewall"
          onClick={() => setShowModal(true)}
        >
          View all {votes.length} votes <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}

      <VoteHistoryModal
        show={showModal}
        onClose={() => setShowModal(false)}
        votes={votes}
      />
    </div>
  );
};

export default VoteHistorySection;