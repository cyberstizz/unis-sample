import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, ShieldCheck, ArrowRight } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './phoneVerificationModal.scss';

/**
 * PhoneVerificationModal
 *  step 'phone' -> POST /v1/phone/start { phoneNumber }
 *  step 'code'  -> POST /v1/phone/check { code }
 * Calls onVerified() once Twilio approves the code.
 */
const PhoneVerificationModal = ({ show, onClose, onVerified }) => {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const codeRef = useRef(null);

  useEffect(() => {
    if (!show) {
      // reset when closed so re-opening starts clean
      setStep('phone');
      setPhone('');
      setMaskedPhone('');
      setCode('');
      setError(null);
      setBusy(false);
    }
  }, [show]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  if (!show) return null;

  const sendCode = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiCall({ method: 'post', url: '/v1/phone/start', data: { phoneNumber: phone } });
      if (res.data?.alreadyVerified) {
        onVerified?.();
        onClose?.();
        return;
      }
      setMaskedPhone(res.data?.phone || '');
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send a code. Check the number and try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiCall({ method: 'post', url: '/v1/phone/check', data: { code } });
      if (res.data?.verified) {
        onVerified?.();
        onClose?.();
      } else {
        setError("That code didn't match. Try again.");
      }
    } catch (err) {
      setError(err.response?.data?.error || 'That code is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setCode('');
    setError(null);
    await sendCode();
  };

  return (
    <div className="pv-overlay" onClick={onClose}>
      <div
        className="pv-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Verify your phone number"
      >
        <button type="button" className="pv-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>

        <div className="pv-icon">
          <ShieldCheck size={26} />
        </div>

        {step === 'phone' ? (
          <>
            <h2>Verify your <em>phone</em></h2>
            <p className="pv-sub">
              We'll text you a 6-digit code. Verifying unlocks voting, comments, and referral
              earnings — and keeps Unis free of bots.
            </p>

            <label className="pv-field">
              <span><Phone size={13} /> Mobile number</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(212) 555-0134"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendCode(); }}
                autoFocus
              />
            </label>

            {error && <p className="pv-error">{error}</p>}

            <button type="button" className="pv-btn" onClick={sendCode} disabled={busy || !phone.trim()}>
              {busy ? 'Sending…' : <>Send code <ArrowRight size={15} /></>}
            </button>
          </>
        ) : (
          <>
            <h2>Enter the <em>code</em></h2>
            <p className="pv-sub">
              We texted a 6-digit code to {maskedPhone || 'your phone'}. Enter it below.
            </p>

            <label className="pv-field">
              <span>Verification code</span>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') verifyCode(); }}
                className="pv-code-input"
              />
            </label>

            {error && <p className="pv-error">{error}</p>}

            <button type="button" className="pv-btn" onClick={verifyCode} disabled={busy || code.length < 4}>
              {busy ? 'Verifying…' : <>Verify <ShieldCheck size={15} /></>}
            </button>

            <div className="pv-foot">
              <button type="button" className="pv-link" onClick={() => setStep('phone')}>Change number</button>
              <span aria-hidden="true">·</span>
              <button type="button" className="pv-link" onClick={resend} disabled={busy}>Resend code</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PhoneVerificationModal;