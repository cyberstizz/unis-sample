import React, { useState } from 'react';
import { X, Upload, Type, User } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './editProfileWizard.scss'; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const EditProfileWizard = ({ show, onClose, userProfile, onSuccess }) => {
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

  const handleSubmit = async () => {
    if (!photoFile && bio === userProfile?.bio) {
      onClose();
      return;
    }

    setLoading(true);
    const formData = new FormData();
    if (photoFile) formData.append('photo', photoFile);
    if (bio !== userProfile?.bio) formData.append('bio', bio);

    try {
      await apiCall({
        method: 'patch',
        url: '/v1/users/profile',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-wizard-overlay"> {/* REUSING SAME CLASS NAMES */}
      <div className="upload-wizard">
        <button className="close-button" onClick={onClose}>
          <X size={28} />
        </button>

        <h2>Edit Profile</h2>
        <p className="wizard-intro">
          Update your photo and bio to let Harlem know who you are.
        </p>

        <div className="step-content">

          {/* Profile Photo */}
          <div className="form-group">
            <label className="upload-section-header">
              <User size={18} /> Profile Photo
            </label>
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <img
                src={preview || '/default-avatar.jpg'}
                alt="Profile preview"
                style={{
                  width: 140,
                  height: 140,
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

          {/* Bio */}
          <div className="form-group">
            <label className="upload-section-header">
              <Type size={18} /> Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="Tell the world about your sound, your story, your Harlem roots..."
              maxLength={500}
            />
            <p style={{ textAlign: 'right', color: '#666', fontSize: '0.8rem', marginTop: '4px' }}>
              {bio.length}/500
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
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileWizard;