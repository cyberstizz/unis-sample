// src/SoundDiscoveryFields.jsx
//
// The "Sound & discovery" block shared by the upload wizard, the signup
// wizard's debut-song step and the edit-song wizard.
//
//   Primary subgenre  – required, from the song's own genre (or "Other" + a
//                       short description when nothing fits)
//   Second subgenre   – optional, from ANY genre (a rap song can lean R&B)
//   Mood              – one required, a second optional
//   Language          – defaults to English
//
// It only collects values. The parent keeps the state, checks
// isDiscoveryComplete() before moving on, and sends toDiscoveryPayload().

import React, { useEffect, useMemo } from 'react';
import {
  useTaxonomy, OTHER_SUBGENRE, GENRE_LABELS, GENRE_ORDER,
} from './utils/taxonomy';
import './soundDiscoveryFields.scss';

const SoundDiscoveryFields = ({ genreId, value, onChange, showErrors = false, idPrefix = 'sdf' }) => {
  const { taxonomy, loading, error, retry } = useTaxonomy();

  const set = (patch) => onChange({ ...value, ...patch });

  const ownGenre = useMemo(
    () => (taxonomy?.subgenres || []).filter((s) => s.genreId === genreId),
    [taxonomy, genreId]
  );
  const byGenre = useMemo(() => {
    const groups = {};
    (taxonomy?.subgenres || []).forEach((s) => {
      (groups[s.genreId] = groups[s.genreId] || []).push(s);
    });
    return groups;
  }, [taxonomy]);

  // If the genre changes (signup lets you go back and switch), a primary
  // subgenre from the old genre no longer applies.
  useEffect(() => {
    if (!taxonomy || !value.primarySubgenreId || value.primarySubgenreId === OTHER_SUBGENRE) return;
    if (!ownGenre.some((s) => s.subgenreId === value.primarySubgenreId)) {
      onChange({ ...value, primarySubgenreId: '' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxonomy, genreId]);

  if (loading) {
    return <div className="sdf"><p className="sdf__status">Loading subgenres and moods…</p></div>;
  }
  if (error || !taxonomy) {
    return (
      <div className="sdf">
        <p className="sdf__status sdf__status--error">
          We couldn't load the subgenre and mood lists. Check your connection, then try again.
        </p>
        <button type="button" className="sdf__retry" onClick={retry}>Try again</button>
      </div>
    );
  }

  const primary = ownGenre.find((s) => s.subgenreId === value.primarySubgenreId);
  const isOther = value.primarySubgenreId === OTHER_SUBGENRE;
  const secondary = taxonomy.subgenres.find((s) => s.subgenreId === value.secondarySubgenreId);
  const genreName = GENRE_LABELS[genreId] || 'your genre';

  const missingPrimary = showErrors && (!value.primarySubgenreId || (isOther && !value.subgenreWriteIn.trim()));
  const missingMood = showErrors && !value.primaryMoodId;

  // Mood chips: the first one picked is the main mood, the second is extra.
  // Clicking a picked chip removes it; picking a third replaces the second.
  const toggleMood = (moodId) => {
    if (value.primaryMoodId === moodId) {
      set({ primaryMoodId: value.secondaryMoodId || '', secondaryMoodId: '' });
    } else if (value.secondaryMoodId === moodId) {
      set({ secondaryMoodId: '' });
    } else if (!value.primaryMoodId) {
      set({ primaryMoodId: moodId });
    } else {
      set({ secondaryMoodId: moodId });
    }
  };

  return (
    <fieldset className="sdf">
      <legend className="sdf__legend">Sound &amp; discovery</legend>
      <p className="sdf__intro">
        This helps listeners find your song. It does not change which awards your song competes in;
        that is still {genreName}.
      </p>

      {/* Primary subgenre */}
      <div className="sdf__field">
        <label className="sdf__label" htmlFor={`${idPrefix}-primary`}>
          Subgenre <span className="sdf__req">required</span>
        </label>
        <select
          id={`${idPrefix}-primary`}
          className={`sdf__select ${missingPrimary ? 'is-invalid' : ''}`}
          value={value.primarySubgenreId}
          onChange={(e) => {
            const next = e.target.value;
            set({
              primarySubgenreId: next,
              subgenreWriteIn: next === OTHER_SUBGENRE ? value.subgenreWriteIn : '',
              // The second subgenre can't repeat the first.
              secondarySubgenreId: value.secondarySubgenreId === next ? '' : value.secondarySubgenreId,
            });
          }}
          aria-invalid={missingPrimary || undefined}
        >
          <option value="">Choose the {genreName} subgenre that fits best</option>
          {ownGenre.map((s) => (
            <option key={s.subgenreId} value={s.subgenreId}>{s.name}</option>
          ))}
          <option value={OTHER_SUBGENRE}>None of these fit (describe it)</option>
        </select>
        {primary?.soundsLike && <span className="sdf__hint">Sounds like {primary.soundsLike}</span>}
        {isOther && (
          <>
            <input
              className={`sdf__input ${missingPrimary ? 'is-invalid' : ''}`}
              type="text"
              maxLength={60}
              value={value.subgenreWriteIn}
              onChange={(e) => set({ subgenreWriteIn: e.target.value })}
              placeholder="Describe the sound in a few words, e.g. Jersey club"
              aria-label="Describe the sound"
            />
            <span className="sdf__hint">
              We review these to decide which subgenres to add next. {60 - value.subgenreWriteIn.length} characters left.
            </span>
          </>
        )}
        {missingPrimary && (
          <span className="sdf__error">
            {isOther ? 'Describe the sound in a few words.' : 'Pick the subgenre that fits this song best.'}
          </span>
        )}
      </div>

      {/* Secondary subgenre — any genre */}
      <div className="sdf__field">
        <label className="sdf__label" htmlFor={`${idPrefix}-secondary`}>
          Second subgenre <span className="sdf__opt">optional</span>
        </label>
        <select
          id={`${idPrefix}-secondary`}
          className="sdf__select"
          value={value.secondarySubgenreId}
          onChange={(e) => set({ secondarySubgenreId: e.target.value })}
        >
          <option value="">None</option>
          {GENRE_ORDER.filter((g) => byGenre[g]?.length).map((g) => (
            <optgroup key={g} label={GENRE_LABELS[g]}>
              {byGenre[g]
                .filter((s) => s.subgenreId !== value.primarySubgenreId)
                .map((s) => (
                  <option key={s.subgenreId} value={s.subgenreId}>{s.name}</option>
                ))}
            </optgroup>
          ))}
        </select>
        <span className="sdf__hint">
          {secondary?.soundsLike
            ? `Sounds like ${secondary.soundsLike}`
            : 'Use this if the song also leans another way. It can come from any genre.'}
        </span>
      </div>

      {/* Moods */}
      <div className="sdf__field">
        <span className="sdf__label" id={`${idPrefix}-mood-label`}>
          Mood <span className="sdf__req">pick 1 or 2</span>
        </span>
        <div className="sdf__moods" role="group" aria-labelledby={`${idPrefix}-mood-label`}>
          {taxonomy.moods.map((m) => {
            const order = value.primaryMoodId === m.moodId ? 1 : value.secondaryMoodId === m.moodId ? 2 : 0;
            return (
              <button
                key={m.moodId}
                type="button"
                className={`sdf__mood ${order ? 'is-on' : ''}`}
                aria-pressed={order > 0}
                title={m.description || undefined}
                onClick={() => toggleMood(m.moodId)}
              >
                {order > 0 && <span className="sdf__mood-num" aria-hidden="true">{order}</span>}
                {m.name}
              </button>
            );
          })}
        </div>
        <span className="sdf__hint">
          Your first pick is the main mood. Tap a picked mood again to remove it.
        </span>
        {missingMood && <span className="sdf__error">Pick at least one mood.</span>}
      </div>

      {/* Language */}
      <div className="sdf__field">
        <label className="sdf__label" htmlFor={`${idPrefix}-language`}>Language</label>
        <select
          id={`${idPrefix}-language`}
          className="sdf__select"
          value={value.language}
          onChange={(e) => set({ language: e.target.value })}
        >
          {taxonomy.languages.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
        <span className="sdf__hint">The main language of the vocals.</span>
      </div>
    </fieldset>
  );
};

export default SoundDiscoveryFields;
