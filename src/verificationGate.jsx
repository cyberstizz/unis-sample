import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import PhoneVerificationModal from './phoneVerificationModal';
import './verificationGate.scss';

/**
 * VerificationGate
 * Wrap any feature that should require a verified phone (referral card, comment
 * box, vote action). When the signed-in user's phone is verified, children
 * render normally. Otherwise children are shown locked (blurred, non-interactive)
 * under an overlay with a "Verify your phone" CTA that opens the modal. On
 * success it refreshes the auth user so the gate re-opens automatically.
 *
 *   <VerificationGate title="Verify to refer & earn">
 *     <ReferralCodeCard ... />
 *   </VerificationGate>
 *
 * Pass `compact` for tight spaces (e.g. above a comment box).
 */
const VerificationGate = ({
  children,
  title = 'Verify your phone to unlock this',
  message = 'A quick phone check keeps Unis bot-free. It takes about a minute.',
  compact = false,
}) => {
  const { user, refreshUser } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Not logged in at all -> let the app's existing auth flow handle it; render as-is.
  if (!user) return children;

  if (user.phoneVerified) return children;

  const handleVerified = async () => {
    try {
      await refreshUser?.();
    } catch (_) {
      /* refresh failure is non-fatal; the next profile load will reflect it */
    }
  };

  return (
    <div className={`vgate ${compact ? 'vgate--compact' : ''}`}>
      <div className="vgate__content" aria-hidden="true">
        {children}
      </div>

      <div className="vgate__overlay">
        <div className="vgate__lock"><Lock size={compact ? 16 : 20} /></div>
        <strong>{title}</strong>
        {!compact && <p>{message}</p>}
        <button type="button" className="vgate__btn" onClick={() => setShowModal(true)}>
          Verify phone
        </button>
      </div>

      <PhoneVerificationModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onVerified={handleVerified}
      />
    </div>
  );
};

export default VerificationGate;