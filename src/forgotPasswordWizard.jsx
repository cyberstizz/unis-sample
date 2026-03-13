import React, { useState } from 'react';
import axiosInstance from './components/axiosInstance';

const ForgotPasswordWizard = ({ show, onClose }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axiosInstance.post('/auth/forgot-password', { email });
    } catch (e) {
      // Intentionally ignore — backend always returns 200
    }

    // Always show success to prevent email enumeration
    setStep(2);
    setLoading(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 10000
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a1a', borderRadius: '16px', padding: '40px',
        maxWidth: '450px', width: '90%', border: '1px solid rgba(255,255,255,0.1)'
      }} onClick={(e) => e.stopPropagation()}>

        {step === 1 && (
          <>
            <h2 style={{ color: '#fff', marginBottom: '8px' }}>Forgot Password</h2>
            <p style={{ color: '#A9A9A9', marginBottom: '24px', fontSize: '14px' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && (
              <div style={{
                background: 'rgba(220,53,69,0.2)', border: '1px solid #dc3545',
                borderRadius: '8px', padding: '10px', marginBottom: '16px',
                color: '#ff6b7a', fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: '16px', marginBottom: '20px', boxSizing: 'border-box'
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onClose}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.1)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  background: '#163387', color: '#fff', border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ color: '#fff', marginBottom: '8px' }}>Check Your Email</h2>
            <p style={{ color: '#A9A9A9', marginBottom: '8px', fontSize: '14px' }}>
              If an account exists with <strong style={{ color: '#fff' }}>{email}</strong>, 
              we've sent a password reset link.
            </p>
            <p style={{ color: '#A9A9A9', marginBottom: '24px', fontSize: '14px' }}>
              Check your inbox and spam folder. The link expires in 1 hour.
            </p>
            <button onClick={onClose}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                background: '#163387', color: '#fff', border: 'none', cursor: 'pointer'
              }}>
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordWizard;