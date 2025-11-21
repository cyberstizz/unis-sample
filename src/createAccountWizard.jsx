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
    bio: '',
    photoFile: null,
    songFile: null,
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
    // Validation
    if (formData.role === 'artist') {
      if (!formData.photoFile) return setError('Photo required for artists');
      if (!formData.songFile) return setError('Song required for artists');
      if (!formData.genreId) return setError('Genre required for artists');
    }
    
    if (!formData.jurisdictionId) return setError('Please select your Harlem neighborhood');

    setLoading(true);
    setError('');

    try {
      // Step 1: Register user (no token returned, so we'll login after)
      const registerPayload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        jurisdictionId: formData.jurisdictionId,
        genreId: formData.role === 'artist' ? formData.genreId : null,
        bio: formData.bio || '',
        supportedArtistId: formData.role === 'listener' ? formData.supportedArtistId : null,
      };

      const regRes = await apiCall({
        method: 'post',
        url: '/v1/users/register',
        data: registerPayload
      });

      // Registration successful, now get the userId from the response
      const newUserId = regRes.data.userId;

      // Step 2: Login to get token (since register doesn't return it)
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

      // Small delay to ensure token is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Upload photo if artist
      if (formData.role === 'artist' && formData.photoFile) {
        const photoFD = new FormData();
        photoFD.append('photo', formData.photoFile);
        
        await apiCall({
          method: 'patch',
          url: '/v1/users/profile/photo',
          data: photoFD
        });
      }

      // Step 4: Upload song if artist
      if (formData.role === 'artist' && formData.songFile) {
        // FIXED: Template literal with backticks
        const songJson = JSON.stringify({
          title: `${formData.username}'s Debut Track`,
          genreId: formData.genreId,
          jurisdictionId: formData.jurisdictionId,
          artistId: newUserId,
        });

        const songFD = new FormData();
        songFD.append('song', songJson);
        songFD.append('file', formData.songFile);
        if (formData.photoFile) {
          songFD.append('artwork', formData.photoFile);
        }

        const songRes = await apiCall({
          method: 'post',
          url: '/v1/media/song',
          data: songFD
        });

        console.log('Song uploaded:', songRes.data);
        
        // Note: You'll need to add a PATCH endpoint for default-song
        // or handle this differently since the endpoint doesn't exist yet
      }

      alert('Account created successfully! Please login with your credentials.');
      onClose();
      
      // Clear token and redirect to login instead of feed
      localStorage.removeItem('token');
      window.location.href = '/login';

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
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

          {/* Step 3: Listener - Support Artist */}
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

          {/* Step 3: Artist - Details */}
          {step === 3 && formData.role === 'artist' && (
            <>
              <h3 className="upload-section-header">Artist Setup</h3>
              <select value={formData.genreId} onChange={e => update('genreId', e.target.value)}>
                <option value="">Select Genre</option>
                {Object.keys(GENRE_IDS).map(key => (
                  <option key={key} value={GENRE_IDS[key]}>
                    {key.replace('-', '/').toUpperCase()}
                  </option>
                ))}
              </select>

              <h3 className="upload-section-header">Upload A Song</h3>
              <input
                type="file"
                accept="audio/*"
                onChange={e => update('songFile', e.target.files[0])}
              />

              <h3 className="upload-section-header">Upload Profile Photo</h3>
              <input
                type="file"
                accept="image/*"
                onChange={e => update('photoFile', e.target.files[0])}
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
                  <p>Song: {formData.songFile?.name}</p>
                  <p>Photo: {formData.photoFile?.name}</p>
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