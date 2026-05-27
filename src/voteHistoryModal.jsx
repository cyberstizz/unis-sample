import React from 'react';
import { X, History, Music, User } from 'lucide-react';
import buildUrl from './utils/buildUrl';
import './voteHistoryModal.scss';

// =============================================================================
// VoteHistoryModal -- purely presentational. Receives the full vote list from
// VoteHistorySection (which owns the single /v1/vote/history fetch). No data
// fetching, no dummy data. Images go through the shared buildUrl for R2/CDN
// consistency.
// =============================================================================
const VoteHistoryModal = ({ show, onClose, votes = [] }) => {
  if (!show) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const getIntervalLabel = (interval) => {
    const labels = {
      day: 'Daily',
      week: 'Weekly',
      month: 'Monthly',
      quarter: 'Quarterly',
      midterm: 'Midterm',
      year: 'Yearly',
    };
    return labels[interval?.toLowerCase()] || interval || 'Daily';
  };

  return (
    <div className="vote-history-modal-overlay" onClick={onClose}>
      <div className="vote-history-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>

        <div className="modal-header">
          <div className="header-icon">
            <History size={28} />
          </div>
          <h2>Vote History</h2>
          <p className="modal-subtitle">
            {votes.length} {votes.length === 1 ? 'vote' : 'votes'} cast
            <br />
            <span style={{ color: 'var(--unis-primary-2)' }}>You voted for</span>
          </p>
        </div>

        <div className="votes-container">
          {votes.length > 0 ? (
            votes.map((vote) => {
              const img = buildUrl(vote.nomineeImage);
              const isArtist = vote.targetType === 'artist';
              return (
                <div key={vote.voteId} className="vote-row">
                  <div className="vote-left">
                    <div className="nominee-image-wrapper">
                      {img ? (
                        <img src={img} alt={vote.nomineeName} className="nominee-image" />
                      ) : (
                        <div className="nominee-placeholder">
                          {isArtist ? <User size={24} /> : <Music size={24} />}
                        </div>
                      )}
                    </div>
                    <div className="nominee-info">
                      <span className="nominee-name">{vote.nomineeName || 'Unknown'}</span>
                      <span className="nominee-type">{isArtist ? 'Artist' : 'Song'}</span>
                    </div>
                  </div>
                  <div className="vote-right">
                    <span className="vote-date">{formatDate(vote.voteDate)}</span>
                    <span className="vote-interval">{getIntervalLabel(vote.interval)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <History size={48} />
              <p>No votes yet</p>
              <span>Go support your favorite artists and songs!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoteHistoryModal;