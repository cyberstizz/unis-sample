import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Type, Music, Image, ShieldCheck, Download, AlertCircle } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl'; // ★ item 7: checklist — buildUrl everywhere
import useModalA11y from './hooks/useModalA11y'; // ★ item 7: same a11y as the other modals
import './editSongWizard.scss';

// =============================================================================
// EditSongWizard — revamped to the UploadWizard design language (esw- namespace,
// --unis-* tokens, zero inline styles, inline validation instead of alert()).
// API contract unchanged:
//   PATCH /v1/media/song/:songId          — artwork, description, isrc (multipart)
//   PUT   /v1/songs/:songId/download-settings — policy + price (integer cents)
// =============================================================================
const EditSongWizard = ({ show, onClose, song, onSuccess }) => {
  const [description, setDescription] = useState(song?.description || '');
  const [artworkFile, setArtworkFile] = useState(null);
  const [isrc, setIsrc] = useState(song?.isrc || '');
  const [preview, setPreview] = useState(buildUrl(song?.artworkUrl)); // ★ item 7: was hand-rolled API_BASE_URL prefixing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // ★ item 7: inline error replaces alert()
  const [downloadPolicy, setDownloadPolicy] = useState(song?.downloadPolicy || 'free');
  const [downloadPrice, setDownloadPrice] = useState(
    song?.downloadPrice ? (song.downloadPrice / 100).toFixed(2) : ''
  );
  const modalRef = useRef(null);

  useModalA11y({ active: show, onClose, modalRef }); // ★ item 7

  // ★ item 7: re-sync when the wizard opens for a (possibly different) song
  useEffect(() => {
    if (show) {
      setDescription(song?.description || '');
      setArtworkFile(null);
      setIsrc(song?.isrc || '');
      setPreview(buildUrl(song?.artworkUrl));
      setError(null);
      setDownloadPolicy(song?.downloadPolicy || 'free');
      setDownloadPrice(song?.downloadPrice ? (song.downloadPrice / 100).toFixed(2) : '');
    }
  }, [show, song?.songId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !song) return null;

  const handleArtworkChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArtworkFile(file);
      setPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const hasChanges = artworkFile
    || description !== song?.description
    || isrc !== (song?.isrc || '')
    || downloadPolicy !== (song?.downloadPolicy || 'free')
    || (downloadPolicy === 'paid' && downloadPrice !== ((song?.downloadPrice || 0) / 100).toFixed(2));

  const handleSubmit = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    // Validate price if paid
    if (downloadPolicy === 'paid' && (!downloadPrice || parseFloat(downloadPrice) < 1.99)) {
      setError('Minimum download price is $1.99.'); // ★ item 7: inline, not alert()
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Save description, artwork, isrc via existing PATCH endpoint
      const hasMediaChanges = artworkFile
        || description !== song?.description
        || isrc !== (song?.isrc || '');

      if (hasMediaChanges) {
        const formData = new FormData();
        if (artworkFile) formData.append('artwork', artworkFile);
        if (description !== song?.description) formData.append('description', description);
        if (isrc !== (song?.isrc || '')) formData.append('isrc', isrc || '');

        await apiCall({
          method: 'patch',
          url: `/v1/media/song/${song.songId}`,
          data: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 2. Save download settings via the dedicated endpoint
      const downloadPolicyChanged = downloadPolicy !== (song?.downloadPolicy || 'free');
      const downloadPriceChanged = downloadPolicy === 'paid'
        && downloadPrice !== ((song?.downloadPrice || 0) / 100).toFixed(2);

      if (downloadPolicyChanged || downloadPriceChanged) {
        await apiCall({
          method: 'put',
          url: `/v1/songs/${song.songId}/download-settings`,
          data: {
            downloadPolicy,
            downloadPrice: downloadPolicy === 'paid'
              ? Math.round(parseFloat(downloadPrice) * 100)
              : null,
          },
        });
      }

      console.log('Song updated:', song.songId); // ★ checklist: success logging
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to update song:', err);
      setError(err?.response?.data?.error || 'Failed to update the song. Please try again.'); // ★ item 7
    } finally {
      setLoading(false);
    }
  };

  const POLICY_OPTIONS = [
    { value: 'free', label: 'Free Download' },
    { value: 'paid', label: 'Paid Download' },
    { value: 'unavailable', label: 'No Download' },
  ];

  return (
    <div className="esw-overlay" onClick={onClose}>
      <div
        className="esw"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="esw-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="esw__header">
          <span className="esw__icon" aria-hidden="true">
            <Music size={17} />
          </span>
          <div className="esw__titles">
            <span className="artist-section__eyebrow">Edit song</span>
            <h2 id="esw-title">{song.title}</h2>
          </div>
          <button className="esw__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="esw__body">
          {error && (
            <div className="esw__error" role="alert">
              <AlertCircle size={15} aria-hidden="true" /> {error}
            </div>
          )}

          {/* Artwork */}
          <div className="esw__field">
            <span className="esw__label">
              <Image size={13} aria-hidden="true" /> Artwork
            </span>
            <div className="esw__artwork">
              {preview ? (
                <img src={preview} alt="Song artwork" className="esw__artwork-img" />
              ) : (
                <div className="esw__artwork-placeholder" aria-hidden="true">
                  <Music size={38} />
                </div>
              )}
            </div>
            <label className="esw__file-btn">
              <Upload size={15} aria-hidden="true" />
              Choose New Artwork
              <input
                type="file"
                accept="image/*"
                onChange={handleArtworkChange}
                hidden
              />
            </label>
            {artworkFile && (
              <p className="esw__file-preview">Selected: {artworkFile.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="esw__field">
            <label className="esw__label" htmlFor="esw-description">
              <Type size={13} aria-hidden="true" /> Description
            </label>
            <textarea
              id="esw-description"
              className="esw__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe your track, the inspiration behind it, or any credits..."
              maxLength={500}
            />
            <p className="esw__counter">{description.length}/500</p>
          </div>

          {/* ISRC */}
          <div className="esw__field">
            <label className="esw__label" htmlFor="esw-isrc">
              <ShieldCheck size={13} aria-hidden="true" /> ISRC
            </label>
            <input
              id="esw-isrc"
              className="esw__input"
              type="text"
              value={isrc}
              onChange={(e) => setIsrc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g., USRC17607839"
              maxLength={15}
            />
            <p className="esw__hint">12-character International Standard Recording Code</p>
          </div>

          {/* Download policy */}
          <div className="esw__field">
            <span className="esw__label">
              <Download size={13} aria-hidden="true" /> Download Availability
            </span>
            <div className="esw__policy-row" role="group" aria-label="Download availability">
              {POLICY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`esw__policy-btn ${downloadPolicy === opt.value ? 'is-active' : ''}`}
                  aria-pressed={downloadPolicy === opt.value}
                  onClick={() => {
                    setDownloadPolicy(opt.value);
                    if (opt.value !== 'paid') setDownloadPrice('');
                    setError(null);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {downloadPolicy === 'paid' && (
              <div className="esw__price-row">
                <span className="esw__price-symbol" aria-hidden="true">$</span>
                <input
                  className="esw__price-input"
                  type="number"
                  min="1.99"
                  step="0.01"
                  placeholder="1.99"
                  aria-label="Download price in dollars"
                  value={downloadPrice}
                  onChange={(e) => { setDownloadPrice(e.target.value); setError(null); }}
                />
              </div>
            )}

            <p className="esw__hint">
              {downloadPolicy === 'free' && 'Listeners can download this track for free.'}
              {downloadPolicy === 'paid' && 'Set your price (minimum $1.99). You receive 90% directly to your Stripe account.'}
              {downloadPolicy === 'unavailable' && 'Listeners can stream but not download this track.'}
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="esw__footer">
          <button type="button" className="esw__btn esw__btn--back" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="esw__btn esw__btn--save"
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