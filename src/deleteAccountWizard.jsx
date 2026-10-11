import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './deleteAccountWizard.scss';

// What happens on deletion is decided by the backend (UserService.deleteAccount)
// and described in the help center (/help#deleting-account). The list below
// must say the same thing.
//
// Money rule ($50 — the payout minimum):
//   - a payout still processing → wait for it to finish
//   - $50 or more waiting       → cash it out from Earnings first
//   - under $50                 → tick "I give up my $X.XX" to continue
const DeleteAccountWizard = ({ show, onClose }) => {
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [forfeitConfirmed, setForfeitConfirmed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [typedNameBackwards, setTypedNameBackwards] = useState('');
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState(null);       // GET /v1/users/me/deletion-check
  const [checkError, setCheckError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Fresh balance check every time the wizard opens.
  useEffect(() => {
    if (!show) return undefined;
    let active = true;
    setCheck(null);
    setCheckError('');
    setDeleteError('');
    setForfeitConfirmed(false);
    apiCall({ method: 'get', url: '/v1/users/me/deletion-check', useCache: false })
      .then((res) => { if (active) setCheck(res?.data || null); })
      .catch((err) => {
        console.error('[DeleteAccount] deletion check failed:', err);
        if (active) setCheckError('We could not check your earnings balance. Please try again in a moment.');
      });
    return () => { active = false; };
  }, [show]);

  if (!show) return null;

  const username = user?.username || '';
  const expectedBackwards = username.split('').reverse().join('');

  const balance = check ? Number(check.availableBalance || 0).toFixed(2) : null;
  const blockedByMoney = !!check && (!!check.payoutProcessing || !!check.mustCashOut);
  const needsForfeit = !!check && !!check.mustConfirmForfeit;

  const canProceed = !!check && !blockedByMoney &&
    confirmed &&
    (!needsForfeit || forfeitConfirmed) &&
    typedName === username &&
    typedNameBackwards === expectedBackwards;

  const handleDelete = async () => {
    if (!canProceed) return;

    setLoading(true);
    setDeleteError('');
    try {
      await apiCall({
        method: 'delete',
        url: needsForfeit ? '/v1/users/me?forfeitBalance=true' : '/v1/users/me',
      });

      logout();
      navigate('/login');
      alert('Your account has been permanently deleted.');
    } catch (err) {
      console.error('[DeleteAccount] delete failed:', err);
      // 409 = refused for a reason the user can fix (balance, payout in
      // progress). The message says exactly what to do.
      setDeleteError(
        err?.response?.data?.error ||
        'Failed to delete account. Please contact support if this persists.'
      );
    } finally {
      setLoading(false);
    }
  };

  const goToEarnings = () => {
    onClose();
    navigate('/earnings');
  };

  const moneyNotice = () => {
    if (checkError) {
      return <p role="alert" style={{ color: '#721c24', fontWeight: 600 }}>{checkError}</p>;
    }
    if (!check) {
      return <p role="status">Checking your earnings balance…</p>;
    }
    if (check.payoutProcessing) {
      return (
        <p role="alert" style={{ color: '#721c24', fontWeight: 600 }}>
          A payout is still on its way to your bank. You can delete your account once it finishes.
        </p>
      );
    }
    if (check.mustCashOut) {
      return (
        <>
          <p role="alert" style={{ color: '#721c24', fontWeight: 600 }}>
            You have ${balance} in earnings. Cash it out before deleting your account.
          </p>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button className="submit-upload-button" onClick={goToEarnings}>
              Go to Earnings
            </button>
          </div>
        </>
      );
    }
    if (needsForfeit) {
      return (
        <p style={{ color: '#721c24', fontWeight: 600 }}>
          You have ${balance} in earnings. That&rsquo;s under the ${Number(check.payoutThreshold || 50).toFixed(0)} payout
          minimum, so it can&rsquo;t be paid out. Deleting your account gives it up.
        </p>
      );
    }
    return null;
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
                <li>Your songs are removed and your videos are deleted. Songs that won awards stay in the winners history.</li>
                <li>Your profile, photos, likes, follows, comments and playlists are removed.</li>
                <li>Votes you already cast stay in results decided before today, without your details.</li>
                <li>Your username stays reserved — nobody else can ever take it.</li>
                <li>People who support you will pick a new artist.</li>
                <li>There is no recovery — ever</li>
              </ul>

              {moneyNotice()}

              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button
                  className="submit-upload-button"
                  style={{ background: blockedByMoney || !check ? '#6c757d' : '#dc3545' }}
                  onClick={() => setStep(2)}
                  disabled={!check || blockedByMoney}
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

              {needsForfeit && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600', color: '#d9534f' }}>
                    <input
                      type="checkbox"
                      checked={forfeitConfirmed}
                      onChange={(e) => setForfeitConfirmed(e.target.checked)}
                      style={{ width: '1.2rem', height: '1.2rem' }}
                    />
                    I give up my ${balance} earnings balance
                  </label>
                </div>
              )}

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

              {deleteError && (
                <p role="alert" style={{ color: '#721c24', fontWeight: 600 }}>{deleteError}</p>
              )}

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
