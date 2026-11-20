// src/commentSection.test.jsx
//
// Tests for CommentSection — comments under a song or a video.
//
// Covers:
//   • the three requests on mount (list, count, per-user limit); songs and videos
//   • loading, load error + Try again, empty state
//   • guests: no limit request, a log-in prompt, and the sign-in sheet on
//     comment / like / reply
//   • composer: expands on focus, Cancel, trims, disabled when empty,
//     Cmd/Ctrl+Enter, the "N comments left" hint, the limit message
//   • posting adds the comment to the top and bumps the count
//   • sorting: Top (likes + replies) and Newest
//   • replies: toggle, reply box, @mention when answering a reply, Enter sends,
//     auto-expand after posting, replying still allowed in your own thread at
//     the limit
//   • likes: optimistic update, POST then DELETE, roll back + message on failure
//   • delete: only for the author or the track's artist, confirm dialog,
//     no userId in the URL, reply delete, failure message
//   • mobile: preview button opens the sheet; the sheet closes
//
// apiCall is mocked. The viewer (AuthContext), the sign-in sheet and the
// phone-verification gate are stubbed: each has its own suite.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';

vi.mock('./components/axiosInstance', () => ({ apiCall: vi.fn() }));
vi.mock('./commentSection.scss', () => ({}));

const { authState, triggerGate } = vi.hoisted(() => ({
  authState: { user: { username: 'Charles', photoUrl: null } },
  triggerGate: vi.fn(),
}));

vi.mock('./context/AuthContext', () => ({ useAuth: () => authState }));

vi.mock('./AuthGateSheet', () => ({
  default: () => null,
  useAuthGate: () => ({ triggerGate, gateProps: { isOpen: false } }),
}));

vi.mock('./verificationGate', () => ({
  default: ({ children }) => <>{children}</>,
}));

import CommentSection from './commentSection';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ME = 10;
const ARTIST = 30;
const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

const comment = (overrides) => ({
  commentId: 1,
  songId: 50,
  userId: 20,
  username: 'Maya',
  userJurisdictionName: 'Brooklyn',
  userPhotoUrl: null,
  content: 'A comment',
  createdAt: minutesAgo(5),
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
  replies: [],
  ...overrides,
});

const THREAD = [
  comment({
    commentId: 1,
    userId: ME,
    username: 'Charles',
    userJurisdictionName: 'Harlem',
    content: 'This beat is serious.',
    replyCount: 1,
    replies: [
      comment({ commentId: 2, userId: 20, username: 'Maya', content: 'Facts. The drums are crazy.' }),
    ],
  }),
];

let backend;

function setupApi(overrides = {}) {
  backend = {
    comments: THREAD,
    count: { totalCount: 2, topLevelCount: 1 },
    userLimit: { count: 0, limit: 3, remaining: 3, limitReached: false },
    fail: {},
    ...overrides,
  };
  let nextId = 100;

  apiCall.mockImplementation(async ({ method, url, data }) => {
    const key = `${method} ${url}`;
    if (backend.fail[key]) throw backend.fail[key];

    if (method === 'get' && /\/user-count$/.test(url)) return { data: backend.userLimit };
    if (method === 'get' && /\/count$/.test(url)) return { data: backend.count };
    if (method === 'get' && /^\/v1\/comments\/(song|video)\/\d+$/.test(url)) return { data: backend.comments };
    if (method === 'post' && url === '/v1/comments') {
      return {
        data: comment({
          commentId: nextId++,
          userId: ME,
          username: 'Charles',
          content: data.content,
          createdAt: new Date().toISOString(),
          parentCommentId: data.parentCommentId,
        }),
      };
    }
    if (/\/like$/.test(url)) return { data: { likeCount: method === 'post' ? 8 : 7 } };
    if (method === 'delete') return { data: {} };
    return { data: null };
  });
}

function renderComments(props = {}) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <CommentSection songId={50} userId={ME} songArtistId={ARTIST} {...props} />
    </MemoryRouter>
  );
  return { user };
}

