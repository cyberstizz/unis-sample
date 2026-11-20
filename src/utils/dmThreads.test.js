// src/utils/dmThreads.test.js
//
// Keeps recently opened message threads warm so reopening one is instant, and
// lets the inbox start loading a thread the moment a finger lands on its row.
//
// Rules:
//   • everything is keyed by the signed-in user — switching accounts on one
//     device must never show someone else's thread
//   • the press-down prefetch and the opened thread share ONE request
//   • only the 30 most recent threads are kept
//   • server times are UTC, whether or not the backend says so

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mod;
let apiSpy;

const messages = (count, prefix = 'm') =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, body: `message ${i}` }));

// The module keeps its caches in memory, so each test loads a fresh copy.
beforeEach(async () => {
  vi.resetModules();
  const axiosFresh = await import('../components/axiosInstance');
  apiSpy = vi.spyOn(axiosFresh, 'apiCall').mockResolvedValue({ data: messages(3) });
  mod = await import('./dmThreads');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('dmThreads — remembering threads', () => {
  it('returns null for a thread that has not been opened', () => {
    expect(mod.getThread('me', 'c-1')).toBeNull();
  });

  it('returns what was stored', () => {
    const data = { messages: messages(2), hasMore: false };
    mod.putThread('me', 'c-1', data);
    expect(mod.getThread('me', 'c-1')).toBe(data);
  });

  it('one account never sees another account\'s thread', () => {
    mod.putThread('me', 'c-1', { messages: messages(2), hasMore: false });
    expect(mod.getThread('someone-else', 'c-1')).toBeNull();
  });

  it.each([[null, 'c-1'], ['me', null], [undefined, undefined]])('ignores a missing user or thread (%p, %p)', (me, id) => {
    mod.putThread(me, id, { messages: [], hasMore: false });
    expect(mod.getThread(me, id)).toBeNull();
  });

  it('keeps only the 30 most recently stored threads', () => {
    for (let i = 1; i <= 31; i += 1) mod.putThread('me', `c-${i}`, { messages: [], hasMore: false });
    expect(mod.getThread('me', 'c-1')).toBeNull();
    expect(mod.getThread('me', 'c-2')).not.toBeNull();
    expect(mod.getThread('me', 'c-31')).not.toBeNull();
  });

  it('storing a thread again counts as recent use', () => {
    for (let i = 1; i <= 30; i += 1) mod.putThread('me', `c-${i}`, { messages: [], hasMore: false });
    mod.putThread('me', 'c-1', { messages: messages(1), hasMore: false }); // c-1 is now the newest
    mod.putThread('me', 'c-31', { messages: [], hasMore: false });          // pushes out c-2

    expect(mod.getThread('me', 'c-1')).not.toBeNull();
    expect(mod.getThread('me', 'c-2')).toBeNull();
  });
});

describe('dmThreads — loading the newest page', () => {
  it('asks for the newest 40 messages, bypassing the response cache', async () => {
    await mod.fetchLatest('me', 'c-1');
    expect(apiSpy).toHaveBeenCalledWith({ url: '/v1/conversations/c-1/messages?limit=40', useCache: false });
    expect(mod.PAGE_SIZE).toBe(40);
  });

  it('returns the messages and whether there are more', async () => {
    expect(await mod.fetchLatest('me', 'c-1')).toEqual({ messages: messages(3), hasMore: false });
  });

  it('a full page means there may be older messages', async () => {
    apiSpy.mockResolvedValue({ data: messages(40) });
    expect((await mod.fetchLatest('me', 'c-1')).hasMore).toBe(true);
  });

  it.each([null, undefined, {}, 'oops'])('an unusable answer (%p) is an empty thread', async (data) => {
    apiSpy.mockResolvedValue({ data });
    expect(await mod.fetchLatest('me', 'c-1')).toEqual({ messages: [], hasMore: false });
  });

  it('two callers at the same moment share one request', async () => {
    const [a, b] = await Promise.all([mod.fetchLatest('me', 'c-1'), mod.fetchLatest('me', 'c-1')]);
    expect(apiSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('asks again by default once the first request has finished', async () => {
    await mod.fetchLatest('me', 'c-1');
    await mod.fetchLatest('me', 'c-1');
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('reuses a recent answer when the caller allows it', async () => {
    vi.useFakeTimers();
    await mod.fetchLatest('me', 'c-1');
    vi.advanceTimersByTime(3999);
    await mod.fetchLatest('me', 'c-1', { maxAgeMs: 4000 });
    expect(apiSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await mod.fetchLatest('me', 'c-1', { maxAgeMs: 4000 });
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('a recent answer for one account is not reused for another', async () => {
    await mod.fetchLatest('me', 'c-1');
    await mod.fetchLatest('someone-else', 'c-1', { maxAgeMs: 4000 });
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('a failure reaches the caller, and the next call tries again', async () => {
    apiSpy.mockRejectedValueOnce(new Error('down'));
    await expect(mod.fetchLatest('me', 'c-1')).rejects.toThrow('down');
    await expect(mod.fetchLatest('me', 'c-1')).resolves.toEqual({ messages: messages(3), hasMore: false });
  });
});

describe('dmThreads — loading older messages', () => {
  it('asks for the page before a message\'s time, encoded', async () => {
    await mod.fetchOlder('c-1', '2026-11-17T01:02:03+00:00');
    expect(apiSpy).toHaveBeenCalledWith({
      url: '/v1/conversations/c-1/messages?before=2026-11-17T01%3A02%3A03%2B00%3A00&limit=40',
      useCache: false,
    });
  });

  it('returns the page in the same shape', async () => {
    apiSpy.mockResolvedValue({ data: messages(40, 'old') });
    const page = await mod.fetchOlder('c-1', '2026-11-17T01:02:03Z');
    expect(page.messages).toHaveLength(40);
    expect(page.hasMore).toBe(true);
  });
});

describe('dmThreads — prefetch on press', () => {
  it('starts loading the thread', () => {
    mod.prefetchThread('me', 'c-1');
    expect(apiSpy).toHaveBeenCalledTimes(1);
  });

  it('the thread that opens next shares that request', async () => {
    mod.prefetchThread('me', 'c-1');
    await mod.fetchLatest('me', 'c-1', { maxAgeMs: mod.THREAD_FRESH_MS });
    expect(apiSpy).toHaveBeenCalledTimes(1);
  });

  it('pressing the same row again within four seconds asks nothing new', async () => {
    mod.prefetchThread('me', 'c-1');
    await Promise.resolve();
    await mod.fetchLatest('me', 'c-1', { maxAgeMs: mod.THREAD_FRESH_MS });
    mod.prefetchThread('me', 'c-1');
    expect(apiSpy).toHaveBeenCalledTimes(1);
  });

  it.each([[null, 'c-1'], ['me', null], ['me', 'draft-u-new']])(
    'does nothing for (%p, %p) — no user, no thread, or a draft that does not exist yet', (me, id) => {
      mod.prefetchThread(me, id);
      expect(apiSpy).not.toHaveBeenCalled();
    });

  it('a failed prefetch is logged, never thrown — the thread loads when opened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiSpy.mockRejectedValue(new Error('down'));
    expect(() => mod.prefetchThread('me', 'c-1')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(console.error).toHaveBeenCalledWith(
      '[Messages] thread prefetch failed (will load on open):', 'down');
  });
});

describe('dmThreads — server times are UTC', () => {
  it('a time with no zone is read as UTC, not local time', () => {
    expect(mod.parseServerTime('2026-11-17T06:30:00').toISOString()).toBe('2026-11-17T06:30:00.000Z');
    expect(mod.parseServerTime('2026-11-17T06:30:00.123456').toISOString()).toBe('2026-11-17T06:30:00.123Z');
  });

  it.each([
    ['2026-11-17T06:30:00Z', '2026-11-17T06:30:00.000Z'],
    ['2026-11-17T06:30:00z', '2026-11-17T06:30:00.000Z'],
    ['2026-11-17T01:30:00-05:00', '2026-11-17T06:30:00.000Z'],
    ['2026-11-17T01:30:00-0500', '2026-11-17T06:30:00.000Z'],
    ['2026-11-17T07:30:00+01:00', '2026-11-17T06:30:00.000Z'],
  ])('a time that states its zone (%s) is left alone', (value, iso) => {
    expect(mod.parseServerTime(value).toISOString()).toBe(iso);
  });

  it('old and new backends give the same moment for the same message', () => {
    expect(mod.parseServerTime('2026-11-17T06:30:00').getTime())
      .toBe(mod.parseServerTime('2026-11-17T06:30:00Z').getTime());
  });

  it('passes a Date straight through', () => {
    const date = new Date('2026-11-17T06:30:00Z');
    expect(mod.parseServerTime(date)).toBe(date);
  });

  it.each([null, undefined, ''])('%p is an invalid date, not a crash', (value) => {
    expect(Number.isNaN(mod.parseServerTime(value).getTime())).toBe(true);
  });
});

describe('dmThreads — the inbox preview for a message', () => {
  it('uses the text, trimmed', () => {
    expect(mod.previewFor({ body: '  see you there  ' })).toBe('see you there');
  });

  it('a support payment with no text reads "Sent support"', () => {
    expect(mod.previewFor({ body: '', supportPaymentId: 7 })).toBe('Sent support');
  });

  it('a shared song with no text reads "Shared a track"', () => {
    expect(mod.previewFor({ body: null, sharedSongId: 'song-1' })).toBe('Shared a track');
  });

  it('text wins over an attachment', () => {
    expect(mod.previewFor({ body: 'for you', supportPaymentId: 7, sharedSongId: 'song-1' })).toBe('for you');
  });

  it('support wins over a shared song', () => {
    expect(mod.previewFor({ supportPaymentId: 7, sharedSongId: 'song-1' })).toBe('Sent support');
  });

  it.each([null, undefined, {}, { body: '   ' }])('%p has no preview', (message) => {
    expect(mod.previewFor(message)).toBe('');
  });

  it('matches the two phrases the inbox looks for', () => {
    // MessagePage.jsx renders special rows for exactly these strings.
    expect(mod.previewFor({ supportPaymentId: 1 })).toBe('Sent support');
    expect(mod.previewFor({ sharedSongId: 1 })).toBe('Shared a track');
  });
});
