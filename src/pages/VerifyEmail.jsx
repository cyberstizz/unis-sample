// src/pages/VerifyEmail.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import unisLogo from '../assets/unisLogoThree.svg';

const wrap = {
  position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#06070b', padding: 24, fontFamily: "'Plus Jakarta Sans','Inter',-apple-system,sans-serif",
};
const card = {
  width: '90%', maxWidth: 420, padding: '40px 32px', textAlign: 'center', borderRadius: 22,
  background: 'rgba(12,14,22,0.72)', border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
  boxShadow: '0 30px 70px rgba(0,0,0,0.55)',
};
const h1 = { color: '#f4f6fb', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' };
const sub = { color: '#9aa3b2', fontSize: 15, lineHeight: 1.6, margin: 0 };
const btn = {
  width: '100%', height: 54, marginTop: 24, border: 'none', borderRadius: 12, fontSize: 16,
  fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#2952cc,#163387)',
  cursor: 'pointer', fontFamily: 'inherit',
};
const ghost = {
  ...btn, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)', fontWeight: 600,
};
const input = {
  width: '100%', height: 52, marginTop: 16, padding: '0 14px', borderRadius: 12, fontSize: 15,
  color: '#f4f6fb', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  fontFamily: 'inherit',
};

const CheckMark = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
    <circle cx="32" cy="32" r="30" stroke="#22c55e" strokeWidth="2" fill="rgba(34,197,94,0.12)" />
    <path d="M21 33l7 7 15-16" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
const Warning = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
    <circle cx="32" cy="32" r="30" stroke="#f59e0b" strokeWidth="2" fill="rgba(245,158,11,0.12)" />
    <path d="M32 20v16" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="44" r="2.2" fill="#f59e0b" />
  </svg>
);
const Spinner = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" style={{ margin: '0 auto 16px', display: 'block', animation: 'unisSpin 0.9s linear infinite' }}>
    <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
    <path d="M24 4a20 20 0 0 1 20 20" stroke="#6b8aff" strokeWidth="4" strokeLinecap="round" fill="none" />
    <style>{`@keyframes unisSpin{to{transform:rotate(360deg);transform-origin:center}}`}</style>
  </svg>
);

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    (async () => {
      try {
        await apiCall({ url: `/auth/verify-email?token=${encodeURIComponent(token)}`, method: 'get' });
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'This verification link is invalid or has expired.');
      }
    })();
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) { setResendMsg('Enter your email first.'); return; }
    setResendMsg('Sending…');
    try {
      await apiCall({ url: '/auth/resend-verification', method: 'post', data: { email: resendEmail } });
      setResendMsg('If an unverified account exists for that email, a new link is on its way.');
    } catch {
      setResendMsg('Could not resend right now. Please try again shortly.');
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <img src={unisLogo} alt="UNIS" style={{ width: 120, marginBottom: 24 }} />

        {status === 'verifying' && (
          <>
            <Spinner />
            <h1 style={h1}>Verifying…</h1>
            <p style={sub}>Confirming your email, one moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckMark />
            <h1 style={h1}>Email verified</h1>
            <p style={sub}>Your account is active. You can log in now.</p>
            <button style={btn} onClick={() => navigate('/login')}>Go to Login</button>
          </>
        )}

        {status === 'error' && (
          <>
            <Warning />
            <h1 style={h1}>Couldn't verify</h1>
            <p style={sub}>{message}</p>
            <input
              style={input}
              type="email"
              placeholder="Your email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
            />
            <button style={ghost} onClick={handleResend}>Resend verification link</button>
            {resendMsg && <p style={{ ...sub, fontSize: 13, marginTop: 12 }}>{resendMsg}</p>}
            <button style={{ ...ghost, marginTop: 12 }} onClick={() => navigate('/login')}>Back to Login</button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;