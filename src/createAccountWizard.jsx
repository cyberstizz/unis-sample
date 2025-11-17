import React, { useState, useEffect } from 'react';
import { apiCall } from './components/axiosInstance';
import { JURISDICTION_IDS, GENRE_IDS } from './utils/idMappings';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import './wizard.scss';  // New SCSS for modal/steps

const CreateAccountWizard = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'listener',  // Default
    jurisdictionId: '',
    supportedArtistId: null,
    genreId: null,
    bio: '',
    photoFile: null,
    songFile: null,  // For defaultSongId
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [artistsList, setArtistsList] = useState([]);  // For step 3

  const updateFormData = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  // Step 1: Basics
  const handleStep1 = (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password) {
      setError('All fields required');
      return;
    }
    // Optional: Validate email/username uniqueness via API
    setStep(2);
  };

  // Step 2: Role & Location
  const handleStep2 = (e) => {
    e.preventDefault();
    if (!formData.jurisdictionId) {
      setError('Select jurisdiction');
      return;
    }
    setStep(3);
  };

  // Step 3: Support Artist (fetch list)
  useEffect(() => {
    if (step === 3) {
      const fetchArtists = async () => {
        try {
          const res = await apiCall({ url: '/v1/users/artist/top?limit=20' });  // Or custom endpoint
          setArtistsList(res.data || []);
        } catch (err) {
          setError('Failed to load artists');
        }
      };
      fetchArtists();
    }
  }, [step]);

  const handleStep3 = (e) => {
    e.preventDefault();
    if (!formData.supportedArtistId) {
      setError('Select supported artist');
      return;
    }
    if (formData.role === 'artist') {
      setStep(4);  // To artist details
    } else {
      setStep(5);  // To review
    }
  };

  // Step 4: Artist Details (conditional)
  const handleStep4 = async (e) => {
    e.preventDefault();
    if (formData.role === 'artist') {
      if (!formData.genreId || !formData.songFile) {
        setError('Genre and song required for artists');
        return;
      }
      // Upload song first for defaultSongId
      try {
        const songFormData = new FormData();
        songFormData.append('song', JSON.stringify({ title: 'Default', genreId: formData.genreId }));  // Minimal JSON
        songFormData.append('file', formData.songFile);
        const songRes = await apiCall({
          method: 'post',
          url: '/v1/media/song',
          data: songFormData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        updateFormData('defaultSongId', songRes.data.songId);
        // Optional photo upload
        if (formData.photoFile) {
          const photoFormData = new FormData();
          photoFormData.append('photoUrl', formData.photoFile);
          await apiCall({ method: 'post', url: '/v1/users/profile/temp/photo', data: photoFormData });  // Temp endpoint if needed
        }
      } catch (err) {
        setError('Upload failed');
        return;
      }
    }
    setStep(5);
  };

  // Step 5: Review & Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userDto = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        jurisdictionId: formData.jurisdictionId,
        genreId: formData.genreId || null,
        supportedArtistId: formData.supportedArtistId,
      };
      const res = await apiCall({ method: 'post', url: '/v1/users/register', data: userDto });
      localStorage.setItem('token', res.data.token);  // Assume register returns token
      onSuccess();
    } catch (err) {
      setError('Registration failed: ' + err.response?.data?.message || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const prevStep = () => setStep(prev => prev - 1);

  return (
    <Layout backgroundImage={backimage}>
      <div className="wizard-overlay">
        <div className="wizard-modal">
          <button onClick={onClose} className="close-btn">×</button>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
          <h1>Create Unis Account</h1>
          {error && <p className="error">{error}</p>}
          {step === 1 && (
            <form onSubmit={handleStep1}>
              <input placeholder="Username" value={formData.username} onChange={(e) => updateFormData('username', e.target.value)} required />
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => updateFormData('email', e.target.value)} required />
              <input type="password" placeholder="Password" value={formData.password} onChange={(e) => updateFormData('password', e.target.value)} required />
              <button type="submit">Next</button>
            </form>
          )}
          {step === 2 && (
            <form onSubmit={handleStep2}>
              <label>Role</label>
              <select value={formData.role} onChange={(e) => updateFormData('role', e.target.value)}>
                <option value="listener">Listener</option>
                <option value="artist">Artist</option>
              </select>
              <label>Jurisdiction</label>
              <select value={formData.jurisdictionId} onChange={(e) => updateFormData('jurisdictionId', e.target.value)} required>
                <option value="">Select</option>
                <option value={JURISDICTION_IDS['harlem-wide']}>Harlem-Wide</option>
                <option value={JURISDICTION_IDS['uptown-harlem']}>Uptown Harlem</option>
                <option value={JURISDICTION_IDS['downtown-harlem']}>Downtown Harlem</option>
              </select>
              <button type="button" onClick={prevStep}>Back</button>
              <button type="submit">Next</button>
            </form>
          )}
          {step === 3 && (
            <form onSubmit={handleStep3}>
              <label>Support an Artist</label>
              <select value={formData.supportedArtistId || ''} onChange={(e) => updateFormData('supportedArtistId', e.target.value)} required>
                <option value="">Search/Select</option>
                {artistsList.map(artist => (
                  <option key={artist.userId} value={artist.userId}>{artist.username}</option>
                ))}
              </select>
              <button type="button" onClick={prevStep}>Back</button>
              <button type="submit">Next</button>
            </form>
          )}
          {step === 4 && formData.role === 'artist' && (
            <form onSubmit={handleStep4}>
              <label>Genre</label>
              <select value={formData.genreId || ''} onChange={(e) => updateFormData('genreId', e.target.value)} required>
                <option value="">Select</option>
                <option value={GENRE_IDS['rap-hiphop']}>Rap/Hip-Hop</option>
                <option value={GENRE_IDS['rock']}>Rock</option>
                <option value={GENRE_IDS['pop']}>Pop</option>
              </select>
              <label>Upload Default Song</label>
              <input type="file" accept="audio/*" onChange={(e) => updateFormData('songFile', e.target.files[0])} required />
              <label>Photo (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => updateFormData('photoFile', e.target.files[0])} />
              <label>Bio (optional)</label>
              <textarea value={formData.bio} onChange={(e) => updateFormData('bio', e.target.value)} />
              <button type="button" onClick={prevStep}>Back</button>
              <button type="submit">Next</button>
            </form>
          )}
          {step === 5 && (
            <form onSubmit={handleSubmit}>
              <h3>Review</h3>
              <p>Username: {formData.username}</p>
              <p>Email: {formData.email}</p>
              <p>Role: {formData.role}</p>
              <p>Jurisdiction: {Object.keys(JURISDICTION_IDS).find(k => JURISDICTION_IDS[k] === formData.jurisdictionId)}</p>
              <p>Supported Artist ID: {formData.supportedArtistId}</p>
              {formData.role === 'artist' && (
                <>
                  <p>Genre: {Object.keys(GENRE_IDS).find(k => GENRE_IDS[k] === formData.genreId)}</p>
                  <p>Default Song Uploaded: {formData.defaultSongId ? 'Yes' : 'No'}</p>
                  <p>Bio: {formData.bio || 'None'}</p>
                </>
              )}
              <button type="button" onClick={prevStep}>Back</button>
              <button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CreateAccountWizard;