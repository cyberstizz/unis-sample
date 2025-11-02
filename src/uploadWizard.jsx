// src/components/UploadWizard.jsx
import React, { useState } from 'react';
import axiosInstance from './components/axiosInstance'; 
import './uploadWizard.scss';

const UploadWizard = ({ show, onClose, onUploadSuccess, userProfile = {} }) => {
  const [step, setStep] = useState(1);
  const [mediaType, setMediaType] = useState('song');  // song/video
  const [genreId, setGenreId] = useState('00000000-0000-0000-0000-000000000101');  // Default hip-hop
  const [jurisdictionId, setJurisdictionId] = useState(userProfile.jurisdiction?.jurisdictionId || '00000000-0000-0000-0000-000000000002');  // Default Uptown
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);  // For confirmation

  const artistId = userProfile.userId;  // From profile/token

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

    // Validate type/size
    const allowedTypes = mediaType === 'song' ? ['audio/mpeg'] : ['video/mp4', 'video/quicktime', 'video/x-msvideo'];  // MP3 songs; MP4/MOV/AVI videos
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(`${mediaType} must be ${mediaType === 'song' ? 'MP3' : 'MP4/MOV/AVI'}`);
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {  // 50MB
      setError('File too large (max 50MB)');
      return;
    }

    setFile(selectedFile);
    setError('');
    // Preview URL for confirmation (audio/video tag src)
    setPreview(URL.createObjectURL(selectedFile));
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
      // FormData for multipart
      const formData = new FormData();
      const metadata = {
        title,
        description,
        genreId,
        artistId,  // Current user (artist)
        jurisdictionId
      };
      formData.append(mediaType, JSON.stringify(metadata));  // "song" or "video" JSON
      formData.append('file', file);

      const response = await axiosInstance.post(`/${mediaType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onUploadSuccess(response.data);  // Pass saved media to dashboard refresh
      onClose();
    } catch (err) {
      setError(err.response?.data || 'Upload failed—try again');
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
            <p className="wizard-intro">Select type, genre, and jurisdiction (your home auto-filled).</p>
            <div className="filter-selection-grid">
              <label>Media Type</label>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="input-field">
                <option value="song">Song (MP3)</option>
                <option value="video">Video (MP4/MOV/AVI)</option>
              </select>

              <label>Genre</label>
              <select value={genreId} onChange={(e) => setGenreId(e.target.value)} className="input-field">
                <option value="00000000-0000-0000-0000-000000000101">Hip-Hop/Rap</option>
                <option value="00000000-0000-0000-0000-000000000102">Rock</option>
                <option value="00000000-0000-0000-0000-000000000103">Pop</option>
                {/* Add more genres if DB has */}
              </select>

              <label>Jurisdiction</label>
              <select value={jurisdictionId} onChange={(e) => setJurisdictionId(e.target.value)} className="input-field">
                <option value="00000000-0000-0000-0000-000000000002">Uptown Harlem</option>
                <option value="00000000-0000-0000-0000-000000000003">Downtown Harlem</option>
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
            <form onSubmit={handleUpload}>
              <div className="form-group">
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
                <label htmlFor="file">Upload {mediaType} File</label>
                <input
                  type="file"
                  id="file"
                  accept={mediaType === 'song' ? 'audio/*' : 'video/*'}
                  onChange={handleFileChange}
                  required
                />
                {file && <p className="file-preview">Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>
              <button type="submit" disabled={loading} className="submit-upload-button">
                {loading ? 'Uploading...' : 'Upload'}
              </button>
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
              {preview && (
                <div className="preview-media">
                  {mediaType === 'song' ? (
                    <audio controls src={preview} />
                  ) : (
                    <video controls src={preview} width="200" />
                  )}
                </div>
              )}
            </div>
            <p className="warning-message">This upload cannot be undone. Ensure file is yours.</p>
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