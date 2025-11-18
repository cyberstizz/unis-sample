// src/components/wizards/DeleteAccountWizard.jsx
import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './DeleteAccountWizard.scss';

const DeleteAccountWizard = ({ show, onClose }) => {
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [typedNameBackwards, setTypedNameBackwards] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!show) return null;

  const username = user?.username || '';
  const expectedBackwards = username.split('').reverse().join('');

  const canProceed = confirmed &&
    typedName === username &&
    typedNameBackwards === expectedBackwards;

  const handleDelete = async () => {
    if (!canProceed) return;

    setLoading(true);
    try {
      await apiCall({
        method: 'delete',
        url: '/v1/users/me',   // This should cascade-delete songs, votes, awards, etc.
      });

      logout();                    // Clear context + token
      navigate('/login');
      alert('Your account has been permanently deleted.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete account. Please contact support if this persists.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-wizard-overlay">
      <div className="upload-wizard" style={{ maxWidth: '540px' }}>
        <button className="close-button" onClick={onClose}>
          <X size={28} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ color: '#d9534f', marginBottom: '1rem' }}>
            <AlertTriangle size={64} strokeWidth={2} />
          </div>
          <h2 style={{ color: '#d9534f' }}>Delete Account Forever</h2>
        </div>

        {step === 1 ? (
          <>
            <p className="wizard-intro" style={{ color: '#d9534f', fontWeight: '600' }}>
              This action is permanent and cannot be undone.
            </p>
            <div className="step-content">
              <ul style={{ color: '#721c24', background: '#f8d7da', padding: '1rem', borderRadius: '8px', fontSize: '0.95rem' }}>
                <li>All your songs and videos will be deleted</li>
                <li>All votes and awards will be removed</li>
                <li>Your profile will disappear from leaderboards</li>
                <li>Supporters will no longer see your content</li>
                <li>There is no recovery — ever</li>
              </ul>

              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button
                  className="submit-upload-button"
                  style={{ background: '#dc3545' }}
                  onClick={() => setStep(2)}
                >
                  I Understand — Continue
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="wizard-intro">
              Final confirmation required. Prove it's really you.
            </p>

            <div className="step-content">

              <div className="form-group">
                <label className="upload-section-header" style={{ color: '#d9534f' }}>
                  <Trash2 size={18} /> Type your username
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={username}
                  style={{ borderColor: typedName === username ? '#28a745' : '#dc3545' }}
                />
              </div>

              <div className="form-group">
                <label className="upload-section-header" style={{ color: '#d9534f' }}>
                  Now type it backwards
                </label>
                <input
                  type="text"
                  value={typedNameBackwards}
                  onChange={(e) => setTypedNameBackwards(e.target.value)}
                  placeholder={expectedBackwards}
                  style={{ borderColor: typedNameBackwards === expectedBackwards ? '#28a745' : '#dc3545' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600', color: '#d9534f' }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    style={{ width: '1.2rem', height: '1.2rem' }}
                  />
                  I want to permanently delete my account and all my data
                </label>
              </div>

            </div>

            <div className="button-group">
              <button className="back-button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="submit-upload-button"
                style={{ background: canProceed ? '#dc3545' : '#6c757d' }}
                onClick={handleDelete}
                disabled={!canProceed || loading}
              >
                {loading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountWizard;