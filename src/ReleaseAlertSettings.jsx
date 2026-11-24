// src/ReleaseAlertSettings.jsx — Settings → Release alerts (artist dashboard
// and listener page).
//
//   In Unis    the "New releases" row in Messages, the header badge, NEW tags
//   By email   at most one email a day, only when there's something new
//   Choose per artist   every followed artist's bell in one list
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import useModalA11y from './hooks/useModalA11y';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import buildUrl from './utils/buildUrl';
import {
  ALERT_LEVELS,
  fetchAlertSettings,
  fetchFollowedArtists,
  levelLabel,
  saveAlertSettings,
  saveFollowLevel,
} from './utils/releaseAlerts';
import './releaseAlerts.scss';

export const Switch = ({ on, label, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    className={`ra-switch ${on ? 'is-on' : ''}`}
    disabled={disabled}
    onClick={() => onChange(!on)}
  >
    <span aria-hidden="true" />
  </button>
);

const SHORT = { ALL: 'Every', MAJOR: 'Big only', OFF: 'Off' };

const PerArtistSheet = ({ onClose }) => {
  const feedback = useFeedback();
  const ref = useRef(null);
  useModalA11y({ active: true, onClose, modalRef: ref });
  const [artists, setArtists] = useState(null);
  const [error, setError] = useState(false);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let active = true;
    fetchFollowedArtists()
      .then((list) => {
        if (active) setArtists(list);
      })
      .catch((err) => {
        console.error('Followed artists failed:', err);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const change = async (a, level) => {
    if (a.level === level) return;
    setSavingId(a.artistId);
    setArtists((list) => list.map((x) => (x.artistId === a.artistId ? { ...x, level } : x)));
    try {
      await saveFollowLevel(a.artistId, level);
      feedback.success(level === 'OFF' ? `Alerts from ${a.name} are off` : `${levelLabel(level)} from ${a.name}`);
    } catch (err) {
      setArtists((list) => list.map((x) => (x.artistId === a.artistId ? { ...x, level: a.level } : x)));
      feedback.error(errorMessage(err, "Couldn't change that. Try again."));
    } finally {
      setSavingId(null);
    }
  };

  return createPortal(
    <div className="ra-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ra-sheet ra-sheet--tall" role="dialog" aria-modal="true" aria-labelledby="ra-per-title" ref={ref}>
        <span className="ra-sheet__grab" aria-hidden="true" />
        <div className="ra-sheet__head">
          <h2 id="ra-per-title" className="ra-sheet__title">Alerts per artist</h2>
          <button type="button" className="ra-sheet__done" onClick={onClose}>Done</button>
        </div>
        <p className="ra-sheet__sub">Every release, big releases only (albums, EPs, mixtapes), or off.</p>
        {error ? (
          <p className="ra-empty">Couldn’t load the artists you follow. Try again later.</p>
        ) : artists === null ? (
          <p className="ra-empty" role="status">Loading…</p>
        ) : artists.length === 0 ? (
          <p className="ra-empty">You don’t follow any artists yet. Follow one from their page and their new music shows up here.</p>
        ) : (
          <ul className="ra-per">
            {artists.map((a) => (
              <li key={a.artistId} className="ra-per__row">
                {a.photoUrl
                  ? <img src={buildUrl(a.photoUrl)} alt="" className="ra-per__face" />
                  : <span className="ra-per__face" aria-hidden="true">{(a.name || '?').charAt(0).toUpperCase()}</span>}
                <span className="ra-per__name">{a.name}</span>
                <div className="ra-seg" role="radiogroup" aria-label={`Alerts from ${a.name}`}>
                  {ALERT_LEVELS.map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      role="radio"
                      aria-checked={a.level === l.key}
                      className={a.level === l.key ? 'is-on' : ''}
                      disabled={savingId === a.artistId}
                      onClick={() => change(a, l.key)}
                    >
                      {SHORT[l.key]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
};

const ReleaseAlertSettings = ({ headingLevel = 'h3', accountEmailsOff = false }) => {
  const feedback = useFeedback();
  const [settings, setSettings] = useState(null);
  const [perOpen, setPerOpen] = useState(false);
  const H = headingLevel;

  useEffect(() => {
    let active = true;
    fetchAlertSettings()
      .then((s) => {
        if (active) setSettings(s || { inApp: true, email: true });
      })
      .catch((err) => {
        console.error('Alert settings failed:', err);
        if (active) setSettings({ inApp: true, email: true, failed: true });
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async (patch, message) => {
    const before = settings;
    setSettings((s) => ({ ...s, ...patch }));
    try {
      const saved = await saveAlertSettings(patch);
      if (saved) setSettings(saved);
      feedback.success(message);
    } catch (err) {
      setSettings(before);
      feedback.error(errorMessage(err, "Couldn't save that. Try again."));
    }
  };

  return (
    <section className="ad-panel ra-settings" aria-labelledby="ra-settings-title">
      <div className="ad-panel__head">
        <H id="ra-settings-title">
          Release <em>alerts</em>
        </H>
      </div>
      <div className="ra-setting">
        <div>
          <strong>In Unis</strong>
          <span>New music from artists you follow, in Messages.</span>
        </div>
        <Switch
          on={Boolean(settings?.inApp)}
          label="Release alerts in Unis"
          disabled={!settings}
          onChange={(v) => save({ inApp: v }, v ? 'Release alerts are on in Unis' : 'Release alerts are off in Unis')}
        />
      </div>
      <div className="ra-setting">
        <div>
          <strong>By email</strong>
          <span>
            One email a day at most, only when there’s something new.
            {accountEmailsOff && ' Turn on email notifications below to get it.'}
          </span>
        </div>
        <Switch
          on={Boolean(settings?.email)}
          label="Release alerts by email"
          disabled={!settings}
          onChange={(v) => save({ email: v }, v ? 'Release emails are on' : 'Release emails are off')}
        />
      </div>
      <button type="button" className="ra-link-row" onClick={() => setPerOpen(true)}>
        Choose per artist <ChevronRight size={16} aria-hidden="true" />
      </button>
      {perOpen && <PerArtistSheet onClose={() => setPerOpen(false)} />}
    </section>
  );
};

export default ReleaseAlertSettings;
