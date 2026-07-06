import React, { useRef } from 'react';    
import { X, History, Music, User } from 'lucide-react';
import buildUrl from './utils/buildUrl';
import useModalA11y from './hooks/useModalA11y';
import './voteHistoryModal.scss';


// =============================================================================
// VoteHistoryModal -- purely presentational. Receives the full vote list from
// VoteHistorySection (which owns the single /v1/vote/history fetch). No data
// fetching, no dummy data. Images go through the shared buildUrl for R2/CDN
// consistency. Visual language mirrors SupportedArtistPicker so the two modals
// read as one family.
// =============================================================================
const VoteHistoryModal = ({ show, onClose, votes = [] }) => {

  const modalRef = useRef(null);
  useModalA11y({ active: show, onClose, modalRef });

  if (!show) return null;
  

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const str = String(dateString);
    // ★ item 11: bare YYYY-MM-DD parses as UTC midnight and shifts a day back
    // in timezones west of UTC (e.g. New York) — anchor to local noon.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(`${str}T12:00:00`) : new Date(str);
    if (Number.isNaN(date.getTime())) return '';
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

  const count = votes.length;
  const countLabel = count === 1 ? 'vote cast' : 'votes cast';
  

  return (
    <div className="vote-history-modal-overlay" onClick={onClose}>
      <div
        className="vote-history-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vh-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close-button" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>

        <div className="modal-header">
          <h2 id="vh-title">Vote history</h2>
          <p className="modal-subtitle">
            <span className="modal-subtitle__count">{count}</span>
            <span className="modal-subtitle__label">{countLabel}</span>
          </p> {/* ★ item 11: removed the dangling "You voted for" line — the rows speak for themselves */}
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
                          {isArtist ? <User size={20} /> : <Music size={20} />}
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
              <History size={44} />
              <p>No votes yet</p>
              <span>Go support your favorite artists and songs.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoteHistoryModal;