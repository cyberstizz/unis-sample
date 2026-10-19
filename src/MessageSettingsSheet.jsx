// src/MessageSettingsSheet.jsx
// "Messages" settings, opened from the inbox's settings button. Mirrors the
// help center's "Can I control who messages me?" article exactly:
//   • who can message you — Everyone / People you know / No one
//   • supporters skip Requests · activity status · read receipts · spam filter
//   • blocked accounts, with Unblock
// Each change saves on its own (PUT /v1/messages/settings) and rolls back if
// the save fails.

import React, { useEffect, useRef, useState } from 'react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import useModalA11y from './hooks/useModalA11y';

const PRIVACY = [
  { key: 'EVERYONE', label: 'Everyone', sub: 'People you don’t know land in Requests.' },
  { key: 'PEOPLE_I_KNOW', label: 'People you know', sub: 'Only artists you follow and listeners who support you.' },
  { key: 'NO_ONE', label: 'No one', sub: 'Nobody new. You can still start conversations.' },
];

const TOGGLES = [
  { key: 'supportersSkipRequests', label: 'Supporters skip Requests', sub: 'People who support you land straight in your inbox.' },
  { key: 'showActivityStatus', label: 'Show activity status', sub: 'Off hides when you’re active — and hides everyone else’s from you.' },
  { key: 'sendReadReceipts', label: 'Read receipts', sub: 'Off sends no Seen marks — and shows you none.' },
  { key: 'filterSpamRequests', label: 'Filter spam requests', sub: 'Bulk and low-quality requests go to Filtered.' },
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function MessageSettingsSheet({ open, onClose, onChanged }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const sheetRef = useRef(null);

  useModalA11y({ active: open, onClose, modalRef: sheetRef });

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setError(null);
    apiCall({ url: '/v1/messages/settings', useCache: false })
      .then((res) => { if (alive) setSettings(res.data); })
      .catch((err) => {
        console.error('[Messages] settings load failed:', err?.message || err);
        if (alive) setError('Message settings aren’t available right now.');
      });
    return () => { alive = false; };
  }, [open]);

  const save = async (patch) => {
    const before = settings;
    setSettings((s) => ({ ...s, ...patch }));
    setBusy(Object.keys(patch)[0]);
    setError(null);
    try {
      const res = await apiCall({ method: 'put', url: '/v1/messages/settings', data: patch });
      setSettings(res.data);
      onChanged?.();
    } catch (err) {
      console.error('[Messages] settings save failed:', err?.message || err);
      setSettings(before);
      setError(err?.response?.data?.error || 'That change didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const unblock = async (person) => {
    setBusy(`unblock-${person.userId}`);
    setError(null);
    try {
      await apiCall({ method: 'delete', url: `/v1/users/${person.userId}/block` });
      setSettings((s) => ({ ...s, blocked: s.blocked.filter((b) => b.userId !== person.userId) }));
      onChanged?.();
    } catch (err) {
      console.error('[Messages] unblock failed:', err?.message || err);
      setError(`Couldn’t unblock ${person.username || 'that account'}.`);
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <div className="udm-sheet" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="udm-sheet__panel udm-settings" role="dialog" aria-modal="true" aria-label="Message settings" ref={sheetRef} tabIndex={-1}>
        <div className="udm-sheet__grab" aria-hidden="true" />
        <div className="udm-settings__head">
          <h2 className="udm-settings__title">Message settings</h2>
          <button type="button" className="udm-sheet__close" onClick={onClose}>Done</button>
        </div>

        <div className="udm-settings__body">
          {error && <p className="udm-settings__error" role="alert">{error}</p>}
          {!settings && !error && <p className="udm-sheet__hint">Loading…</p>}

          {settings && (
            <>
              <fieldset className="udm-settings__group">
                <legend className="udm-settings__label">Who can message you</legend>
                {PRIVACY.map((p) => (
                  <label key={p.key} className={`udm-choice${settings.messagePrivacy === p.key ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name="udm-privacy"
                      value={p.key}
                      checked={settings.messagePrivacy === p.key}
                      disabled={busy != null}
                      onChange={() => save({ messagePrivacy: p.key })}
                    />
                    <span className="udm-choice__dot" aria-hidden="true" />
                    <span className="udm-choice__text">
                      <span className="udm-choice__label">{p.label}</span>
                      <span className="udm-choice__sub">{p.sub}</span>
                    </span>
                  </label>
                ))}
                <p className="udm-settings__note">Anyone you already have a conversation with can always reach you.</p>
              </fieldset>

              <div className="udm-settings__group">
                {TOGGLES.map((t) => {
                  const on = !!settings[t.key];
                  return (
                    <div key={t.key} className="udm-toggle-row">
                      <span className="udm-choice__text">
                        <span className="udm-choice__label" id={`udm-t-${t.key}`}>{t.label}</span>
                        <span className="udm-choice__sub">{t.sub}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-labelledby={`udm-t-${t.key}`}
                        className={`udm-switch${on ? ' is-on' : ''}`}
                        disabled={busy != null}
                        onClick={() => save({ [t.key]: !on })}
                      >
                        <span aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="udm-settings__group">
                <span className="udm-settings__label">Blocked accounts</span>
                {settings.blocked?.length ? settings.blocked.map((b) => (
                  <div key={b.userId} className="udm-blocked">
                    {b.photoUrl
                      ? <img className="udm-avatar" style={{ width: 40, height: 40 }} src={buildUrl(b.photoUrl)} alt="" />
                      : <span className="udm-avatar udm-mono" style={{ width: 40, height: 40, fontSize: 14 }} aria-hidden="true">{initials(b.username || '')}</span>}
                    <span className="udm-blocked__name">{b.username || 'Deleted account'}</span>
                    <button
                      type="button"
                      className="udm-menu__btn"
                      disabled={busy != null}
                      onClick={() => unblock(b)}
                    >
                      Unblock
                    </button>
                  </div>
                )) : <p className="udm-settings__note">You haven&rsquo;t blocked anyone.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
