// src/MessageThread.test.jsx
//
// Tests for MessageThread — one conversation.
//
// Covers:
//   • loading: skeleton, the first page, marking the thread read, a failed
//     load and Try again, and a remembered thread that opens instantly
//   • the header and intro card: name, artist check, place, Active now, Back,
//     View profile (artists and listeners go to different pages)
//   • layout: time dividers between sittings, bubbles grouped by sender, Seen
//   • sending: instant bubble, the exact request, in-order delivery, Enter vs
//     Shift+Enter, a failed message (reason shown, retry, remove)
//   • the three lanes, from this viewer's side:
//       – a request sent TO me: Accept / Delete / Block, replying accepts,
//         no reactions and no typing signal until accepted
//       – a request sent BY me: one message, then wait
//       – a brand-new conversation (draft): one message, then wait
//   • typing signal out (throttled, stops when idle or sent) and in
//   • live events: a new message, my own echo, reactions, read receipts
//   • reactions and Copy: the action bar, instant chip, undo on failure,
//     double-click heart, right-click, long-press
//   • shared songs: the card, rank chip (one standings read per place), Play
//     goes through requestPlay — never straight to the player
//   • support messages and their amounts; Send support (artists only)
//   • older messages paging in; the "new messages" pill while reading back
//   • the options menu: Report, Block, Escape
//   • the now-playing chip on phones
//
// SupportSheet and MessagePickerSheet are stubbed (each has its own suite).

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as axiosModule from './components/axiosInstance';

const { feedback, navigateSpy, threads, sounds, standings, sheets } = vi.hoisted(() => ({
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  navigateSpy: vi.fn(),
  threads: { getThread: vi.fn(), putThread: vi.fn(), fetchLatest: vi.fn(), fetchOlder: vi.fn() },
  sounds: { haptic: vi.fn(), playSound: vi.fn(), primeSound: vi.fn() },
  standings: { fetchStandings: vi.fn() },
  sheets: { support: null, picker: null },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateSpy,
}));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));
vi.mock('./context/playercontext', async () => {
  const { createContext } = await import('react');
  return { PlayerContext: createContext(null) };
});
vi.mock('./utils/dmThreads', async (importOriginal) => ({
  ...(await importOriginal()),
  getThread: threads.getThread,
  putThread: threads.putThread,
  fetchLatest: threads.fetchLatest,
  fetchOlder: threads.fetchOlder,
}));
vi.mock('./utils/dmFeedback', () => sounds);
vi.mock('./utils/standings', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStandings: standings.fetchStandings,
}));
vi.mock('./SupportSheet', () => ({
  default: (props) => {
    sheets.support = props;
    return props.isOpen ? <div data-testid="support-sheet" /> : null;
  },
}));
vi.mock('./MessagePickerSheet', () => ({
  default: (props) => {
    sheets.picker = props;
    return props.open ? <div data-testid="song-picker" /> : null;
  },
}));

import MessageThread from './MessageThread';
import { PlayerContext } from './context/playercontext';
import { THREAD_FRESH_MS } from './utils/dmThreads';

// ---------------------------------------------------------------------------
// Fixtures. Loaded messages are stamped around noon today so a run just after
// midnight can't split them across two days.
const NOON = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); })();
const at = (minutesBeforeNoon) => new Date(NOON - minutesBeforeNoon * 60000).toISOString();

const ME = 'me';
const THEM = 'u-2';

const msg = (id, senderId, body, minutesBeforeNoon, extra = {}) => ({
  id, conversationId: 'c-1', senderId, body, createdAt: at(minutesBeforeNoon),
  read: false, reactions: [], sharedSongId: null, supportPaymentId: null, ...extra,
});

const CHAT = {
  id: 'c-1', otherUserId: THEM, otherUsername: 'Tony Fadd', otherPhotoUrl: null,
  otherRole: 'artist', otherJurisdictionName: 'Harlem', pending: false, initiatedByMe: false,
};
const LISTENER_CHAT = { ...CHAT, otherUsername: 'Maya', otherRole: 'listener', otherJurisdictionName: null };
const REQUEST_FOR_ME = { ...CHAT, pending: true, initiatedByMe: false };
const MY_REQUEST = { ...CHAT, pending: true, initiatedByMe: true };
const DRAFT = { id: 'draft-u-2', _draft: true, otherUserId: THEM, otherUsername: 'Tony Fadd' };

const SONG = {
  songId: 's-1', title: 'Uptown Anthem', artworkUrl: '/art/s1.jpg', fileUrl: '/audio/s1.mp3',
  artist: { userId: 'a-9', username: 'Tony Fadd' },
  jurisdiction: { jurisdictionId: 'jur-harlem', name: 'Harlem' },
};

let apiSpy;
let backend;
let player;
let callbacks;
let sentCount;

const calls = (method, urlPattern) => apiSpy.mock.calls.map(([c]) => c)
  .filter((c) => (c.method || 'get') === method && (urlPattern instanceof RegExp ? urlPattern.test(c.url) : c.url === urlPattern));
const sends = () => calls('post', '/v1/messages').map((c) => c.data);

function ui(props) {
  return (
    <MemoryRouter>
      <PlayerContext.Provider value={player}>
        <MessageThread conversation={CHAT} currentUserId={ME} {...callbacks} {...props} />
      </PlayerContext.Provider>
    </MemoryRouter>
  );
}

function renderThread(props = {}) {
  const user = userEvent.setup();
  const view = render(ui(props));
  return { user, rerender: (next = {}) => view.rerender(ui({ ...props, ...next })) };
}

/** Render and wait for the first page to be on screen. */
async function openThread(messages = [], props = {}, { hasMore = false } = {}) {
  threads.fetchLatest.mockResolvedValue({ messages, hasMore });
  const utils = renderThread(props);
  await waitFor(() => expect(document.querySelector('.udm-thread__skeleton')).toBeNull());
  if (!props.conversation?._draft) await waitFor(() => expect(calls('post', /\/read$/).length).toBeGreaterThan(0));
  return utils;
}

const log = () => screen.getByRole('log');
const input = () => screen.getByRole('textbox');
const sendButton = () => screen.getByRole('button', { name: 'Send message' });
const lineOf = (text) => screen.getByText(text).closest('.udm-line');
const bubbleOf = (text) => screen.getByText(text).closest('.udm-bubble');
const bodies = () => Array.from(document.querySelectorAll('.udm-line .udm-bubble')).map((b) => b.textContent);

async function type(user, text) {
  await user.type(input(), text);
}

beforeEach(() => {
  vi.clearAllMocks();
  sheets.support = null;
  sheets.picker = null;
  sentCount = 0;
  // "Reduce motion" on: menus and toasts leave at once instead of animating out.
  window.matchMedia = (query) => ({
    matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });

  threads.getThread.mockReturnValue(null);
  threads.fetchLatest.mockResolvedValue({ messages: [], hasMore: false });
  threads.fetchOlder.mockResolvedValue({ messages: [], hasMore: false });
  standings.fetchStandings.mockResolvedValue({ state: 'LIVE', entries: [] });

  player = { requestPlay: vi.fn(), currentMedia: null, isPlaying: false, togglePlayPause: vi.fn(), toggleExpand: vi.fn() };
  callbacks = {
    onBack: vi.fn(), onActivity: vi.fn(), onAccepted: vi.fn(), onRequestGone: vi.fn(), sendTyping: vi.fn(),
  };

  backend = {
    profile: { username: 'Tony Fadd', role: 'artist', photoUrl: null, jurisdiction: { name: 'Harlem' } },
    songs: { 's-1': SONG },
    supportSent: [],
    supportReceived: [],
    send: async (data) => {
      sentCount += 1;
      return {
        id: `srv-${sentCount}`, conversationId: 'c-1', senderId: ME, body: data.body || '',
        sharedSongId: data.sharedSongId ?? null, supportPaymentId: data.supportPaymentId ?? null,
        createdAt: new Date().toISOString(), read: false, reactions: [],
      };
    },
    react: async (_id, emoji) => [{ userId: ME, emoji }],
    fail: {},
  };

  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async ({ url, method = 'get', data }) => {
    const answer = (key, value) => { if (backend.fail[key]) throw backend.fail[key]; return { data: value }; };
    if (method === 'get') {
      if (/^\/v1\/users\/profile\//.test(url)) return answer('profile', backend.profile);
      const song = url.match(/^\/v1\/media\/song\/(.+)$/);
      if (song) {
        if (backend.fail.song || !backend.songs[song[1]]) throw new Error('song not found');
        return { data: backend.songs[song[1]] };
      }
      if (url === '/v1/support/sent') return answer('supportSent', backend.supportSent);
      if (url === '/v1/support/received') return answer('supportReceived', backend.supportReceived);
    }
    if (method === 'post') {
      if (/^\/v1\/conversations\/[^/]+\/read$/.test(url)) return answer('read', {});
      if (/^\/v1\/conversations\/[^/]+\/accept$/.test(url)) return answer('accept', {});
      if (/^\/v1\/conversations\/[^/]+\/decline$/.test(url)) return answer('decline', {});
      if (/^\/v1\/users\/[^/]+\/block$/.test(url)) return answer('block', {});
      if (url === '/v1/messages/report') return answer('report', {});
      if (url === '/v1/messages') return { data: await backend.send(data) };
      const reaction = url.match(/^\/v1\/messages\/([^/]+)\/reaction$/);
      if (reaction) return { data: await backend.react(reaction[1], data.emoji) };
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
describe('MessageThread — loading', () => {
  it('shows a skeleton, then the first page of messages', async () => {
    let finish;
    threads.fetchLatest.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderThread();
    expect(document.querySelector('.udm-thread__skeleton')).not.toBeNull();

    await act(async () => { finish({ messages: [msg('m-1', THEM, 'yo', 5), msg('m-2', ME, 'hey', 4)], hasMore: false }); });
    expect(document.querySelector('.udm-thread__skeleton')).toBeNull();
    expect(bodies()).toEqual(['yo', 'hey']);
  });

  it('asks for this viewer\'s copy of the thread, reusing a recent one', async () => {
    await openThread();
    expect(threads.fetchLatest).toHaveBeenCalledWith(ME, 'c-1', { maxAgeMs: THREAD_FRESH_MS });
  });

  it('marks the conversation read once it has loaded', async () => {
    await openThread([msg('m-1', THEM, 'yo', 5)]);
    expect(calls('post', '/v1/conversations/c-1/read')).toHaveLength(1);
  });

  it('a failed mark-read is harmless', async () => {
    backend.fail.read = new Error('down');
    threads.fetchLatest.mockResolvedValue({ messages: [msg('m-1', THEM, 'yo', 5)], hasMore: false });
    renderThread();
    expect(await screen.findByText('yo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the thread cannot be loaded, and Try again reloads it', async () => {
    threads.fetchLatest.mockRejectedValueOnce(new Error('down'));
    const { user } = renderThread();
    expect(await screen.findByText('Couldn’t load this conversation.')).toBeInTheDocument();
    expect(calls('post', /\/read$/)).toHaveLength(0);

    threads.fetchLatest.mockResolvedValue({ messages: [msg('m-1', THEM, 'back again', 5)], hasMore: false });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('back again')).toBeInTheDocument();
    expect(screen.queryByText('Couldn’t load this conversation.')).not.toBeInTheDocument();
  });

  it('a thread opened before shows at once — no skeleton — and then refreshes', async () => {
    threads.getThread.mockReturnValue({ messages: [msg('m-1', THEM, 'from last time', 30)], hasMore: false });
    let finish;
    threads.fetchLatest.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderThread();

    expect(screen.getByText('from last time')).toBeInTheDocument();
    expect(document.querySelector('.udm-thread__skeleton')).toBeNull();

    await act(async () => {
      finish({ messages: [msg('m-1', THEM, 'from last time', 30), msg('m-2', THEM, 'and a new one', 2)], hasMore: false });
    });
    expect(bodies()).toEqual(['from last time', 'and a new one']);
  });

  it('keeps showing the remembered thread when the refresh fails', async () => {
    threads.getThread.mockReturnValue({ messages: [msg('m-1', THEM, 'from last time', 30)], hasMore: false });
    threads.fetchLatest.mockRejectedValue(new Error('down'));
    renderThread();

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t refresh this conversation.');
    expect(screen.getByText('from last time')).toBeInTheDocument();
    expect(screen.queryByText('Couldn’t load this conversation.')).not.toBeInTheDocument();
  });

  it('remembers the loaded thread so it reopens instantly', async () => {
    const loaded = [msg('m-1', THEM, 'yo', 5)];
    await openThread(loaded);
    expect(threads.putThread).toHaveBeenLastCalledWith(ME, 'c-1', { messages: loaded, hasMore: false });
  });

  it('never saves a message that is still sending', async () => {
    backend.send = () => new Promise(() => {});
    const { user } = await openThread([msg('m-1', THEM, 'yo', 5)]);
    await type(user, 'in flight');
    await user.click(sendButton());

    const saved = threads.putThread.mock.calls.at(-1)[2].messages;
    expect(saved.map((m) => m.body)).toEqual(['yo']);
  });
});

// ===========================================================================
describe('MessageThread — header and intro', () => {
  it('shows who the conversation is with, their place, and the artist check', async () => {
    await openThread();
    const head = document.querySelector('.udm-thread__head');
    expect(within(head).getByText('Tony Fadd')).toBeInTheDocument();
    expect(within(head).getByText('Harlem')).toBeInTheDocument();
    expect(within(head).getByRole('img', { name: 'Artist' })).toBeInTheDocument();
    expect(log()).toHaveAccessibleName('Conversation with Tony Fadd');
  });

  it('a listener has no artist check', async () => {
    await openThread([], { conversation: LISTENER_CHAT });
    expect(screen.queryByRole('img', { name: 'Artist' })).not.toBeInTheDocument();
  });

  it('shows "Active now" only while they are online', async () => {
    const { rerender } = await openThread();
    expect(screen.queryByText('Active now')).not.toBeInTheDocument();
    rerender({ otherOnline: true });
    expect(screen.getByText('Active now')).toBeInTheDocument();
  });

  it('someone with no name on file is shown as "Member" rather than breaking the thread', async () => {
    backend.profile = {};
    await openThread([msg('m-1', THEM, 'hello', 5)], { conversation: { ...CHAT, otherUsername: null, otherRole: null } });
    expect(log()).toHaveAccessibleName('Conversation with Member');
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('Back hands control to the inbox', async () => {
    const { user } = await openThread();
    await user.click(screen.getByRole('button', { name: 'Back to messages' }));
    expect(callbacks.onBack).toHaveBeenCalledTimes(1);
  });

  it('tapping an artist opens their artist page', async () => {
    const { user } = await openThread();
    await user.click(screen.getByRole('button', { name: "View Tony Fadd's profile" }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/u-2');
  });

  it('tapping a listener opens their listener page', async () => {
    const { user } = await openThread([], { conversation: LISTENER_CHAT });
    await user.click(screen.getByRole('button', { name: "View Maya's profile" }));
    expect(navigateSpy).toHaveBeenCalledWith('/user/u-2');
  });

  it('the conversation starts with an intro card', async () => {
    const { user } = await openThread();
    const intro = document.querySelector('.udm-intro');
    expect(within(intro).getByText('Tony Fadd')).toBeInTheDocument();
    expect(intro.querySelector('.udm-intro__sub')).toHaveTextContent('Artist · Harlem');
    expect(within(intro).getByText('Say something to Tony Fadd.')).toBeInTheDocument();

    await user.click(within(intro).getByRole('button', { name: 'View profile' }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/u-2');
  });

  it('the intro drops its prompt once there are messages', async () => {
    await openThread([msg('m-1', THEM, 'yo', 5)]);
    expect(document.querySelector('.udm-intro')).not.toBeNull();
    expect(document.querySelector('.udm-intro__hint')).toBeNull();
  });

  it('does not look the other person up when the inbox already said who they are', async () => {
    await openThread();
    expect(calls('get', /\/v1\/users\/profile\//)).toHaveLength(0);
  });

  it('fills in a missing role and place from their profile', async () => {
    backend.profile = { username: 'Tony Fadd', role: 'ARTIST', jurisdiction: { name: 'Uptown Harlem' } };
    await openThread([], { conversation: { ...CHAT, otherRole: null, otherJurisdictionName: null } });
    const head = document.querySelector('.udm-thread__head');
    expect(await within(head).findByRole('img', { name: 'Artist' })).toBeInTheDocument();
    expect(head).toHaveTextContent('Uptown Harlem');
    expect(calls('get', '/v1/users/profile/u-2')).toHaveLength(1);
  });
});

// ===========================================================================
describe('MessageThread — how the messages are laid out', () => {
  it('puts my messages on one side and theirs on the other', async () => {
    await openThread([msg('m-1', THEM, 'from them', 5), msg('m-2', ME, 'from me', 4)]);
    expect(lineOf('from them')).toHaveClass('theirs');
    expect(lineOf('from me')).toHaveClass('mine');
  });

  it('starts the thread with a time divider', async () => {
    await openThread([msg('m-1', THEM, 'yo', 5)]);
    const pills = Array.from(document.querySelectorAll('.udm-pill'));
    expect(pills).toHaveLength(1);
    expect(pills[0].textContent).toMatch(/^Today \d{1,2}:\d{2}/);
  });

  it('adds a divider after more than an hour of silence, but not within one sitting', async () => {
    await openThread([
      msg('m-1', THEM, 'morning', 200),
      msg('m-2', ME, 'still morning', 170),
      msg('m-3', THEM, 'much later', 60),
    ]);
    expect(document.querySelectorAll('.udm-pill')).toHaveLength(2);
    expect(lineOf('much later').previousElementSibling).toHaveClass('udm-pill');
    expect(lineOf('still morning').previousElementSibling).not.toHaveClass('udm-pill');
  });

  it('adds a divider when the day changes, naming the date for older days', async () => {
    const lastWeek = new Date(NOON - 8 * 24 * 3600 * 1000).toISOString();
    await openThread([{ ...msg('m-1', THEM, 'last week', 0), createdAt: lastWeek }, msg('m-2', THEM, 'today', 5)]);
    const pills = Array.from(document.querySelectorAll('.udm-pill')).map((p) => p.textContent);
    expect(pills).toHaveLength(2);
    expect(pills[0]).not.toMatch(/^(Today|Yesterday)/);
    expect(pills[1]).toMatch(/^Today/);
  });

  it('reads server times that carry no time zone as UTC', async () => {
    const utc = new Date(NOON);
    const bare = utc.toISOString().replace('Z', '');
    await openThread([{ ...msg('m-1', THEM, 'no zone', 0), createdAt: bare }]);
    const expected = utc.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    expect(lineOf('no zone').querySelector('.udm-line__time')).toHaveTextContent(expected);
  });

  it('stacks quick messages from one person and shows their face once, on the last', async () => {
    await openThread([msg('m-1', THEM, 'one', 10), msg('m-2', THEM, 'two', 9), msg('m-3', ME, 'three', 8)]);
    expect(bubbleOf('one')).toHaveClass('is-first');
    expect(bubbleOf('one')).not.toHaveClass('is-last');
    expect(bubbleOf('two')).toHaveClass('is-last');
    expect(bubbleOf('two')).not.toHaveClass('is-first');
    expect(lineOf('one').querySelector('.udm-row__face .udm-avatar')).toBeNull();
    expect(lineOf('two').querySelector('.udm-row__face .udm-avatar')).not.toBeNull();
    expect(lineOf('three').querySelector('.udm-row__face')).toBeNull();
  });

  it('messages more than five minutes apart do not stack', async () => {
    await openThread([msg('m-1', THEM, 'one', 20), msg('m-2', THEM, 'two', 10)]);
    expect(bubbleOf('one')).toHaveClass('is-first', 'is-last');
    expect(bubbleOf('two')).toHaveClass('is-first', 'is-last');
  });

  it('shows Seen under my last message once they have read it', async () => {
    await openThread([msg('m-1', THEM, 'yo', 5), msg('m-2', ME, 'hey', 4, { read: true })]);
    expect(document.querySelector('.udm-seen')).toHaveTextContent('Seen');
  });

  it('no Seen when unread, or when the last message is theirs', async () => {
    const { rerender } = await openThread([msg('m-1', ME, 'hey', 5)]);
    expect(document.querySelector('.udm-seen')).toBeNull();

    rerender({ incomingMessage: msg('m-9', THEM, 'reply', 0) });
    await screen.findByText('reply');
    expect(document.querySelector('.udm-seen')).toBeNull();
  });

  it('hides Seen while they are typing', async () => {
    await openThread([msg('m-1', ME, 'hey', 4, { read: true })], { otherTyping: true });
    expect(document.querySelector('.udm-seen')).toBeNull();
    expect(screen.getByText('Tony Fadd is typing')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessageThread — sending', () => {
  it('Send is off until there is something to send', async () => {
    const { user } = await openThread();
    expect(sendButton()).toBeDisabled();
    await type(user, '   ');
    expect(sendButton()).toBeDisabled();
    await type(user, 'hey');
    expect(sendButton()).toBeEnabled();
  });

  it('posts the message to the other person, marked as a DM', async () => {
    const { user } = await openThread();
    await type(user, '  hey Tony  ');
    await user.click(sendButton());

    await waitFor(() => expect(sends()).toEqual([{ recipientId: THEM, source: 'dm', body: 'hey Tony' }]));
    expect(input()).toHaveValue('');
  });

  it('the bubble appears straight away, marked Sending…, before the server answers', async () => {
    let finish;
    backend.send = () => new Promise((resolve) => { finish = resolve; });
    const { user } = await openThread();
    await type(user, 'instant');
    await user.click(sendButton());

    expect(bubbleOf('instant')).toHaveClass('is-sending');
    expect(lineOf('instant').querySelector('.udm-row__stamp')).toHaveTextContent('Sending…');

    await act(async () => {
      finish({ id: 'srv-1', conversationId: 'c-1', senderId: ME, body: 'instant', createdAt: new Date().toISOString(), read: false, reactions: [] });
    });
    expect(bubbleOf('instant')).not.toHaveClass('is-sending');
    expect(bodies()).toEqual(['instant']);
  });

  it('tells the inbox about the saved message', async () => {
    const { user } = await openThread();
    await type(user, 'hey');
    await user.click(sendButton());
    await waitFor(() => expect(callbacks.onActivity).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-1', body: 'hey' })));
    expect(callbacks.onAccepted).not.toHaveBeenCalled();
  });

  it('Enter sends; Shift+Enter makes a new line', async () => {
    const { user } = await openThread();
    await type(user, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(sends()).toEqual([]);
    expect(input()).toHaveValue('line one\nline two');

    await user.keyboard('{Enter}');
    await waitFor(() => expect(sends()).toEqual([{ recipientId: THEM, source: 'dm', body: 'line one\nline two' }]));
  });

  it('messages sent quickly each get a bubble and are delivered one at a time, in order', async () => {
    const pending = [];
    backend.send = (data) => new Promise((resolve) => { pending.push({ data, resolve }); });
    const { user } = await openThread();

    await type(user, 'first{Enter}');
    await type(user, 'second{Enter}');
    await type(user, 'third{Enter}');
    expect(bodies()).toEqual(['first', 'second', 'third']);
    expect(pending.map((p) => p.data.body)).toEqual(['first']);

    const saved = (n, body) => ({ id: `srv-${n}`, conversationId: 'c-1', senderId: ME, body, createdAt: new Date().toISOString(), read: false, reactions: [] });
    await act(async () => { pending[0].resolve(saved(1, 'first')); });
    await waitFor(() => expect(pending.map((p) => p.data.body)).toEqual(['first', 'second']));
    await act(async () => { pending[1].resolve(saved(2, 'second')); });
    await waitFor(() => expect(pending.map((p) => p.data.body)).toEqual(['first', 'second', 'third']));
    await act(async () => { pending[2].resolve(saved(3, 'third')); });

    expect(bodies()).toEqual(['first', 'second', 'third']);
    await waitFor(() => expect(document.querySelectorAll('.is-sending')).toHaveLength(0));
  });

  it('plays the send sound, muted while music is playing', async () => {
    player.isPlaying = true;
    const { user } = await openThread();
    await type(user, 'hey{Enter}');
    expect(sounds.playSound).toHaveBeenCalledWith('send', { muted: true });
  });

  describe('when a message fails', () => {
    const refuse = (error) => { backend.send = async () => { throw error; }; };

    it('the bubble stays, marked not delivered, and the server\'s reason is shown', async () => {
      refuse({ response: { status: 403, data: { error: 'This member isn’t accepting messages.' } } });
      const { user } = await openThread();
      await type(user, 'hello?{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('This member isn’t accepting messages.');
      expect(bubbleOf('hello?')).toHaveClass('is-failed');
      expect(screen.getByRole('button', { name: /not delivered · tap to retry/i })).toBeInTheDocument();
      expect(callbacks.onActivity).not.toHaveBeenCalled();
    });

    it('a dropped connection is named as such', async () => {
      refuse({ request: {}, message: 'Network Error' });
      const { user } = await openThread();
      await type(user, 'hello?{Enter}');
      expect(await screen.findByRole('alert')).toHaveTextContent("You're offline or the connection dropped. Try again.");
    });

    it('a server fault gets the plain fallback', async () => {
      refuse({ response: { status: 500, data: {} } });
      const { user } = await openThread();
      await type(user, 'hello?{Enter}');
      expect(await screen.findByRole('alert')).toHaveTextContent('Message not sent. Tap it to try again.');
    });

    it('Tap to retry sends the same message again', async () => {
      refuse({ response: { status: 500, data: {} } });
      const { user } = await openThread();
      await type(user, 'hello?{Enter}');
      const retry = await screen.findByRole('button', { name: /tap to retry/i });

      backend.send = async (data) => ({ id: 'srv-9', conversationId: 'c-1', senderId: ME, body: data.body, createdAt: new Date().toISOString(), read: false, reactions: [] });
      await user.click(retry);

      await waitFor(() => expect(screen.queryByRole('button', { name: /tap to retry/i })).not.toBeInTheDocument());
      expect(bodies()).toEqual(['hello?']);
      expect(bubbleOf('hello?')).not.toHaveClass('is-failed');
      expect(callbacks.onActivity).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-9' }));
    });

    it('a failed message can be removed', async () => {
      refuse({ response: { status: 500, data: {} } });
      const { user } = await openThread();
      await type(user, 'never mind{Enter}');
      await user.click(await screen.findByRole('button', { name: 'Remove this message' }));
      expect(screen.queryByText('never mind')).not.toBeInTheDocument();
    });

    it('a failed message is kept when the thread is remembered, so it is still there on return', async () => {
      refuse({ response: { status: 500, data: {} } });
      const { user } = await openThread();
      await type(user, 'kept{Enter}');
      await screen.findByRole('button', { name: /tap to retry/i });
      const saved = threads.putThread.mock.calls.at(-1)[2].messages;
      expect(saved.map((m) => [m.body, m._status])).toEqual([['kept', 'failed']]);
    });

    it('one failure does not hold up the messages behind it', async () => {
      let n = 0;
      backend.send = async (data) => {
        n += 1;
        if (n === 1) throw { response: { status: 500, data: {} } };
        return { id: `srv-${n}`, conversationId: 'c-1', senderId: ME, body: data.body, createdAt: new Date().toISOString(), read: false, reactions: [] };
      };
      const { user } = await openThread();
      await type(user, 'fails{Enter}');
      await type(user, 'goes through{Enter}');

      await waitFor(() => expect(callbacks.onActivity).toHaveBeenCalledWith(expect.objectContaining({ body: 'goes through' })));
      expect(bubbleOf('fails')).toHaveClass('is-failed');
      expect(bubbleOf('goes through')).not.toHaveClass('is-failed');
    });
  });
});

// ===========================================================================
describe('MessageThread — a request sent to me', () => {
  const open = (messages = [msg('m-1', THEM, 'love your music', 5)]) => openThread(messages, { conversation: REQUEST_FOR_ME });

  it('explains the request and that replying accepts it', async () => {
    await open();
    const box = document.querySelector('.udm-request');
    expect(box).toHaveTextContent('Tony Fadd wants to message you');
    expect(box).toHaveTextContent('They won’t know you’ve seen this until you accept. Replying accepts too.');
    ['Delete', 'Block', 'Accept'].forEach((name) => expect(within(box).getByRole('button', { name })).toBeEnabled());
  });

  it('Accept accepts the request and moves it to Chats', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(callbacks.onAccepted).toHaveBeenCalledTimes(1));
    expect(calls('post', '/v1/conversations/c-1/accept')).toHaveLength(1);
    expect(feedback.success).toHaveBeenCalledWith('You can now message Tony Fadd');
  });

  it('a failed accept leaves the request where it is', async () => {
    backend.fail.accept = { response: { status: 500, data: {} } };
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith('Couldn’t accept this request. Try again.'));
    expect(callbacks.onAccepted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
  });

  it('Delete declines the request and closes the thread', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(callbacks.onRequestGone).toHaveBeenCalledTimes(1));
    expect(calls('post', '/v1/conversations/c-1/decline')).toHaveLength(1);
    expect(feedback.success).toHaveBeenCalledWith('Request from Tony Fadd deleted');
  });

  it('a failed delete keeps the request and says so', async () => {
    backend.fail.decline = { response: { status: 500, data: {} } };
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith('Couldn’t delete this request. Try again.'));
    expect(callbacks.onRequestGone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('all three buttons lock while one is working', async () => {
    let finish;
    const original = apiSpy.getMockImplementation();
    apiSpy.mockImplementation((config) => (/\/accept$/.test(config.url)
      ? new Promise((resolve) => { finish = () => resolve({ data: {} }); })
      : original(config)));
    const { user } = await open();
    const box = document.querySelector('.udm-request');
    await user.click(within(box).getByRole('button', { name: 'Accept' }));

    within(box).getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
    await act(async () => { finish(); });
  });

  it('Block asks first, then blocks and closes the thread', async () => {
    const { user } = await open();
    await user.click(within(document.querySelector('.udm-request')).getByRole('button', { name: 'Block' }));

    expect(screen.getByText('Block Tony Fadd? Neither of you can message the other until you unblock.')).toBeInTheDocument();
    expect(calls('post', /\/block$/)).toHaveLength(0);

    await user.click(within(screen.getByRole('menu')).getByRole('button', { name: 'Block' }));
    await waitFor(() => expect(callbacks.onRequestGone).toHaveBeenCalledTimes(1));
    expect(calls('post', '/v1/users/u-2/block')).toHaveLength(1);
  });

  it('replying accepts: the inbox is told the request is now a chat', async () => {
    const { user } = await open();
    await type(user, 'thanks!{Enter}');

    await waitFor(() => expect(callbacks.onAccepted).toHaveBeenCalledWith(expect.objectContaining({ body: 'thanks!' })));
    expect(callbacks.onActivity).not.toHaveBeenCalled();
  });

  it('does not let them know I am typing before I accept', async () => {
    const { user } = await open();
    await type(user, 'thinking about it');
    expect(callbacks.sendTyping).not.toHaveBeenCalled();
  });

  it('offers no reactions until the request is accepted', async () => {
    await open();
    expect(screen.queryByRole('button', { name: 'React or copy' })).not.toBeInTheDocument();
    fireEvent.doubleClick(bubbleOf('love your music'));
    expect(calls('post', /\/reaction$/)).toHaveLength(0);
  });

  it('never shows their typing indicator in a request', async () => {
    await openThread([msg('m-1', THEM, 'hi', 5)], { conversation: REQUEST_FOR_ME, otherTyping: true });
    expect(screen.queryByText('Tony Fadd is typing')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessageThread — a request I sent', () => {
  it('after my one message the composer is replaced by a waiting note', async () => {
    await openThread([msg('m-1', ME, 'big fan', 5)], { conversation: MY_REQUEST });
    expect(screen.getByText('Message request sent. You can send more once Tony Fadd accepts.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
  });

  it('before that message exists it is text only — no song share, no support', async () => {
    await openThread([], { conversation: MY_REQUEST });
    expect(input()).toHaveAttribute('placeholder', 'Your one message request…');
    expect(screen.queryByRole('button', { name: 'Share a song' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send support' })).not.toBeInTheDocument();
    expect(screen.getByText(/your first message goes to their requests/i)).toBeInTheDocument();
  });

  it('a request message that failed does not use up the one message', async () => {
    backend.send = async () => { throw { response: { status: 500, data: {} } }; };
    const { user } = await openThread([], { conversation: MY_REQUEST });
    await type(user, 'big fan{Enter}');
    await screen.findByRole('button', { name: /tap to retry/i });

    expect(screen.queryByText(/message request sent/i)).not.toBeInTheDocument();
    expect(input()).toBeInTheDocument();
  });

  it('no Accept / Delete bar on my own request', async () => {
    await openThread([msg('m-1', ME, 'big fan', 5)], { conversation: MY_REQUEST });
    expect(document.querySelector('.udm-request')).toBeNull();
  });
});

// ===========================================================================
describe('MessageThread — a brand-new conversation', () => {
  it('loads no messages (there is no conversation yet) but looks the person up', async () => {
    await openThread([], { conversation: DRAFT });
    expect(threads.fetchLatest).not.toHaveBeenCalled();
    expect(calls('post', /\/read$/)).toHaveLength(0);
    expect(calls('get', '/v1/users/profile/u-2')).toHaveLength(1);
    expect(await within(document.querySelector('.udm-thread__head')).findByRole('img', { name: 'Artist' })).toBeInTheDocument();
  });

  it('invites a first message and warns it may land in Requests', async () => {
    await openThread([], { conversation: DRAFT });
    expect(screen.getByText(
      'Say hi to Tony Fadd. If you don’t know each other yet, your first message goes to their Requests.')).toBeInTheDocument();
  });

  it('is text only', async () => {
    await openThread([], { conversation: DRAFT });
    expect(screen.queryByRole('button', { name: 'Share a song' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send support' })).not.toBeInTheDocument();
  });

  it('sends one message, then waits for the server to decide the lane', async () => {
    backend.send = () => new Promise(() => {});
    const { user } = await openThread([], { conversation: DRAFT });
    await type(user, 'first{Enter}');
    await waitFor(() => expect(sends()).toHaveLength(1));

    await type(user, 'second');
    expect(sendButton()).toBeDisabled();
    await user.keyboard('{Enter}');
    expect(sends()).toHaveLength(1);
    expect(input()).toHaveValue('second');
  });

  it('a first message that failed can be tried again', async () => {
    backend.send = async () => { throw { response: { status: 500, data: {} } }; };
    const { user } = await openThread([], { conversation: DRAFT });
    await type(user, 'first{Enter}');
    await screen.findByRole('button', { name: /tap to retry/i });

    await type(user, 'another go');
    expect(sendButton()).toBeEnabled();
  });

  it('when the draft becomes a real conversation its bubbles carry over without a loading flash', async () => {
    const { user, rerender } = await openThread([], { conversation: DRAFT });
    await type(user, 'first{Enter}');
    await waitFor(() => expect(callbacks.onActivity).toHaveBeenCalled());

    threads.getThread.mockImplementation(() => {
      const carried = threads.putThread.mock.calls.find(([, id]) => id === 'c-77');
      return carried ? carried[2] : null;
    });
    threads.fetchLatest.mockReturnValue(new Promise(() => {}));
    rerender({ conversation: { ...MY_REQUEST, id: 'c-77' } });

    expect(threads.putThread).toHaveBeenCalledWith(ME, 'c-77', {
      messages: [expect.objectContaining({ body: 'first', conversationId: 'c-77' })], hasMore: false,
    });
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(document.querySelector('.udm-thread__skeleton')).toBeNull();
  });
});

// ===========================================================================
describe('MessageThread — typing', () => {
  it('announces typing once, not on every keystroke', async () => {
    const { user } = await openThread();
    await type(user, 'hello there');
    expect(callbacks.sendTyping.mock.calls).toEqual([['c-1', true]]);
  });

  it('stops when the message is sent', async () => {
    const { user } = await openThread();
    await type(user, 'hi{Enter}');
    expect(callbacks.sendTyping.mock.calls).toEqual([['c-1', true], ['c-1', false]]);
  });

  it('stops when the box is cleared or loses focus', async () => {
    const { user } = await openThread();
    await type(user, 'h');
    await user.clear(input());
    expect(callbacks.sendTyping).toHaveBeenLastCalledWith('c-1', false);

    await type(user, 'h');
    await user.tab();
    expect(callbacks.sendTyping.mock.calls.filter(([, on]) => on === false)).toHaveLength(2);
  });

  it('stops after four seconds idle, and re-announces every three seconds while typing continues', async () => {
    await openThread();
    vi.useFakeTimers();
    fireEvent.change(input(), { target: { value: 'h' } });
    expect(callbacks.sendTyping.mock.calls).toEqual([['c-1', true]]);

    act(() => { vi.advanceTimersByTime(3100); });
    fireEvent.change(input(), { target: { value: 'he' } });
    expect(callbacks.sendTyping.mock.calls).toEqual([['c-1', true], ['c-1', true]]);

    act(() => { vi.advanceTimersByTime(3900); });
    expect(callbacks.sendTyping).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(200); });
    expect(callbacks.sendTyping).toHaveBeenLastCalledWith('c-1', false);
  });

  it('shows their typing indicator in an accepted chat', async () => {
    const { rerender } = await openThread([msg('m-1', THEM, 'yo', 5)]);
    expect(screen.queryByText('Tony Fadd is typing')).not.toBeInTheDocument();
    rerender({ otherTyping: true });
    expect(screen.getByText('Tony Fadd is typing')).toBeInTheDocument();
    rerender({ otherTyping: false });
    expect(screen.queryByText('Tony Fadd is typing')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessageThread — live events', () => {
  it('a new message from them appears, is marked read, and plays the receive sound', async () => {
    const { rerender } = await openThread([msg('m-1', THEM, 'yo', 5)]);
    rerender({ incomingMessage: msg('m-2', THEM, 'you there?', 0) });

    expect(await screen.findByText('you there?')).toBeInTheDocument();
    expect(lineOf('you there?')).toHaveClass('theirs', 'is-new');
    expect(calls('post', '/v1/conversations/c-1/read')).toHaveLength(2);
    expect(sounds.playSound).toHaveBeenCalledWith('receive', { muted: false });
  });

  it('a message for another conversation is ignored', async () => {
    const { rerender } = await openThread([msg('m-1', THEM, 'yo', 5)]);
    rerender({ incomingMessage: { ...msg('m-2', 'u-3', 'wrong thread', 0), conversationId: 'c-other' } });
    expect(screen.queryByText('wrong thread')).not.toBeInTheDocument();
    expect(calls('post', /\/read$/)).toHaveLength(1);
  });

  it('a message already on screen is not added twice', async () => {
    const { rerender } = await openThread([msg('m-1', THEM, 'yo', 5)]);
    rerender({ incomingMessage: msg('m-1', THEM, 'yo', 5) });
    expect(bodies()).toEqual(['yo']);
    expect(sounds.playSound).not.toHaveBeenCalledWith('receive', expect.anything());
  });

  it('my own message echoed back replaces its sending bubble instead of doubling it', async () => {
    let finish;
    backend.send = () => new Promise((resolve) => { finish = resolve; });
    const { user, rerender } = await openThread();
    await type(user, 'hey{Enter}');
    const echo = { id: 'srv-1', conversationId: 'c-1', senderId: ME, body: 'hey', createdAt: new Date().toISOString(), read: false, reactions: [] };

    rerender({ incomingMessage: echo });
    expect(bodies()).toEqual(['hey']);
    expect(bubbleOf('hey')).not.toHaveClass('is-sending');

    await act(async () => { finish(echo); });
    expect(bodies()).toEqual(['hey']);
  });

  it('a message I sent from another device appears here too', async () => {
    const { rerender } = await openThread([msg('m-1', THEM, 'yo', 5)]);
    rerender({ incomingMessage: msg('m-2', ME, 'sent from my phone', 0) });
    expect(lineOf('sent from my phone')).toHaveClass('mine');
    expect(sounds.playSound).not.toHaveBeenCalledWith('receive', expect.anything());
  });

  it('a read receipt marks my earlier messages Seen', async () => {
    const { rerender } = await openThread([msg('m-1', ME, 'hey', 5)]);
    expect(document.querySelector('.udm-seen')).toBeNull();
    rerender({ incomingRead: { conversationId: 'c-1', readAt: new Date(NOON).toISOString() } });
    expect(document.querySelector('.udm-seen')).not.toBeNull();
  });

  it('a read receipt does not cover messages sent after it', async () => {
    const { rerender } = await openThread([msg('m-1', ME, 'early', 30), msg('m-2', ME, 'late', 5)]);
    rerender({ incomingRead: { conversationId: 'c-1', readAt: at(10) } });
    expect(document.querySelector('.udm-seen')).toBeNull();
  });

  it('a read receipt for another conversation changes nothing', async () => {
    const { rerender } = await openThread([msg('m-1', ME, 'hey', 5)]);
    rerender({ incomingRead: { conversationId: 'c-other', readAt: new Date(NOON).toISOString() } });
    expect(document.querySelector('.udm-seen')).toBeNull();
  });

  it('a reaction from them shows on the message', async () => {
    const { rerender } = await openThread([msg('m-1', ME, 'new track out', 5)]);
    rerender({ incomingReaction: { conversationId: 'c-1', messageId: 'm-1', reactions: [{ userId: THEM, emoji: '🔥' }] } });
    expect(within(lineOf('new track out')).getByRole('button', { name: '🔥 1' })).toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessageThread — reactions and Copy', () => {
  const openBar = async (user, text) => {
    await user.click(within(lineOf(text)).getByRole('button', { name: 'React or copy' }));
    return screen.getByRole('menu', { name: 'Message actions' });
  };

  it('the action bar offers the six reactions and Copy', async () => {
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5)]);
    const bar = await openBar(user, 'new track out');
    expect(within(bar).getAllByRole('menuitem').map((b) => b.getAttribute('aria-label') || b.textContent))
      .toEqual(['React ❤️', 'React 🔥', 'React 😂', 'React 😮', 'React 😢', 'React 👏', 'Copy']);
  });

  it('a reaction shows instantly and is saved', async () => {
    let finish;
    backend.react = () => new Promise((resolve) => { finish = resolve; });
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5)]);
    await user.click(within(await openBar(user, 'new track out')).getByRole('menuitem', { name: 'React 🔥' }));

    expect(within(lineOf('new track out')).getByRole('button', { name: '🔥 1, yours — tap to remove' })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Message actions' })).not.toBeInTheDocument();
    expect(calls('post', '/v1/messages/m-1/reaction').map((c) => c.data)).toEqual([{ emoji: '🔥' }]);

    await act(async () => { finish([{ userId: ME, emoji: '🔥' }, { userId: THEM, emoji: '🔥' }]); });
    expect(within(lineOf('new track out')).getByRole('button', { name: '🔥 2, yours — tap to remove' })).toBeInTheDocument();
  });

  it('a reaction that does not save is taken back, with the reason', async () => {
    backend.react = async () => { throw { response: { status: 400, data: { error: 'That reaction isn’t available.' } } }; };
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5)]);
    await user.click(within(await openBar(user, 'new track out')).getByRole('menuitem', { name: 'React 🔥' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That reaction isn’t available.');
    expect(lineOf('new track out').querySelector('.udm-react')).toBeNull();
  });

  it('tapping my own reaction removes it', async () => {
    backend.react = async () => [];
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5, { reactions: [{ userId: ME, emoji: '🔥' }] })]);
    await user.click(screen.getByRole('button', { name: '🔥 1, yours — tap to remove' }));

    await waitFor(() => expect(lineOf('new track out').querySelector('.udm-react')).toBeNull());
    expect(calls('post', '/v1/messages/m-1/reaction').map((c) => c.data)).toEqual([{ emoji: '🔥' }]);
  });

  it('choosing a different reaction replaces mine — one reaction each', async () => {
    let finish;
    backend.react = () => new Promise((resolve) => { finish = resolve; });
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5, { reactions: [{ userId: ME, emoji: '🔥' }] })]);
    const bar = await openBar(user, 'new track out');
    expect(within(bar).getByRole('menuitem', { name: 'React 🔥' })).toHaveClass('is-mine');
    await user.click(within(bar).getByRole('menuitem', { name: 'React 😂' }));

    const chips = Array.from(lineOf('new track out').querySelectorAll('.udm-react')).map((c) => c.getAttribute('aria-label'));
    expect(chips).toEqual(['😂 1, yours — tap to remove']);
    await act(async () => { finish([{ userId: ME, emoji: '😂' }]); });
  });

  it('counts everyone who used the same reaction', async () => {
    await openThread([msg('m-1', ME, 'new track out', 5, {
      reactions: [{ userId: THEM, emoji: '❤️' }, { userId: 'u-3', emoji: '❤️' }, { userId: 'u-4', emoji: '😂' }],
    })]);
    expect(screen.getByRole('button', { name: '❤️ 2' })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: '😂 1' })).toBeInTheDocument();
  });

  it('double-click drops a heart', async () => {
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5)]);
    await user.dblClick(bubbleOf('new track out'));

    await waitFor(() => expect(calls('post', '/v1/messages/m-1/reaction').map((c) => c.data)).toEqual([{ emoji: '❤️' }]));
    expect(lineOf('new track out').querySelector('.udm-burst')).not.toBeNull();
  });

  it('double-clicking a message I already hearted does not take the heart away', async () => {
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5, { reactions: [{ userId: ME, emoji: '❤️' }] })]);
    await user.dblClick(bubbleOf('new track out'));

    expect(calls('post', /\/reaction$/)).toHaveLength(0);
    expect(screen.getByRole('button', { name: '❤️ 1, yours — tap to remove' })).toBeInTheDocument();
  });

  it('a message still sending cannot be reacted to', async () => {
    backend.send = () => new Promise(() => {});
    const { user } = await openThread();
    await type(user, 'on its way{Enter}');
    expect(within(lineOf('on its way')).queryByRole('button', { name: 'React or copy' })).not.toBeInTheDocument();
  });

  it('Copy puts the message text on the clipboard', async () => {
    const { user } = await openThread([msg('m-1', THEM, 'copy me', 5)]);
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(within(await openBar(user, 'copy me')).getByRole('menuitem', { name: 'Copy' }));

    expect(write).toHaveBeenCalledWith('copy me');
    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
  });

  it('says so when copying is not allowed', async () => {
    const { user } = await openThread([msg('m-1', THEM, 'copy me', 5)]);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(within(await openBar(user, 'copy me')).getByRole('menuitem', { name: 'Copy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t copy that message.');
  });

  it('right-click opens the same bar', async () => {
    await openThread([msg('m-1', THEM, 'right click me', 5)]);
    fireEvent.contextMenu(bubbleOf('right click me'));
    expect(screen.getByRole('menu', { name: 'Message actions' })).toBeInTheDocument();
    expect(lineOf('right click me')).toHaveClass('is-focus');
  });

  it('in a request, right-click offers Copy only', async () => {
    await openThread([msg('m-1', THEM, 'hi there', 5)], { conversation: REQUEST_FOR_ME });
    fireEvent.contextMenu(bubbleOf('hi there'));
    const bar = screen.getByRole('menu', { name: 'Message actions' });
    expect(within(bar).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Copy']);
  });

  it('pressing elsewhere or Escape closes the bar', async () => {
    const { user } = await openThread([msg('m-1', THEM, 'new track out', 5)]);
    await openBar(user, 'new track out');
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu', { name: 'Message actions' })).not.toBeInTheDocument();

    await openBar(user, 'new track out');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Message actions' })).not.toBeInTheDocument();
  });

  describe('touch', () => {
    const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });

    it('holding a bubble squeezes it, then opens the bar', async () => {
      await openThread([msg('m-1', THEM, 'hold me', 5)]);
      vi.useFakeTimers();
      fireEvent.touchStart(bubbleOf('hold me'), touch(50, 50));

      act(() => { vi.advanceTimersByTime(150); });
      expect(bubbleOf('hold me')).toHaveClass('is-pressing');
      expect(screen.queryByRole('menu', { name: 'Message actions' })).not.toBeInTheDocument();

      act(() => { vi.advanceTimersByTime(300); });
      expect(screen.getByRole('menu', { name: 'Message actions' })).toBeInTheDocument();
      expect(bubbleOf('hold me')).not.toHaveClass('is-pressing');
      expect(sounds.haptic).toHaveBeenCalledWith('press');
    });

    it('moving the finger (scrolling) cancels the hold', async () => {
      await openThread([msg('m-1', THEM, 'hold me', 5)]);
      vi.useFakeTimers();
      fireEvent.touchStart(bubbleOf('hold me'), touch(50, 50));
      fireEvent.touchMove(bubbleOf('hold me'), touch(50, 80));

      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.queryByRole('menu', { name: 'Message actions' })).not.toBeInTheDocument();
    });

    it('lifting early is a tap, not a hold', async () => {
      await openThread([msg('m-1', THEM, 'hold me', 5)]);
      vi.useFakeTimers();
      fireEvent.touchStart(bubbleOf('hold me'), touch(50, 50));
      act(() => { vi.advanceTimersByTime(200); });
      fireEvent.touchEnd(bubbleOf('hold me'));

      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.queryByRole('menu', { name: 'Message actions' })).not.toBeInTheDocument();
      expect(calls('post', /\/reaction$/)).toHaveLength(0);
    });

    it('two quick taps drop a heart', async () => {
      await openThread([msg('m-1', THEM, 'tap tap', 5)]);
      const bubble = bubbleOf('tap tap');
      fireEvent.touchStart(bubble, touch(50, 50));
      fireEvent.touchEnd(bubble);
      fireEvent.touchStart(bubble, touch(50, 50));
      fireEvent.touchEnd(bubble);

      await waitFor(() => expect(calls('post', '/v1/messages/m-1/reaction').map((c) => c.data)).toEqual([{ emoji: '❤️' }]));
    });

    it('swiping left reveals the times and lets go when released', async () => {
      await openThread([msg('m-1', THEM, 'what time', 5)]);
      const el = log();
      fireEvent.touchStart(el, touch(200, 100));
      fireEvent.touchMove(el, touch(160, 102));
      expect(el).toHaveClass('is-revealing');
      expect(el.style.getPropertyValue('--udm-reveal')).toBe('-40px');

      fireEvent.touchEnd(el);
      expect(el).not.toHaveClass('is-revealing');
      expect(el.style.getPropertyValue('--udm-reveal')).toBe('0px');
    });

    it('an up-and-down drag is a scroll, not a reveal', async () => {
      await openThread([msg('m-1', THEM, 'what time', 5)]);
      const el = log();
      fireEvent.touchStart(el, touch(200, 100));
      fireEvent.touchMove(el, touch(190, 160));
      expect(el).not.toHaveClass('is-revealing');
    });
  });
});

// ===========================================================================
describe('MessageThread — shared songs', () => {
  const shared = (id = 'm-1', songId = 's-1', extra = {}) => msg(id, THEM, '', 5, { sharedSongId: songId, ...extra });

  it('shows the song as a card with its title and artist', async () => {
    await openThread([shared()]);
    const open = await screen.findByRole('button', { name: 'Open Uptown Anthem' });
    expect(open).toHaveTextContent('Tony Fadd');
    expect(calls('get', '/v1/media/song/s-1')).toHaveLength(1);
  });

  it('shows a placeholder card until the song loads, and keeps it if the song is gone', async () => {
    backend.fail.song = true;
    await openThread([shared()]);
    await waitFor(() => expect(calls('get', '/v1/media/song/s-1')).toHaveLength(1));
    expect(document.querySelector('.udm-track--loading')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^play /i })).not.toBeInTheDocument();
  });

  it('Play asks the player through requestPlay, tagged as coming from a DM', async () => {
    const { user } = await openThread([shared()]);
    await user.click(await screen.findByRole('button', { name: 'Play Uptown Anthem' }));

    expect(player.requestPlay).toHaveBeenCalledTimes(1);
    expect(player.requestPlay).toHaveBeenCalledWith(expect.objectContaining({
      type: 'song', id: 's-1', songId: 's-1', title: 'Uptown Anthem', artist: 'Tony Fadd', artistId: 'a-9', source: 'dm',
    }));
    const sent = player.requestPlay.mock.calls[0][0];
    expect(sent.url).toContain('/audio/s1.mp3');
    expect(sent.fileUrl).toBe(sent.url);
    expect(sent.artwork).toContain('/art/s1.jpg');
  });

  it('the thread itself never reports a play — the Player is the only source', async () => {
    const { user } = await openThread([shared()]);
    await user.click(await screen.findByRole('button', { name: 'Play Uptown Anthem' }));
    const urls = apiSpy.mock.calls.map(([c]) => c.url);
    expect(urls.filter((u) => /track|play|view/i.test(u))).toEqual([]);
  });

  it('a song with no audio file cannot be played', async () => {
    backend.songs['s-1'] = { ...SONG, fileUrl: null };
    await openThread([shared()]);
    expect(await screen.findByRole('button', { name: 'Play Uptown Anthem' })).toBeDisabled();
  });

  it('tapping the card opens the song page', async () => {
    const { user } = await openThread([shared()]);
    await user.click(await screen.findByRole('button', { name: 'Open Uptown Anthem' }));
    expect(navigateSpy).toHaveBeenCalledWith('/song/s-1');
  });

  it('shows where the song stands today in its home area, and how far it moved', async () => {
    standings.fetchStandings.mockResolvedValue({
      state: 'LIVE', entries: [{ id: 's-1', rank: 2, movement: 3, points: 40 }],
    });
    await openThread([shared()]);

    expect(await screen.findByText('#2 Harlem')).toBeInTheDocument();
    expect(document.querySelector('.udm-track__move')).toHaveTextContent('▲ 3');
    expect(document.querySelector('.udm-track__move')).toHaveClass('is-up');
    expect(standings.fetchStandings).toHaveBeenCalledWith({
      type: 'song', jurisdictionId: 'jur-harlem', genre: 'all', period: 'daily', limit: 50,
    });
  });

  it('a song that fell shows a down arrow; one that held shows none', async () => {
    backend.songs['s-2'] = { ...SONG, songId: 's-2', title: 'Second Song' };
    standings.fetchStandings.mockResolvedValue({
      state: 'LIVE', entries: [{ id: 's-1', rank: 5, movement: -2, points: 9 }, { id: 's-2', rank: 6, movement: 0, points: 8 }],
    });
    await openThread([shared('m-1', 's-1'), shared('m-2', 's-2')]);

    await screen.findByText('#5 Harlem');
    const first = screen.getByRole('button', { name: 'Open Uptown Anthem' });
    const second = screen.getByRole('button', { name: 'Open Second Song' });
    expect(first.querySelector('.udm-track__move')).toHaveTextContent('▼ 2');
    expect(first.querySelector('.udm-track__move')).toHaveClass('is-down');
    expect(second).toHaveTextContent('#6 Harlem');
    expect(second.querySelector('.udm-track__move')).toBeNull();
  });

  it('reads the standings once per area, however many songs come from it', async () => {
    backend.songs['s-2'] = { ...SONG, songId: 's-2', title: 'Second Song' };
    backend.songs['s-3'] = { ...SONG, songId: 's-3', title: 'Bronx Song', jurisdiction: { jurisdictionId: 'jur-bronx', name: 'The Bronx' } };
    await openThread([shared('m-1', 's-1'), shared('m-2', 's-2'), shared('m-3', 's-3'), shared('m-4', 's-1')]);

    await screen.findByRole('button', { name: 'Open Bronx Song' });
    await waitFor(() => expect(standings.fetchStandings).toHaveBeenCalledTimes(2));
    expect(standings.fetchStandings.mock.calls.map(([q]) => q.jurisdictionId).sort()).toEqual(['jur-bronx', 'jur-harlem']);
    expect(calls('get', '/v1/media/song/s-1')).toHaveLength(1);
  });

  it.each([
    ['the song has no points today', { state: 'LIVE', entries: [{ id: 's-1', rank: 2, movement: 0, points: 0 }] }],
    ['the board is not live', { state: 'CLOSED', entries: [{ id: 's-1', rank: 2, movement: 0, points: 40 }] }],
    ['the song is not on the board', { state: 'LIVE', entries: [{ id: 's-99', rank: 1, movement: 0, points: 40 }] }],
  ])('no rank chip when %s', async (_label, board) => {
    standings.fetchStandings.mockResolvedValue(board);
    await openThread([shared()]);
    await screen.findByRole('button', { name: 'Open Uptown Anthem' });
    await waitFor(() => expect(standings.fetchStandings).toHaveBeenCalled());
    expect(document.querySelector('.udm-track__chips')).toBeNull();
  });

  it('the card still shows when the standings cannot be read', async () => {
    standings.fetchStandings.mockRejectedValue(new Error('down'));
    await openThread([shared()]);
    expect(await screen.findByRole('button', { name: 'Open Uptown Anthem' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a note sent with the song shows under the card', async () => {
    await openThread([msg('m-1', THEM, 'listen to this', 5, { sharedSongId: 's-1' })]);
    await screen.findByRole('button', { name: 'Open Uptown Anthem' });
    expect(bubbleOf('listen to this')).not.toBeNull();
  });

  it('Share a song opens the picker in song mode', async () => {
    const { user } = await openThread();
    expect(screen.queryByTestId('song-picker')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Share a song' }));
    expect(screen.getByTestId('song-picker')).toBeInTheDocument();
    expect(sheets.picker.mode).toBe('song');
  });

  it('picking a song sends it and shows its card at once from what the picker knew', async () => {
    backend.send = () => new Promise(() => {});
    backend.songs = {};
    const { user } = await openThread();
    await user.click(screen.getByRole('button', { name: 'Share a song' }));
    act(() => { sheets.picker.onPick({ id: 's-7', name: 'Picked Song', artworkUrl: '/art/s7.jpg', subtitle: 'Some Artist' }); });

    expect(screen.queryByTestId('song-picker')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Picked Song' })).toHaveTextContent('Some Artist');
    await waitFor(() => expect(sends()).toEqual([{ recipientId: THEM, source: 'dm', sharedSongId: 's-7', body: '' }]));
  });
});

// ===========================================================================
describe('MessageThread — support', () => {
  it('a support message I sent shows the amount from my support history', async () => {
    backend.supportSent = [{ id: 77, amount: 500 }];
    await openThread([msg('m-1', ME, 'keep going', 5, { supportPaymentId: 77 })]);

    const card = document.querySelector('.udm-support');
    expect(card).toHaveTextContent('Support sent');
    expect(card).toHaveTextContent('keep going');
    await waitFor(() => expect(card.querySelector('.udm-support__amount')).toHaveTextContent('$5.00'));
  });

  it('support I received names the sender and reads from what I received', async () => {
    backend.supportReceived = [{ id: 88, amount: 123456 }];
    await openThread([msg('m-1', THEM, '', 5, { supportPaymentId: 88 })]);

    const card = document.querySelector('.udm-support');
    expect(card).toHaveTextContent('Tony Fadd sent support');
    await waitFor(() => expect(card.querySelector('.udm-support__amount')).toHaveTextContent('$1,234.56'));
  });

  it('asks for the history once and never from a cache', async () => {
    backend.supportSent = [{ id: 77, amount: 500 }, { id: 78, amount: 300 }];
    await openThread([
      msg('m-1', ME, '', 9, { supportPaymentId: 77 }),
      msg('m-2', ME, '', 5, { supportPaymentId: 78 }),
    ]);
    await waitFor(() => expect(document.querySelectorAll('.udm-support__amount')).toHaveLength(2));
    expect(calls('get', '/v1/support/sent')).toEqual([{ url: '/v1/support/sent', useCache: false }]);
    expect(calls('get', '/v1/support/received')).toEqual([{ url: '/v1/support/received', useCache: false }]);
  });

  it('the card shows without an amount when the history cannot be read', async () => {
    backend.fail.supportSent = new Error('down');
    backend.fail.supportReceived = new Error('down');
    await openThread([msg('m-1', ME, 'keep going', 5, { supportPaymentId: 77 })]);
    await waitFor(() => expect(calls('get', '/v1/support/sent')).toHaveLength(1));
    expect(document.querySelector('.udm-support')).toHaveTextContent('Support sent');
    expect(document.querySelector('.udm-support__amount')).toBeNull();
  });

  it('a support message that also names a song is shown as support, not as a song card', async () => {
    backend.supportSent = [{ id: 77, amount: 500 }];
    await openThread([msg('m-1', ME, '', 5, { supportPaymentId: 77, sharedSongId: 's-1' })]);
    await waitFor(() => expect(document.querySelector('.udm-support__amount')).not.toBeNull());
    expect(document.querySelector('.udm-track')).toBeNull();
    expect(calls('get', /\/v1\/media\/song\//)).toHaveLength(0);
  });

  it('Send support is offered for artists only', async () => {
    await openThread();
    expect(screen.getByRole('button', { name: 'Send support' })).toBeInTheDocument();
  });

  it('there is no Send support in a chat with a listener', async () => {
    await openThread([], { conversation: LISTENER_CHAT });
    expect(screen.queryByRole('button', { name: 'Send support' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share a song' })).toBeInTheDocument();
  });

  it('opens the support sheet for this artist, tagged as coming from a DM', async () => {
    const { user } = await openThread();
    await user.click(screen.getByRole('button', { name: 'Send support' }));
    expect(screen.getByTestId('support-sheet')).toBeInTheDocument();
    expect(sheets.support).toMatchObject({ artistId: THEM, artistName: 'Tony Fadd', source: 'dm' });
  });

  it('once the payment is recorded, the message that carries it is sent with the note and amount', async () => {
    const { user } = await openThread();
    await user.click(screen.getByRole('button', { name: 'Send support' }));
    act(() => { sheets.support.onSuccess({ supportId: 9, note: 'love the new one', amount: 1000 }); });

    await waitFor(() => expect(sends()).toEqual([
      { recipientId: THEM, source: 'dm', body: 'love the new one', supportPaymentId: 9 },
    ]));
    const card = document.querySelector('.udm-support');
    expect(card).toHaveTextContent('Support sent');
    expect(card.querySelector('.udm-support__amount')).toHaveTextContent('$10.00');
    expect(calls('get', '/v1/support/sent')).toHaveLength(0);
  });
});

// ===========================================================================
describe('MessageThread — older messages and reading back', () => {
  const page = (from, count, minutesStart) => Array.from({ length: count }, (_, i) => (
    msg(`m-${from + i}`, i % 2 ? ME : THEM, `message ${from + i}`, minutesStart - i)));

  /** Give the scroll area a real size (jsdom has none). */
  const size = (el, { scrollHeight, clientHeight, scrollTop }) => {
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
    el.scrollTop = scrollTop;
  };

  it('a first page too short to scroll pulls the older page straight away', async () => {
    threads.fetchOlder.mockResolvedValue({ messages: page(1, 2, 60), hasMore: false });
    const latest = page(3, 2, 10);
    await openThread(latest, {}, { hasMore: true });

    await screen.findByText('message 1');
    expect(threads.fetchOlder).toHaveBeenCalledTimes(1);
    expect(threads.fetchOlder).toHaveBeenCalledWith('c-1', latest[0].createdAt);
    expect(bodies()).toEqual(['message 1', 'message 2', 'message 3', 'message 4']);
  });

  it('the intro card appears only once the start of the conversation is reached', async () => {
    let finish;
    threads.fetchOlder.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await openThread(page(3, 2, 10), {}, { hasMore: true });

    expect(document.querySelector('.udm-intro')).toBeNull();
    expect(screen.getByText('Loading older messages')).toBeInTheDocument();

    await act(async () => { finish({ messages: page(1, 2, 60), hasMore: false }); });
    expect(document.querySelector('.udm-intro')).not.toBeNull();
    expect(screen.queryByText('Loading older messages')).not.toBeInTheDocument();
  });

  it('a message already on screen is not repeated when an older page overlaps', async () => {
    const latest = page(3, 2, 10);
    threads.fetchOlder.mockResolvedValue({ messages: [...page(1, 2, 60), latest[0]], hasMore: false });
    await openThread(latest, {}, { hasMore: true });
    await screen.findByText('message 1');
    expect(bodies()).toEqual(['message 1', 'message 2', 'message 3', 'message 4']);
  });

  it('says so when older messages cannot be loaded, and keeps what is there', async () => {
    threads.fetchOlder.mockRejectedValue(new Error('down'));
    await openThread(page(3, 2, 10), {}, { hasMore: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load older messages.');
    expect(bodies()).toEqual(['message 3', 'message 4']);
  });

  it('while reading back, a new message does not pull the view down — a pill appears instead', async () => {
    const { user, rerender } = await openThread(page(1, 6, 30));
    const el = log();
    size(el, { scrollHeight: 3000, clientHeight: 600, scrollTop: 400 });
    fireEvent.scroll(el);

    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument();

    rerender({ incomingMessage: msg('m-50', THEM, 'are you there', 0) });
    expect(await screen.findByRole('button', { name: '1 new message, jump to latest' })).toHaveTextContent('New message');
    expect(el.scrollTop).toBe(400);

    rerender({ incomingMessage: msg('m-51', THEM, 'hello??', 0) });
    expect(await screen.findByRole('button', { name: '2 new messages, jump to latest' })).toHaveTextContent('2 new messages');

    await user.click(screen.getByRole('button', { name: /jump to latest/i }));
    expect(screen.queryByRole('button', { name: /jump to latest/i })).not.toBeInTheDocument();
  });

  it('no pill while at the bottom', async () => {
    const { rerender } = await openThread(page(1, 6, 30));
    const el = log();
    size(el, { scrollHeight: 3000, clientHeight: 600, scrollTop: 2400 });
    fireEvent.scroll(el);
    rerender({ incomingMessage: msg('m-50', THEM, 'are you there', 0) });

    await screen.findByText('are you there');
    expect(screen.queryByRole('button', { name: /jump to latest/i })).not.toBeInTheDocument();
  });

  it('scrolling back to the bottom clears the unseen count', async () => {
    const { rerender } = await openThread(page(1, 6, 30));
    const el = log();
    size(el, { scrollHeight: 3000, clientHeight: 600, scrollTop: 400 });
    fireEvent.scroll(el);
    rerender({ incomingMessage: msg('m-50', THEM, 'are you there', 0) });
    await screen.findByRole('button', { name: '1 new message, jump to latest' });

    el.scrollTop = 2400;
    fireEvent.scroll(el);
    expect(screen.queryByRole('button', { name: /jump to latest/i })).not.toBeInTheDocument();
  });

  it('my own message always brings the view back down, never the pill', async () => {
    const { user } = await openThread(page(1, 6, 30));
    const el = log();
    size(el, { scrollHeight: 3000, clientHeight: 600, scrollTop: 2000 });
    fireEvent.scroll(el);
    await type(user, 'replying{Enter}');

    await screen.findByText('replying');
    expect(screen.queryByRole('button', { name: /new message/i })).not.toBeInTheDocument();
  });

  it('does not start a second older-page request while one is still out', async () => {
    threads.fetchLatest.mockResolvedValue({ messages: page(41, 4, 10), hasMore: true });
    threads.fetchOlder.mockReturnValueOnce(new Promise(() => {}));
    renderThread();
    await screen.findByText('message 41');
    await waitFor(() => expect(threads.fetchOlder).toHaveBeenCalledTimes(1));

    // The first pull is still out: scrolling again must not start a second one.
    const el = log();
    size(el, { scrollHeight: 3000, clientHeight: 600, scrollTop: 100 });
    fireEvent.scroll(el);
    fireEvent.scroll(el);
    expect(threads.fetchOlder).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
describe('MessageThread — the options menu', () => {
  const openMenu = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Conversation options' }));
    return screen.getByRole('menu');
  };

  it('offers View profile, Report and Block', async () => {
    const { user } = await openThread();
    const menu = await openMenu(user);
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['View profile', 'Report', 'Block Tony Fadd']);
    expect(screen.getByRole('button', { name: 'Conversation options' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('View profile goes to their page and closes the menu', async () => {
    const { user } = await openThread();
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'View profile' }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/u-2');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Report asks what is wrong and sends the chosen reason', async () => {
    const { user } = await openThread();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Report' }));

    expect(menu).toHaveTextContent('Unis reviews every report. Reporting doesn’t block on its own.');
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Spam', 'Harassment or bullying', 'Something else']);

    await user.click(within(menu).getByRole('menuitem', { name: 'Harassment or bullying' }));
    await waitFor(() => expect(menu).toHaveTextContent('Thanks — it’s with Unis for review.'));
    expect(calls('post', '/v1/messages/report').map((c) => c.data)).toEqual([
      { reportedUserId: THEM, reason: 'Harassment or bullying' },
    ]);
    expect(feedback.success).toHaveBeenCalledWith('Report sent — our moderators will take it from here');
    expect(calls('post', /\/block$/)).toHaveLength(0);
    expect(callbacks.onRequestGone).not.toHaveBeenCalled();
  });

  it('after reporting, Done closes the menu and "Block too" moves on to blocking', async () => {
    const { user } = await openThread();
    let menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Report' }));
    await user.click(within(menu).getByRole('menuitem', { name: 'Spam' }));
    await user.click(await within(menu).findByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Report' }));
    await user.click(within(menu).getByRole('menuitem', { name: 'Spam' }));
    await user.click(await within(menu).findByRole('button', { name: 'Block too' }));
    expect(menu).toHaveTextContent('Block Tony Fadd?');
  });

  it('a report that fails says so and closes the menu', async () => {
    backend.fail.report = { response: { status: 500, data: {} } };
    const { user } = await openThread();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Report' }));
    await user.click(within(menu).getByRole('menuitem', { name: 'Spam' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith('Couldn’t send that report. Try again.'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Block needs a second press; Cancel backs out', async () => {
    const { user } = await openThread();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Block Tony Fadd' }));
    expect(calls('post', /\/block$/)).toHaveLength(0);

    await user.click(within(menu).getByRole('button', { name: 'Cancel' }));
    expect(within(menu).getByRole('menuitem', { name: 'Block Tony Fadd' })).toBeInTheDocument();
    expect(calls('post', /\/block$/)).toHaveLength(0);
  });

  it('confirming blocks them and closes the conversation', async () => {
    const { user } = await openThread();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Block Tony Fadd' }));
    await user.click(within(menu).getByRole('button', { name: 'Block' }));

    await waitFor(() => expect(callbacks.onRequestGone).toHaveBeenCalledTimes(1));
    expect(calls('post', '/v1/users/u-2/block')).toHaveLength(1);
    expect(feedback.success).toHaveBeenCalledWith("Tony Fadd is blocked — they can't message you");
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a block that fails leaves the conversation open', async () => {
    backend.fail.block = { response: { status: 500, data: {} } };
    const { user } = await openThread();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Block Tony Fadd' }));
    await user.click(within(menu).getByRole('button', { name: 'Block' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith('Couldn’t block Tony Fadd. Try again.'));
    expect(callbacks.onRequestGone).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape or a press outside closes the menu', async () => {
    const { user } = await openThread();
    await openMenu(user);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await openMenu(user);
    fireEvent.pointerDown(log());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('reopening the menu always starts at the top level', async () => {
    const { user } = await openThread();
    let menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Report' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    menu = await openMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'View profile' })).toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessageThread — now playing (phone)', () => {
  beforeEach(() => {
    player.currentMedia = { title: 'Uptown Anthem', artwork: 'https://cdn.test/a.jpg' };
    player.isPlaying = true;
  });

  it('shows what is playing in the header, with pause and a way into the player', async () => {
    const { user } = await openThread([], { isPhone: true });
    await user.click(screen.getByRole('button', { name: 'Now playing: Uptown Anthem. Open the player' }));
    expect(player.toggleExpand).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(player.togglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('offers Play when paused', async () => {
    player.isPlaying = false;
    await openThread([], { isPhone: true });
    expect(document.querySelector('.udm-np__toggle')).toHaveAccessibleName('Play');
  });

  it('is not shown on desktop, or when nothing is playing', async () => {
    const { rerender } = await openThread([], { isPhone: false });
    expect(document.querySelector('.udm-np')).toBeNull();

    player.currentMedia = null;
    rerender({ isPhone: true });
    expect(document.querySelector('.udm-np')).toBeNull();
  });
});
