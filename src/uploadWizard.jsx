// src/components/UploadWizard.jsx
import React, { useState, useEffect } from 'react';
import { apiCall } from './components/axiosInstance';
import './uploadWizard.scss';

const UploadWizard = ({ show, onClose, onUploadSuccess, userProfile = {} }) => {
  const [step, setStep] = useState(1);
  const [mediaType, setMediaType] = useState('song');
  const [genreId, setGenreId] = useState(userProfile.genreId || '00000000-0000-0000-0000-000000000101');
  const [jurisdictionId, setJurisdictionId] = useState(userProfile.jurisdiction?.jurisdictionId || '00000000-0000-0000-0000-000000000002');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [isrc, setIsrc] = useState('');
  const [explicit, setExplicit] = useState(false);
  const [downloadPolicy, setDownloadPolicy] = useState('free');
  const [downloadPrice, setDownloadPrice] = useState('');

  // Clean version state
  const [uploadedSong, setUploadedSong] = useState(null); // stores the response from the explicit upload
  const [cleanVersionChoice, setCleanVersionChoice] = useState(null); // null | 'yes' | 'no'
  const [cleanFile, setCleanFile] = useState(null);
  const [cleanPreview, setCleanPreview] = useState(null);
  const [cleanLoading, setCleanLoading] = useState(false);

  const artistId = userProfile.userId;

  // Total steps: 1=type, 2=details, 3=confirm, 4=clean version prompt (conditional)
  const totalSteps = (explicit && uploadedSong) ? 4 : 3;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (cleanPreview) URL.revokeObjectURL(cleanPreview);
    };
  }, [preview, cleanPreview]);

  const resetWizard = () => {
    setStep(1);
    setTitle('');
    setDescription('');
    setFile(null);
    setArtwork(null);
    setError('');
    setLoading(false);
    setPreview(null);
    setIsrc('');
    setExplicit(false);
    setUploadedSong(null);
    setCleanVersionChoice(null);
    setCleanFile(null);
    setCleanPreview(null);
    setCleanLoading(false);
    setDownloadPolicy('free');
    setDownloadPrice('');
  };

  const handleNext = () => {
    setError('');
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const allowedTypes = mediaType === 'song' ? ['audio/mpeg'] : ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(`${mediaType} must be ${mediaType === 'song' ? 'MP3' : 'MP4/MOV/AVI'}`);
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(selectedFile);
    setError('');
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleCleanFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!['audio/mpeg'].includes(selectedFile.type)) {
      setError('Clean version must be MP3');
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      return;
    }

    if (cleanPreview) URL.revokeObjectURL(cleanPreview);
    setCleanFile(selectedFile);
    setError('');
    setCleanPreview(URL.createObjectURL(selectedFile));
  };

  const handleArtworkChange = (e) => {
    const selectedArtwork = e.target.files[0];
    if (!selectedArtwork) return;

    if (!['image/jpeg', 'image/png'].includes(selectedArtwork.type)) {
      setError('Artwork must be JPEG or PNG');
      return;
    }
    if (selectedArtwork.size > 1024 * 1024) {
      setError('Artwork too large (max 1MB)');
      return;
    }

    setArtwork(selectedArtwork);
    setError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!title || !file || !genreId || !jurisdictionId) {
      setError('All fields required');
      setLoading(false);
      return;
    }
    if (downloadPolicy === 'paid' && (!downloadPrice || parseFloat(downloadPrice) < 1.99)) {
      setError('Minimum download price is $1.99');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      const metadata = {
        title,
        description,
        genreId,
        artistId,
        jurisdictionId,
        explicit,
        isrc: isrc || null,
        downloadPolicy,
        downloadPrice: downloadPolicy === 'paid' ? parseInt(downloadPrice) : null
      };
      formData.append(mediaType, JSON.stringify(metadata));
      formData.append('file', file);
      if (artwork) formData.append('artwork', artwork);

      console.log('Uploading to:', `/v1/media/${mediaType}`);
      console.log('FormData keys:', Array.from(formData.keys()));

      const response = await apiCall({
        url: `/v1/media/${mediaType}`,
        method: 'post',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Upload response:', response.data);

      // If explicit, move to clean version step instead of closing
      if (explicit && mediaType === 'song') {
        setUploadedSong(response.data);
        setStep(4);
      } else {
        onUploadSuccess(response.data || { message: 'Upload successful (mock mode)' });
        onClose();
        resetWizard();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Upload failed—check console/backend');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanVersionUpload = async () => {
    if (!cleanFile) {
      setError('Please select a clean version audio file');
      return;
    }

    setError('');
    setCleanLoading(true);

    try {
      // Step 1: Upload the clean version as a new song
      const cleanFormData = new FormData();
      const cleanMetadata = {
        title: title + ' (Clean)',
        description,
        genreId,
        artistId,
        jurisdictionId,
        explicit: false,
        isrc: null // Clean version gets its own ISRC if needed later
      };
      cleanFormData.append('song', JSON.stringify(cleanMetadata));
      cleanFormData.append('file', cleanFile);
      if (artwork) cleanFormData.append('artwork', artwork);

      const cleanResponse = await apiCall({
        url: '/v1/media/song',
        method: 'post',
        data: cleanFormData,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Clean version uploaded:', cleanResponse.data);

      const cleanSongId = cleanResponse.data?.songId;
      const explicitSongId = uploadedSong?.songId;

      // Step 2: Link the clean version to the explicit version via PATCH
      if (cleanSongId && explicitSongId) {
        const linkFormData = new FormData();
        linkFormData.append('cleanVersionId', cleanSongId);

        await apiCall({
          url: `/v1/media/song/${explicitSongId}`,
          method: 'patch',
          data: linkFormData,
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        console.log('Linked clean version', cleanSongId, 'to explicit song', explicitSongId);
      }

      onUploadSuccess(uploadedSong || { message: 'Upload successful with clean version' });
      onClose();
      resetWizard();
    } catch (err) {
      console.error('Clean version upload error:', err);
      setError(err.response?.data?.message || err.message || 'Clean version upload failed');
    } finally {
      setCleanLoading(false);
    }
  };

  const handleSkipCleanVersion = () => {
    onUploadSuccess(uploadedSong || { message: 'Upload successful' });
    onClose();
    resetWizard();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Upload New {mediaType.toUpperCase()}</h2>
            <p className="wizard-intro">Select media type (your genre and jurisdiction auto-filled).</p>
            {error && <p className="error-message">{error}</p>}
            <div className="filter-selection-grid">
              <label>Media Type</label>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="input-field">
                <option value="song">Song (MP3)</option>
                <option value="video">Video (MP4/MOV/AVI)</option>
              </select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="step-content">
            <h2>Upload File & Details</h2>
            <p className="wizard-intro">Add title, description, and your {mediaType} file.</p>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="upload-form-group">
                <label htmlFor="title">Title</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter song/video title"
                  required
                />
              </div>

              <div className="upload-form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                  rows="3"
                />
              </div>
              <div className="upload-form-group">
                <label htmlFor="isrc">ISRC (Optional)</label>
                <input
                  type="text"
                  id="isrc"
                  value={isrc}
                  onChange={(e) => setIsrc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g., USRC17607839"
                  maxLength={15}
                />
                <small style={{ color: '#A9A9A9', display: 'block', marginTop: '4px' }}>
                  12-character International Standard Recording Code. You can add this later from your dashboard.
                </small>
              </div>

              {/* Explicit toggle — only for songs */}
              {mediaType === 'song' && (
                <div className="upload-form-group">
                  <label className="explicit-toggle-label">
                    <span>Explicit Content</span>
                    <div
                      className={`explicit-toggle ${explicit ? 'active' : ''}`}
                      onClick={() => setExplicit(!explicit)}
                      role="switch"
                      aria-checked={explicit}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setExplicit(!explicit); } }}
                    >
                      <div className="explicit-toggle-track">
                        <div className="explicit-toggle-thumb" />
                      </div>
                    </div>
                  </label>
                  <small style={{ color: '#A9A9A9', display: 'block', marginTop: '4px' }}>
                    Mark this song as explicit if it contains strong language, violence, or adult themes.
                    {explicit && ' After uploading, you\'ll be prompted to upload an optional clean version.'}
                  </small>
                </div>
              )}

              {/* Download policy — only for songs */}
{mediaType === 'song' && (
  <div className="upload-form-group">
    <label>Download Availability</label>
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      {[
        { value: 'free', label: 'Free Download' },
        { value: 'paid', label: 'Paid Download' },
        { value: 'unavailable', label: 'No Download' },
      ].map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            setDownloadPolicy(opt.value);
            if (opt.value !== 'paid') setDownloadPrice('');
          }}
          style={{
            flex: 1,
            padding: '10px 8px',
            borderRadius: '8px',
            border: downloadPolicy === opt.value
              ? '2px solid var(--unis-primary, #163387)'
              : '1px solid rgba(255,255,255,0.15)',
            background: downloadPolicy === opt.value
              ? 'rgba(22,51,135,0.15)'
              : 'rgba(255,255,255,0.05)',
            color: downloadPolicy === opt.value
              ? 'var(--unis-primary, #6b8cff)'
              : 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>

    {downloadPolicy === 'paid' && (
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', padding: '0 12px' }}>
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>$</span>
        <input
          type="number"
          min="1.99"
          step="0.01"
          placeholder="1.99"
          value={downloadPrice}
          onChange={(e) => setDownloadPrice(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: '16px', fontWeight: 600, padding: '10px 8px',
          }}
        />
      </div>
    )}

    <small style={{ color: '#A9A9A9', display: 'block', marginTop: '6px' }}>
      {downloadPolicy === 'free' && 'Listeners can download this track for free.'}
      {downloadPolicy === 'paid' && 'Set your price (minimum $1.99). You receive 90% — funds go directly to your Stripe account.'}
      {downloadPolicy === 'unavailable' && 'Listeners can stream but not download this track.'}
    </small>
  </div>
)}

              <div className="form-group">
                <label htmlFor="file">{mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} File</label>
                <input
                  type="file"
                  id="file"
                  accept={mediaType === 'song' ? 'audio/*' : 'video/*'}
                  onChange={handleFileChange}
                  required
                />
                {file && <p className="file-preview">Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>
              <div className="form-group">
                <label htmlFor="artwork">Cover Artwork (Optional, JPEG/PNG &lt;1MB)</label>
                <input
                  type="file"
                  id="artwork"
                  accept="image/jpeg,image/png"
                  onChange={handleArtworkChange}
                />
                {artwork && <p className="file-preview">Selected: {artwork.name} ({(artwork.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>
            </form>
          </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h2>Confirm Upload</h2>
            <p className="wizard-intro">Review your {mediaType} before submitting.</p>
            <div className="confirmation-summary">
              <strong>Title:</strong> {title}<br />
              <strong>Description:</strong> {description || 'None'}<br />
              <strong>Genre:</strong> Hip-Hop/Rap (ID: {genreId})<br />
              <strong>Jurisdiction:</strong> Uptown Harlem (ID: {jurisdictionId})<br />
              <strong>File:</strong> {file?.name} ({mediaType})<br />
              <strong>Artwork:</strong> {artwork ? artwork.name : 'None'}<br />
              <strong>ISRC:</strong> {isrc || 'Not provided'}<br />
              {mediaType === 'song' && (
                <><strong>Explicit:</strong> {explicit ? 'Yes' : 'No'}<br /></>
              )}
              {mediaType === 'song' && (
                <><strong>Download:</strong> {downloadPolicy === 'free' ? 'Free' : downloadPolicy === 'paid' ? `$${(parseInt(downloadPrice) / 100).toFixed(2) !== 'NaN' ? parseFloat(downloadPrice).toFixed(2) : downloadPrice}` : 'Not available'}<br /></>
              )}
              {preview && (
                <div className="preview-media">
                  {mediaType === 'song' ? (
                    <audio controls src={preview} />
                  ) : (
                    <video controls src={preview} width="200" />
                  )}
                </div>
              )}
              {artwork && (
                <div className="preview-artwork">
                  <img src={URL.createObjectURL(artwork)} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover' }} />
                </div>
              )}
            </div>
            <p className="warning-message">This upload cannot be undone. Ensure file is yours.</p>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleUpload}>
              <button type="submit" disabled={loading} className="submit-upload-button">
                {loading ? 'Uploading...' : 'Upload Now'}
              </button>
            </form>
          </div>
        );

      // Step 4: Clean version prompt (only shown for explicit songs after upload)
      case 4:
        return (
          <div className="step-content">
            <h2>Upload Clean Version?</h2>
            <p className="wizard-intro">
              Your explicit track <strong>"{title}"</strong> has been uploaded successfully.
              Would you like to upload a clean version? This helps listeners with explicit content disabled still enjoy your music.
            </p>
            {error && <p className="error-message">{error}</p>}

            {cleanVersionChoice === null && (
              <div className="clean-version-choices">
                <button
                  className="clean-choice-button clean-choice-yes"
                  onClick={() => setCleanVersionChoice('yes')}
                >
                  Yes, upload a clean version
                </button>
                <button
                  className="clean-choice-button clean-choice-skip"
                  onClick={handleSkipCleanVersion}
                >
                  No, skip for now
                </button>
                <small style={{ color: '#A9A9A9', display: 'block', marginTop: '12px', textAlign: 'center' }}>
                  You can always add a clean version later from your dashboard.
                </small>
              </div>
            )}

            {cleanVersionChoice === 'yes' && (
              <div className="clean-version-upload">
                <div className="form-group">
                  <label htmlFor="cleanFile">Clean Version Audio (MP3)</label>
                  <input
                    type="file"
                    id="cleanFile"
                    accept="audio/mpeg"
                    onChange={handleCleanFileChange}
                  />
                  {cleanFile && (
                    <p className="file-preview">Selected: {cleanFile.name} ({(cleanFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                  )}
                  {cleanPreview && (
                    <div className="preview-media" style={{ marginTop: '12px' }}>
                      <audio controls src={cleanPreview} />
                    </div>
                  )}
                </div>

                <div className="clean-version-info">
                  <p style={{ color: '#A9A9A9', fontSize: '0.85rem' }}>
                    The clean version will inherit the title (as "{title} (Clean)"), artwork, genre, and jurisdiction from the explicit version.
                  </p>
                </div>

                <div className="clean-version-actions">
                  <button
                    className="submit-upload-button"
                    onClick={handleCleanVersionUpload}
                    disabled={!cleanFile || cleanLoading}
                  >
                    {cleanLoading ? 'Uploading Clean Version...' : 'Upload Clean Version'}
                  </button>
                  <button
                    className="back-button"
                    onClick={handleSkipCleanVersion}
                    disabled={cleanLoading}
                    style={{ marginTop: '8px' }}
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      default: return null;
    }
  };

  if (!show) return null;

  return (
    <div className="upload-wizard-overlay" onClick={onClose}>
      <div className="upload-wizard" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        {renderStep()}
        {step <= 3 && (
          <div className="button-group">
            {step > 1 && <button onClick={handleBack} className="back-button">Back</button>}
            {step < 3 && <button onClick={handleNext} className="next-button">Next</button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadWizard;