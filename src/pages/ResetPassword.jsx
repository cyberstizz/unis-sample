import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import Layout from '../layout';
import backimage from '../assets/randomrapper.jpeg';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid reset link — no token found.');
      return;
    }

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
      await apiCall({
        url: '/auth/reset-password',
        method: 'post',
        data: { token, newPassword }
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Layout backgroundImage={backimage}>
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          minHeight: '80vh', padding: '20px'
        }}>
          <div style={{
            background: 'rgba(26, 26, 26, 0.9)', borderRadius: '16px',
            padding: '50px', maxWidth: '500px', width: '100%', textAlign: 'center'
          }}>
            <h2 style={{ color: '#fff', marginBottom: '16px' }}>Password Reset Successfully</h2>
            <p style={{ color: '#C0C0C0' }}>Redirecting to login...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundImage={backimage}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '80vh', padding: '20px'
      }}>
        <div style={{
          background: 'rgba(26, 26, 26, 0.9)', borderRadius: '16px',
          padding: '50px', maxWidth: '500px', width: '100%'
        }}>
          <h2 style={{ color: '#fff', marginBottom: '8px', textAlign: 'center' }}>Reset Your Password</h2>
          <p style={{ color: '#A9A9A9', textAlign: 'center', marginBottom: '30px' }}>
            Enter your new password below.
          </p>

          {error && (
            <div style={{
              background: 'rgba(220, 53, 69, 0.2)', border: '1px solid #dc3545',
              borderRadius: '8px', padding: '12px', marginBottom: '20px',
              color: '#ff6b7a', textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#C0C0C0', marginBottom: '8px' }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: '16px', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: '#C0C0C0', marginBottom: '8px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: '16px', boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: '8px',
              background: '#163387', color: '#fff', border: 'none',
              fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;