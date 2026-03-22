import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosInstance from './components/axiosInstance';
import unisLogo from './assets/UnisFireFinal.png';
import './resetPassword.scss';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(token ? 'form' : 'invalid'); // form | success | invalid | error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await axiosInstance.post('/auth/reset-password', {
        token,
        newPassword,
      });
      setStep('success');
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg) {
        setError(msg);
      } else {
        setError('Something went wrong. Please try again.');
      }
      if (msg && (msg.includes('expired') || msg.includes('Invalid') || msg.includes('already been used'))) {
        setStep('error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-page">
      {/* Ambient background */}
      <div className="reset-bg-glow" />
      <div className="reset-bg-glow-secondary" />

      <div className="reset-card">
        <img src={unisLogo} alt="UNIS" className="reset-logo" />

        {/* ── No token ── */}
        {step === 'invalid' && (
          <div className="reset-state">
            <div className="reset-icon reset-icon-error">✕</div>
            <h2>Invalid Reset Link</h2>
            <p>This link is missing a reset token. Please request a new password reset from the login page.</p>
            <button className="reset-btn-primary" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        )}

        {/* ── Token expired / used ── */}
        {step === 'error' && (
          <div className="reset-state">
            <div className="reset-icon reset-icon-error">!</div>
            <h2>Link Expired</h2>
            <p>{error || 'This reset link has expired or has already been used. Please request a new one.'}</p>
            <button className="reset-btn-primary" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        )}

        {/* ── Form ── */}
        {step === 'form' && (
          <>
            <h2 className="reset-title">Set New Password</h2>
            <p className="reset-subtitle">Enter your new password below.</p>

            {error && (
              <div className="reset-error-banner">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="reset-form">
              <div className="reset-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  disabled={loading}
                />
              </div>

              <div className="reset-field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  disabled={loading}
                />
              </div>

              {/* Strength hint */}
              {newPassword.length > 0 && (
                <div className="reset-strength">
                  <div className={`reset-strength-bar ${
                    newPassword.length >= 12 ? 'strong' :
                    newPassword.length >= 8 ? 'good' : 'weak'
                  }`} />
                  <span>{
                    newPassword.length >= 12 ? 'Strong' :
                    newPassword.length >= 8 ? 'Good' : 'Too short'
                  }</span>
                </div>
              )}

              <button type="submit" className="reset-btn-primary" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>

            <button className="reset-btn-link" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="reset-state">
            <div className="reset-icon reset-icon-success">✓</div>
            <h2>Password Reset</h2>
            <p>Your password has been updated. You can now log in with your new password.</p>
            <button className="reset-btn-primary" onClick={() => navigate('/login')}>
              Go to Login
            </button>
          </div>
        )}
      </div>

      <p className="reset-footer">Unis Music Platform — Your block's beats.</p>
    </div>
  );
};

export default ResetPassword;