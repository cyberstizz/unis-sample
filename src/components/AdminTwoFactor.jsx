// ─────────────────────────────────────────────────────────────────────────────
// AdminTwoFactor — the second step of sign-in for staff accounts
// (moderator, admin, super admin).
//
// After the password is right, the server answers { mfaRequired, setupRequired,
// mfaToken } instead of a session. This component finishes the job:
//
//   verify  — "Enter the 6-digit code from your authenticator app" (or a
//             recovery code) → POST /auth/mfa/verify → session token.
//   setup   — first time only: show a QR code to scan with Google
//             Authenticator (or any authenticator app), confirm one code
//             → POST /auth/mfa/setup/confirm → session token + 10 recovery codes.
//   codes   — show the recovery codes once; continue only after
//             "I saved these" is ticked.
//
// Rendered inside the Login card, so it reuses the Login form styles.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { apiCall } from './axiosInstance';
import './adminTwoFactor.scss';

const errorText = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.error || fallback;

const AdminTwoFactor = ({ mfa, onComplete, onCancel }) => {
  const [step, setStep] = useState(mfa?.setupRequired ? 'setup' : 'verify');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState(null);       // { manualKey, qrDataUrl }
  const [result, setResult] = useState(null);     // { token, recoveryCodes } after setup
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const setupStarted = useRef(false);

  // First-time setup: ask the server for a new secret, then draw its QR code.
  useEffect(() => {
    if (step !== 'setup' || setupStarted.current) return;
    setupStarted.current = true;
    (async () => {
      setBusy(true);
      try {
        const res = await apiCall({ url: '/auth/mfa/setup', method: 'post', data: { mfaToken: mfa.mfaToken } });
        const qrDataUrl = await QRCode.toDataURL(res.data.otpauthUri, { margin: 1, width: 232 });
        setSetup({ manualKey: res.data.manualKey, qrDataUrl });
      } catch (err) {
        console.error('[2FA] setup failed:', err?.message || err);
        setError(errorText(err, 'Setup could not start. Go back and sign in again.'));
      } finally {
        setBusy(false);
      }
    })();
  }, [step, mfa]);

  useEffect(() => {
    if ((step === 'verify' || (step === 'setup' && setup)) && inputRef.current) inputRef.current.focus();
  }, [step, setup, useRecovery]);

  const submitVerify = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiCall({
        url: '/auth/mfa/verify',
        method: 'post',
        data: { mfaToken: mfa.mfaToken, code: code.trim() },
      });
      await onComplete(res.data.token, { recoveryCodesLeft: res.data.recoveryCodesLeft, usedRecovery: useRecovery });
    } catch (err) {
      console.error('[2FA] verify failed:', err?.response?.status || err?.message);
      setError(errorText(err, "That code didn't work. Try the newest code."));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const submitSetup = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiCall({
        url: '/auth/mfa/setup/confirm',
        method: 'post',
        data: { mfaToken: mfa.mfaToken, code: code.trim() },
      });
      setResult({ token: res.data.token, recoveryCodes: res.data.recoveryCodes || [] });
      setStep('codes');
    } catch (err) {
      console.error('[2FA] setup confirm failed:', err?.response?.status || err?.message);
      setError(errorText(err, "That code didn't match. Try the newest code."));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const codesText = () =>
    ['Unis recovery codes — each works once.', 'Use one if your phone is unavailable.', '', ...(result?.recoveryCodes || [])].join('\n');

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codesText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[2FA] copy failed:', err?.message || err);
    }
  };

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([codesText()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unis-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const finishSetup = async () => {
    setBusy(true);
    try {
      await onComplete(result.token, { recoveryCodesLeft: result.recoveryCodes.length });
    } finally {
      setBusy(false);
    }
  };

  // ── Save your recovery codes ──────────────────────────────────────────────
  if (step === 'codes' && result) {
    return (
      <div className="tfa">
        <h2 className="tfa-title">Save your recovery codes</h2>
        <p className="tfa-text">
          If your phone is lost or reset, each of these lets you sign in once. This is the only time
          they're shown. Keep them in your password manager.
        </p>
        <ol className="tfa-codes" aria-label="Recovery codes">
          {result.recoveryCodes.map((c) => <li key={c}><code>{c}</code></li>)}
        </ol>
        <div className="tfa-row">
          <button type="button" className="tfa-secondary" onClick={copyCodes}>{copied ? 'Copied' : 'Copy all'}</button>
          <button type="button" className="tfa-secondary" onClick={downloadCodes}>Download .txt</button>
        </div>
        <label className="tfa-check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>I saved these somewhere safe</span>
        </label>
        <div className="login-form">
          <button type="button" onClick={finishSetup} disabled={!saved || busy}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  // ── First-time setup ──────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="tfa">
        <h2 className="tfa-title">Set up two-factor sign-in</h2>
        <p className="tfa-text">
          Staff accounts need a code from an authenticator app (Google Authenticator, Microsoft
          Authenticator, 1Password, Salesforce Authenticator and others all work).
        </p>
        {error && <p className="login-error" role="alert">{error}</p>}
        {!setup && !error && <p className="tfa-text" role="status">Preparing your code…</p>}
        {setup && (
          <>
            <ol className="tfa-steps">
              <li>In your authenticator app, add an account and scan this code.</li>
            </ol>
            <img className="tfa-qr" src={setup.qrDataUrl} alt="QR code for your authenticator app" width="232" height="232" />
            <details className="tfa-manual">
              <summary>Can't scan? Enter this key instead</summary>
              <code className="tfa-key">{setup.manualKey}</code>
              <span className="tfa-hint">Account: your email · Type: time-based</span>
            </details>
            <ol className="tfa-steps" start={2}>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <form className="login-form" onSubmit={submitSetup}>
              <input
                ref={inputRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                placeholder="6-digit code"
                aria-label="6-digit code from your authenticator app"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                required
              />
              <button type="submit" disabled={busy || code.replace(/\s/g, '').length !== 6}>
                {busy ? 'Checking…' : 'Turn on two-factor sign-in'}
              </button>
            </form>
          </>
        )}
        <button type="button" className="forgot-password-btn" onClick={onCancel} disabled={busy}>
          Back to sign in
        </button>
      </div>
    );
  }

  // ── Every sign-in after setup ─────────────────────────────────────────────
  return (
    <div className="tfa">
      <h2 className="tfa-title">Two-factor sign-in</h2>
      <p className="tfa-text">
        {useRecovery
          ? 'Enter one of your recovery codes. Each one works once.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      {error && <p className="login-error" role="alert">{error}</p>}
      <form className="login-form" onSubmit={submitVerify}>
        <input
          ref={inputRef}
          inputMode={useRecovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={useRecovery ? 11 : 7}
          placeholder={useRecovery ? 'xxxxx-xxxxx' : '6-digit code'}
          aria-label={useRecovery ? 'Recovery code' : '6-digit code from your authenticator app'}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={busy}
          required
        />
        <button type="submit" disabled={busy || !code.trim()}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
      <button
        type="button"
        className="forgot-password-btn"
        onClick={() => { setUseRecovery((v) => !v); setCode(''); setError(''); }}
        disabled={busy}
      >
        {useRecovery ? 'Use my authenticator app' : 'Use a recovery code'}
      </button>
      <button type="button" className="forgot-password-btn" onClick={onCancel} disabled={busy}>
        Back to sign in
      </button>
    </div>
  );
};

export default AdminTwoFactor;
