// src/SleepTimerSheet.jsx
//
// The sleep timer (listener features design): 5, 10, 15, 30, 45 or 60 minutes,
// or "End of this song". The music fades out over the last 10 seconds, then
// stops. While it runs, a chip shows the time left with "Turn off".

import React, { useEffect, useRef, useState } from 'react';
import { Moon, X } from 'lucide-react';
import useModalA11y from './hooks/useModalA11y';
import {
  useSleepTimer, startSleep, sleepAtEndOfSong, cancelSleep, sleepRemaining, formatSleep,
} from './utils/sleepTimer';
import { useFeedback } from './context/FeedbackContext';
import './playback.scss';

const MINUTES = [5, 10, 15, 30, 45, 60];

export default function SleepTimerSheet({ open, onClose }) {
  const sleep = useSleepTimer();
  const feedback = useFeedback();
  const dialogRef = useRef(null);
  useModalA11y({ active: open, onClose, modalRef: dialogRef });
  if (!open) return null;

  const pick = (m) => {
    startSleep(m);
    feedback.success(`Sleep timer: ${m} minutes`, { id: 'sleep-timer' });
    onClose();
  };
  const pickEnd = () => {
    sleepAtEndOfSong();
    feedback.success('Music stops after this song', { id: 'sleep-timer' });
    onClose();
  };
  const off = () => {
    cancelSleep();
    feedback.info('Sleep timer off', { id: 'sleep-timer' });
    onClose();
  };

  return (
    <div className="slp">
      <button type="button" className="slp__backdrop" aria-label="Close sleep timer" onClick={onClose} />
      <div className="slp__sheet" role="dialog" aria-modal="true" aria-labelledby="slp-title" ref={dialogRef}>
        <span className="slp__grip" aria-hidden="true" />
        <div className="slp__head">
          <span className="slp__icon"><Moon size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="slp-title">Sleep timer</h2>
            <p>Fades out, then stops</p>
          </div>
          <button type="button" className="slp__x" onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="slp__grid">
          {MINUTES.map((m) => {
            const on = sleep.mode === 'time' && Math.abs((sleep.endsAt - Date.now()) / 60000 - m) < 0.02;
            return (
              <button key={m} type="button" className={`slp__opt ${on ? 'is-on' : ''}`} onClick={() => pick(m)}>
                <strong>{m}</strong><span>minutes</span>
              </button>
            );
          })}
        </div>
        <button type="button" className={`slp__end ${sleep.mode === 'end' ? 'is-on' : ''}`} onClick={pickEnd}>
          <Moon size={17} aria-hidden="true" /> End of this song
        </button>
        {sleep.mode && (
          <button type="button" className="slp__off" onClick={off}>Turn off timer</button>
        )}
      </div>
    </div>
  );
}

/** "Stops in 29:41 · Turn off" — shown in Now Playing while a timer runs. */
export function SleepChip({ className = '' }) {
  const sleep = useSleepTimer();
  const [, force] = useState(0);
  useEffect(() => {
    if (!sleep.mode) return undefined;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [sleep.mode]);
  if (!sleep.mode) return null;
  const left = sleepRemaining();
  const text = sleep.mode === 'end' ? 'Stops after this song' : `Stops in ${formatSleep(left)}`;
  return (
    <div className={`slp-chip ${className}`} role="status">
      <Moon size={15} aria-hidden="true" fill="currentColor" />
      <span>{text}</span>
      <button type="button" onClick={cancelSleep}>Turn off</button>
    </div>
  );
}
