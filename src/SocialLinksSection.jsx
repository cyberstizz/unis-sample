import React, { useState, useEffect } from 'react';
import { Instagram, Twitter, Music2, Edit3, Check, X } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './SocialLinksSection.scss';

// =============================================================================
// SocialLinksSection
//
// Edit + display for the user's three social URLs (Instagram / Twitter / TikTok).
// Persists via PUT /v1/users/profile/{userId} (the backend's "Update social URLs"
// endpoint per architecture doc § 4).
//
// Props:
//   - userId:    UUID
//   - profile:   { instagramUrl, twitterUrl, tiktokUrl }  (from ProfileSummary)
//   - onUpdated: () => void  (parent reload; busts cache)
// =============================================================================

const SocialLinksSection = ({ userId, profile, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    instagramUrl: profile?.instagramUrl || '',
    twitterUrl:   profile?.twitterUrl   || '',
    tiktokUrl:    profile?.tiktokUrl    || '',
  });

  // Re-sync if parent reloads with new data
  useEffect(() => {
    setValues({
      instagramUrl: profile?.instagramUrl || '',
      twitterUrl:   profile?.twitterUrl   || '',
      tiktokUrl:    profile?.tiktokUrl    || '',
    });
  }, [profile?.instagramUrl, profile?.twitterUrl, profile?.tiktokUrl]);

  const handleSave = async () => {
    setSaving(true);
    const startedAt = performance.now();
    try {
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${userId}`,
        data: {
          instagramUrl: values.instagramUrl.trim() || null,
          twitterUrl:   values.twitterUrl.trim()   || null,
          tiktokUrl:    values.tiktokUrl.trim()    || null,
        },
      });
      const ms = Math.round(performance.now() - startedAt);
      console.log(`[SocialLinks] action=save status=ok durationMs=${ms}`);
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      console.error('[SocialLinks] action=save status=fail err=', err);
      alert('Failed to save social links. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValues({
      instagramUrl: profile?.instagramUrl || '',
      twitterUrl:   profile?.twitterUrl   || '',
      tiktokUrl:    profile?.tiktokUrl    || '',
    });
    setEditing(false);
  };

  const update = (key, value) => setValues(v => ({ ...v, [key]: value }));

  const hasAny = Boolean(values.instagramUrl || values.twitterUrl || values.tiktokUrl);

  return (
    <div className="social-links-section">
      {editing ? (
        <>
          <SocialRow
            icon={<Instagram size={16} aria-hidden="true" />}
            placeholder="https://instagram.com/yourhandle"
            value={values.instagramUrl}
            onChange={v => update('instagramUrl', v)}
          />
          <SocialRow
            icon={<Twitter size={16} aria-hidden="true" />}
            placeholder="https://twitter.com/yourhandle"
            value={values.twitterUrl}
            onChange={v => update('twitterUrl', v)}
          />
          <SocialRow
            icon={<Music2 size={16} aria-hidden="true" />}
            placeholder="https://tiktok.com/@yourhandle"
            value={values.tiktokUrl}
            onChange={v => update('tiktokUrl', v)}
          />
          <div className="social-links-actions">
            <button
              type="button"
              className="profile-btn profile-btn--ghost"
              onClick={handleCancel}
              disabled={saving}
            >
              <X size={14} aria-hidden="true" /> Cancel
            </button>
            <button
              type="button"
              className="profile-btn profile-btn--primary"
              onClick={handleSave}
              disabled={saving}
            >
              <Check size={14} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          {values.instagramUrl && (
            <SocialDisplay
              href={values.instagramUrl}
              icon={<Instagram size={16} aria-hidden="true" />}
              label={values.instagramUrl}
            />
          )}
          {values.twitterUrl && (
            <SocialDisplay
              href={values.twitterUrl}
              icon={<Twitter size={16} aria-hidden="true" />}
              label={values.twitterUrl}
            />
          )}
          {values.tiktokUrl && (
            <SocialDisplay
              href={values.tiktokUrl}
              icon={<Music2 size={16} aria-hidden="true" />}
              label={values.tiktokUrl}
            />
          )}
          {!hasAny && (
            <p className="social-links-empty">
              No social links yet. Add your handles so fans can find you.
            </p>
          )}
          <div className="social-links-actions">
            <button
              type="button"
              className="profile-btn profile-btn--ghost"
              onClick={() => setEditing(true)}
            >
              <Edit3 size={14} aria-hidden="true" /> {hasAny ? 'Edit' : 'Add'} links
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const SocialRow = ({ icon, placeholder, value, onChange }) => (
  <div className="social-links-row">
    <span className="social-links-row__icon">{icon}</span>
    <input
      type="url"
      className="social-links-row__input"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

const SocialDisplay = ({ href, icon, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="social-links-row social-links-row--display"
  >
    <span className="social-links-row__icon">{icon}</span>
    <span className="social-links-row__value">{label}</span>
  </a>
);

export default SocialLinksSection;