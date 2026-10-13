// ═══════════════════════════════════════════════════════════════════════
//  UNIS — Subgenres, moods and languages (the discovery layer)
//
//  These are for FINDING music only. Voting, awards and charts still key off
//  the three genres in idMappings.js and never look at a subgenre or mood.
//
//  The lists live in the database (sql/V2026_10c__subgenres_moods_language.sql)
//  and arrive from GET /v1/taxonomy. They change a few times a year at most,
//  so the first call is shared by every component for the life of the page.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { apiCall } from '../components/axiosInstance';
import { GENRE_IDS } from './idMappings';

/** Value the primary-subgenre picker uses for "none of these fit". */
export const OTHER_SUBGENRE = '__other';

export const GENRE_LABELS = {
  [GENRE_IDS.rap]: 'Rap',
  [GENRE_IDS.rock]: 'Rock',
  [GENRE_IDS.pop]: 'Pop',
};

/** Order the three genres appear in grouped lists. */
export const GENRE_ORDER = [GENRE_IDS.rap, GENRE_IDS.rock, GENRE_IDS.pop];

/** Blank form state for SoundDiscoveryFields. */
export const EMPTY_DISCOVERY = {
  primarySubgenreId: '',
  secondarySubgenreId: '',
  subgenreWriteIn: '',
  primaryMoodId: '',
  secondaryMoodId: '',
  language: 'en',
};

let taxonomyPromise = null;

/** Fetches the lists once and shares the answer. A failed fetch can be retried. */
export function loadTaxonomy() {
  if (!taxonomyPromise) {
    taxonomyPromise = apiCall({ method: 'get', url: '/v1/taxonomy', useCache: false })
      .then((res) => {
        const data = res.data || {};
        return {
          subgenres: data.subgenres || [],
          moods: data.moods || [],
          languages: data.languages || [],
        };
      })
      .catch((err) => {
        taxonomyPromise = null; // let the next caller try again
        throw err;
      });
  }
  return taxonomyPromise;
}

/** React hook: { taxonomy, loading, error, retry } */
export function useTaxonomy() {
  const [state, setState] = useState({ taxonomy: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loadTaxonomy()
      .then((taxonomy) => { if (active) setState({ taxonomy, loading: false, error: null }); })
      .catch((err) => {
        console.error('[Taxonomy] could not load subgenres and moods:', err);
        if (active) setState({ taxonomy: null, loading: false, error: err });
      });
    return () => { active = false; };
  }, [attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

/** True when the form holds everything the backend requires. */
export function isDiscoveryComplete(value) {
  if (!value) return false;
  const hasPrimary = value.primarySubgenreId === OTHER_SUBGENRE
    ? value.subgenreWriteIn.trim().length > 0
    : Boolean(value.primarySubgenreId);
  return hasPrimary && Boolean(value.primaryMoodId);
}

/** Plain-English reason the form isn't complete, or '' when it is. */
export function discoveryProblem(value) {
  if (!value?.primarySubgenreId) return 'Pick the subgenre that fits this song best.';
  if (value.primarySubgenreId === OTHER_SUBGENRE && !value.subgenreWriteIn.trim()) {
    return 'Describe the sound in a few words, since none of the subgenres fit.';
  }
  if (!value.primaryMoodId) return 'Pick at least one mood.';
  return '';
}

/** The fields the upload JSON and PATCH /discovery body expect. */
export function toDiscoveryPayload(value) {
  const other = value.primarySubgenreId === OTHER_SUBGENRE;
  return {
    primarySubgenreId: other ? null : value.primarySubgenreId || null,
    subgenreWriteIn: other ? value.subgenreWriteIn.trim() : null,
    secondarySubgenreId: value.secondarySubgenreId || null,
    primaryMoodId: value.primaryMoodId || null,
    secondaryMoodId: value.secondaryMoodId || null,
    language: value.language || 'en',
  };
}

/** Form state from a song the backend returned (for the edit wizard). */
export function discoveryFromSong(song) {
  if (!song) return { ...EMPTY_DISCOVERY };
  const primary = song.primarySubgenre?.subgenreId || song.primarySubgenreId || '';
  const writeIn = song.subgenreWriteIn || '';
  return {
    primarySubgenreId: primary || (writeIn ? OTHER_SUBGENRE : ''),
    secondarySubgenreId: song.secondarySubgenre?.subgenreId || song.secondarySubgenreId || '',
    subgenreWriteIn: writeIn,
    primaryMoodId: song.primaryMood?.moodId || song.primaryMoodId || '',
    secondaryMoodId: song.secondaryMood?.moodId || song.secondaryMoodId || '',
    language: song.language || 'en',
  };
}

/** Readable summary for review screens: { subgenres, moods, language }. */
export function describeDiscovery(value, taxonomy) {
  const sg = (id) => taxonomy?.subgenres.find((s) => s.subgenreId === id)?.name;
  const md = (id) => taxonomy?.moods.find((m) => m.moodId === id)?.name;
  const primary = value.primarySubgenreId === OTHER_SUBGENRE
    ? `Other: ${value.subgenreWriteIn.trim() || '—'}`
    : sg(value.primarySubgenreId);
  const subgenres = [primary, sg(value.secondarySubgenreId)].filter(Boolean).join(' + ') || '—';
  const moods = [md(value.primaryMoodId), md(value.secondaryMoodId)].filter(Boolean).join(' + ') || '—';
  const language = taxonomy?.languages.find((l) => l.code === value.language)?.name || 'English';
  return { subgenres, moods, language };
}