async function renderLoaded(props) {
  const utils = renderComments(props);
  await waitFor(() => expect(screen.queryByText('Loading comments...')).not.toBeInTheDocument());
  return utils;
}

const calls = (method, url) =>
  apiCall.mock.calls.map(([c]) => c).filter((c) => c.method === method && (url instanceof RegExp ? url.test(c.url) : c.url === url));

const composer = () => screen.getByRole('textbox', { name: 'Add a comment' });
const article = (author) => screen.getAllByRole('article', { name: `Comment by ${author}` })[0];
const authors = () => Array.from(document.querySelectorAll('.cmt-list > .cmt-comment > .cmt-comment__body .cmt-comment__author'))
  .filter((el) => !el.closest('.cmt-thread'))
  .map((el) => el.textContent);
const toast = () => document.querySelector('.cmt-toast');

const useMobile = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  }));
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { username: 'Charles', photoUrl: null };
  useMobile(false);
  setupApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('CommentSection — loading the thread', () => {
  it('asks for the comments, the count and the viewer\'s limit', async () => {
    await renderLoaded();
    expect(apiCall).toHaveBeenCalledWith({ method: 'get', url: '/v1/comments/song/50' });
    expect(apiCall).toHaveBeenCalledWith({ method: 'get', url: '/v1/comments/song/50/count' });
    expect(apiCall).toHaveBeenCalledWith({ method: 'get', url: '/v1/comments/song/50/user-count' });
  });

  it('uses the video endpoints for a video', async () => {
    await renderLoaded({ songId: undefined, videoId: 77 });
    expect(apiCall).toHaveBeenCalledWith({ method: 'get', url: '/v1/comments/video/77' });
    expect(apiCall).toHaveBeenCalledWith({ method: 'get', url: '/v1/comments/video/77/count' });
    expect(apiCall).toHaveBeenCalledWith({ method: 'get', url: '/v1/comments/video/77/user-count' });
  });

  it('shows a loading state, then the comments and the total', async () => {
    renderComments();
    expect(screen.getByText('Loading comments...')).toBeInTheDocument();

    expect(await screen.findByText('This beat is serious.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Comments2');
  });

  it('shows who wrote a comment, where they are from and how long ago', async () => {
    await renderLoaded();
    const row = article('Charles');
    expect(row.querySelector('.cmt-comment__author')).toHaveTextContent('Charles');
    expect(row.querySelector('.cmt-comment__place')).toHaveTextContent('Harlem');
    expect(row.querySelector('.cmt-comment__time')).toHaveTextContent('5 minutes ago');
  });

  it('shows the empty state when there are no comments', async () => {
    setupApi({ comments: [], count: { totalCount: 0, topLevelCount: 0 } });
    await renderLoaded();
    expect(screen.getByText('No comments yet')).toBeInTheDocument();
    expect(screen.getByText('Be the first to share your thoughts')).toBeInTheDocument();
    expect(document.querySelector('.cmt-head__count')).toBeNull();
  });

  it('shows an error with Try again, and reloads when it is pressed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApi({ fail: { 'get /v1/comments/song/50': new Error('down') } });
    const { user } = await renderLoaded();
    expect(screen.getByText("Couldn't load comments")).toBeInTheDocument();

    backend.fail = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This beat is serious.')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('CommentSection — guests', () => {
  it('does not ask for a comment limit', async () => {
    await renderLoaded({ userId: null });
    expect(calls('get', /user-count$/)).toHaveLength(0);
  });

  it('shows a log-in prompt in place of the composer', async () => {
    await renderLoaded({ userId: null });
    expect(screen.getByRole('button', { name: /log in to join the conversation/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
  });

  it('the prompt, Like and Reply all open the sign-in sheet', async () => {
    const { user } = await renderLoaded({ userId: null });
    await user.click(screen.getByRole('button', { name: /log in to join the conversation/i }));
    await user.click(screen.getByRole('button', { name: /^Like comment by Charles/ }));
    await user.click(screen.getByRole('button', { name: 'Reply to Charles' }));

    expect(triggerGate).toHaveBeenCalledTimes(3);
    expect(triggerGate).toHaveBeenCalledWith('generic');
    expect(calls('post', /.*/)).toHaveLength(0);
    expect(screen.queryByRole('textbox', { name: 'Reply to Charles' })).not.toBeInTheDocument();
  });

  it('never offers a guest the delete menu', async () => {
    await renderLoaded({ userId: null });
    expect(screen.queryByRole('button', { name: 'Comment options' })).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('CommentSection — composer', () => {
  it('shows Cancel and Comment once focused; Comment is disabled while empty', async () => {
    const { user } = await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();

    await user.click(composer());
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('stays disabled for whitespace only', async () => {
    const { user } = await renderLoaded();
    await user.type(composer(), '    ');
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
  });

  it('Cancel clears the text and collapses the composer', async () => {
    const { user } = await renderLoaded();
    await user.type(composer(), 'never mind');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(composer()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();
  });

  it('caps comments at 2,000 characters', async () => {
    await renderLoaded();
    expect(composer()).toHaveAttribute('maxLength', '2000');
  });

  it('posts the trimmed text, with no userId in the body', async () => {
    const { user } = await renderLoaded();
    await user.type(composer(), '   This is my new comment.   ');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(calls('post', '/v1/comments')).toHaveLength(1));
    expect(calls('post', '/v1/comments')[0]).toEqual({
      method: 'post',
      url: '/v1/comments',
      data: { songId: 50, content: 'This is my new comment.' },
    });
  });

  it('posts against the video when it is a video', async () => {
    const { user } = await renderLoaded({ songId: undefined, videoId: 77 });
    await user.type(composer(), 'Great video');
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(calls('post', '/v1/comments')).toHaveLength(1));
    expect(calls('post', '/v1/comments')[0].data).toEqual({ videoId: 77, content: 'Great video' });
  });

  it('puts the new comment first, clears the box and bumps the count', async () => {
    const { user } = await renderLoaded();
    await user.type(composer(), 'Brand new');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText('Brand new')).toBeInTheDocument();
    expect(document.querySelectorAll('.cmt-list > .cmt-comment')[0]).toHaveTextContent('Brand new');
    expect(composer()).toHaveValue('');
    expect(document.querySelector('.cmt-head__count')).toHaveTextContent('3');
  });

  it('Ctrl+Enter posts', async () => {
    const { user } = await renderLoaded();
    await user.type(composer(), 'Quick one');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(calls('post', '/v1/comments')).toHaveLength(1));
  });

  it('a plain Enter does not post', async () => {
    const { user } = await renderLoaded();
    await user.type(composer(), 'Line one{Enter}');
    expect(calls('post', '/v1/comments')).toHaveLength(0);
  });

  it('shows the server\'s message when a post is refused, and keeps the text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApi({
      fail: { 'post /v1/comments': { response: { status: 400, data: { message: 'Comment limit reached for this track' } } } },
    });
    const { user } = await renderLoaded();
    await user.type(composer(), 'One more');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(toast()).toHaveTextContent('Comment limit reached for this track'));
    expect(composer()).toHaveValue('One more');
  });

  it('shows a plain message when the server is down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApi({ fail: { 'post /v1/comments': { response: { status: 500, data: { message: 'NullPointerException' } } } } });
    const { user } = await renderLoaded();
    await user.type(composer(), 'One more');
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(toast()).toHaveTextContent("Couldn't post your comment. Try again."));
  });
});

// ===========================================================================
describe('CommentSection — the three-comment limit', () => {
  it('says how many are left when it gets down to two', async () => {
    setupApi({ userLimit: { count: 1, limit: 3, remaining: 2, limitReached: false } });
    const { user } = await renderLoaded();
    await user.click(composer());
    expect(await screen.findByText('2 comments left on this track')).toBeInTheDocument();
  });

  it('uses the singular for the last one, and says "video" on a video', async () => {
    setupApi({ userLimit: { count: 2, limit: 3, remaining: 1, limitReached: false } });
    const { user } = await renderLoaded({ songId: undefined, videoId: 77 });
    await user.click(composer());
    expect(await screen.findByText('1 comment left on this video')).toBeInTheDocument();
  });

  it('says nothing while all three are still available', async () => {
    const { user } = await renderLoaded();
    await user.click(composer());
    expect(screen.queryByText(/left on this track/)).not.toBeInTheDocument();
  });

  it('replaces the composer with a message once the limit is reached', async () => {
    setupApi({ userLimit: { count: 3, limit: 3, remaining: 0, limitReached: true } });
    await renderLoaded();
    expect(await screen.findByText(/you've used all 3 comments on this track/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();
  });

  it('posting the last allowed comment swaps the composer for the message', async () => {
    setupApi({ userLimit: { count: 2, limit: 3, remaining: 1, limitReached: false } });
    const { user } = await renderLoaded();
    await user.type(composer(), 'My third');
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(await screen.findByText(/you've used all 3 comments/i)).toBeInTheDocument();
  });

  it('at the limit you can still reply in your own thread, but not in someone else\'s', async () => {
    setupApi({
      userLimit: { count: 3, limit: 3, remaining: 0, limitReached: true },
      comments: [
        comment({ commentId: 1, userId: ME, username: 'Charles', content: 'Mine' }),
        comment({ commentId: 3, userId: 20, username: 'Maya', content: 'Hers' }),
      ],
    });
    await renderLoaded();
    await screen.findByText(/you've used all 3 comments/i);
    expect(screen.getByRole('button', { name: 'Reply to Charles' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reply to Maya' })).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('CommentSection — sorting', () => {
  const MIXED = [
    comment({ commentId: 1, username: 'Quiet', content: 'newest, no likes', createdAt: minutesAgo(1) }),
    comment({ commentId: 2, username: 'Liked', content: 'old, most liked', createdAt: minutesAgo(90), likeCount: 9 }),
    comment({
      commentId: 3, username: 'Talked', content: 'middle, has replies', createdAt: minutesAgo(30), likeCount: 1,
      replies: [comment({ commentId: 31 }), comment({ commentId: 32 })],
    }),
  ];

  it('defaults to Top: likes plus replies, highest first', async () => {
    setupApi({ comments: MIXED });
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Top' })).toHaveAttribute('aria-pressed', 'true');
    expect(authors()).toEqual(['Liked', 'Talked', 'Quiet']);
  });

  it('Newest orders by time', async () => {
    setupApi({ comments: MIXED });
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Newest' }));
    expect(screen.getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'true');
    expect(authors()).toEqual(['Quiet', 'Talked', 'Liked']);
  });

  it('changing the sort makes no request', async () => {
    setupApi({ comments: MIXED });
    const { user } = await renderLoaded();
    const before = apiCall.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Newest' }));
    await user.click(screen.getByRole('button', { name: 'Top' }));
    expect(apiCall.mock.calls.length).toBe(before);
  });
});

// ===========================================================================
describe('CommentSection — replies', () => {
  it('keeps replies folded until the toggle is pressed', async () => {
    const { user } = await renderLoaded();
    expect(screen.queryByText('Facts. The drums are crazy.')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: '1 reply' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByText('Facts. The drums are crazy.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(screen.queryByText('Facts. The drums are crazy.')).not.toBeInTheDocument();
  });

  it('says "replies" for more than one', async () => {
    setupApi({
      comments: [comment({ replies: [comment({ commentId: 2 }), comment({ commentId: 3 })] })],
    });
    await renderLoaded();
    expect(screen.getByRole('button', { name: '2 replies' })).toBeInTheDocument();
  });

  it('Reply opens a focused reply box; pressing it again closes it', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Reply to Charles' }));
    const box = screen.getByRole('textbox', { name: 'Reply to Charles' });
    expect(box).toHaveFocus();
    expect(box).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Reply to Charles' }));
    expect(screen.queryByRole('textbox', { name: 'Reply to Charles' })).not.toBeInTheDocument();
  });

  it('Cancel closes the reply box', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Reply to Charles' }));
    await user.type(screen.getByRole('textbox', { name: 'Reply to Charles' }), 'hmm');
    await user.click(within(document.querySelector('.cmt-reply-box')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Reply to Charles' })).not.toBeInTheDocument();
  });

  it('posts the reply under the top-level comment and opens the thread', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Reply to Charles' }));
    await user.type(screen.getByRole('textbox', { name: 'Reply to Charles' }), '  Thanks!  ');
    await user.click(within(document.querySelector('.cmt-reply-box')).getByRole('button', { name: 'Reply' }));

    await waitFor(() => expect(calls('post', '/v1/comments')).toHaveLength(1));
    expect(calls('post', '/v1/comments')[0].data).toEqual({ songId: 50, parentCommentId: 1, content: 'Thanks!' });

    expect(await screen.findByText('Thanks!')).toBeInTheDocument();
    expect(screen.getByText('Facts. The drums are crazy.')).toBeInTheDocument(); // thread opened
    expect(screen.getByRole('button', { name: '2 replies' })).toBeInTheDocument();
    expect(document.querySelector('.cmt-head__count')).toHaveTextContent('3');
    expect(screen.queryByRole('textbox', { name: 'Reply to Charles' })).not.toBeInTheDocument();
  });

  it('Enter sends a reply; Shift+Enter does not', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Reply to Charles' }));
    const box = screen.getByRole('textbox', { name: 'Reply to Charles' });
    await user.type(box, 'first line{Shift>}{Enter}{/Shift}');
    expect(calls('post', '/v1/comments')).toHaveLength(0);

    await user.type(box, 'second line{Enter}');
    await waitFor(() => expect(calls('post', '/v1/comments')).toHaveLength(1));
  });

  it('answering a reply starts with an @mention and still posts to the top-level comment', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: '1 reply' }));
    await user.click(screen.getByRole('button', { name: 'Reply to Maya' }));

    const box = screen.getByRole('textbox', { name: 'Reply to Maya' });
    expect(box).toHaveValue('@Maya ');
    await user.type(box, 'agreed{Enter}');

    await waitFor(() => expect(calls('post', '/v1/comments')).toHaveLength(1));
    expect(calls('post', '/v1/comments')[0].data).toEqual({ songId: 50, parentCommentId: 1, content: '@Maya agreed' });
  });

  it('highlights a leading @mention in a comment', async () => {
    setupApi({ comments: [comment({ content: '@Charles great verse' })] });
    await renderLoaded();
    expect(document.querySelector('.cmt-mention')).toHaveTextContent('@Charles');
  });

  it('shows a message when a reply fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = await renderLoaded();
    backend.fail = { 'post /v1/comments': new Error('down') };
    await user.click(screen.getByRole('button', { name: 'Reply to Charles' }));
    await user.type(screen.getByRole('textbox', { name: 'Reply to Charles' }), 'hello{Enter}');
    await waitFor(() => expect(toast()).toHaveTextContent("Couldn't post your reply. Try again."));
  });
});

// ===========================================================================
describe('CommentSection — likes', () => {
  const likeButton = () => screen.getByRole('button', { name: /^Like comment by Maya/ });

  it('shows the like count, and nothing at zero', async () => {
    setupApi({
      comments: [
        comment({ commentId: 1, username: 'Maya', likeCount: 7 }),
        comment({ commentId: 2, username: 'Zero', likeCount: 0 }),
      ],
    });
    await renderLoaded();
    expect(likeButton()).toHaveAccessibleName('Like comment by Maya, 7 likes');
    expect(likeButton().querySelector('.cmt-like__count')).toHaveTextContent('7');
    expect(screen.getByRole('button', { name: 'Like comment by Zero' }).querySelector('.cmt-like__count')).toBeNull();
  });

  it('abbreviates large counts', async () => {
    setupApi({ comments: [comment({ username: 'Maya', likeCount: 1234 })] });
    await renderLoaded();
    expect(likeButton().querySelector('.cmt-like__count')).toHaveTextContent('1.2K');
  });

  it('liking updates straight away and POSTs the like', async () => {
    setupApi({ comments: [comment({ commentId: 1, username: 'Maya', likeCount: 7 })] });
    const { user } = await renderLoaded();
    await user.click(likeButton());

    expect(likeButton()).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(calls('post', '/v1/comments/1/like')).toHaveLength(1));
    await waitFor(() => expect(likeButton().querySelector('.cmt-like__count')).toHaveTextContent('8'));
  });

  it('unliking sends DELETE', async () => {
    setupApi({ comments: [comment({ commentId: 1, username: 'Maya', likeCount: 8, likedByMe: true })] });
    const { user } = await renderLoaded();
    expect(likeButton()).toHaveAttribute('aria-pressed', 'true');

    await user.click(likeButton());
    expect(likeButton()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(calls('delete', '/v1/comments/1/like')).toHaveLength(1));
    await waitFor(() => expect(likeButton().querySelector('.cmt-like__count')).toHaveTextContent('7'));
  });

  it('a failed like rolls back and tells the user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApi({
      comments: [comment({ commentId: 1, username: 'Maya', likeCount: 7 })],
      fail: { 'post /v1/comments/1/like': new Error('down') },
    });
    const { user } = await renderLoaded();
    await user.click(likeButton());

    await waitFor(() => expect(toast()).toHaveTextContent("Couldn't save your like. Try again."));
    expect(likeButton()).toHaveAttribute('aria-pressed', 'false');
    expect(likeButton().querySelector('.cmt-like__count')).toHaveTextContent('7');
  });

  it('a reply can be liked too', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: '1 reply' }));
    await user.click(likeButton());
    await waitFor(() => expect(calls('post', '/v1/comments/2/like')).toHaveLength(1));
    expect(likeButton()).toHaveAttribute('aria-pressed', 'true');
  });
});

