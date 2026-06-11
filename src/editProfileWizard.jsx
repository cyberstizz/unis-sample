import React, { useState } from 'react';
import { X, Upload, Type, Camera } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import cacheService from './services/cacheService';
import buildUrl from './utils/buildUrl';
import './editProfileWizard.scss';

const EditProfileWizard = ({ show, onClose, userProfile, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('photo');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(buildUrl(userProfile?.photoUrl));
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '?');
  const ambient = userProfile?.photoUrl ? buildUrl(userProfile.photoUrl) : null;

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSavePhoto = async () => {
    if (!photoFile) { onClose(); return; }
    setLoading(true);
    const formData = new FormData();
    formData.append('photo', photoFile);
    try {
      await apiCall({ method: 'patch', url: '/v1/users/profile', data: formData });
      cacheService.invalidate('user', userProfile.userId);
      cacheService.invalidate('artist', userProfile.userId);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBio = async () => {
    if (bio === userProfile?.bio) { onClose(); return; }
    setLoading(true);
    try {
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${userProfile.userId}/bio`,
        data: { bio: bio.trim() },
      });
      cacheService.invalidate('user', userProfile.userId);
      cacheService.invalidate('artist', userProfile.userId);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update bio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isSaveDisabled =
    loading ||
    (activeTab === 'photo' && !photoFile) ||
    (activeTab === 'bio' && bio === userProfile?.bio);

  return (
    <div className="epw-overlay">
      <div className="epw" role="dialog" aria-modal="true" aria-label="Edit profile">

        {/* Ambient blurred photo — drives the atmospheric tint */}
        {ambient && (
          <div
            className="epw-ambient"
            style={{ backgroundImage: `url(${ambient})` }}
            aria-hidden="true"
          />
        )}

        {/* ── Header ── */}
        <div className="epw__header">
          <div className="epw__avatar">
            {preview ? (
              <img
                src={preview}
                alt={userProfile?.displayName || 'Artist'}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span className="epw__avatar-fallback">
                {initialOf(userProfile?.displayName)}
              </span>
            )}
          </div>

          <div className="epw__titles">
            <span className="artist-section__eyebrow">Your profile</span>
            <h2>Edit <em>profile</em></h2>
          </div>

          <button className="epw__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Tab strip ── */}
        <div className="epw__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'photo'}
            className={`epw__tab ${activeTab === 'photo' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('photo')}
          >
            <Camera size={13} aria-hidden="true" />
            Photo
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'bio'}
            className={`epw__tab ${activeTab === 'bio' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('bio')}
          >
            <Type size={13} aria-hidden="true" />
            Bio
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="epw__body" role="tabpanel">

          {activeTab === 'photo' && (
            <>
              <div className="epw__section-label">
                <Camera size={12} aria-hidden="true" />
                Profile photo
              </div>
              <p className="epw__intro">
                This is how artists and listeners see you across Unis.
              </p>

              <div className="epw__photo-preview">
                <div className="epw__photo-ring">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Profile preview"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="epw__photo-fallback">
                      {initialOf(userProfile?.displayName)}
                    </div>
                  )}
                </div>

                <label className="epw__file-label">
                  <Upload size={14} aria-hidden="true" />
                  Choose new photo
                  <input type="file" accept="image/*" onChange={handlePhotoChange} />
                </label>

                {photoFile && (
                  <p className="epw__file-name">{photoFile.name}</p>
                )}
              </div>
            </>
          )}

          {activeTab === 'bio' && (
            <>
              <div className="epw__section-label">
                <Type size={12} aria-hidden="true" />
                Bio
              </div>
              <p className="epw__intro">
                Tell the world about your sound, your story, your roots.
              </p>
              <textarea
                className="epw__textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={6}
                placeholder="Share your musical journey, influences, and what makes you unique…"
                maxLength={500}
              />
              <p className="epw__char-count">{bio.length} / 500</p>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="epw__footer">
          <button className="epw__btn epw__btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="epw__btn epw__btn--save"
            onClick={activeTab === 'photo' ? handleSavePhoto : handleSaveBio}
            disabled={isSaveDisabled}
          >
            {loading ? 'Saving…' : `Save ${activeTab === 'photo' ? 'photo' : 'bio'}`}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EditProfileWizard;