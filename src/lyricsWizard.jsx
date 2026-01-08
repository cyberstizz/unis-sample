import React, { useState } from 'react';
import { X } from 'lucide-react';
import './lyricsWizard.scss'; 
import { apiCall } from './components/axiosInstance';

const LyricsWizard = ({ show, onClose, song, onSuccess }) => {
  if (!show || !song) return null;

  const [lyrics, setLyrics] = useState(song.lyrics || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;  // Prevent double-click

    setSaving(true);
    try {
      const formData = new FormData();
      // Send empty string to clear lyrics, or trimmed value
      formData.append('lyrics', lyrics.trim());

      // Use the EXISTING multipart endpoint (no /lyrics sub-path)
      await apiCall({
        method: 'patch',
        url: `/v1/media/song/${song.songId || song.id}`,
        data: formData,  // ← NOW USING FormData (multipart)
      });

      // Success → refetch fresh data
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save lyrics:', err);
      // More visible error (check network tab if this shows)
      alert('Failed to save lyrics – check console/network tab for details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-content lyrics-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>{song.lyrics ? 'Edit' : 'Add'} Lyrics — {song.title}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="wizard-body">
          <textarea
            className="lyrics-textarea"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={20}
            placeholder="Enter lyrics here...\n(one line per verse, empty lines for breaks)"
          />
        </div>
        <div className="wizard-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Lyrics'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LyricsWizard;