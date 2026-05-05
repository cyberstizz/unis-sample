import React, { useState } from 'react';
import { Bell, Globe, Eye, MapPin, Languages } from 'lucide-react';
import './AccountSettings.scss';

// =============================================================================
// AccountSettings
//
// Notifications, privacy, and general account preferences.
//
// CURRENT STATE: All toggles are NON-FUNCTIONAL placeholders (UI-only).
// Local component state holds the on/off value so the toggle visually responds,
// but no API calls are made. Wire each one up by replacing the TODO blocks
// inside `update()` with the appropriate apiCall().
//
// Suggested API patterns (verify against your backend):
//   PATCH /v1/users/profile/${userId}          { emailNotifications: true }
//   PATCH /v1/users/${userId}/preferences      { publicProfile: false }
// =============================================================================

const JURISDICTION_OPTIONS = [
  'Downtown Harlem',
  'Uptown Harlem',
  'East Harlem',
  // TODO: Replace with a live list from /v1/jurisdictions or wherever
  // your jurisdictions live.
];

const LANGUAGE_OPTIONS = [
  'English (US)',
  // TODO: Wire up to a real i18n list once localization lands.
];

const AccountSettings = ({ userId, userProfile = {} }) => {
  // Initialize from userProfile if those fields exist; otherwise sensible defaults.
  const [settings, setSettings] = useState({
    emailNotifications: userProfile.emailNotifications ?? true,
    publicProfile:      userProfile.publicProfile ?? true,
    showVoteHistory:    userProfile.showVoteHistory ?? false,
    defaultJurisdiction: userProfile.defaultJurisdiction || 'Downtown Harlem',
    language:           userProfile.language || 'English (US)',
  });

  // Generic updater — currently UI-only. Add the real apiCall when wiring up.
  const update = async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    // TODO: Persist to backend. Example:
    // try {
    //   await apiCall({
    //     method: 'patch',
    //     url: `/v1/users/profile/${userId}`,
    //     data: { [key]: value },
    //   });
    // } catch (err) {
    //   console.error(`Failed to save ${key}:`, err);
    //   setSettings(prev => ({ ...prev, [key]: !value })); // revert
    // }
  };

  return (
    <div className="account-settings">

      {/* ----- Notifications group ----- */}
      <div className="account-settings__group">
        <div className="account-settings__group-label">
          <Bell size={12} /> Notifications
        </div>

        <SettingRow
          label="Email notifications"
          sub="Weekly digest of your jurisdiction"
        >
          <Switch
            on={settings.emailNotifications}
            onToggle={() => update('emailNotifications', !settings.emailNotifications)}
          />
        </SettingRow>
      </div>

      {/* ----- Privacy group ----- */}
      <div className="account-settings__group">
        <div className="account-settings__group-label">
          <Eye size={12} /> Privacy
        </div>

        <SettingRow
          label="Public profile"
          sub="Anyone on UNIS can find you"
        >
          <Switch
            on={settings.publicProfile}
            onToggle={() => update('publicProfile', !settings.publicProfile)}
          />
        </SettingRow>

        <SettingRow
          label="Show vote history"
          sub="Display your votes on your profile"
        >
          <Switch
            on={settings.showVoteHistory}
            onToggle={() => update('showVoteHistory', !settings.showVoteHistory)}
          />
        </SettingRow>
      </div>

      {/* ----- Region group ----- */}
      <div className="account-settings__group">
        <div className="account-settings__group-label">
          <Globe size={12} /> Region &amp; Language
        </div>

        <SettingRow
          label="Default jurisdiction"
          sub="Where your votes count by default"
        >
          <Select
            value={settings.defaultJurisdiction}
            options={JURISDICTION_OPTIONS}
            onChange={v => update('defaultJurisdiction', v)}
            icon={<MapPin size={12} />}
          />
        </SettingRow>

        <SettingRow
          label="Language"
          sub="Display language"
        >
          <Select
            value={settings.language}
            options={LANGUAGE_OPTIONS}
            onChange={v => update('language', v)}
            icon={<Languages size={12} />}
          />
        </SettingRow>
      </div>

    </div>
  );
};

// =============================================================================
// Sub-components
// =============================================================================

const SettingRow = ({ label, sub, children }) => (
  <div className="setting-row">
    <div className="setting-row__text">
      <div className="setting-row__label">{label}</div>
      {sub && <div className="setting-row__sub">{sub}</div>}
    </div>
    <div className="setting-row__control">{children}</div>
  </div>
);

const Switch = ({ on, onToggle }) => (
  <button
    type="button"
    className={`account-switch ${on ? 'is-on' : ''}`}
    onClick={onToggle}
    aria-pressed={on}
    aria-label={on ? 'Enabled — tap to disable' : 'Disabled — tap to enable'}
  >
    <span className="account-switch__thumb" />
  </button>
);

// Lightweight native-looking select with custom chrome. Uses a real <select>
// underneath for accessibility — looks like a pill with a chevron.
const Select = ({ value, options, onChange, icon }) => (
  <label className="account-select">
    {icon}
    <span className="account-select__value">{value}</span>
    <svg className="account-select__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="account-select__native"
      aria-label="Select option"
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </label>
);

export default AccountSettings;