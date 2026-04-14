import React, { useState } from 'react';
import { X, Upload, Type, Music, Image } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './editSongWizard.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const EditSongWizard = ({ show, onClose, song, onSuccess }) => {
  const [description, setDescription] = useState(song?.description || '');
  const [artworkFile, setArtworkFile] = useState(null);
  const [isrc, setIsrc] = useState(song?.isrc || '');
  const [preview, setPreview] = useState(
    song?.artworkUrl 
  ? (song.artworkUrl.startsWith('http') ? song.artworkUrl : `${API_BASE_URL}${song.artworkUrl}`)
  : null
  );

  const [loading, setLoading] = useState(false);
  const [downloadPolicy, setDownloadPolicy] = useState(song?.downloadPolicy || 'free');
  const [downloadPrice, setDownloadPrice] = useState(
    song?.downloadPrice ? (song.downloadPrice / 100).toFixed(2) : ''
  );

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
    if (isrc !== (song?.isrc || '')) formData.append('isrc', isrc || '');
    if (downloadPolicy !== (song?.downloadPolicy || 'free')) {
      formData.append('downloadPolicy', downloadPolicy);
    }
    if (downloadPolicy === 'paid' && downloadPrice) {
      formData.append('downloadPrice', Math.round(parseFloat(downloadPrice) * 100));
    } else if (downloadPolicy !== 'paid') {
      formData.append('downloadPrice', '');
    }


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

  const hasChanges = artworkFile
    || description !== song?.description
    || isrc !== (song?.isrc || '')
    || downloadPolicy !== (song?.downloadPolicy || 'free')
    || (downloadPolicy === 'paid' && downloadPrice !== ((song?.downloadPrice || 0) / 100).toFixed(2));

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

          <div className="form-group">
            <label>ISRC</label>
            <input
              type="text"
              value={isrc}
              onChange={(e) => setIsrc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g., USRC17607839"
              maxLength={15}
            />
            <small>12-character International Standard Recording Code</small>
          </div>

        </div>

        {/* Download Policy */}
        <div className="form-group">
          <label className="upload-section-header">Download Availability</label>
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
            {downloadPolicy === 'paid' && 'Set your price (minimum $1.99). You receive 90% directly to your Stripe account.'}
            {downloadPolicy === 'unavailable' && 'Listeners can stream but not download this track.'}
          </small>
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
