import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';
import './lyricsWizard.scss';
import { apiCall } from './components/axiosInstance';
import useModalA11y from './hooks/useModalA11y'; // ★ item 1: same focus-trap a11y as the other modals

// =============================================================================
// LyricsWizard — restyled to the UploadWizard design language (lw- namespace,
// --unis-* tokens throughout, inline error state instead of alert()).
// API contract unchanged: PATCH /v1/media/song/:id with multipart `lyrics`.
// =============================================================================
const LyricsWizard = ({ show, onClose, song, onSuccess }) => {
  const [lyrics, setLyrics] = useState(song?.lyrics || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); // ★ item 1: inline error replaces alert()
  const modalRef = useRef(null);

  useModalA11y({ active: show, onClose, modalRef }); // ★ item 1

  // ★ item 1: re-sync when the wizard opens for a (possibly different) song —
  // useState's initializer only runs once per mount, so without this a second
  // song would show the first song's lyrics.
  useEffect(() => {
    if (show) {
      setLyrics(song?.lyrics || '');
      setError(null);
    }
  }, [show, song?.songId, song?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !song) return null;

  const handleSave = async () => {
    if (saving) return; // prevent double-click
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      // Send empty string to clear lyrics, or trimmed value
      formData.append('lyrics', lyrics.trim());

      // Existing multipart endpoint (no /lyrics sub-path)
      await apiCall({
        method: 'patch',
        url: `/v1/media/song/${song.songId || song.id}`,
        data: formData,
      });

      console.log('Lyrics saved for song:', song.songId || song.id); // ★ checklist: success logging
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save lyrics:', err);
      setError(err?.response?.data?.error || 'Could not save the lyrics. Please try again.'); // ★ item 1
    } finally {
      setSaving(false);
    }
  };

  const chars = lyrics.length;

  return (
    <div className="lw-overlay" onClick={onClose}>
      <div
        className="lw"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lw-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="lw__header">
          <span className="lw__icon" aria-hidden="true">
            <FileText size={17} />
          </span>
          <div className="lw__titles">
            <span className="artist-section__eyebrow">{song.lyrics ? 'Edit' : 'Add'} lyrics</span>
            <h2 id="lw-title">{song.title}</h2>
          </div>
          <button className="lw__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="lw__body">
          {error && (
            <div className="lw__error" role="alert">
              <AlertCircle size={15} aria-hidden="true" /> {error}
            </div>
          )}
          <label className="lw__label" htmlFor="lw-textarea">Lyrics</label>
          <textarea
            id="lw-textarea"
            className="lw__textarea"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={14}
            placeholder={'Enter lyrics here…\nOne line per bar, empty lines for breaks.'}
          />
          <p className="lw__hint">
            {chars > 0 ? `${chars.toLocaleString()} characters` : 'Leave empty and save to clear the lyrics.'}
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="lw__footer">
          <button type="button" className="lw__btn lw__btn--back" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="lw__btn lw__btn--save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Lyrics'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LyricsWizard;