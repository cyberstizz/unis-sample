// src/ReleaseAlertBell.jsx — the bell next to Following on an artist's page.
//
// Following turns release alerts on (every release). The bell opens a sheet:
// Every release · Big releases only (albums, EPs, mixtapes) · Off. Also
// exports AlertLevelSheet, which Settings → "Choose per artist" reuses.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, BellRing, Check } from 'lucide-react';
import useModalA11y from './hooks/useModalA11y';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { ALERT_LEVELS, fetchFollowLevel, levelLabel, saveFollowLevel } from './utils/releaseAlerts';
import './releaseAlerts.scss';

export const LevelIcon = ({ level, size = 19 }) => {
  if (level === 'OFF') return <BellOff size={size} aria-hidden="true" />;
  if (level === 'MAJOR') return <Bell size={size} aria-hidden="true" />;
  return <BellRing size={size} aria-hidden="true" />;
};

/** The three choices, as a sheet. onPick(level) saves; the sheet closes itself after. */
export const AlertLevelSheet = ({ artistName, level, onPick, onClose, saving }) => {
  const ref = useRef(null);
  useModalA11y({ active: true, onClose, modalRef: ref });

  return createPortal(
    <div className="ra-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ra-sheet" role="dialog" aria-modal="true" aria-labelledby="ra-level-title" ref={ref}>
        <span className="ra-sheet__grab" aria-hidden="true" />
        <h2 id="ra-level-title" className="ra-sheet__title">Release alerts from {artistName}</h2>
        <p className="ra-sheet__sub">In Messages, and by email if you have it on.</p>
        <div className="ra-levels" role="radiogroup" aria-labelledby="ra-level-title">
          {ALERT_LEVELS.map((l) => {
            const on = l.key === level;
            return (
              <button
                key={l.key}
                type="button"
                role="radio"
                aria-checked={on}
                className={`ra-level ${on ? 'is-on' : ''}`}
                disabled={saving}
                onClick={() => onPick(l.key)}
              >
                <span className="ra-level__icon"><LevelIcon level={l.key} /></span>
                <span className="ra-level__text">
                  <strong>{l.label}</strong>
                  <span>{l.sub}</span>
                </span>
                {on && <Check size={18} strokeWidth={2.6} className="ra-level__check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * The bell itself. Shown only while following (pass isFollowing), since
 * following is what turns alerts on.
 */
const ReleaseAlertBell = ({ artistId, artistName, isFollowing, className = '' }) => {
  const feedback = useFeedback();
  const [level, setLevel] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!artistId || !isFollowing) return undefined;
    let active = true;
    fetchFollowLevel(artistId)
      .then((d) => {
        if (active && d?.level) setLevel(d.level);
      })
      .catch((err) => console.error('Alert level failed:', err));
    return () => {
      active = false;
    };
  }, [artistId, isFollowing]);

  // A fresh follow starts at Every release.
  useEffect(() => {
    if (!isFollowing) setLevel('ALL');
    return load();
  }, [isFollowing, load]);

  if (!isFollowing) return null;

  const pick = async (next) => {
    if (next === level) {
      setOpen(false);
      return;
    }
    const before = level;
    setLevel(next);
    setSaving(true);
    try {
      await saveFollowLevel(artistId, next);
      feedback.success(
        next === 'OFF'
          ? `Release alerts from ${artistName} are off`
          : `${levelLabel(next)} from ${artistName}`
      );
      setOpen(false);
    } catch (err) {
      setLevel(before);
      feedback.error(errorMessage(err, "Couldn't change your alerts. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`${className} ra-bell ${level === 'OFF' ? 'is-off' : ''}`.trim()}
        aria-label={`Release alerts: ${levelLabel(level)}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <LevelIcon level={level} />
      </button>
      {open && (
        <AlertLevelSheet artistName={artistName} level={level} saving={saving} onPick={pick} onClose={() => setOpen(false)} />
      )}
    </>
  );
};

export default ReleaseAlertBell;
