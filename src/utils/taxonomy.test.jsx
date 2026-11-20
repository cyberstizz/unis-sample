// src/utils/taxonomy.test.jsx
//
// Subgenres, moods and languages — the "Sound & discovery" tags a song carries
// behind its votable genre (rap / rock / pop). These helpers decide whether a
// song is allowed to upload and exactly what is sent to the backend, in the
// upload wizard, the signup debut-song step and the edit-song wizard.
//
// Rules:
//   • a song needs a main subgenre (or a written description when none fit)
//     and at least one mood
//   • the lists are fetched once and shared; a failed fetch can be retried

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { GENRE_IDS } from './idMappings';
import {
  OTHER_SUBGENRE,
  GENRE_LABELS,
  GENRE_ORDER,
  EMPTY_DISCOVERY,
  isDiscoveryComplete,
  discoveryProblem,
  toDiscoveryPayload,
  discoveryFromSong,
  describeDiscovery,
} from './taxonomy';

const TAXONOMY = {
  subgenres: [
    { subgenreId: 'sg-drill', genreId: GENRE_IDS.rap, name: 'Drill' },
    { subgenreId: 'sg-indie', genreId: GENRE_IDS.rock, name: 'Indie rock' },
  ],
  moods: [
    { moodId: 'mood-hype', name: 'Hype' },
    { moodId: 'mood-chill', name: 'Chill' },
  ],
  languages: [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
  ],
};

