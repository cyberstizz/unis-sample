// src/components/wizards/CreateAccountWizard.jsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { JURISDICTION_IDS, GENRE_IDS } from './utils/idMappings';

const CreateAccountWizard = ({ show, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'listener',
    jurisdictionId: '',
    genreId: '',
    title: '',
    bio: '',
    artistPhotoFile: null,
    songFile: null,
    songArtworkFile: null,
    supportedArtistId: null,
  });
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (step === 3 && show && formData.role === 'listener') {
      apiCall({ url: '/v1/users/artists/active' })
        .then(res => setArtists(res.data || []))
        .catch(() => setError('Could not load artists'));
    }
  }, [step, show, formData.role]);

  const next = () => setStep(s => s + 1);
  const prev = () => setStep(s => s - 1);

  const submit = async () => {
    // Enhanced Validation
    if (formData.role === 'artist') {
      if (!formData.title.trim()) return setError('Song title required');
      if (!formData.artistPhotoFile) return setError('Artist profile photo required');
      if (!formData.songFile) return setError('Debut song audio required');
      if (!formData.songArtworkFile) return setError('Song artwork required');
      if (!formData.genreId) return setError('Genre required for artists');
    }
    
    if (!formData.jurisdictionId) return setError('Please select your Harlem neighborhood');

    setLoading(true);
    setError('');

    try {
      // Step 1: Register user (WITHOUT bio - we'll add it after)
      const registerPayload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        jurisdictionId: formData.jurisdictionId,
        genreId: formData.role === 'artist' ? formData.genreId : null,
        // ❌ DON'T send bio here - backend ignores it anyway
        supportedArtistId: formData.role === 'listener' ? formData.supportedArtistId : null,
      };

      const regRes = await apiCall({
        method: 'post',
        url: '/v1/users/register',
        data: registerPayload
      });

      console.log('=== REGISTRATION RESPONSE ===', regRes.data);
      const newUserId = regRes.data.userId || regRes.data.user_id || regRes.data.id;
      console.log('Extracted userId:', newUserId);
      
      if (!newUserId) {
        throw new Error('Failed to get user ID from registration response');
      }

      // Delay for DB propagation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Login to get token
      const loginRes = await apiCall({
        method: 'post',
        url: '/auth/login',
        data: {
          email: formData.email,
          password: formData.password
        }
      });

      const token = loginRes.data.token;
      localStorage.setItem('token', token);
      console.log('Token set');

      // Delay for token propagation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Upload song if artist (BEFORE profile update)
      let songId = null;
      if (formData.role === 'artist' && formData.songFile) {
        const songJson = JSON.stringify({
          title: formData.title,
          genreId: formData.genreId,
          jurisdictionId: formData.jurisdictionId,
          artistId: newUserId,
        });

        const songFD = new FormData();
        songFD.append('song', songJson);
        songFD.append('file', formData.songFile);
        songFD.append('artwork', formData.songArtworkFile);

        const songRes = await apiCall({
          method: 'post',
          url: '/v1/media/song',
          data: songFD
        });

        // Extract songId - backend returns Song entity with songId field
        songId = songRes.data.songId;
        console.log('Song uploaded with ID:', songId);
        
        if (!songId) {
          console.error('WARNING: songId is undefined!', songRes.data);
          throw new Error('Failed to get song ID from upload response');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 4: Update profile (photo + bio) - Using the SAME endpoint as EditProfileWizard
      if (formData.role === 'artist') {
        const profileFD = new FormData();
        
        if (formData.artistPhotoFile) {
          profileFD.append('photo', formData.artistPhotoFile);
        }
        
        if (formData.bio && formData.bio.trim()) {
          profileFD.append('bio', formData.bio.trim());
        }

        await apiCall({
          method: 'patch',
          url: '/v1/users/profile',  // ✅ Same as EditProfileWizard
          data: profileFD,
          headers: { 'Content-Type': 'multipart/form-data' },  // ✅ CRITICAL!
        });
        
        console.log('Profile updated (photo + bio)');
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 5: Set default song if artist
      if (formData.role === 'artist' && songId) {
        await apiCall({
          method: 'patch',
          url: '/v1/users/default-song',  // ✅ Fixed endpoint path
          data: { defaultSongId: songId },
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('Default song set to:', songId);
      }

      alert('Account created successfully! Please login with your credentials.');
      onClose();
      
      // Clear token and redirect
      localStorage.removeItem('token');
      window.location.href = '/login';

    } catch (err) {
      console.error('Registration error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setError(errorMsg);
      localStorage.removeItem('token');
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
          {/* Step 1: Basics */}
          {step === 1 && (
            <>
              <h3 className="upload-section-header">Basics</h3>
              <input
                placeholder="Username"
                value={formData.username}
                onChange={e => update('username', e.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={e => update('email', e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={e => update('password', e.target.value)}
              />
            </>
          )}

          {/* Step 2: Role & Location */}
          {step === 2 && (
            <>
              <h3 className="upload-section-header">Who Are You?</h3>
              <select value={formData.role} onChange={e => update('role', e.target.value)}>
                <option value="listener">Listener (Fan)</option>
                <option value="artist">Artist</option>
              </select>

              <label className="upload-section-header">Your Harlem</label>
              <select
                value={formData.jurisdictionId}
                onChange={e => update('jurisdictionId', e.target.value)}
              >
                <option value="">Select...</option>
                <option value={JURISDICTION_IDS['uptown-harlem']}>Uptown Harlem</option>
                <option value={JURISDICTION_IDS['downtown-harlem']}>Downtown Harlem</option>
              </select>
            </>
          )}

          {/* Step 3: Listener */}
          {step === 3 && formData.role === 'listener' && (
            <>
              <h3 className="upload-section-header">Support an Artist</h3>
              <select
                value={formData.supportedArtistId || ''}
                onChange={e => update('supportedArtistId', e.target.value)}
              >
                <option value="">Choose who you support</option>
                {artists.map(a => (
                  <option key={a.userId} value={a.userId}>{a.username}</option>
                ))}
              </select>
            </>
          )}

          {/* Step 3: Artist */}
          {step === 3 && formData.role === 'artist' && (
            <>
              <h3 className="upload-section-header">Artist Setup</h3>
              <input
                placeholder="Song Title (Required)"
                value={formData.title}
                onChange={e => update('title', e.target.value)}
              />
              <select value={formData.genreId} onChange={e => update('genreId', e.target.value)}>
                <option value="">Select Genre</option>
                {Object.keys(GENRE_IDS).map(key => (
                  <option key={key} value={GENRE_IDS[key]}>
                    {key.replace('-', '/').toUpperCase()}
                  </option>
                ))}
              </select>

              <h3 className="upload-section-header">Upload Debut Song (Required)</h3>
              <input
                type="file"
                accept="audio/*"
                onChange={e => update('songFile', e.target.files[0])}
              />

              <h3 className="upload-section-header">Artist Profile Photo (Required)</h3>
              <input
                type="file"
                accept="image/*"
                onChange={e => update('artistPhotoFile', e.target.files[0])}
              />

              <h3 className="upload-section-header">Song Artwork (Required)</h3>
              <input
                type="file"
                accept="image/*"
                onChange={e => update('songArtworkFile', e.target.files[0])}
              />

              <textarea
                placeholder="Bio (optional)"
                value={formData.bio}
                onChange={e => update('bio', e.target.value)}
              />
            </>
          )}

          {/* Final Review */}
          {step === maxSteps && (
            <div className="confirmation-summary">
              <h3>All Set!</h3>
              <p>Username: <strong>{formData.username}</strong></p>
              <p>Role: <strong>{formData.role}</strong></p>
              <p>
                Jurisdiction:{' '}
                {formData.jurisdictionId === JURISDICTION_IDS['uptown-harlem']
                  ? 'Uptown'
                  : 'Downtown'}{' '}
                Harlem
              </p>
              {formData.role === 'listener' && formData.supportedArtistId && (
                <p>
                  Supporting: {artists.find(a => a.userId === formData.supportedArtistId)?.username}
                </p>
              )}
              {formData.role === 'artist' && (
                <>
                  <p>Song Title: <strong>{formData.title}</strong></p>
                  <p>Song File: <strong>{formData.songFile?.name}</strong></p>
                  <p>Artist Photo: <strong>{formData.artistPhotoFile?.name}</strong></p>
                  <p>Song Artwork: <strong>{formData.songArtworkFile?.name}</strong></p>
                  {formData.bio && <p>Bio: <strong>{formData.bio.substring(0, 50)}...</strong></p>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="button-group">
          {step > 1 && <button className="back-button" onClick={prev}>Back</button>}
          {step < maxSteps ? (
            <button className="submit-upload-button" onClick={next}>Next</button>
          ) : (
            <button
              className="submit-upload-button"
              onClick={submit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateAccountWizard;