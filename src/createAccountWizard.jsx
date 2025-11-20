// src/components/wizards/CreateAccountWizard.jsx   ← FINAL WORKING VERSION
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { JURISDICTION_IDS, GENRE_IDS } from './utils/idMappings';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const CreateAccountWizard = ({ show, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'listener',
    jurisdictionId: '',
    genreId: '',
    bio: '',
    photoFile: null,
    songFile: null,
    supportedArtistId: null,
  });
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  // ← THIS WAS THE MISSING BRACE THAT CAUSED 500!
  useEffect(() => {
    if (step === 3 && show && formData.role === 'listener') {
      apiCall({ url: '/v1/users/artists/active' })
        .then(res => setArtists(res.data || []))
        .catch(() => setError('Could not load artists'));
    }
  }, [step, show, formData.role]);   // ← Critical dependency added

  const next = () => setStep(s => s + 1);
  const prev = () => setStep(s => s - 1);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      let photoUrl = null;
      let defaultSongId = null;

      // Upload photo if provided
      if (formData.photoFile) {
        const fd = new FormData();
        fd.append('photo', formData.photoFile);
        const res = await apiCall({ method: 'patch', url: '/v1/users/profile/photo', data: fd });
        photoUrl = res.data.photoUrl;
      }

      // Upload default song if artist
      if (formData.role === 'artist' && formData.songFile) {
        const fd = new FormData();
        fd.append('title', `${formData.username}'s Debut`);
        fd.append('genreId', formData.genreId);
        fd.append('jurisdictionId', formData.jurisdictionId);
        fd.append('file', formData.songFile);
        if (formData.photoFile) fd.append('artwork', formData.photoFile);

        const res = await apiCall({ method: 'post', url: '/v1/media/song', data: fd });
        defaultSongId = res.data.songId;
      }

      // Final registration
      const payload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        jurisdictionId: formData.jurisdictionId,
        genreId: formData.role === 'artist' ? formData.genreId : null,
        bio: formData.bio || null,
        photoUrl,
        defaultSongId,
        supportedArtistId: formData.role === 'listener' ? formData.supportedArtistId : null,
      };

      const res = await apiCall({ method: 'post', url: '/v1/users/register', data: payload });
      localStorage.setItem('token', res.data.token);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const maxSteps = formData.role === 'artist' ? 4 : 3;

  return (
    <div className="upload-wizard-overlay">
      <div className="upload-wizard">
        <button className="close-button" onClick={onClose}><X size={28} /></button>
        <h2>Create Unis Account</h2>
        <p className="wizard-intro">Step {step} of {maxSteps}</p>

        <div className="progress-bar">
          <div className="progress" style={{ width: `${(step / maxSteps) * 100}%` }} />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="step-content">

          {/* Step 1 */}
          {step === 1 && (
            <>
              <h3 className="upload-section-header">Basics</h3>
              <input placeholder="Username" value={formData.username} onChange={e => update('username', e.target.value)} />
              <input type="email" placeholder="Email" value={formData.email} onChange={e => update('email', e.target.value)} />
              <input type="password" placeholder="Password" value={formData.password} onChange={e => update('password', e.target.value)} />
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <h3 className="upload-section-header">Who Are You?</h3>
              <select value={formData.role} onChange={e => update('role', e.target.value)}>
                <option value="listener">Listener (Fan)</option>
                <option value="artist">Artist</option>
              </select>

              <label className="upload-section-header">Your Harlem</label>
              <select value={formData.jurisdictionId} onChange={e => update('jurisdictionId', e.target.value)}>
                <option value="">Select...</option>
                <option value={JURISDICTION_IDS['uptown-harlem']}>Uptown Harlem</option>
                <option value={JURISDICTION_IDS['downtown-harlem']}>Downtown Harlem</option>
              </select>
            </>
          )}

          {/* Step 3 – Listener: Support Artist */}
          {step === 3 && formData.role === 'listener' && (
            <>
              <h3 className="upload-section-header">Support an Artist</h3>
              <select value={formData.supportedArtistId || ''} onChange={e => update('supportedArtistId', e.target.value)}>
                <option value="">Choose who you support</option>
                {artists.map(a => (
                  <option key={a.userId} value={a.userId}>{a.username}</option>
                ))}
              </select>
            </>
          )}

          {/* Step 3 – Artist: Details */}
          {step === 3 && formData.role === 'artist' && (
            <>
              <h3 className="upload-section-header">Artist Setup</h3>
              <select value={formData.genreId} onChange={e => update('genreId', e.target.value)}>
                <option value="">Genre</option>
                {Object.keys(GENRE_IDS).map(key => (
                  <option key={key} value={GENRE_IDS[key]}>{key.replace('-', '/').toUpperCase()}</option>
                ))}
              </select>
              <input type="file" accept="audio/*" onChange={e => update('songFile', e.target.files[0])} />
              <input type="file" accept="image/*" onChange={e => update('photoFile', e.target.files[0])} />
              <textarea placeholder="Bio (optional)" value={formData.bio} onChange={e => update('bio', e.target.value)} />
            </>
          )}

          {/* Final Review */}
          {step === maxSteps && (
            <div className="confirmation-summary">
              <h3>All Set!</h3>
              <p>Username: <strong>{formData.username}</strong></p>
              <p>Role: <strong>{formData.role}</strong></p>
              <p>Jurisdiction: {formData.jurisdictionId === JURISDICTION_IDS['uptown-harlem'] ? 'Uptown' : 'Downtown'} Harlem</p>
              {formData.role === 'listener' && formData.supportedArtistId && (
                <p>Supporting: {artists.find(a => a.userId === formData.supportedArtistId)?.username}</p>
              )}
            </div>
          )}

        </div>

        <div className="button-group">
          {step > 1 && <button className="back-button" onClick={prev}>Back</button>}
          {step < maxSteps ? (
            <button className="submit-upload-button" onClick={next}>Next</button>
          ) : (
            <button className="submit-upload-button" onClick={submit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateAccountWizard;