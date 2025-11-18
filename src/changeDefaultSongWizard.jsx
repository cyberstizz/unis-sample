// src/components/wizards/ChangeDefaultSongWizard.jsx
import React, { useState } from 'react';
import { X, Music, Check } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './changeDefaultSongWizard.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const ChangeDefaultSongWizard = ({ show, onClose, userProfile, songs, onSuccess }) => {
  const [selectedSongId, setSelectedSongId] = useState(userProfile?.defaultSong?.songId || null);
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSave = async () => {
    if (selectedSongId === userProfile?.defaultSong?.songId) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await apiCall({
        method: 'put',
        url: '/v1/users/default-song',
        data: { defaultSongId: selectedSongId },
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      alert('Failed to update featured song. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // If no songs yet
  if (songs.length === 0) {
    return (
      <div className="upload-wizard-overlay">
        <div className="upload-wizard">
          <button className="close-button" onClick={onClose}><X size={28} /></button>
          <h2>No Songs Yet</h2>
          <p className="wizard-intro">
            Upload your first song to set it as your featured track!
          </p>
          <div className="button-group">
            <button className="submit-upload-button" onClick={onClose}>
              Got It
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-wizard-overlay">
      <div className="upload-wizard">
        <button className="close-button" onClick={onClose}>
          <X size={28} />
        </button>

        <h2>Set Featured Song</h2>
        <p className="wizard-intro">
          This song will play when someone clicks your profile across UNIS.
        </p>

        <div className="step-content">
          <div className="upload-section-header">
            <Music size={18} /> Choose Your Main Track
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {songs.map((song) => {
              const isSelected = song.songId === selectedSongId;
              return (
                <div
                  key={song.songId}
                  onClick={() => setSelectedSongId(song.songId)}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${isSelected ? '#004aad' : '#ddd'}`,
                    borderRadius: '10px',
                    background: isSelected ? '#f6f9ff' : '#fafafa',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  {song.artworkUrl ? (
                    <img
                      src={`${API_BASE_URL}${song.artworkUrl}`}
                      alt={song.title}
                      style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 60,
                      height: 60,
                      background: '#eee',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Music size={28} color="#999" />
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem' }}>{song.title}</h4>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.9rem' }}>
                      {song.plays || 0} plays • {(song.duration / 60000).toFixed(1)} min
                    </p>
                  </div>

                  {isSelected && (
                    <Check size={28} color="#004aad" strokeWidth={3} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="button-group">
          <button className="back-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="submit-upload-button"
            onClick={handleSave}
            disabled={loading || selectedSongId === userProfile?.defaultSong?.songId}
          >
            {loading ? 'Saving...' : 'Save as Featured'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeDefaultSongWizard;