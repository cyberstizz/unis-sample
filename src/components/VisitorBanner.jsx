// =============================================================================
// VisitorBanner — one line at the top of every app page for a visitor:
// "Visiting from Dallas. Voting opens when Dallas does.  31%  Share my code"
// Rendered by Layout only when useAuth().user.visitor is true.
// =============================================================================
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import useRegionProgress from '../hooks/useRegionProgress';
import { isVisitor, shareVisitorCode, visitorCity } from '../utils/visitor';
import './visitor.scss';

// Read through try/catch: Layout renders this on every page, including pages
// rendered without AuthProvider (tests, isolated previews), where useAuth
// throws. useContext still runs on every render, so the hook order is stable.
const useSignedInUser = () => {
  try {
    return useAuth()?.user || null;
  } catch {
    return null;
  }
};

const VisitorBanner = () => {
  const user = useSignedInUser();
  const feedback = useFeedback();
  const { progress } = useRegionProgress(user?.visitorStateCode, user?.visitorCity);
  if (!isVisitor(user)) return null;

  const city = visitorCity(user);
  const pct = progress ? Math.round(Math.max(0, Math.min(100, Number(progress.progressPercent) || 0))) : null;

  return (
    <div className="vb" role="note" aria-label="Visitor account">
      <svg className="vb__pin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="10" r="3" />
        <path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" />
      </svg>
      <span className="vb__text">
        Visiting from {city}. Listen, like, make playlists and message anyone. Voting opens when {city} does.
      </span>
      {pct !== null && (
        <span className="vb__pct" title={`${city} is ${pct}% of the way to opening`}>{pct}%</span>
      )}
      <button type="button" className="vb__share" onClick={() => shareVisitorCode(user, feedback)}>
        Share my code
      </button>
    </div>
  );
};

export default VisitorBanner;