const filled = (overrides = {}) => ({
  ...EMPTY_DISCOVERY,
  primarySubgenreId: 'sg-drill',
  primaryMoodId: 'mood-hype',
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('taxonomy — constants', () => {
  it('labels the three votable genres, in the order lists show them', () => {
    expect(GENRE_ORDER.map((id) => GENRE_LABELS[id])).toEqual(['Rap', 'Rock', 'Pop']);
  });

  it('a blank form defaults to English and nothing else', () => {
    expect(EMPTY_DISCOVERY).toEqual({
      primarySubgenreId: '', secondarySubgenreId: '', subgenreWriteIn: '',
      primaryMoodId: '', secondaryMoodId: '', language: 'en',
    });
  });
});

// ===========================================================================
describe('taxonomy — is the form complete?', () => {
  it('a subgenre and a mood are enough', () => {
    expect(isDiscoveryComplete(filled())).toBe(true);
    expect(discoveryProblem(filled())).toBe('');
  });

  it('second subgenre and second mood are optional', () => {
    expect(isDiscoveryComplete(filled({ secondarySubgenreId: '', secondaryMoodId: '' }))).toBe(true);
  });

  it('no subgenre: not complete', () => {
    const value = filled({ primarySubgenreId: '' });
    expect(isDiscoveryComplete(value)).toBe(false);
    expect(discoveryProblem(value)).toBe('Pick the subgenre that fits this song best.');
  });

  it('no mood: not complete', () => {
    const value = filled({ primaryMoodId: '' });
    expect(isDiscoveryComplete(value)).toBe(false);
    expect(discoveryProblem(value)).toBe('Pick at least one mood.');
  });

  it('a second mood does not stand in for the first', () => {
    expect(isDiscoveryComplete(filled({ primaryMoodId: '', secondaryMoodId: 'mood-chill' }))).toBe(false);
  });

  it('"none of these fit" needs a description', () => {
    const value = filled({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: '   ' });
    expect(isDiscoveryComplete(value)).toBe(false);
    expect(discoveryProblem(value)).toBe('Describe the sound in a few words, since none of the subgenres fit.');
  });

  it('"none of these fit" with a description and a mood is complete', () => {
    const value = filled({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: 'Jersey club' });
    expect(isDiscoveryComplete(value)).toBe(true);
    expect(discoveryProblem(value)).toBe('');
  });

  it('reports the subgenre problem before the mood problem', () => {
    expect(discoveryProblem({ ...EMPTY_DISCOVERY })).toBe('Pick the subgenre that fits this song best.');
  });

  it.each([null, undefined])('%p is not complete', (value) => {
    expect(isDiscoveryComplete(value)).toBe(false);
    expect(discoveryProblem(value)).toBe('Pick the subgenre that fits this song best.');
  });

  it('the two checks always agree', () => {
    [
      filled(),
      filled({ primarySubgenreId: '' }),
      filled({ primaryMoodId: '' }),
      filled({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: '' }),
      filled({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: 'x' }),
      { ...EMPTY_DISCOVERY },
    ].forEach((value) => {
      expect(isDiscoveryComplete(value)).toBe(discoveryProblem(value) === '');
    });
  });
});

// ===========================================================================
describe('taxonomy — what is sent to the backend', () => {
  it('sends ids, with null for anything not picked', () => {
    expect(toDiscoveryPayload(filled())).toEqual({
      primarySubgenreId: 'sg-drill',
      subgenreWriteIn: null,
      secondarySubgenreId: null,
      primaryMoodId: 'mood-hype',
      secondaryMoodId: null,
      language: 'en',
    });
  });

  it('sends the optional picks when made', () => {
    expect(toDiscoveryPayload(filled({ secondarySubgenreId: 'sg-indie', secondaryMoodId: 'mood-chill', language: 'es' })))
      .toMatchObject({ secondarySubgenreId: 'sg-indie', secondaryMoodId: 'mood-chill', language: 'es' });
  });

  it('"none of these fit" sends the trimmed description and no subgenre id', () => {
    expect(toDiscoveryPayload(filled({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: '  Jersey club  ' })))
      .toMatchObject({ primarySubgenreId: null, subgenreWriteIn: 'Jersey club' });
  });

  it('never sends the internal "__other" marker', () => {
    const payload = toDiscoveryPayload(filled({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: 'x' }));
    expect(JSON.stringify(payload)).not.toContain(OTHER_SUBGENRE);
  });

  it('a leftover description is dropped once a real subgenre is picked', () => {
    expect(toDiscoveryPayload(filled({ subgenreWriteIn: 'old text' })).subgenreWriteIn).toBeNull();
  });

  it('defaults the language to English', () => {
    expect(toDiscoveryPayload(filled({ language: '' })).language).toBe('en');
  });
});

// ===========================================================================
describe('taxonomy — reading a song back into the form', () => {
  it('reads the nested objects the backend returns', () => {
    expect(discoveryFromSong({
      primarySubgenre: { subgenreId: 'sg-drill' },
      secondarySubgenre: { subgenreId: 'sg-indie' },
      primaryMood: { moodId: 'mood-hype' },
      secondaryMood: { moodId: 'mood-chill' },
      language: 'es',
    })).toEqual({
      primarySubgenreId: 'sg-drill', secondarySubgenreId: 'sg-indie', subgenreWriteIn: '',
      primaryMoodId: 'mood-hype', secondaryMoodId: 'mood-chill', language: 'es',
    });
  });

  it('reads flat ids too', () => {
    expect(discoveryFromSong({ primarySubgenreId: 'sg-drill', primaryMoodId: 'mood-hype' }))
      .toMatchObject({ primarySubgenreId: 'sg-drill', primaryMoodId: 'mood-hype', language: 'en' });
  });

  it('a song tagged with a written description comes back as "none of these fit"', () => {
    expect(discoveryFromSong({ subgenreWriteIn: 'Jersey club', primaryMood: { moodId: 'mood-hype' } }))
      .toMatchObject({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: 'Jersey club' });
  });

  it('an untagged song (uploaded before subgenres existed) gives a blank form', () => {
    expect(discoveryFromSong({ songId: 's1', title: 'Old Song' })).toEqual(EMPTY_DISCOVERY);
  });

  it.each([null, undefined])('%p gives a blank form, and a fresh copy each time', (song) => {
    const a = discoveryFromSong(song);
    expect(a).toEqual(EMPTY_DISCOVERY);
    expect(a).not.toBe(EMPTY_DISCOVERY);
  });

  it('survives the round trip: song → form → payload', () => {
    const song = {
      primarySubgenre: { subgenreId: 'sg-drill' }, primaryMood: { moodId: 'mood-hype' },
      secondaryMood: { moodId: 'mood-chill' }, language: 'es',
    };
    expect(toDiscoveryPayload(discoveryFromSong(song))).toEqual({
      primarySubgenreId: 'sg-drill', subgenreWriteIn: null, secondarySubgenreId: null,
      primaryMoodId: 'mood-hype', secondaryMoodId: 'mood-chill', language: 'es',
    });
  });
});

// ===========================================================================
describe('taxonomy — the review summary', () => {
  it('names the picks', () => {
    expect(describeDiscovery(filled(), TAXONOMY)).toEqual({ subgenres: 'Drill', moods: 'Hype', language: 'English' });
  });

  it('joins two subgenres and two moods', () => {
    expect(describeDiscovery(
      filled({ secondarySubgenreId: 'sg-indie', secondaryMoodId: 'mood-chill', language: 'es' }), TAXONOMY))
      .toEqual({ subgenres: 'Drill + Indie rock', moods: 'Hype + Chill', language: 'Spanish' });
  });

  it('shows a written description as "Other: …"', () => {
    expect(describeDiscovery(filled({ primarySubgenreId: OTHER_SUBGENRE, subgenreWriteIn: ' Jersey club ' }), TAXONOMY).subgenres)
      .toBe('Other: Jersey club');
  });

  it('shows dashes for a blank form', () => {
    expect(describeDiscovery({ ...EMPTY_DISCOVERY }, TAXONOMY)).toEqual({ subgenres: '—', moods: '—', language: 'English' });
  });

  it('does not throw before the lists have loaded', () => {
    expect(describeDiscovery(filled(), null)).toEqual({ subgenres: '—', moods: '—', language: 'English' });
  });

  it('ignores an id that is no longer in the lists', () => {
    expect(describeDiscovery(filled({ primarySubgenreId: 'sg-retired', primaryMoodId: 'mood-retired' }), TAXONOMY))
      .toEqual({ subgenres: '—', moods: '—', language: 'English' });
  });
});

// ===========================================================================
// Loading the lists. The module keeps one shared request, so each test here
// loads a fresh copy of the module.
describe('taxonomy — loading the lists', () => {
  let mod;
  let apiSpy;

  beforeEach(async () => {
    vi.resetModules();
    const axiosFresh = await import('../components/axiosInstance');
    apiSpy = vi.spyOn(axiosFresh, 'apiCall').mockResolvedValue({ data: TAXONOMY });
    mod = await import('./taxonomy');
  });

  it('asks once, bypassing the response cache', async () => {
    await mod.loadTaxonomy();
    expect(apiSpy).toHaveBeenCalledWith({ method: 'get', url: '/v1/taxonomy', useCache: false });
  });

  it('every caller shares one request', async () => {
    const [a, b] = await Promise.all([mod.loadTaxonomy(), mod.loadTaxonomy()]);
    await mod.loadTaxonomy();
    expect(apiSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a).toEqual(TAXONOMY);
  });

  it.each([null, undefined, {}])('an empty answer (%p) becomes three empty lists', async (data) => {
    apiSpy.mockResolvedValue({ data });
    expect(await mod.loadTaxonomy()).toEqual({ subgenres: [], moods: [], languages: [] });
  });

  it('a failed load can be tried again', async () => {
    apiSpy.mockRejectedValueOnce(new Error('down'));
    await expect(mod.loadTaxonomy()).rejects.toThrow('down');
    await expect(mod.loadTaxonomy()).resolves.toEqual(TAXONOMY);
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  describe('useTaxonomy hook', () => {
    const Probe = () => {
      const { taxonomy, loading, error, retry } = mod.useTaxonomy();
      return (
        <div>
          <span data-testid="state">{loading ? 'loading' : error ? 'error' : 'ready'}</span>
          <span data-testid="count">{taxonomy ? taxonomy.subgenres.length : ''}</span>
          <button onClick={retry}>retry</button>
        </div>
      );
    };

    it('starts loading, then has the lists', async () => {
      render(<Probe />);
      expect(screen.getByTestId('state')).toHaveTextContent('loading');
      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });

    it('reports an error, and Retry loads again', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiSpy.mockRejectedValueOnce(new Error('down'));
      render(<Probe />);
      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('error'));

      await act(async () => { screen.getByRole('button', { name: 'retry' }).click(); });
      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready'));
      expect(apiSpy).toHaveBeenCalledTimes(2);
    });

    it('two forms on screen share the one request', async () => {
      render(<><Probe /><Probe /></>);
      await waitFor(() => expect(screen.getAllByTestId('state')[1]).toHaveTextContent('ready'));
      expect(apiSpy).toHaveBeenCalledTimes(1);
    });
  });
});