// ===========================================================================
describe('CommentSection — deleting', () => {
  const openDelete = async (user, author) => {
    await user.click(within(article(author)).getAllByRole('button', { name: 'Comment options' }).at(-1));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  };

  it('offers the menu on your own comments only', async () => {
    setupApi({
      comments: [
        comment({ commentId: 1, userId: ME, username: 'Charles' }),
        comment({ commentId: 3, userId: 20, username: 'Maya' }),
      ],
    });
    await renderLoaded();
    expect(within(article('Charles')).getByRole('button', { name: 'Comment options' })).toBeInTheDocument();
    expect(within(article('Maya')).queryByRole('button', { name: 'Comment options' })).not.toBeInTheDocument();
  });

  it('the track\'s artist can delete anyone\'s comment', async () => {
    setupApi({ comments: [comment({ commentId: 3, userId: 20, username: 'Maya' })] });
    await renderLoaded({ userId: ARTIST });
    expect(within(article('Maya')).getByRole('button', { name: 'Comment options' })).toBeInTheDocument();
  });

  it('asks before deleting', async () => {
    const { user } = await renderLoaded();
    await openDelete(user, 'Charles');

    const dialog = screen.getByRole('alertdialog', { name: 'Delete comment?' });
    expect(dialog).toHaveTextContent('Delete your comment permanently?');
    expect(calls('delete', /.*/)).toHaveLength(0);
  });

  it('Cancel keeps the comment', async () => {
    const { user } = await renderLoaded();
    await openDelete(user, 'Charles');
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('This beat is serious.')).toBeInTheDocument();
    expect(calls('delete', /.*/)).toHaveLength(0);
  });

  it('Delete removes it, with no userId in the address — the server knows who is asking', async () => {
    const { user } = await renderLoaded();
    await openDelete(user, 'Charles');
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(calls('delete', '/v1/comments/1')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('This beat is serious.')).not.toBeInTheDocument());
    expect(toast()).toHaveTextContent('Comment deleted');
    expect(document.querySelector('.cmt-head__count')).toHaveTextContent('1');
  });

  it('deleting your own comment re-reads your limit', async () => {
    const { user } = await renderLoaded();
    const before = calls('get', /user-count$/).length;
    await openDelete(user, 'Charles');
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls('get', /user-count$/).length).toBe(before + 1));
  });

  it('deleting a reply leaves the comment above it', async () => {
    setupApi({
      comments: [comment({
        commentId: 1, userId: 20, username: 'Maya', content: 'Top level', replyCount: 1,
        replies: [comment({ commentId: 2, userId: ME, username: 'Charles', content: 'My reply' })],
      })],
    });
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: '1 reply' }));
    await openDelete(user, 'Charles');
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(calls('delete', '/v1/comments/2')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('My reply')).not.toBeInTheDocument());
    expect(screen.getByText('Top level')).toBeInTheDocument();
  });

  it('a failed delete keeps the comment and tells the user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = await renderLoaded();
    backend.fail = { 'delete /v1/comments/1': new Error('down') };
    await openDelete(user, 'Charles');
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(toast()).toHaveTextContent("Couldn't delete that comment. Try again."));
    expect(screen.getByText('This beat is serious.')).toBeInTheDocument();
  });

  it('Escape closes the options menu', async () => {
    const { user } = await renderLoaded();
    await user.click(within(article('Charles')).getByRole('button', { name: 'Comment options' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('CommentSection — mobile sheet', () => {
  beforeEach(() => useMobile(true));

  it('shows a preview button with the count and the top comment', async () => {
    await renderLoaded();
    const preview = document.querySelector('.cmt-preview');
    expect(preview).toHaveAttribute('aria-expanded', 'false');
    expect(preview.querySelector('.cmt-preview__count')).toHaveTextContent('2');
    expect(preview.querySelector('.cmt-preview__text')).toHaveTextContent('This beat is serious.');
  });

  it('invites a comment when there are none', async () => {
    setupApi({ comments: [], count: { totalCount: 0, topLevelCount: 0 } });
    await renderLoaded();
    expect(document.querySelector('.cmt-preview__placeholder')).toHaveTextContent('Add a comment...');
  });

  it('tapping the preview opens the sheet; Close shuts it', async () => {
    const { user } = await renderLoaded();
    const sheet = document.querySelector('.cmt-sheet');
    expect(sheet).not.toHaveClass('is-open');

    await user.click(document.querySelector('.cmt-preview'));
    expect(sheet).toHaveClass('is-open');
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Close comments' }));
    expect(sheet).not.toHaveClass('is-open');
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape closes the sheet', async () => {
    const { user } = await renderLoaded();
    await user.click(document.querySelector('.cmt-preview'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.cmt-sheet')).not.toHaveClass('is-open');
  });

  it('the sheet links to the help page on how comments work', async () => {
    const { user } = await renderLoaded();
    await user.click(document.querySelector('.cmt-preview'));
    expect(screen.getByRole('link', { name: 'How comments work' })).toHaveAttribute('href', '/help#comments');
  });

  it('the sheet composer posts with its send button', async () => {
    const { user } = await renderLoaded();
    await user.click(document.querySelector('.cmt-preview'));
    const send = screen.getByRole('button', { name: 'Post comment' });
    expect(send).toBeDisabled();

    await user.type(composer(), 'From my phone');
    await user.click(send);
    await waitFor(() => expect(calls('post', '/v1/comments')).toHaveLength(1));
    expect(calls('post', '/v1/comments')[0].data).toEqual({ songId: 50, content: 'From my phone' });
  });
});
