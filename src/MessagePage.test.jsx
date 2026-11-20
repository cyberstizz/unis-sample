// src/MessagePage.test.jsx
//
// Tests for MessagePage — the inbox (/messages).
//
// Covers (Nov 2026 inbox redesign):
//   • loading skeleton, the inbox request, and a failed load
//   • first visit: "Say hi to the artists around you" — this week's top
//     artists in the user's area, each with a Message button
//   • requests as a card at the top, the Requests view with Accept / Decline
//     on each row, and the Filtered folder inside it
//   • the header line: unread count, request count, "All caught up"
//   • filter chips: All · Unread · Artists · Supporters
//   • a conversation row: name, area, preview wording (text, "You:", support,
//     shared song, typing, none yet), time, unread badge, seen marker
//   • pinned chats: pin / unpin from right-click or long-press, the limit of
//     three, and pinned chats staying on top
//   • "Active now" strip and the desktop placeholder
//   • opening a conversation: the thread gets it, the unread badge clears and
//     the app is told to recount unread messages
//   • search: by name, by what was said, by area; no-match line; clearing
//   • New message → pick a person → an existing chat opens, or a draft starts;
//     someone whose thread sits in Requests opens there
//   • arriving with a compose target (from a profile's Message button)
//   • live updates from the socket: a new message moves its row to the top and
//     counts as unread unless that thread is open; typing; presence; and a
//     debounced inbox reload
//
// MessageThread, the two sheets and the socket hook are stubbed — the thread
// has its own suite. The page is rendered at desktop width.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as axiosModule from './components/axiosInstance';
import { INTERVAL_IDS } from './utils/idMappings';

vi.mock('./messages.scss', () => ({}));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

const { authState, feedback, socket, navigateSpy, prefetchThread } = vi.hoisted(() => ({
  authState: { user: { userId: 'me', username: 'charles' } },
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  socket: { onMessage: null, handlers: {}, sendTyping: vi.fn() },
  navigateSpy: vi.fn(),
  prefetchThread: vi.fn(),
}));

vi.mock('./context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));
vi.mock('./useMessagingSocket', () => ({
  useMessagingSocket: (onMessage, handlers) => {
    socket.onMessage = onMessage;
    socket.handlers = handlers;
    return { connected: true, sendTyping: socket.sendTyping };
  },
}));
vi.mock('./utils/dmFeedback', () => ({ haptic: vi.fn(), playSound: vi.fn(), primeSound: vi.fn() }));
vi.mock('./utils/dmThreads', async (importOriginal) => ({
  ...(await importOriginal()),
  prefetchThread,
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateSpy,
}));

// The thread is stubbed to show which conversation it was given and to let a
// test fire the callbacks the inbox listens to.
vi.mock('./MessageThread', () => ({
  default: (props) => (
    <div data-testid="thread" data-conversation={props.conversation.id} data-draft={String(!!props.conversation._draft)}>
      <span data-testid="thread-name">{props.conversation.otherUsername || ''}</span>
      <span data-testid="thread-typing">{String(props.otherTyping)}</span>
      <span data-testid="thread-online">{String(props.otherOnline)}</span>
      <span data-testid="thread-incoming">{props.incomingMessage?.id || ''}</span>
      <span data-testid="thread-pinned">{String(props.pinned)}</span>
      {props.onTogglePin && <button onClick={props.onTogglePin}>thread-pin</button>}
      <button onClick={props.onBack}>thread-back</button>
      <button onClick={props.onAccepted}>thread-accepted</button>
      <button onClick={props.onRequestGone}>thread-request-gone</button>
      <button onClick={() => props.onActivity({ conversationId: props.conversation.id, body: 'sent from thread', createdAt: new Date().toISOString() })}>
        thread-activity
      </button>
    </div>
  ),
}));
vi.mock('./MessagePickerSheet', () => ({
  default: ({ open, onPick, onClose, excludeUserId }) => (open ? (
    <div data-testid="picker" data-exclude={excludeUserId}>
      <button onClick={() => onPick({ id: 'u-maya', name: 'Maya', artworkUrl: null })}>pick-maya</button>
      <button onClick={() => onPick({ id: 'u-stranger', name: 'Stranger', artworkUrl: null })}>pick-stranger</button>
      <button onClick={() => onPick({ id: 'u-new', name: 'Newcomer', artworkUrl: 'https://cdn.test/new.jpg' })}>pick-new</button>
      <button onClick={onClose}>picker-close</button>
    </div>
  ) : null),
}));
vi.mock('./MessageSettingsSheet', () => ({
  default: ({ open, onClose, onChanged }) => (open ? (
    <div data-testid="settings">
      <button onClick={onChanged}>settings-changed</button>
      <button onClick={onClose}>settings-close</button>
    </div>
  ) : null),
}));

import MessagePage from './MessagePage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

const conv = (overrides) => ({
  id: 'c-x',
  otherUserId: 'u-x',
  otherUsername: 'Someone',
  otherPhotoUrl: null,
  lane: 'chats',
  lastMessagePreview: 'hey',
  lastMessageMine: false,
  lastMessageAt: minutesAgo(5),
  lastMessageSeen: false,
  unreadCount: 0,
  otherOnline: false,
  ...overrides,
});

const INBOX = [
  conv({ id: 'c-maya', otherUserId: 'u-maya', otherUsername: 'Maya', lastMessagePreview: 'see you at the show', unreadCount: 2, otherOnline: true }),
  conv({ id: 'c-tony', otherUserId: 'u-tony', otherUsername: 'Tony Fadd', lastMessagePreview: 'new single friday', lastMessageMine: true, lastMessageAt: minutesAgo(120), lastMessageSeen: true }),
  conv({ id: 'c-req', otherUserId: 'u-stranger', otherUsername: 'Stranger', lane: 'requests', lastMessagePreview: 'love your music' }),
  conv({ id: 'c-spam', otherUserId: 'u-spam', otherUsername: 'Promo Bot', lane: 'filtered', lastMessagePreview: 'buy plays now' }),
];

let apiSpy;
let inbox;
let standings;

const inboxCalls = () => apiSpy.mock.calls.filter(([c]) => c.url === '/v1/conversations');

function renderPage({ state } = {}) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[{ pathname: '/messages', state }]}>
      <MessagePage />
    </MemoryRouter>
  );
  return { user };
}

