import React, { useState } from 'react';
import axiosInstance from './components/axiosInstance';
import { useAuth } from './context/AuthContext';

const ChangePasswordWizard = ({ show, onClose }) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await axiosInstance.put(`/v1/users/profile/${user.userId}/password`, {
        oldPassword: currentPassword,
        newPassword: newPassword
      });
      setStep(2);
    } catch (err) {
      const msg = err.response?.data;
      if (typeof msg === 'string' && msg.includes('Old password incorrect')) {
        setError('Current password is incorrect.');
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStep(1);
    setError('');
    onClose();
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 10000
    }} onClick={handleClose}>
      <div style={{
        background: '#1a1a1a', borderRadius: '16px', padding: '40px',
        maxWidth: '450px', width: '90%', border: '1px solid rgba(255,255,255,0.1)'
      }} onClick={(e) => e.stopPropagation()}>

        {step === 1 && (
          <>
            <h2 style={{ color: '#fff', marginBottom: '24px' }}>Change Password</h2>

            {error && (
              <div style={{
                background: 'rgba(220,53,69,0.2)', border: '1px solid #dc3545',
                borderRadius: '8px', padding: '10px', marginBottom: '16px',
                color: '#ff6b7a', fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#A9A9A9', marginBottom: '6px', fontSize: '14px' }}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                  color: '#fff', fontSize: '16px', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#A9A9A9', marginBottom: '6px', fontSize: '14px' }}>
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

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#A9A9A9', marginBottom: '6px', fontSize: '14px' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                  color: '#fff', fontSize: '16px', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleClose}
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
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ color: '#fff', marginBottom: '8px' }}>Password Changed</h2>
            <p style={{ color: '#A9A9A9', marginBottom: '24px', fontSize: '14px' }}>
              Your password has been updated successfully.
            </p>
            <button onClick={handleClose}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                background: '#163387', color: '#fff', border: 'none', cursor: 'pointer'
              }}>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordWizard;