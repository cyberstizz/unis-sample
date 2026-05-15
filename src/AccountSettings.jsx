import React, { useState, useEffect } from 'react';
import { Bell, Eye } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './AccountSettings.scss';

const DEFAULTS = {
  emailNotifications: true,
  publicProfile: true,
  showVoteHistory: false,
};

const AccountSettings = ({ userId, settings: incomingSettings, onUpdated }) => {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULTS,
    ...(incomingSettings || {}),
  }));
  const [saving, setSaving] = useState({});

  // Re-sync when parent provides new settings (e.g., after reload()).
  useEffect(() => {
    if (incomingSettings) {
      setSettings(s => ({ ...s, ...incomingSettings }));
    }
  }, [incomingSettings]);

  const update = async (key, value) => {
    const prev = settings[key];

    // Optimistic
    setSettings(s => ({ ...s, [key]: value }));
    setSaving(s => ({ ...s, [key]: true }));

    const startedAt = performance.now();
    try {
      await apiCall({
        method: 'patch',
        url: `/v1/users/${userId}/preferences`,
        data: { [key]: value },
      });
      const ms = Math.round(performance.now() - startedAt);
      console.log(`[AccountSettings] action=update key=${key} status=ok durationMs=${ms}`);
      onUpdated?.();
    } catch (err) {
      const ms = Math.round(performance.now() - startedAt);
      console.error(`[AccountSettings] action=update key=${key} status=fail durationMs=${ms} err=`, err);
      setSettings(s => ({ ...s, [key]: prev })); // revert
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
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
          sub="Weekly digest of your jurisdiction and activity"
        >
          <Switch
            on={settings.emailNotifications}
            disabled={saving.emailNotifications}
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
            disabled={saving.publicProfile}
            onToggle={() => update('publicProfile', !settings.publicProfile)}
          />
        </SettingRow>

        <SettingRow
          label="Show vote history"
          sub="Display your votes on your profile"
        >
          <Switch
            on={settings.showVoteHistory}
            disabled={saving.showVoteHistory}
            onToggle={() => update('showVoteHistory', !settings.showVoteHistory)}
          />
        </SettingRow>
      </div>

    </div>
  );
};

const SettingRow = ({ label, sub, children }) => (
  <div className="setting-row">
    <div className="setting-row__text">
      <div className="setting-row__label">{label}</div>
      {sub && <div className="setting-row__sub">{sub}</div>}
    </div>
    <div className="setting-row__control">{children}</div>
  </div>
);

const Switch = ({ on, onToggle, disabled }) => (
  <button
    type="button"
    className={`account-switch ${on ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}
    onClick={onToggle}
    disabled={disabled}
    role="switch"
    aria-checked={on}
    aria-label={on ? 'Enabled — tap to disable' : 'Disabled — tap to enable'}
  >
    <span className="account-switch__thumb" aria-hidden="true" />
  </button>
);

export default AccountSettings;