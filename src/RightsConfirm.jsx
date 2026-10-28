// src/RightsConfirm.jsx
import React from 'react';
import './RightsConfirm.scss';

// ─────────────────────────────────────────────────────────────────────────────
// RightsConfirm — the rights checkbox on every upload (Terms of Service 3.6)
//
// Until Unis holds licenses from The MLC and the performing rights
// organizations, it can only carry music the uploader controls: no publisher
// or publishing administrator, no SESAC or GMR writer, no covers, no
// uncleared samples. Each upload shows this box and sends
// `rightsConfirmed: true`; the backend refuses anything else
// (MediaService.RIGHTS_REFUSED_SONG / RIGHTS_REFUSED_VIDEO), so a client that
// skips the box can't skip the rule.
//
// Used by: uploadWizard (songs, their clean versions, videos) and
// createAccountWizard (the debut song). The mobile app needs the same box and
// the same field.
//
// The parent owns the state: `checked`, `onChange(bool)`, and `showAlert`,
// which it turns on when someone tries to continue without ticking the box.
// ─────────────────────────────────────────────────────────────────────────────

export const RIGHTS_HELP_HREF = '/help#upload-rights';

const rightsAlert = (mediaType = 'song') => (
  mediaType === 'video'
    ? 'Check the box to upload this video. If any of these isn’t true for the music in it, the video can’t go on Unis yet.'
    : 'Check the box to upload this song. If any of these isn’t true, the song can’t go on Unis yet.'
);

const RightsConfirm = ({
  checked,
  onChange,
  mediaType = 'song',
  showAlert = false,
  idPrefix = 'rights',
}) => {
  const subject = mediaType === 'video' ? 'the music in this video' : 'this song';
  const inputId = `${idPrefix}-confirm`;
  const alertId = `${idPrefix}-alert`;
  const alerting = showAlert && !checked;

  return (
    <fieldset className={`rights-confirm${alerting ? ' rights-confirm--alert' : ''}`}>
      <legend className="rights-confirm__title">Your rights to {subject}</legend>
      <p className="rights-confirm__intro">
        Unis can only take music you control yourself. For now, that means:
      </p>
      <ul className="rights-confirm__list">
        <li>You wrote it, and everyone who co-wrote it or made the beat is fine with it being on Unis.</li>
        <li>No publisher or publishing administrator, such as Songtrust or TuneCore Publishing, handles any part of it.</li>
        <li>No one who wrote it is with SESAC or GMR. ASCAP and BMI are fine.</li>
        <li>It isn’t a cover, and any sample in it is cleared.</li>
      </ul>

      <label className="rights-confirm__check" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={alerting || undefined}
          aria-describedby={alerting ? alertId : undefined}
        />
        <span>
          All of this is true for {subject}, and I license it to Unis under section 3 of the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
        </span>
      </label>

      {alerting && (
        <p id={alertId} className="rights-confirm__alert" role="alert">
          {rightsAlert(mediaType)}
        </p>
      )}

      <a className="rights-confirm__why" href={RIGHTS_HELP_HREF} target="_blank" rel="noopener noreferrer">
        Why Unis asks
      </a>
    </fieldset>
  );
};

export default RightsConfirm;
