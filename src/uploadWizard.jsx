// src/components/UploadWizard.jsx
import React, { useState, useEffect } from 'react';
import { apiCall } from './components/axiosInstance';  // Use wrapper now (imported as named)
import './uploadWizard.scss';

const UploadWizard = ({ show, onClose, onUploadSuccess, userProfile = {} }) => {
  const [step, setStep] = useState(1);
  const [mediaType, setMediaType] = useState('song');  
  const [genreId, setGenreId] = useState(userProfile.genreId || '00000000-0000-0000-0000-000000000101');  // Default or user's genre
  const [jurisdictionId, setJurisdictionId] = useState(userProfile.jurisdiction?.jurisdictionId || '00000000-0000-0000-0000-000000000002');  // User's home
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const artistId = userProfile.userId;  // From profile

  // Cleanup previews on unmount/close (memory fix)
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (artwork) URL.revokeObjectURL(URL.createObjectURL(artwork));  // If previewed
    };
  }, [preview, artwork]);

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

    // Revoke old preview
    if (preview) URL.revokeObjectURL(preview);
    setFile(selectedFile);
    setError('');
    setPreview(URL.createObjectURL(selectedFile));
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

    try {
      const formData = new FormData();
      const metadata = {
        title,
        description,
        genreId,
        artistId,
        jurisdictionId
      };
      formData.append(mediaType, JSON.stringify(metadata));
      formData.append('file', file);
      if (artwork) formData.append('artwork', artwork);

      // Debug: Log FormData (remove after)
      console.log('Uploading to:', `/v1/media/${mediaType}`);
      console.log('FormData keys:', Array.from(formData.keys()));

      // Fix: Use apiCall wrapper for mock fallback + error handling
      const response = await apiCall({
        url: `/v1/media/${mediaType}`,
        method: 'post',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' }  // Optional: Axios auto-handles, but explicit for clarity
      });

      // Mock mode returns { data: [] }—treat as success for demo, or check response
      console.log('Upload response:', response.data);
      onUploadSuccess(response.data || { message: 'Upload successful (mock mode)' });
      onClose();
      setStep(1);  // Reset wizard
    } catch (err) {
      console.error('Upload error:', err);
      // apiCall already handles 401 redirect; enhance error msg if needed
      setError(err.response?.data?.message || err.message || 'Upload failed—check console/backend');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Upload New {mediaType.toUpperCase()}</h2>
            <p className="wizard-intro">Select media type (your genre and jurisdiction auto-filled).</p>
            {error && <p className="error-message">{error}</p>}  {/* Global error */}
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
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                  rows="3"
                />
              </div>
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
      default: return null;
    }
  };

  if (!show) return null;

  return (
    <div className="upload-wizard-overlay" onClick={onClose}>
      <div className="upload-wizard" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        {renderStep()}
        <div className="button-group">
          {step > 1 && <button onClick={handleBack} className="back-button">Back</button>}
          {step < 3 && <button onClick={handleNext} className="next-button">Next</button>}
        </div>
      </div>
    </div>
  );
};

export default UploadWizard;