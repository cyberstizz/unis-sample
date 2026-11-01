import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImagePlus, Trash2, AlertCircle } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import buildUrl from './utils/buildUrl';
import './artistPhotosManager.scss';

const DEFAULT_MAX = 15; // mirrors ArtistPhotoService.MAX_PHOTOS; server is the source of truth

const ArtistPhotosManager = ({ artistId }) => {
  const feedback = useFeedback();
  const [photos, setPhotos] = useState([]);
  const [max, setMax] = useState(DEFAULT_MAX);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // ★ item 9: photo awaiting delete confirmation
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (!artistId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall({ url: `/v1/users/${artistId}/photos`, method: 'get', useCache: false });
      setPhotos(res.data?.photos || []);
      if (res.data?.max) setMax(res.data.max);
    } catch (err) {
      setError('Could not load your photos.');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => { load(); }, [load]);

  const remaining = Math.max(0, max - photos.length);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);

    // Upload one at a time so the server cap is enforced cleanly and a single
    // bad file doesn't sink the whole batch.
    let added = 0;
    for (const file of files.slice(0, remaining)) {
      const form = new FormData();
      form.append('file', file);
      try {
        await apiCall({
          method: 'post',
          url: `/v1/users/${artistId}/photos`,
          data: form,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        added += 1;
      } catch (err) {
        const text = err.response?.data?.error || 'One or more photos failed to upload.';
        setError(text);
        feedback.error(errorMessage(err, text));
        break;
      }
    }

    if (files.length > remaining) {
      const text = `Only ${remaining} more photo${remaining === 1 ? '' : 's'} allowed — some weren't added.`;
      setError(text);
      feedback.error(text);
    }
    setUploading(false);
    if (added > 0) {
      feedback.success(added === 1 ? 'Photo added to your gallery' : `${added} photos added to your gallery`);
      load();
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (photoId) => {
    setConfirmId(null); // ★ item 9: confirmation accepted — proceed
    setDeletingId(photoId);
    setError(null);
    try {
      await apiCall({ method: 'delete', url: `/v1/users/${artistId}/photos/${photoId}` });
      console.log('Artist photo deleted:', photoId); // ★ checklist: success logging
      setPhotos((prev) => prev.filter((p) => p.photoId !== photoId));
      feedback.success('Photo removed from your gallery');
    } catch (err) {
      console.error('Artist photo delete failed:', photoId, err); // ★ checklist: failure logging
      const text = err.response?.data?.error || 'Could not remove that photo.';
      setError(text);
      feedback.error(errorMessage(err, text));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="apm">
      <div className="apm__head">
        <p className="apm__count">
          <strong>{photos.length}</strong> / {max} photos
        </p>
        {remaining > 0 && (
          <p className="apm__hint">Add up to {remaining} more · JPG or PNG · 10MB each</p>
        )}
      </div>

      {error && (
        <div className="apm__error" role="alert">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="apm__loading"><div className="apm__spinner" /></div>
      ) : (
        <div className="apm__grid">
          {photos.map((photo) => {
            const url = buildUrl(photo.photoUrl);
            const isConfirming = confirmId === photo.photoId; // ★ item 9
            return (
              <div className="apm__tile" key={photo.photoId}>
                <img src={url} alt="" loading="lazy" />
                {isConfirming ? ( // ★ item 9: explicit warning before anything is deleted
                  <div className="apm__confirm" role="alertdialog" aria-label="Confirm photo removal">
                    <p>Remove this photo?</p>
                    <div className="apm__confirm-actions">
                      <button
                        type="button"
                        className="apm__confirm-yes"
                        onClick={() => handleDelete(photo.photoId)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="apm__confirm-no"
                        onClick={() => setConfirmId(null)}
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="apm__del"
                    onClick={() => setConfirmId(photo.photoId)} // ★ item 9: arm, don't delete
                    disabled={deletingId === photo.photoId}
                    aria-label="Remove photo"
                  >
                    {deletingId === photo.photoId ? '…' : <Trash2 size={15} />}
                  </button>
                )}
              </div>
            );
          })}

          {remaining > 0 && (
            <button
              type="button"
              className="apm__add"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus size={22} />
              <span>{uploading ? 'Uploading…' : 'Add photos'}</span>
            </button>
          )}
        </div>
      )}

      {!loading && photos.length === 0 && remaining > 0 && (
        <p className="apm__empty">
          Add photos of your shows, your studio, your city — they'll appear on your artist page.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default ArtistPhotosManager;