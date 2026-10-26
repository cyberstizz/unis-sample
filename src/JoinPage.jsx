// ─────────────────────────────────────────────────────────────────────────────
// /join/:code — the link printed on posters, QR codes, crew cards and ads.
//
// It keeps the code in this browser (utils/referralLink) and opens sign-up
// with the code already filled in:
//   • before launch: the Coming soon page, with the sign-up form open;
//   • after launch:  the login page's sign-up (/login?signup=1).
// /join with no code (or ?ref=CODE) works the same way. This path is open
// before launch (prelaunch/prelaunchConfig OPEN_PATHS).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import ComingSoon from './prelaunch/ComingSoon';
import { isPrelaunch } from './prelaunch/prelaunchConfig';
import { cleanReferral, storeReferral } from './utils/referralLink';

const JoinPage = () => {
  const { code } = useParams();
  const [params] = useSearchParams();
  const clean = cleanReferral(code || params.get('ref'));

  useEffect(() => {
    if (clean) storeReferral(clean);
  }, [clean]);

  if (isPrelaunch()) return <ComingSoon autoSignup initialReferralCode={clean} />;
  // The effect above stores the code in the same commit as this redirect, so
  // the sign-up form on /login finds it when it opens.
  return <Navigate to="/login?signup=1" replace />;
};

export default JoinPage;
