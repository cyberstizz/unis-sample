import React, { useState } from 'react';
import { X, Upload, Type, User, Camera } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import cacheService from './services/cacheService';
import './editProfileWizard.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const EditProfileWizard = ({ show, onClose, userProfile, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('photo');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(
    userProfile?.photoUrl ? `${API_BASE_URL}${userProfile.photoUrl}` : null
  );
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSavePhoto = async () => {
    if (!photoFile) {
      onClose();
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('photo', photoFile);

    try {
      await apiCall({
        method: 'patch',
        url: '/v1/users/profile',
        data: formData,
      });

      cacheService.invalidate('user', userProfile.userId);
      cacheService.invalidate('artist', userProfile.userId);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err)
      alert('Failed to update photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBio = async () => {
    if (bio === userProfile?.bio) {
      onClose();
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('bio', bio);

    try {
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${userProfile.userId}/bio`,
        data:  {
        bio: bio.trim(),
      },
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

  return (
    <div className="upload-wizard-overlay">
      <div className="upload-wizard">
        <button className="close-button" onClick={onClose}>
          <X size={28} />
        </button>

        <h2>Edit Profile</h2>

        {/* Tab Navigation */}
        <div className="edit-profile-tabs">
          <button
            className={`tab-button ${activeTab === 'photo' ? 'active' : ''}`}
            onClick={() => setActiveTab('photo')}
          >
            <Camera size={16} /> Photo
          </button>
          <button
            className={`tab-button ${activeTab === 'bio' ? 'active' : ''}`}
            onClick={() => setActiveTab('bio')}
          >
            <Type size={16} /> Bio
          </button>
        </div>

        <div className="step-content">
          {/* Photo Tab */}
          {activeTab === 'photo' && (
            <div className="form-group">
              <label className="upload-section-header">
                <User size={18} /> Profile Photo
              </label>
              <p className="wizard-intro">
                Upload a photo that represents you as an artist.
              </p>
              <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                <img
                  src={preview || '/default-avatar.jpg'}
                  alt="Profile preview"
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '4px solid #004aad22',
                  }}
                />
              </div>
              <label className="input-field" style={{ cursor: 'pointer', textAlign: 'center' }}>
                <Upload size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Choose New Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
              </label>
              {photoFile && (
                <p className="file-preview">Selected: {photoFile.name}</p>
              )}
            </div>
          )}

          {/* Bio Tab */}
          {activeTab === 'bio' && (
            <div className="form-group">
              <label className="upload-section-header">
                <Type size={18} /> Bio
              </label>
              <p className="wizard-intro">
                Tell the world about your sound, your story, your roots.
              </p>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={6}
                placeholder="Share your musical journey, influences, and what makes you unique..."
                maxLength={500}
              />
              <p style={{ textAlign: 'right', color: '#666', fontSize: '0.8rem', marginTop: '4px' }}>
                {bio.length}/500
              </p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="button-group">
          <button className="back-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="submit-upload-button"
            onClick={activeTab === 'photo' ? handleSavePhoto : handleSaveBio}
            disabled={loading || (activeTab === 'photo' && !photoFile) || (activeTab === 'bio' && bio === userProfile?.bio)}
          >
            {loading ? 'Saving...' : `Save ${activeTab === 'photo' ? 'Photo' : 'Bio'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileWizard;
 