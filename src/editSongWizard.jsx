import React, { useState } from 'react';
import { X, Upload, Type, Music, Image } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './editSongWizard.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const EditSongWizard = ({ show, onClose, song, onSuccess }) => {
  const [description, setDescription] = useState(song?.description || '');
  const [artworkFile, setArtworkFile] = useState(null);
  const [preview, setPreview] = useState(
    song?.artworkUrl ? `${API_BASE_URL}${song.artworkUrl}` : null
  );
  const [loading, setLoading] = useState(false);

  if (!show || !song) return null;

  const handleArtworkChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArtworkFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!artworkFile && description === song?.description) {
      onClose();
      return;
    }

    setLoading(true);
    const formData = new FormData();
    if (artworkFile) formData.append('artwork', artworkFile);
    if (description !== song?.description) formData.append('description', description);

    try {
      await apiCall({
        method: 'patch',
        url: `/v1/media/song/${song.songId}`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to update song:', err);
      alert('Failed to update song. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = artworkFile || description !== song?.description;

  return (
    <div className="upload-wizard-overlay">
      <div className="upload-wizard">
        <button className="close-button" onClick={onClose}>
          <X size={28} />
        </button>

        <h2>Edit Song</h2>
        <p className="wizard-intro">
          Update the artwork or description for <strong>"{song.title}"</strong>
        </p>

        <div className="step-content">
          {/* Artwork Section */}
          <div className="form-group">
            <label className="upload-section-header">
              <Image size={18} /> Artwork
            </label>
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              {preview ? (
                <img
                  src={preview}
                  alt="Song artwork"
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '3px solid #004aad22',
                  }}
                />
              ) : (
                <div style={{
                  width: 160,
                  height: 160,
                  borderRadius: '12px',
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  border: '2px dashed #ccc'
                }}>
                  <Music size={48} color="#999" />
                </div>
              )}
            </div>
            <label className="input-field" style={{ cursor: 'pointer', textAlign: 'center' }}>
              <Upload size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Choose New Artwork
              <input
                type="file"
                accept="image/*"
                onChange={handleArtworkChange}
                style={{ display: 'none' }}
              />
            </label>
            {artworkFile && (
              <p className="file-preview">Selected: {artworkFile.name}</p>
            )}
          </div>

          {/* Description Section */}
          <div className="form-group">
            <label className="upload-section-header">
              <Type size={18} /> Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe your track, the inspiration behind it, or any credits..."
              maxLength={500}
            />
            <p style={{ textAlign: 'right', color: '#666', fontSize: '0.8rem', marginTop: '4px' }}>
              {description.length}/500
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="button-group">
          <button className="back-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="submit-upload-button"
            onClick={handleSubmit}
            disabled={loading || !hasChanges}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSongWizard;
