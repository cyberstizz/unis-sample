import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import unisLogo from '../assets/unisLogoThree.svg';
import spaceVideo from '../assets/space-bg.mp4';
import CreateAccountWizard from '../createAccountWizard'; 
import ForgotPasswordWizard from '../forgotPasswordWizard';
import './Login.scss';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [waitlistInfo, setWaitlistInfo] = useState(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowWaitlistModal(false);
    setWaitlistInfo(null);
    setLoading(true);

    const result = await login({ email, password });

    if (result.success) {
      navigate('/');
    } else {
      // Check if the error response contains waitlist data
      const data = result.data;
      if (data?.waitlist) {
        setWaitlistInfo(data);
        setShowWaitlistModal(true);
      } else {
        setError(result.error || 'Login failed');
      }
    }
    setLoading(false);
  };

  const handleCopyCode = () => {
    if (waitlistInfo?.referralCode) {
      navigator.clipboard.writeText(waitlistInfo.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const waitlistProgress = waitlistInfo
    ? Math.min(100, Math.round((waitlistInfo.regionSignupCount / waitlistInfo.regionThreshold) * 100))
    : 0;

  return (
    <div className="login-wrapper">
      <video
        className="login-bg-video"
        autoPlay
        loop
        muted
        playsInline
        src={spaceVideo}
      />

      <div className="login-overlay" />

      <div className="login-card">
        <img src={unisLogo} alt="UNIS" className="login-logo" />

        <h2 className="login-title">Welcome back</h2>

        {error && !showWaitlistModal && <p className="login-error">{error}</p>}

        {!showWaitlistModal && (
          <>
            <form onSubmit={handleSubmit} className="login-form">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Logging in…' : 'Login'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="forgot-password-btn"
              disabled={loading}
            >
              Forgot Password?
            </button>

            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="create-account-btn"
              disabled={loading}
            >
              Don't have an account? Create one
            </button>
          </>
        )}

        {showWaitlistModal && waitlistInfo && (
          <div style={{
            background: 'rgba(17,17,20,0.95)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(22,51,135,0.3)',
            marginTop: '20px',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="26" stroke="#163387" strokeWidth="2" fill="rgba(22,51,135,0.15)" />
                <path d="M28 16v12l7 3.5" stroke="#163387" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
              You're on the waitlist, {waitlistInfo.username}!
            </h3>
            <p style={{ color: '#A9A9A9', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              Unis isn't in <strong style={{ color: '#fff' }}>{waitlistInfo.metroRegion}</strong>,{' '}
              <strong style={{ color: '#fff' }}>{waitlistInfo.stateName}</strong> yet.
              Share your code to unlock it faster.
            </p>

            <div style={{
              background: '#0a0a0c',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid rgba(22,51,135,0.4)',
              marginBottom: '20px',
            }}>
              <div style={{
                color: '#A9A9A9', fontSize: '11px',
                letterSpacing: '1px', textTransform: 'uppercase',
                marginBottom: '6px',
              }}>
                Your Referral Code
              </div>
              <div style={{
                color: '#fff', fontSize: '28px', fontWeight: '700',
                letterSpacing: '3px', fontFamily: "'DM Sans', sans-serif",
              }}>
                {waitlistInfo.referralCode}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#A9A9A9', fontSize: '13px' }}>
                  {waitlistInfo.regionSignupCount} of {waitlistInfo.regionThreshold} signups
                </span>
                <span style={{ color: '#163387', fontSize: '13px', fontWeight: '600' }}>
                  {waitlistProgress}%
                </span>
              </div>
              <div style={{
                width: '100%', height: '8px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '4px', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${waitlistProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #163387, #2952cc)',
                  borderRadius: '4px',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>

            <button
              onClick={handleCopyCode}
              style={{
                width: '100%', padding: '14px',
                background: '#163387', color: '#fff', border: 'none',
                borderRadius: '10px', fontSize: '15px', fontWeight: '600',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {copied ? 'Copied!' : 'Copy Referral Code'}
            </button>

            <button
              onClick={() => {
                setShowWaitlistModal(false);
                setWaitlistInfo(null);
              }}
              style={{
                width: '100%', padding: '10px', marginTop: '10px',
                background: 'transparent', color: '#A9A9A9',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', fontSize: '13px', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>

      {showForgotPassword && (
        <ForgotPasswordWizard
          show={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      )}

      <CreateAccountWizard
        show={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          setShowWizard(false);
          navigate('/feed');
        }}
      />
    </div>
  );
};

export default Login;