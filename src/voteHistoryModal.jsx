import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, History, Music, User } from 'lucide-react';
import buildUrl from './utils/buildUrl';
import useModalA11y from './hooks/useModalA11y';
import './voteHistoryModal.scss';

// =============================================================================
// VoteHistoryModal -- purely presentational. Receives the full vote list from
// VoteHistorySection (which owns the single /v1/vote/history fetch).
//
// ★ FIX (containment): this modal is rendered from inside an
//   .artist-collapsible section. That section carries `animation: artist-rise
//   ... both`, whose final keyframe applies `transform: translateY(0)`, plus
//   `overflow: hidden`. A transformed ancestor becomes the containing block for
//   `position: fixed` descendants — so the overlay was never viewport-fixed at
//   all. It was a box trapped inside the section, clipped by its overflow, with
//   the close button scrolled out of reach.
//
//   We now render through a portal straight into <body>, which makes the modal
//   independent of whatever ancestor it's invoked from. It is also a true
//   full-screen sheet on mobile with a sticky header close button AND a sticky
//   footer Done button, so there is always a visible way out.
// =============================================================================
const VoteHistoryModal = ({ show, onClose, votes = [] }) => {
  const modalRef = useRef(null);
  useModalA11y({ active: show, onClose, modalRef });

  // ★ lock background scroll while the sheet is open (prevents the page from
  //    scrolling under the overlay on iOS Safari / Chrome mobile).
  useEffect(() => {
    if (!show) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [show]);

  if (!show) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const str = String(dateString);
    // bare YYYY-MM-DD parses as UTC midnight and shifts a day back in
    // timezones west of UTC (e.g. New York) — anchor to local noon.
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

  const modal = (
    <div className="vote-history-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="vote-history-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vh-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ★ mobile grab handle — signals "this sheet closes" */}
        <div className="vote-history-modal__grabber" aria-hidden="true" />

        {/* ★ header is sticky so the close button is ALWAYS reachable, no
            matter how far down the list you scroll. */}
        <div className="modal-header">
          <div className="modal-header__text">
            <h2 id="vh-title">Vote history</h2>
            <p className="modal-subtitle">
              <span className="modal-subtitle__count">{count}</span>
              <span className="modal-subtitle__label">{countLabel}</span>
            </p>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close vote history"
          >
            <X size={20} />
          </button>
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

        {/* ★ second, unmissable exit at the bottom of the sheet */}
        <div className="modal-footer">
          <button type="button" className="vote-history-modal__done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  // ★ portal out of any transformed / overflow-hidden ancestor.
  return createPortal(modal, document.body);
};

export default VoteHistoryModal;