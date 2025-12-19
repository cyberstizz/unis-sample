// src/components/wizards/CreateAccountWizard.jsx - WITH ARTIST UPLOAD AGREEMENT
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
    agreedToTerms: false,  // NEW: Agreement checkbox
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

  const next = () => {
    // NEW: Block next if artist and agreement not checked
    if (formData.role === 'artist' && step === 3 && !formData.agreedToTerms) {
      setError('You must agree to the Upload Agreement to continue');
      return;
    }
    setStep(s => s + 1);
  };
  const prev = () => setStep(s => s - 1);

  const submit = async () => {
    // ... your existing submit logic unchanged (no changes here)
  };

  if (!show) return null;

  // NEW: Adjust maxSteps — +1 for agreement step (artists only)
  const maxSteps = formData.role === 'artist' ? 5 : 3;

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

          {/* NEW Step 3: Upload Agreement (Artists Only) */}
          {step === 3 && formData.role === 'artist' && (
            <div className="agreement-step">
              <h3 className="upload-section-header">Upload Agreement</h3>
              <div className="agreement-text">
                <p style={{color: "black"}}>By uploading and clicking “I Agree”, you represent and warrant that:</p>
                <ol style={{color: "blue", fontWeight: "bold"}}>
                  <li>You own or control 100% of the worldwide rights in both the sound recording (master) and the underlying musical composition (publishing), or you have obtained all necessary licenses.</li>
                  <li>You grant Unis a non-exclusive, royalty-free, worldwide license to reproduce, distribute, publicly perform, and publicly display your content on the platform, and to monetize it through advertisements.</li>
                  <li>Revenue Share: Unis will pay you 50% of Net Advertising Revenue attributable to your content (after ad costs/taxes/compulsory royalties). Payments monthly over $50.</li>
                  <li>You indemnify Unis from third-party claims arising from your breach.</li>
                  <li>This license is perpetual but terminable with 30 days notice.</li>
                </ol>
                <p style={{color: "blue"}}>Unis handles required royalty payments to performing rights organizations and mechanical licensing collectives on an aggregate basis.</p>
              </div>
              <label className="agreement-checkbox">
                <input 
                  type="checkbox" 
                  checked={formData.agreedToTerms} 
                  onChange={e => update('agreedToTerms', e.target.checked)} 
                />
                <span style={{color: "black"}}>I agree to the Upload Agreement and warrant I have the rights</span>
              </label>
            </div>
          )}

          {/* Step 3: Listener Support (unchanged, but shifted for artists) */}
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

          {/* Step 4: Artist Setup (shifted for artists) */}
          {step === 4 && formData.role === 'artist' && (
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

          {/* Final Review (shifted for artists) */}
          {(step === 4 && formData.role === 'listener') || (step === 5 && formData.role === 'artist') && (
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