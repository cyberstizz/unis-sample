// src/components/UploadWizard.jsx
import React, { useState, useEffect } from 'react';
import { X, Upload, Music, Video, FileText, CheckCircle } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './uploadWizard.scss';

// Media uploads can be up to 50 MB; the shared axios instance times out at
// 10s, which aborts video uploads mid-transfer.
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const UploadWizard = ({ show, onClose, onUploadSuccess, userProfile = {} }) => {
  const [step, setStep] = useState(1);
  const [mediaType, setMediaType] = useState('song');
  const [genreId, setGenreId] = useState(
    userProfile.genreId || '00000000-0000-0000-0000-000000000101'
  );
  const [jurisdictionId, setJurisdictionId] = useState(
    userProfile.jurisdiction?.jurisdictionId || '00000000-0000-0000-0000-000000000002'
  );
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
  const [uploadedSong, setUploadedSong] = useState(null);
  const [cleanVersionChoice, setCleanVersionChoice] = useState(null);
  const [cleanFile, setCleanFile] = useState(null);
  const [cleanPreview, setCleanPreview] = useState(null);
  const [cleanLoading, setCleanLoading] = useState(false);

  const artistId = userProfile.userId;
  const ambient = userProfile?.photoUrl ? buildUrl(userProfile.photoUrl) : null;
  const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '?');

  const STEP_LABELS = ['Type', 'Details', 'Review'];

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (cleanPreview) URL.revokeObjectURL(cleanPreview);
    };
  }, [preview, cleanPreview]);

  const resetWizard = () => {
    setStep(1); setTitle(''); setDescription(''); setFile(null);
    setArtwork(null); setError(''); setLoading(false); setPreview(null);
    setIsrc(''); setExplicit(false); setUploadedSong(null);
    setCleanVersionChoice(null); setCleanFile(null); setCleanPreview(null);
    setCleanLoading(false); setDownloadPolicy('free'); setDownloadPrice('');
  };

  const handleNext = () => { setError(''); if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    const allowedTypes =
      mediaType === 'song'
        ? ['audio/mpeg']
        : ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(`${mediaType} must be ${mediaType === 'song' ? 'MP3' : 'MP4 / MOV / AVI'}`);
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large (max 50 MB)');
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
      setError('File too large (max 50 MB)');
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
      setError('Artwork too large (max 1 MB)');
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

      // Song-only fields (explicit / isrc / downloadPolicy / downloadPrice)
      // must NOT be sent on a video upload — VideoUploadRequest has no such
      // fields and the UI hides those controls for videos anyway.
      const baseMetadata = { title, description, genreId, artistId, jurisdictionId };
      const metadata = mediaType === 'song'
        ? {
            ...baseMetadata,
            explicit,
            isrc: isrc || null,
            downloadPolicy,
            downloadPrice: downloadPolicy === 'paid' ? parseInt(downloadPrice) : null,
          }
        : baseMetadata;

      formData.append(mediaType, JSON.stringify(metadata));
      formData.append('file', file);
      if (artwork) formData.append('artwork', artwork);

      const response = await apiCall({
        url: `/v1/media/${mediaType}`,
        method: 'post',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
        // The global axios timeout is 10s — fine for a 4 MB song, far too
        // short for a 50 MB video, which aborts mid-transfer on any normal
        // connection. Uploads get their own generous ceiling.
        timeout: UPLOAD_TIMEOUT_MS,
      });

      if (explicit && mediaType === 'song') {
        setUploadedSong(response.data);
        setStep(4);
      } else {
        onUploadSuccess(response.data || { message: 'Upload successful' });
        onClose();
        resetWizard();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanVersionUpload = async () => {
    if (!cleanFile) { setError('Please select a clean version audio file'); return; }
    setError('');
    setCleanLoading(true);
    try {
      const cleanFormData = new FormData();
      const cleanMetadata = {
        title: title + ' (Clean)', description, genreId, artistId,
        jurisdictionId, explicit: false, isrc: null,
        isCleanVersion: true,
      };
      cleanFormData.append('song', JSON.stringify(cleanMetadata));
      cleanFormData.append('file', cleanFile);
      if (artwork) cleanFormData.append('artwork', artwork);

      const cleanResponse = await apiCall({
        url: '/v1/media/song',
        method: 'post',
        data: cleanFormData,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
      });

      const cleanSongId = cleanResponse.data?.songId;
      const explicitSongId = uploadedSong?.songId;

      if (cleanSongId && explicitSongId) {
        const linkFormData = new FormData();
        linkFormData.append('cleanVersionId', cleanSongId);
        await apiCall({
          url: `/v1/media/song/${explicitSongId}`,
          method: 'patch',
          data: linkFormData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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

  // ── Step renderers ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <>
      <p className="uw__step-intro">
        Your genre and jurisdiction are pre-filled from your profile.
      </p>
      {error && <div className="uw__error">{error}</div>}

      <div className="uw__field">
        <span className="uw__label">Media type</span>
        <select
          className="uw__select"
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value)}
        >
          <option value="song">Song (MP3)</option>
          <option value="video">Video (MP4 / MOV / AVI)</option>
        </select>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <p className="uw__step-intro">Add your title, description, and upload your file.</p>
      {error && <div className="uw__error">{error}</div>}

      <div className="uw__field">
        <span className="uw__label">Title</span>
        <input
          className="uw__input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter song or video title"
        />
      </div>

      <div className="uw__field">
        <span className="uw__label">Description</span>
        <textarea
          className="uw__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description (optional)"
          rows={3}
        />
      </div>

      <div className="uw__field">
        <span className="uw__label">ISRC <span style={{ opacity: 0.5, fontWeight: 500 }}>(optional)</span></span>
        <input
          className="uw__input"
          type="text"
          value={isrc}
          onChange={(e) =>
            setIsrc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
          }
          placeholder="e.g. USRC17607839"
          maxLength={15}
        />
        <span className="uw__hint">
          12-character International Standard Recording Code. You can add this later from your dashboard.
        </span>
      </div>

      {/* Explicit toggle — songs only */}
      {mediaType === 'song' && (
        <div className="uw__field">
          <div className="uw__toggle-row">
            <span>Explicit content</span>
            <div
              className={`uw__toggle ${explicit ? 'is-on' : ''}`}
              onClick={() => setExplicit(!explicit)}
              role="switch"
              aria-checked={explicit}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setExplicit(!explicit);
                }
              }}
            >
              <div className="uw__toggle-track">
                <div className="uw__toggle-thumb" />
              </div>
            </div>
          </div>
          <span className="uw__hint">
            Mark as explicit if it contains strong language, violence, or adult themes.
            {explicit && " After uploading, you'll be prompted to add an optional clean version."}
          </span>
        </div>
      )}

      {/* Download policy — songs only */}
      {mediaType === 'song' && (
        <div className="uw__field">
          <span className="uw__label">Download availability</span>
          <div className="uw__policy-row">
            {[
              { value: 'free', label: 'Free' },
              { value: 'paid', label: 'Paid' },
              { value: 'unavailable', label: 'No download' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`uw__policy-btn ${downloadPolicy === opt.value ? 'is-active' : ''}`}
                onClick={() => {
                  setDownloadPolicy(opt.value);
                  if (opt.value !== 'paid') setDownloadPrice('');
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {downloadPolicy === 'paid' && (
            <div className="uw__price-row">
              <span>$</span>
              <input
                type="number"
                min="1.99"
                step="0.01"
                placeholder="1.99"
                value={downloadPrice}
                onChange={(e) => setDownloadPrice(e.target.value)}
              />
            </div>
          )}
          <span className="uw__hint">
            {downloadPolicy === 'free' && 'Listeners can download this track for free.'}
            {downloadPolicy === 'paid' &&
              'Set your price (min $1.99). You receive 90% — paid directly to your Stripe account.'}
            {downloadPolicy === 'unavailable' &&
              'Listeners can stream but not download this track.'}
          </span>
        </div>
      )}

      {/* Media file */}
      <div className="uw__section-label">
        {mediaType === 'song' ? <Music size={12} aria-hidden="true" /> : <Video size={12} aria-hidden="true" />}
        {mediaType === 'song' ? 'Audio file' : 'Video file'}
      </div>
      <div className="uw__field">
        <label className="uw__file-zone">
          <Upload size={15} aria-hidden="true" />
          {file ? file.name : `Choose ${mediaType === 'song' ? 'MP3' : 'MP4 / MOV / AVI'}`}
          <input
            type="file"
            accept={mediaType === 'song' ? 'audio/*' : 'video/*'}
            onChange={handleFileChange}
          />
        </label>
        {file && (
          <p className="uw__file-preview">
            {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </div>

      {/* Artwork */}
      <div className="uw__section-label">
        <FileText size={12} aria-hidden="true" />
        Cover artwork <span style={{ fontWeight: 500, opacity: 0.5, letterSpacing: 0 }}>(optional)</span>
      </div>
      <div className="uw__field">
        <label className="uw__file-zone">
          <Upload size={15} aria-hidden="true" />
          {artwork ? artwork.name : 'JPEG or PNG, max 1 MB'}
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleArtworkChange}
          />
        </label>
        {artwork && (
          <p className="uw__file-preview">
            {artwork.name} — {(artwork.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <p className="uw__step-intro">Review everything before it goes live.</p>
      {error && <div className="uw__error">{error}</div>}

      <dl className="uw__summary">
        <div className="uw__summary-row"><dt>Title</dt><dd>{title}</dd></div>
        <div className="uw__summary-row"><dt>Description</dt><dd>{description || '—'}</dd></div>
        <div className="uw__summary-row"><dt>File</dt><dd>{file?.name}</dd></div>
        <div className="uw__summary-row"><dt>Artwork</dt><dd>{artwork ? artwork.name : '—'}</dd></div>
        <div className="uw__summary-row"><dt>ISRC</dt><dd>{isrc || '—'}</dd></div>
        {mediaType === 'song' && (
          <>
            <div className="uw__summary-row">
              <dt>Explicit</dt><dd>{explicit ? 'Yes' : 'No'}</dd>
            </div>
            <div className="uw__summary-row">
              <dt>Download</dt>
              <dd>
                {downloadPolicy === 'free'
                  ? 'Free'
                  : downloadPolicy === 'paid'
                  ? `$${parseFloat(downloadPrice || 0).toFixed(2)}`
                  : 'Not available'}
              </dd>
            </div>
          </>
        )}
      </dl>

      {preview && (
        <div className="uw__preview-media">
          {mediaType === 'song' ? (
            <audio controls src={preview} />
          ) : (
            <video controls src={preview} style={{ width: '100%', borderRadius: 10 }} />
          )}
        </div>
      )}

      {artwork && (
        <div style={{ marginTop: 14 }}>
          <img
            className="uw__artwork-preview"
            src={URL.createObjectURL(artwork)}
            alt="Artwork preview"
          />
        </div>
      )}

      <p className="uw__warning">
        This upload cannot be undone. Make sure this content is yours to upload.
      </p>

      <form onSubmit={handleUpload} style={{ marginTop: 16 }}>
        <button
          type="submit"
          className="uw__btn uw__btn--upload"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Uploading…' : 'Upload now'}
        </button>
      </form>
    </>
  );

  const renderStep4 = () => (
    <>
      <p className="uw__step-intro">
        <strong style={{ color: 'var(--unis-text)' }}>"{title}"</strong> has been uploaded.
        Would you like to add a clean version? This lets listeners with explicit content
        disabled still enjoy your music.
      </p>
      {error && <div className="uw__error">{error}</div>}

      {cleanVersionChoice === null && (
        <>
          <div className="uw__clean-choices">
            <button
              className="uw__clean-btn uw__clean-btn--yes"
              onClick={() => setCleanVersionChoice('yes')}
            >
              Yes, upload a clean version
            </button>
            <button
              className="uw__clean-btn uw__clean-btn--skip"
              onClick={handleSkipCleanVersion}
            >
              No, skip for now
            </button>
          </div>
          <p className="uw__hint" style={{ marginTop: 12, textAlign: 'center' }}>
            You can always add a clean version later from your dashboard.
          </p>
        </>
      )}

      {cleanVersionChoice === 'yes' && (
        <>
          <div className="uw__field">
            <span className="uw__label">Clean version audio (MP3)</span>
            <label className="uw__file-zone">
              <Upload size={15} aria-hidden="true" />
              {cleanFile ? cleanFile.name : 'Choose MP3'}
              <input type="file" accept="audio/mpeg" onChange={handleCleanFileChange} />
            </label>
            {cleanFile && (
              <p className="uw__file-preview">
                {cleanFile.name} — {(cleanFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
            {cleanPreview && (
              <div className="uw__preview-media" style={{ marginTop: 10 }}>
                <audio controls src={cleanPreview} />
              </div>
            )}
          </div>

          <div className="uw__clean-info">
            The clean version will inherit the title ("{title} (Clean)"), artwork, genre,
            and jurisdiction from the explicit version.
          </div>

          <button
            className="uw__btn uw__btn--upload"
            onClick={handleCleanVersionUpload}
            disabled={!cleanFile || cleanLoading}
            style={{ width: '100%', marginBottom: 8 }}
          >
            {cleanLoading ? 'Uploading clean version…' : 'Upload clean version'}
          </button>
          <button
            className="uw__btn uw__btn--back"
            onClick={handleSkipCleanVersion}
            disabled={cleanLoading}
            style={{ width: '100%' }}
          >
            Skip
          </button>
        </>
      )}
    </>
  );

  // ── Titles per step ─────────────────────────────────────────────────────────
  const stepHeadline = ['', 'New upload', 'File & details', 'Review', 'Clean version'][step];
  const stepEyebrow = ['', 'Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3', 'Optional'][step];

  if (!show) return null;

  return (
    <div className="uw-overlay" onClick={onClose}>
      <div className="uw" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* Ambient blurred photo */}
        {ambient && (
          <div
            className="uw-ambient"
            style={{ backgroundImage: `url(${ambient})` }}
            aria-hidden="true"
          />
        )}

        {/* ── Header ── */}
        <div className="uw__header">
          <div className="uw__artist-avatar">
            {userProfile?.photoUrl ? (
              <img
                src={ambient}
                alt={userProfile?.displayName || 'Artist'}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="uw__avatar-fallback">
                {initialOf(userProfile?.displayName)}
              </div>
            )}
          </div>

          <div className="uw__titles">
            <span className="artist-section__eyebrow">{stepEyebrow}</span>
            <h2>
              {step === 3
                ? <>Review <em>upload</em></>
                : step === 4
                ? <>Clean <em>version</em></>
                : <>Upload <em>{mediaType}</em></>}
            </h2>
          </div>

          <button className="uw__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Progress bar (steps 1-3 only) ── */}
        {step <= 3 && (
          <div className="uw__progress" aria-label="Upload progress">
            {STEP_LABELS.map((label, i) => {
              const num = i + 1;
              const isDone = step > num;
              const isActive = step === num;
              return (
                <div
                  key={label}
                  className={`uw__progress-step ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}
                >
                  <div className="uw__progress-item">
                    <div className="uw__progress-dot">
                      {isDone ? <CheckCircle size={13} /> : num}
                    </div>
                    <span className="uw__progress-label">{label}</span>
                  </div>
                  <div className="uw__progress-line" />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="uw__body">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* ── Footer nav (back/next) for steps 1-2 ── */}
        {step <= 2 && (
          <div className="uw__footer">
            {step > 1 && (
              <button className="uw__btn uw__btn--back" onClick={handleBack}>
                Back
              </button>
            )}
            <button
              className="uw__btn uw__btn--next"
              onClick={handleNext}
              disabled={step === 2 && (!title || !file)}
              style={{ flex: 1 }}
            >
              {step === 2 ? 'Review' : 'Next'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default UploadWizard;