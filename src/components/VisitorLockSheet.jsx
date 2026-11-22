// =============================================================================
// VisitorLockSheet — what a visitor sees instead of the voting or upload wizard.
//
// Visitors joined from outside an open area (utils/visitor.js). They can't
// vote or upload until their own city opens; the server refuses both anyway
// (VISITOR_NO_VOTE / VISITOR_UPLOAD_LOCKED). This sheet says why, shows how
// close their city is, and turns the moment into a reason to share their code.
//
//   kind="vote"    "Harlem votes on Harlem."  Keep listening | Share my code
//   kind="upload"  "Uploads open with Dallas." Got it
//
// Bottom sheet on phones, centered dialog on wider screens. Theme-aware
// through --unis-primary; dark text on the yellow theme (visitor.scss).
// =============================================================================
import React, { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import useModalA11y from '../hooks/useModalA11y';
import useRegionProgress from '../hooks/useRegionProgress';
import { OPEN_AREA_NAME, shareVisitorCode, visitorCity, visitorPlace } from '../utils/visitor';
import './visitor.scss';

const count = (n) => Number(n || 0).toLocaleString('en-US');

const LockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
);

/** "312 of 1,000" with a bar, for the visitor's own city. */
export const VisitorMeter = ({ user }) => {
  const city = visitorCity(user);
  const { loading, progress } = useRegionProgress(user?.visitorStateCode, user?.visitorCity);
  if (!user?.visitorCity) return null;
  const pct = progress ? Math.max(0, Math.min(100, Number(progress.progressPercent) || 0)) : 0;
  const left = progress ? Math.max(0, Number(progress.threshold) - Number(progress.signupCount)) : 0;

  let line;
  if (loading && !progress) line = 'Counting…';
  else if (!progress) line = 'We couldn’t load the count just now.';
  else if (progress.readyToActivate) line = `${city} hit its number. It opens soon.`;
  else line = `${count(left)} more and ${city} opens. Your code brings it closer.`;

  return (
    <div className="vl-meter">
      <div className="vl-meter__top">
        <b>{city}</b>
        {progress && <span>{count(progress.signupCount)} of {count(progress.threshold)}</span>}
      </div>
      <div
        className="vl-meter__bar"
        role="progressbar"
        aria-label={`${city} sign-ups`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="vl-meter__line" aria-live="polite">{line}</p>
    </div>
  );
};

const VisitorLockSheet = ({ kind = 'vote', nomineeName = '', onClose }) => {
  const { user } = useAuth();
  const feedback = useFeedback();
  const ref = useRef(null);
  useModalA11y({ active: true, onClose, modalRef: ref });

  const place = visitorPlace(user) || 'your city';
  const city = visitorCity(user);
  const isVote = kind === 'vote';

  return (
    <div className="vl-overlay" onClick={onClose}>
      <div
        ref={ref}
        className="vl-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vl-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="vl-sheet__handle" aria-hidden="true" />
        <button type="button" className="vl-sheet__close" aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="vl-sheet__icon"><LockIcon /></div>

        {isVote ? (
          <>
            <h2 id="vl-title" className="vl-sheet__title">
              {OPEN_AREA_NAME} votes on <em>{OPEN_AREA_NAME}.</em>
            </h2>
            <p className="vl-sheet__body">
              You&rsquo;re visiting from {place}. Your plays and likes still support
              {nomineeName ? ` ${nomineeName}` : ' this artist'}. Your vote opens the day {city} does.
            </p>
          </>
        ) : (
          <>
            <h2 id="vl-title" className="vl-sheet__title">
              Uploads open with <em>{city}.</em>
            </h2>
            <p className="vl-sheet__body">
              Your artist name is held. Until {city} opens you can listen, follow, comment and
              message like everyone else, and your songs go up on day one.
            </p>
          </>
        )}

        <VisitorMeter user={user} />

        {isVote ? (
          <div className="vl-sheet__actions">
            <button type="button" className="vl-btn vl-btn--ghost" onClick={onClose}>Keep listening</button>
            <button type="button" className="vl-btn vl-btn--primary" onClick={() => shareVisitorCode(user, feedback)}>
              Share my code
            </button>
          </div>
        ) : (
          <div className="vl-sheet__actions vl-sheet__actions--one">
            <button type="button" className="vl-btn vl-btn--primary" onClick={onClose}>Got it</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitorLockSheet;