async function renderLoaded(options) {
  const utils = renderPage(options);
  await waitFor(() => expect(document.querySelector('.udm-list__skeleton')).toBeNull());
  return utils;
}

const rowNames = () => Array.from(document.querySelectorAll('.udm-conv__name-text')).map((el) => el.textContent);
const rowOf = (name) => screen.getAllByText(name).map((el) => el.closest('button')).find((b) => b?.querySelector('.udm-conv__body'));
const requestCard = () => screen.queryByRole('button', { name: /^message requests/i });
const openRequests = (user) => user.click(requestCard());
const listTitle = () => document.querySelector('.udm-list__title').textContent;
const headerButton = (name) => within(document.querySelector('.udm-list__head')).getByRole('button', { name });
const searchBox = () => screen.getByRole('searchbox', { name: 'Search messages' });

beforeEach(() => {
  vi.clearAllMocks();
  // Desktop width, full motion. (Set here because restoreAllMocks wipes the
  // shared matchMedia stub between tests.)
  window.matchMedia = (query) => ({
    matches: false, media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
  authState.user = { userId: 'me', username: 'charles' };
  inbox = INBOX;
  standings = { state: 'LIVE', entries: [] };
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async ({ url, method = 'get', data }) => {
    if (url === '/v1/conversations') return { data: inbox };
    if (url.startsWith('/v1/awards/standings?')) return { data: standings };
    if (method === 'post' && /^\/v1\/conversations\/[^/]+\/(accept|decline)$/.test(url)) return { data: {} };
    if (method === 'put' && /^\/v1\/conversations\/[^/]+\/pin$/.test(url)) {
      return { data: data.pinned ? { pinnedAt: '2026-11-20T08:00:00Z' } : {} };
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('MessagePage — loading the inbox', () => {
  it('shows a skeleton, then asks for the conversations without the cache', async () => {
    renderPage();
    expect(document.querySelector('.udm-list__skeleton')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('.udm-list__skeleton')).toBeNull());
    expect(apiSpy).toHaveBeenCalledWith({ url: '/v1/conversations', useCache: false });
  });

  it('tells the user when the inbox cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiSpy.mockRejectedValue(new Error('down'));
    await renderLoaded();
    expect(feedback.error).toHaveBeenCalledWith(
      "Couldn't refresh your messages. Check your connection.", { id: 'dm-inbox' });
  });

  it('tells the rest of the app to recount unread messages once loaded', async () => {
    const heard = vi.fn();
    window.addEventListener('unis:messages-updated', heard);
    await renderLoaded();
    expect(heard).toHaveBeenCalled();
    window.removeEventListener('unis:messages-updated', heard);
  });

  it('a first visit offers both ways to start: New message and Find artists near you', async () => {
    inbox = [];
    const { user } = await renderLoaded();
    const list = document.querySelector('.udm-list');
    expect(within(list).getByRole('heading', { name: /say hi to the artists around you/i })).toBeInTheDocument();
    expect(document.querySelector('.udm-list__sub')).toHaveTextContent('No conversations yet');

    await user.click(within(list).getByRole('button', { name: /find artists near you/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/findpage');
    await user.click(within(list.querySelector('.udm-empty__actions')).getByRole('button', { name: /^new message$/i }));
    expect(screen.getByTestId('picker')).toBeInTheDocument();
  });

  it('with no chats, the search bar finds anyone on Unis', async () => {
    inbox = [];
    const { user } = await renderLoaded();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search anyone on Unis' }));
    expect(screen.getByTestId('picker')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessagePage — artists around you', () => {
  const HOME = { jurisdictionId: 'jur-harlem', name: 'Harlem' };
  const artist = (id, rank, name) => ({ targetId: id, rank, name, artworkUrl: null });

  beforeEach(() => {
    authState.user = { userId: 'me', username: 'charles', jurisdiction: HOME };
    standings = {
      state: 'LIVE',
      entries: [artist('a-1', 1, 'Tony Fadd'), artist('me', 2, 'charles'), artist('a-3', 3, 'Maya Beats')],
    };
  });

  const standingsCalls = () => apiSpy.mock.calls.filter(([c]) => c.url.startsWith('/v1/awards/standings'));

  it('asks for this week\'s top artists in the user\'s area', async () => {
    inbox = [];
    await renderLoaded();
    await waitFor(() => expect(standingsCalls()).toHaveLength(1));
    expect(standingsCalls()[0][0]).toEqual({
      method: 'get',
      url: `/v1/awards/standings?type=artist&jurisdictionId=jur-harlem&intervalId=${INTERVAL_IDS.weekly}&limit=8`,
    });
  });

  it('lists them with their rank — never the user themselves — and each can be messaged', async () => {
    inbox = [];
    const { user } = await renderLoaded();
    const list = await screen.findByRole('region', { name: 'Top artists in Harlem' });
    expect(list).toHaveTextContent('Top in Harlem this week');
    expect(Array.from(list.querySelectorAll('.udm-suggest__row')).map((r) => r.textContent))
      .toEqual([expect.stringContaining('Tony Fadd'), expect.stringContaining('Maya Beats')]);
    expect(within(list).queryByText('charles')).not.toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: 'Message Maya Beats' }));
    expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'draft-a-3');
    expect(screen.getByTestId('thread-name')).toHaveTextContent('Maya Beats');
  });

  it('says "last week" when the week has not started yet', async () => {
    inbox = [];
    standings.state = 'PREVIOUS_FINAL';
    await renderLoaded();
    expect(await screen.findByRole('region', { name: 'Top artists in Harlem' })).toHaveTextContent('Top in Harlem last week');
  });

  it('the desktop pane shows them as cards even when the user has chats', async () => {
    const { user } = await renderLoaded();
    const pane = document.querySelector('.udm-main');
    await waitFor(() => expect(pane.querySelectorAll('.udm-card')).toHaveLength(2));
    expect(pane).toHaveTextContent('Pick a chat, or say hi to the artists around you');
    expect(pane.querySelector('.udm-card')).toHaveTextContent('#1 this week');

    await user.click(within(pane).getByRole('button', { name: 'Message Tony Fadd' }));
    expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'draft-a-1');
  });

  it('falls back to the two ways to start when the list cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    inbox = [];
    const original = apiSpy.getMockImplementation();
    apiSpy.mockImplementation((config) => (config.url.startsWith('/v1/awards/standings')
      ? Promise.reject(new Error('down')) : original(config)));
    await renderLoaded();

    await waitFor(() => expect(standingsCalls()).toHaveLength(1));
    const list = document.querySelector('.udm-list');
    expect(await within(list).findByRole('button', { name: /find artists near you/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /top artists/i })).not.toBeInTheDocument();
  });

  it('does not ask when the user has no home area', async () => {
    authState.user = { userId: 'me', username: 'charles' };
    inbox = [];
    await renderLoaded();
    expect(standingsCalls()).toHaveLength(0);
  });
});

// ===========================================================================
describe('MessagePage — requests', () => {
  it('the inbox shows chats only — requests and filtered threads stay out', async () => {
    await renderLoaded();
    expect(listTitle()).toBe('Messages');
    expect(rowNames()).toEqual(['Maya', 'Tony Fadd']);
  });

  it('treats a conversation with no lane as a chat', async () => {
    inbox = [conv({ id: 'c-old', otherUsername: 'Old Thread', lane: undefined })];
    await renderLoaded();
    expect(rowNames()).toEqual(['Old Thread']);
  });

  it('waiting requests show as a card at the top, with who and how many', async () => {
    await renderLoaded();
    const card = requestCard();
    expect(card).toHaveTextContent('Stranger wants to message you');
    expect(card.querySelector('.udm-badge')).toHaveTextContent('1');
  });

  it.each([
    [2, 'Stranger and 1 other want to message you'],
    [3, 'Stranger and 2 others want to message you'],
  ])('with %i requests the card says "%s"', async (count, line) => {
    inbox = [INBOX[0], ...Array.from({ length: count }, (_, i) => conv({
      id: `c-r${i}`, otherUserId: `u-r${i}`, otherUsername: i === 0 ? 'Stranger' : `Person ${i}`, lane: 'requests',
    }))];
    await renderLoaded();
    expect(requestCard()).toHaveTextContent(line);
    expect(requestCard().querySelector('.udm-badge')).toHaveTextContent(String(count));
  });

  it('there is no card when nobody is waiting', async () => {
    inbox = [INBOX[0], INBOX[1]];
    await renderLoaded();
    expect(requestCard()).not.toBeInTheDocument();
  });

  it('the card opens Requests, with a note that the sender can\'t see they were read', async () => {
    const { user } = await renderLoaded();
    await openRequests(user);
    expect(screen.getByRole('heading', { level: 1, name: 'Requests' })).toBeInTheDocument();
    expect(rowNames()).toEqual(['Stranger']);
    expect(screen.getByText('People you don’t follow yet. They won’t know you’ve seen it until you accept.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('Back returns to the inbox', async () => {
    const { user } = await renderLoaded();
    await openRequests(user);
    await user.click(screen.getByRole('button', { name: 'Back to messages' }));
    expect(listTitle()).toBe('Messages');
    expect(rowNames()).toEqual(['Maya', 'Tony Fadd']);
  });

  it('filtered requests sit in their own folder, with a count', async () => {
    const { user } = await renderLoaded();
    await openRequests(user);
    const folder = screen.getByRole('button', { name: /filtered requests/i });
    expect(folder.querySelector('.udm-folder__count')).toHaveTextContent('1');

    await user.click(folder);
    expect(screen.getByRole('heading', { level: 1, name: 'Filtered requests' })).toBeInTheDocument();
    expect(rowNames()).toEqual(['Promo Bot']);

    await user.click(screen.getByRole('button', { name: 'Back to requests' }));
    expect(rowNames()).toEqual(['Stranger']);
  });

  it('explains an empty Filtered folder', async () => {
    inbox = [INBOX[0], INBOX[2]];
    const { user } = await renderLoaded();
    await openRequests(user);
    await user.click(screen.getByRole('button', { name: /filtered requests/i }));
    expect(screen.getByRole('heading', { name: 'Nothing filtered' })).toBeInTheDocument();
    expect(screen.getByText('Bulk and low-quality requests would show up here.')).toBeInTheDocument();
  });

  it('leaving and coming back starts at Requests, not inside the Filtered folder', async () => {
    const { user } = await renderLoaded();
    await openRequests(user);
    await user.click(screen.getByRole('button', { name: /filtered requests/i }));
    await user.click(screen.getByRole('button', { name: 'Back to messages' }));
    await openRequests(user);
    expect(rowNames()).toEqual(['Stranger']);
  });

  it('a request is not pinnable', async () => {
    const { user } = await renderLoaded();
    await openRequests(user);
    fireEvent.contextMenu(rowOf('Stranger'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(rowOf('Stranger'));
    expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-req');
  });

  describe('Accept and Decline on the row', () => {
    const rowButtons = () => within(rowOf('Stranger').closest('.udm-reqrow'));

    it('Accept accepts, confirms and reloads the inbox', async () => {
      const { user } = await renderLoaded();
      await openRequests(user);
      inbox = INBOX.map((c) => (c.id === 'c-req' ? { ...c, lane: 'chats' } : c));
      await user.click(rowButtons().getByRole('button', { name: 'Accept' }));

      await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('You can now message Stranger'));
      expect(apiSpy).toHaveBeenCalledWith({ method: 'post', url: '/v1/conversations/c-req/accept' });
      expect(inboxCalls()).toHaveLength(2);
      expect(screen.getByRole('heading', { name: 'No requests' })).toBeInTheDocument();
    });

    it('Decline declines and the empty Requests view explains itself', async () => {
      const { user } = await renderLoaded();
      await openRequests(user);
      inbox = INBOX.filter((c) => c.id !== 'c-req');
      await user.click(rowButtons().getByRole('button', { name: 'Decline' }));

      await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Request from Stranger declined'));
      expect(apiSpy).toHaveBeenCalledWith({ method: 'post', url: '/v1/conversations/c-req/decline' });
      expect(screen.getByRole('heading', { name: 'No requests' })).toBeInTheDocument();
      expect(screen.getByText('Messages from people you don’t know yet wait here. They never notify you.')).toBeInTheDocument();
    });

    it('both buttons lock and say what is happening while it works', async () => {
      const original = apiSpy.getMockImplementation();
      let finish;
      apiSpy.mockImplementation((config) => (/\/accept$/.test(config.url)
        ? new Promise((resolve) => { finish = () => resolve({ data: {} }); }) : original(config)));
      const { user } = await renderLoaded();
      await openRequests(user);
      await user.click(rowButtons().getByRole('button', { name: 'Accept' }));

      expect(rowButtons().getByRole('button', { name: 'Accepting…' })).toBeDisabled();
      expect(rowButtons().getByRole('button', { name: 'Decline' })).toBeDisabled();
      await act(async () => { finish(); });
    });

    it.each([
      ['Accept', 'accept', 'Couldn’t accept this request. Try again.'],
      ['Decline', 'decline', 'Couldn’t decline this request. Try again.'],
    ])('a failed %s says so and leaves the request in place', async (label, action, message) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const original = apiSpy.getMockImplementation();
      apiSpy.mockImplementation((config) => (config.url.endsWith(`/${action}`)
        ? Promise.reject(new Error('down')) : original(config)));
      const { user } = await renderLoaded();
      await openRequests(user);
      await user.click(rowButtons().getByRole('button', { name: label }));

      await waitFor(() => expect(feedback.error).toHaveBeenCalledWith(message));
      expect(rowNames()).toEqual(['Stranger']);
      expect(rowButtons().getByRole('button', { name: label })).toBeEnabled();
    });
  });
});

// ===========================================================================
describe('MessagePage — header line', () => {
  const subline = () => document.querySelector('.udm-list__sub').textContent;

  it('counts unread chats and waiting requests', async () => {
    await renderLoaded();
    expect(subline()).toBe('1 unread · 1 request');
  });

  it('says "All caught up" with nothing unread, and pluralises requests', async () => {
    inbox = [
      conv({ id: 'c-1', otherUsername: 'A' }),
      conv({ id: 'c-2', otherUsername: 'B', lane: 'requests' }),
      conv({ id: 'c-3', otherUsername: 'C', lane: 'requests' }),
    ];
    await renderLoaded();
    expect(subline()).toBe('All caught up · 2 requests');
  });

  it('unread requests do not count as unread — requests never notify', async () => {
    inbox = [conv({ id: 'c-2', otherUsername: 'B', lane: 'requests', unreadCount: 3 })];
    await renderLoaded();
    expect(subline()).toBe('All caught up · 1 request');
  });
});

// ===========================================================================
describe('MessagePage — conversation rows', () => {
  it('shows the last message, with "You:" for one the user sent', async () => {
    await renderLoaded();
    expect(rowOf('Maya').querySelector('.udm-conv__preview')).toHaveTextContent(/^see you at the show$/);
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview')).toHaveTextContent('You: new single friday');
  });

  it.each([
    [{ lastMessagePreview: 'Sent support', lastMessageMine: false }, 'Sent you support'],
    [{ lastMessagePreview: 'Sent support', lastMessageMine: true }, 'You sent support'],
    [{ lastMessagePreview: 'Shared a track', lastMessageMine: false }, /^Shared a song$/],
    [{ lastMessagePreview: 'Shared a track', lastMessageMine: true }, 'You: Shared a song'],
    [{ lastMessagePreview: '' }, 'No messages yet'],
  ])('words the preview for %j', async (fields, expected) => {
    inbox = [conv({ id: 'c-1', otherUsername: 'Maya', ...fields })];
    await renderLoaded();
    expect(rowOf('Maya').querySelector('.udm-conv__preview')).toHaveTextContent(expected);
  });

  it('shows how long ago the last message was', async () => {
    await renderLoaded();
    expect(rowOf('Maya').querySelector('.udm-conv__time')).toHaveTextContent('5m');
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__time')).toHaveTextContent('2h');
  });

  it('shows an unread badge, and a seen marker when the other person has read it', async () => {
    await renderLoaded();
    expect(rowOf('Maya').querySelector('.udm-badge')).toHaveTextContent('2');
    expect(rowOf('Tony Fadd').querySelector('.udm-badge')).toBeNull();
    expect(within(rowOf('Tony Fadd')).getByText('Seen')).toBeInTheDocument();
  });

  it('describes the row for screen readers', async () => {
    await renderLoaded();
    expect(rowOf('Maya')).toHaveAccessibleName('Maya, active now, 2 unread');
    expect(rowOf('Tony Fadd')).toHaveAccessibleName('Tony Fadd');
  });

  it('falls back to "Unknown" when the name is missing from the response', async () => {
    inbox = [conv({ id: 'c-1', otherUsername: undefined })];
    await renderLoaded();
    expect(rowNames()).toEqual(['Unknown']);
    expect(rowOf('Unknown').querySelector('.udm-avatar, [class*="udm-avatar"]')).toHaveTextContent('?');
  });

  // Known crash, left for a code fix. When the backend sends
  // `otherUsername: null` (JSON null — e.g. the other account was deleted),
  // the whole inbox throws "Cannot read properties of null (reading 'trim')"
  // and renders nothing. Cause: `function initials(name = '')` in
  // MessagePage.jsx — a default parameter only replaces undefined, not null.
  // Fix: `const parts = (name || '').trim()...`. Every other use of the name
  // on this page already guards with `|| 'Unknown'`.
  it.todo('[BUG] a conversation whose otherUsername is null should show "Unknown", not crash the inbox');
});

// ===========================================================================
describe('MessagePage — active now and the placeholder', () => {
  it('lists who is online', async () => {
    await renderLoaded();
    const strip = screen.getByRole('region', { name: 'Active now' });
    expect(within(strip).getByRole('button', { name: 'Maya, active now' })).toBeInTheDocument();
    expect(within(strip).queryByRole('button', { name: /tony/i })).not.toBeInTheDocument();
  });

  it('is hidden when nobody is online', async () => {
    inbox = [INBOX[1]];
    await renderLoaded();
    expect(screen.queryByRole('region', { name: 'Active now' })).not.toBeInTheDocument();
    expect(screen.getByText('Pick a chat, or start a new one.')).toBeInTheDocument();
  });

  it('the placeholder says how many people are active and offers them', async () => {
    const { user } = await renderLoaded();
    expect(screen.getByText('1 person is active now.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Message Maya' }));
    expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-maya');
  });
});

// ===========================================================================
describe('MessagePage — opening a conversation', () => {
  it('opens the thread for that conversation', async () => {
    const { user } = await renderLoaded();
    expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
    await user.click(rowOf('Tony Fadd'));
    expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-tony');
    expect(screen.getByTestId('thread-name')).toHaveTextContent('Tony Fadd');
  });

  it('clears the unread badge and the header count straight away', async () => {
    const { user } = await renderLoaded();
    await user.click(rowOf('Maya'));
    expect(rowOf('Maya').querySelector('.udm-badge')).toBeNull();
    expect(document.querySelector('.udm-list__sub')).toHaveTextContent('All caught up');
  });

  it('tells the app to recount unread when a thread is opened', async () => {
    const { user } = await renderLoaded();
    const heard = vi.fn();
    window.addEventListener('unis:messages-updated', heard);
    await user.click(rowOf('Maya'));
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener('unis:messages-updated', heard);
  });

  it('starts loading the thread the moment the row is pressed', async () => {
    await renderLoaded();
    fireEvent.pointerDown(rowOf('Tony Fadd'));
    expect(prefetchThread).toHaveBeenCalledWith('me', 'c-tony');
  });

  it('passes whether the other person is online', async () => {
    const { user } = await renderLoaded();
    await user.click(rowOf('Maya'));
    expect(screen.getByTestId('thread-online')).toHaveTextContent('true');
    await user.click(rowOf('Tony Fadd'));
    expect(screen.getByTestId('thread-online')).toHaveTextContent('false');
  });

  it('the thread\'s back button closes it', async () => {
    const { user } = await renderLoaded();
    await user.click(rowOf('Maya'));
    await user.click(screen.getByRole('button', { name: 'thread-back' }));
    expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessagePage — search', () => {
  it('filters by name, ignoring case', async () => {
    const { user } = await renderLoaded();
    await user.type(searchBox(), 'TONY');
    expect(rowNames()).toEqual(['Tony Fadd']);
  });

  it('filters by what was said', async () => {
    const { user } = await renderLoaded();
    await user.type(searchBox(), 'show');
    expect(rowNames()).toEqual(['Maya']);
  });

  it('filters by the person\'s area', async () => {
    inbox = [conv({ id: 'c-1', otherUsername: 'Maya', otherJurisdictionName: 'Uptown Harlem' }), conv({ id: 'c-2', otherUsername: 'Tony' })];
    const { user } = await renderLoaded();
    await user.type(searchBox(), 'uptown');
    expect(rowNames()).toEqual(['Maya']);
  });

  it('says when nothing matches', async () => {
    const { user } = await renderLoaded();
    await user.type(searchBox(), 'zzz');
    expect(screen.getByText('No conversations match “zzz”.')).toBeInTheDocument();
    expect(rowNames()).toEqual([]);
  });

  it('searches chats only — requests keep their card', async () => {
    const { user } = await renderLoaded();
    await user.type(searchBox(), 'stranger');
    expect(rowNames()).toEqual([]);
    expect(requestCard()).toBeInTheDocument();
  });

  it('Escape and the clear button clear the search', async () => {
    const { user } = await renderLoaded();
    await user.type(searchBox(), 'tony');
    await user.keyboard('{Escape}');
    expect(searchBox()).toHaveValue('');
    expect(rowNames()).toEqual(['Maya', 'Tony Fadd']);

    await user.type(searchBox(), 'tony');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(searchBox()).toHaveValue('');
    expect(rowNames()).toEqual(['Maya', 'Tony Fadd']);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  // The search bar lives in the inbox header, which the Requests view
  // replaces — but the search text is kept and still applied there, with no
  // box on screen to clear it. Type "tony", open the requests card, and the
  // Requests view says "No conversations match “tony”" with no way to clear
  // it except going back. Fix: clear `filter` in openRequests (or apply it
  // only when tab === 'chats').
  it.todo('[BUG] text typed in the inbox search should not silently filter the Requests view');
});

// ===========================================================================
describe('MessagePage — filter chips', () => {
  const CHIPS = [
    conv({ id: 'c-1', otherUserId: 'u-1', otherUsername: 'Artist Unread', otherRole: 'artist', unreadCount: 2 }),
    conv({ id: 'c-2', otherUserId: 'u-2', otherUsername: 'Fan Supporter', otherSupportsMe: true }),
    conv({ id: 'c-3', otherUserId: 'u-3', otherUsername: 'Plain Listener', unreadCount: 1 }),
  ];
  const chip = (name) => within(screen.getByRole('tablist', { name: 'Filter conversations' })).getByRole('tab', { name });

  beforeEach(() => { inbox = CHIPS; });

  it('starts on All, with the unread count on Unread', async () => {
    await renderLoaded();
    expect(chip('All')).toHaveAttribute('aria-selected', 'true');
    expect(chip(/^Unread/)).toHaveTextContent('Unread2');
    expect(rowNames()).toEqual(['Artist Unread', 'Fan Supporter', 'Plain Listener']);
  });

  it.each([
    [/^Unread/, ['Artist Unread', 'Plain Listener']],
    ['Artists', ['Artist Unread']],
    ['Supporters', ['Fan Supporter']],
  ])('%s shows only those chats', async (name, names) => {
    const { user } = await renderLoaded();
    await user.click(chip(name));
    expect(chip(name)).toHaveAttribute('aria-selected', 'true');
    expect(rowNames()).toEqual(names);
  });

  it('the Unread count hides while Unread is chosen', async () => {
    const { user } = await renderLoaded();
    await user.click(chip(/^Unread/));
    expect(chip(/^Unread/)).toHaveTextContent(/^Unread$/);
  });

  it('a chip with nothing in it says so', async () => {
    inbox = [CHIPS[2]];
    const { user } = await renderLoaded();
    await user.click(chip('Artists'));
    expect(screen.getByText('Nothing here right now.')).toBeInTheDocument();
  });

  it('there are no chips before the user has any chats', async () => {
    inbox = [];
    await renderLoaded();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('MessagePage — pinned chats', () => {
  const PINS = [
    conv({ id: 'c-1', otherUserId: 'u-1', otherUsername: 'First' }),
    conv({ id: 'c-2', otherUserId: 'u-2', otherUsername: 'Second' }),
    conv({ id: 'c-3', otherUserId: 'u-3', otherUsername: 'Third', pinnedAt: '2026-11-19T10:00:00Z' }),
    conv({ id: 'c-4', otherUserId: 'u-4', otherUsername: 'Fourth', pinnedAt: '2026-11-18T10:00:00Z' }),
  ];
  const pinCalls = () => apiSpy.mock.calls.map(([c]) => c).filter((c) => c.method === 'put');

  beforeEach(() => { inbox = PINS; });

  it('pinned chats sit on top, in the order they were pinned, marked as pinned', async () => {
    await renderLoaded();
    expect(rowNames()).toEqual(['Fourth', 'Third', 'First', 'Second']);
    expect(rowOf('Fourth')).toHaveClass('pinned');
    expect(rowOf('Fourth')).toHaveAccessibleName('Fourth, pinned');
    expect(rowOf('Fourth').querySelector('.udm-pin')).not.toBeNull();
    expect(rowOf('First')).not.toHaveClass('pinned');
  });

  it('right-click offers Pin chat; pinning moves the chat up and is saved', async () => {
    const { user } = await renderLoaded();
    fireEvent.contextMenu(rowOf('Second'), { clientX: 40, clientY: 60 });
    const menu = screen.getByRole('menu', { name: 'Options for Second' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Pin chat' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(rowNames()).toEqual(['Fourth', 'Third', 'Second', 'First']);
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Pinned Second', { id: 'dm-pin' }));
    expect(pinCalls()).toEqual([{ method: 'put', url: '/v1/conversations/c-2/pin', data: { pinned: true } }]);
  });

  it('a pinned chat offers Unpin chat', async () => {
    const { user } = await renderLoaded();
    fireEvent.contextMenu(rowOf('Third'));
    await user.click(screen.getByRole('menuitem', { name: 'Unpin chat' }));

    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Unpinned Third', { id: 'dm-pin' }));
    expect(pinCalls()).toEqual([{ method: 'put', url: '/v1/conversations/c-3/pin', data: { pinned: false } }]);
    expect(rowNames()).toEqual(['Fourth', 'First', 'Second', 'Third']);
  });

  it('a pin that fails is undone, with the reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = apiSpy.getMockImplementation();
    apiSpy.mockImplementation((config) => (config.method === 'put'
      ? Promise.reject({ response: { status: 400, data: { error: 'You can pin up to 3 chats.' } } }) : original(config)));
    const { user } = await renderLoaded();
    fireEvent.contextMenu(rowOf('Second'));
    await user.click(screen.getByRole('menuitem', { name: 'Pin chat' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith('You can pin up to 3 chats.', { id: 'dm-pin' }));
    expect(rowNames()).toEqual(['Fourth', 'Third', 'First', 'Second']);
  });

  it('no more than three: a fourth pin is refused before asking the server', async () => {
    inbox = PINS.map((c) => ({ ...c, pinnedAt: c.id === 'c-2' ? null : (c.pinnedAt || '2026-11-17T10:00:00Z') }));
    const { user } = await renderLoaded();
    fireEvent.contextMenu(rowOf('Second'));
    await user.click(screen.getByRole('menuitem', { name: 'Pin chat' }));

    expect(feedback.info).toHaveBeenCalledWith('You can pin up to 3 chats. Unpin one first.', { id: 'dm-pin' });
    expect(pinCalls()).toEqual([]);
  });

  // jsdom's pointer events drop pointerType and clientX, so set them by hand.
  const touch = (el, type, x, y) => {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(e, 'pointerType', { value: 'touch' });
    act(() => { el.dispatchEvent(e); });
  };

  it('a long press on a phone opens the same menu, without also opening the chat', async () => {
    await renderLoaded();
    vi.useFakeTimers();
    const row = rowOf('First');
    touch(row, 'pointerdown', 20, 20);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('menu', { name: 'Options for First' })).toBeInTheDocument();

    fireEvent.click(row);
    expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
  });

  it('moving the finger cancels the long press', async () => {
    await renderLoaded();
    vi.useFakeTimers();
    const row = rowOf('First');
    touch(row, 'pointerdown', 20, 20);
    touch(row, 'pointermove', 20, 60);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape or a press outside closes the menu', async () => {
    await renderLoaded();
    fireEvent.contextMenu(rowOf('First'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.contextMenu(rowOf('First'));
    fireEvent.pointerDown(document.querySelector('.udm-pinlayer'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('the open thread can pin its own chat', async () => {
    const { user } = await renderLoaded();
    await user.click(rowOf('First'));
    expect(screen.getByTestId('thread-pinned')).toHaveTextContent('false');
    await user.click(screen.getByRole('button', { name: 'thread-pin' }));
    await waitFor(() => expect(pinCalls()).toEqual([{ method: 'put', url: '/v1/conversations/c-1/pin', data: { pinned: true } }]));
    expect(screen.getByTestId('thread-pinned')).toHaveTextContent('true');
  });
});

// ===========================================================================
describe('MessagePage — new message', () => {
  const openPicker = (user) => user.click(headerButton('New message'));

  it('opens the people picker, never offering the user themselves', async () => {
    const { user } = await renderLoaded();
    await openPicker(user);
    expect(screen.getByTestId('picker')).toHaveAttribute('data-exclude', 'me');
  });

  it('picking someone you already chat with opens that conversation', async () => {
    const { user } = await renderLoaded();
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'pick-maya' }));

    expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-maya');
    expect(screen.getByTestId('thread')).toHaveAttribute('data-draft', 'false');
  });

  it('picking someone new starts a draft — nothing is created until a message is sent', async () => {
    const { user } = await renderLoaded();
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'pick-new' }));

    const thread = screen.getByTestId('thread');
    expect(thread).toHaveAttribute('data-conversation', 'draft-u-new');
    expect(thread).toHaveAttribute('data-draft', 'true');
    expect(screen.getByTestId('thread-name')).toHaveTextContent('Newcomer');
    expect(screen.getByTestId('thread-online')).toHaveTextContent('false');
    expect(rowNames()).toEqual(['Maya', 'Tony Fadd']); // no new row yet
    expect(inboxCalls()).toHaveLength(1);
  });

  it('picking someone whose thread is a request opens it in Requests', async () => {
    const { user } = await renderLoaded();
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'pick-stranger' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Requests' })).toBeInTheDocument();
    expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-req');
  });

  it('once the draft\'s first message creates the conversation, the thread switches to it', async () => {
    const { user } = await renderLoaded();
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'pick-new' }));

    inbox = [conv({ id: 'c-new', otherUserId: 'u-new', otherUsername: 'Newcomer', lastMessagePreview: 'hi', lastMessageMine: true }), ...INBOX];
    await user.click(screen.getByRole('button', { name: 'thread-activity' }));

    await waitFor(() => expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-new'));
    expect(screen.getByTestId('thread')).toHaveAttribute('data-draft', 'false');
    expect(rowNames()[0]).toBe('Newcomer');
  });
});

// ===========================================================================
describe('MessagePage — arriving from a profile\'s Message button', () => {
  it('opens the existing conversation with that person', async () => {
    await renderLoaded({ state: { compose: { userId: 'u-tony', username: 'Tony Fadd' } } });
    await waitFor(() => expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-tony'));
  });

  it('starts a draft with someone new, keeping their name', async () => {
    await renderLoaded({ state: { compose: { userId: 'u-new', username: 'Newcomer', photoUrl: null } } });
    await waitFor(() => expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'draft-u-new'));
    expect(screen.getByTestId('thread-name')).toHaveTextContent('Newcomer');
  });

  it('clears the compose target from history so a refresh does not reopen it', async () => {
    await renderLoaded({ state: { compose: { userId: 'u-tony' } } });
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/messages', { replace: true, state: {} }));
  });

  it('still accepts the older openWith form', async () => {
    await renderLoaded({ state: { openWith: 'u-maya' } });
    await waitFor(() => expect(screen.getByTestId('thread')).toHaveAttribute('data-conversation', 'c-maya'));
  });
});

// ===========================================================================
describe('MessagePage — live updates', () => {
  const incoming = (overrides = {}) => ({
    id: 'm-9', conversationId: 'c-tony', senderId: 'u-tony', body: 'you there?', createdAt: new Date().toISOString(),
    ...overrides,
  });

  it('a new message moves its conversation to the top and counts as unread', async () => {
    await renderLoaded();
    act(() => { socket.onMessage(incoming()); });

    expect(rowNames()).toEqual(['Tony Fadd', 'Maya']);
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview')).toHaveTextContent(/^you there\?$/);
    expect(rowOf('Tony Fadd').querySelector('.udm-badge')).toHaveTextContent('1');
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__time')).toHaveTextContent('now');
  });

  it('does not count as unread when that thread is open', async () => {
    const { user } = await renderLoaded();
    await user.click(rowOf('Tony Fadd'));
    act(() => { socket.onMessage(incoming()); });

    expect(rowOf('Tony Fadd').querySelector('.udm-badge')).toBeNull();
    expect(screen.getByTestId('thread-incoming')).toHaveTextContent('m-9');
  });

  it('the user\'s own message from another device is not unread', async () => {
    await renderLoaded();
    act(() => { socket.onMessage(incoming({ senderId: 'me', body: 'sent from my phone' })); });
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview')).toHaveTextContent('You: sent from my phone');
    expect(rowOf('Tony Fadd').querySelector('.udm-badge')).toBeNull();
  });

  it('a media-only message previews as support or a shared song', async () => {
    await renderLoaded();
    act(() => { socket.onMessage(incoming({ body: '', supportPaymentId: 7 })); });
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview')).toHaveTextContent('Sent you support');
  });

  it('reloads the inbox once after a burst of messages', async () => {
    await renderLoaded();
    vi.useFakeTimers();
    act(() => {
      socket.onMessage(incoming({ id: 'm-1' }));
      socket.onMessage(incoming({ id: 'm-2' }));
      socket.onMessage(incoming({ id: 'm-3' }));
    });
    expect(inboxCalls()).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(inboxCalls()).toHaveLength(2);
  });

  it('shows "typing" on the row and in the open thread, and clears it when the message lands', async () => {
    const { user } = await renderLoaded();
    await user.click(rowOf('Tony Fadd'));
    act(() => { socket.handlers.onTyping({ conversationId: 'c-tony', typing: true }); });

    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview--typing')).not.toBeNull();
    expect(screen.getByTestId('thread-typing')).toHaveTextContent('true');

    act(() => { socket.onMessage(incoming()); });
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview--typing')).toBeNull();
    expect(screen.getByTestId('thread-typing')).toHaveTextContent('false');
  });

  it('a "typing" with no follow-up expires on its own', async () => {
    await renderLoaded();
    vi.useFakeTimers();
    act(() => { socket.handlers.onTyping({ conversationId: 'c-tony', typing: true }); });
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview--typing')).not.toBeNull();

    act(() => { vi.advanceTimersByTime(6000); });
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview--typing')).toBeNull();
  });

  it('presence updates who is active now', async () => {
    await renderLoaded();
    act(() => { socket.handlers.onPresence({ userId: 'u-tony', online: true }); });
    expect(within(screen.getByRole('region', { name: 'Active now' }))
      .getByRole('button', { name: 'Tony Fadd, active now' })).toBeInTheDocument();

    act(() => { socket.handlers.onPresence({ userId: 'u-maya', online: false }); });
    expect(screen.queryByRole('button', { name: 'Maya, active now' })).not.toBeInTheDocument();
  });

  it('a conversation change elsewhere reloads the inbox', async () => {
    await renderLoaded();
    vi.useFakeTimers();
    act(() => { socket.handlers.onConversation({}); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(inboxCalls()).toHaveLength(2);
  });
});

// ===========================================================================
describe('MessagePage — the thread reporting back', () => {
  it('a message sent in the thread updates its row at once', async () => {
    const { user } = await renderLoaded();
    await user.click(rowOf('Tony Fadd'));
    await user.click(screen.getByRole('button', { name: 'thread-activity' }));

    expect(rowNames()[0]).toBe('Tony Fadd');
    expect(rowOf('Tony Fadd').querySelector('.udm-conv__preview')).toHaveTextContent('You: sent from thread');
  });

  it('accepting a request in the thread returns to the inbox and reloads', async () => {
    const { user } = await renderLoaded();
    await openRequests(user);
    await user.click(rowOf('Stranger'));
    inbox = INBOX.map((c) => (c.id === 'c-req' ? { ...c, lane: 'chats' } : c));
    await user.click(screen.getByRole('button', { name: 'thread-accepted' }));

    expect(listTitle()).toBe('Messages');
    await waitFor(() => expect(rowNames()).toContain('Stranger'));
    expect(inboxCalls()).toHaveLength(2);
  });

  it('declining a request in the thread closes it and reloads', async () => {
    const { user } = await renderLoaded();
    await openRequests(user);
    await user.click(rowOf('Stranger'));
    inbox = INBOX.filter((c) => c.id !== 'c-req');
    await user.click(screen.getByRole('button', { name: 'thread-request-gone' }));

    expect(screen.queryByTestId('thread')).not.toBeInTheDocument();
    await waitFor(() => expect(inboxCalls()).toHaveLength(2));
  });
});

// ===========================================================================
describe('MessagePage — settings', () => {
  it('opens the message settings and reloads the inbox when they change', async () => {
    const { user } = await renderLoaded();
    await user.click(headerButton('Message settings'));
    expect(screen.getByTestId('settings')).toBeInTheDocument();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(screen.getByRole('button', { name: 'settings-changed' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(inboxCalls()).toHaveLength(2);
  });
});
