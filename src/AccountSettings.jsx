import React, { useState } from 'react';
import { Bell, Globe, Eye, MapPin, Languages } from 'lucide-react';
import './AccountSettings.scss';

// =============================================================================
// AccountSettings
//
// IMPORTANT — UI-only state, no persistence.
//
// The toggles below (email notifications, public profile, show vote history,
// default jurisdiction, language) do NOT have backing columns on the User
// entity yet. They flip visually but are NOT saved to the backend.
//
// To make any of these persist, you need:
//   1. Add a column to the User entity (e.g., `private Boolean publicProfile`)
//   2. Add a migration to create the column on existing tables
//   3. Add a settings field to ProfileSummaryDto with that value
//   4. Add a PATCH endpoint that updates that column (with @CacheEvict for
//      "profileSummaries" so the consolidated cache stays consistent)
//   5. Wire up the apiCall in this component's `update()` function below
//
// `defaultJurisdiction` is a special case — the User entity DOES have a
// jurisdiction relationship (ManyToOne), but changing it isn't a simple
// toggle; it's a relationship change that should probably live in its own
// flow with confirmation. Left UI-only here for now.
//
// External prop signature:
//   - userId: UUID (kept for future wiring; currently unused)
// =============================================================================

const JURISDICTION_OPTIONS = [
  'Downtown Harlem',
  'Uptown Harlem',
  'East Harlem',
  // TODO: Replace with a live list from /v1/jurisdictions
];

const LANGUAGE_OPTIONS = [
  'English (US)',
  // TODO: Wire up to a real i18n list once localization lands.
];

const DEFAULTS = {
  emailNotifications: true,
  publicProfile: true,
  showVoteHistory: false,
  defaultJurisdiction: 'Downtown Harlem',
  language: 'English (US)',
};

// eslint-disable-next-line no-unused-vars
const AccountSettings = ({ userId }) => {
  const [settings, setSettings] = useState(DEFAULTS);

  const update = (key, value) => {
    // Local-only update. When backing columns exist, replace this with the
    // optimistic-with-revert pattern shown in the comments below.
    setSettings(prev => ({ ...prev, [key]: value }));

    // When ready to persist (after backend columns are added), use:
    //
    // const prevValue = settings[key];
    // try {
    //   await apiCall({
    //     method: 'patch',
    //     url: `/v1/users/${userId}/preferences`,
    //     data: { [key]: value },
    //   });
    //   if (onUpdated) onUpdated();
    // } catch (err) {
    //   console.error(`[AccountSettings] action=update key=${key} status=fail`, err);
    //   setSettings(prev => ({ ...prev, [key]: prevValue }));
    // }
  };

  return (
    <div className="account-settings">

      {/* ----- Notifications group ----- */}
      <div className="account-settings__group">
        <div className="account-settings__group-label">
          <Bell size={12} aria-hidden="true" /> Notifications
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
          <Eye size={12} aria-hidden="true" /> Privacy
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
          <Globe size={12} aria-hidden="true" /> Region &amp; Language
        </div>

        <SettingRow
          label="Default jurisdiction"
          sub="Where your votes count by default"
        >
          <Select
            value={settings.defaultJurisdiction}
            options={JURISDICTION_OPTIONS}
            onChange={v => update('defaultJurisdiction', v)}
            icon={<MapPin size={12} aria-hidden="true" />}
            ariaLabel="Default jurisdiction"
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
            icon={<Languages size={12} aria-hidden="true" />}
            ariaLabel="Display language"
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
    role="switch"
    aria-checked={on}
    aria-label={on ? 'Enabled — tap to disable' : 'Disabled — tap to enable'}
  >
    <span className="account-switch__thumb" aria-hidden="true" />
  </button>
);

const Select = ({ value, options, onChange, icon, ariaLabel }) => (
  <label className="account-select">
    {icon}
    <span className="account-select__value">{value}</span>
    <svg className="account-select__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="account-select__native"
      aria-label={ariaLabel || 'Select option'}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </label>
);

export default AccountSettings;