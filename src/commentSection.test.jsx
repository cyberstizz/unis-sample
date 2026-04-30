// src/commentSection.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommentSection from './commentSection';
import { apiCall } from './components/axiosInstance';

vi.mock('./components/axiosInstance', () => ({
  apiCall: vi.fn(),
}));

const baseComments = [
  {
    commentId: 1,
    songId: 50,
    userId: 10,
    username: 'Charles',
    userJurisdictionName: 'Harlem',
    userPhotoUrl: null,
    content: 'This beat is serious.',
    createdAt: new Date().toISOString(),
    replyCount: 1,
    replies: [
      {
        commentId: 2,
        songId: 50,
        userId: 20,
        username: 'Maya',
        userJurisdictionName: 'Brooklyn',
        userPhotoUrl: null,
        content: 'Facts. The drums are crazy.',
        createdAt: new Date().toISOString(),
        replies: [],
      },
    ],
  },
];

function setupApiMocks({
  comments = baseComments,
  count = { totalCount: 2, topLevelCount: 1 },
  userLimit = { count: 0, limit: 3, remaining: 3, limitReached: false },
  postedComment = {
    commentId: 99,
    songId: 50,
    userId: 10,
    username: 'Charles',
    userJurisdictionName: 'Harlem',
    userPhotoUrl: null,
    content: 'New posted comment',
    createdAt: new Date().toISOString(),
    replies: [],
  },
  postedReply = {
    commentId: 100,
    songId: 50,
    userId: 10,
    username: 'Charles',
    userJurisdictionName: 'Harlem',
    userPhotoUrl: null,
    content: 'New posted reply',
    createdAt: new Date().toISOString(),
    replies: [],
  },
} = {}) {
  apiCall.mockImplementation(({ method, url, data }) => {
    if (method === 'get' && url === '/v1/comments/song/50') {
      return Promise.resolve({ data: comments });
    }

    if (method === 'get' && url === '/v1/comments/song/50/count') {
      return Promise.resolve({ data: count });
    }

    if (method === 'get' && url === '/v1/comments/song/50/user-count') {
      return Promise.resolve({ data: userLimit });
    }

    if (method === 'post' && url === '/v1/comments') {
      if (data.parentCommentId) {
        return Promise.resolve({
          data: {
            ...postedReply,
            content: data.content,
            parentCommentId: data.parentCommentId,
          },
        });
      }

      return Promise.resolve({
        data: {
          ...postedComment,
          content: data.content,
        },
      });
    }

    if (method === 'delete') {
      return Promise.resolve({ data: {} });
    }

    return Promise.resolve({ data: null });
  });
}

function renderCommentSection(props = {}) {
  return render(
    <CommentSection
      songId={50}
      userId={10}
      songArtistId={30}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('CommentSection', () => {
  it('fetches and renders comments, count, and the new comment form', async () => {
    setupApiMocks();

    renderCommentSection();

    expect(screen.getByText('Loading comments...')).toBeInTheDocument();

    expect(await screen.findByText('This beat is serious.')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText('Share your thoughts on this track...')
    ).toBeInTheDocument();

    expect(apiCall).toHaveBeenCalledWith({
      method: 'get',
      url: '/v1/comments/song/50',
    });

    expect(apiCall).toHaveBeenCalledWith({
      method: 'get',
      url: '/v1/comments/song/50/count',
    });

    expect(apiCall).toHaveBeenCalledWith({
      method: 'get',
      url: '/v1/comments/song/50/user-count',
    });
  });

  it('shows a login prompt instead of the comment form when there is no userId', async () => {
    setupApiMocks();

    renderCommentSection({ userId: null });

    expect(await screen.findByText('This beat is serious.')).toBeInTheDocument();
    expect(screen.getByText('Log in to join the conversation')).toBeInTheDocument();

    expect(
      screen.queryByPlaceholderText('Share your thoughts on this track...')
    ).not.toBeInTheDocument();

    expect(apiCall).not.toHaveBeenCalledWith({
      method: 'get',
      url: '/v1/comments/song/50/user-count',
    });
  });

  it('shows the empty state when there are no comments', async () => {
    setupApiMocks({
      comments: [],
      count: { totalCount: 0, topLevelCount: 0 },
    });

    renderCommentSection();

    expect(await screen.findByText('No comments yet')).toBeInTheDocument();
    expect(screen.getByText('Be the first to share your thoughts')).toBeInTheDocument();
  });

  it('submits a new top-level comment and adds it to the list', async () => {
    const user = userEvent.setup();

    setupApiMocks({
      postedComment: {
        commentId: 99,
        songId: 50,
        userId: 10,
        username: 'Charles',
        content: 'This is my new comment.',
        createdAt: new Date().toISOString(),
        replies: [],
      },
    });

    renderCommentSection();

    const textarea = await screen.findByPlaceholderText(
      'Share your thoughts on this track...'
    );

    await user.type(textarea, '   This is my new comment.   ');

    const form = textarea.closest('form');
    const submitButton = form.querySelector('.submit-button');

    await user.click(submitButton);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        method: 'post',
        url: '/v1/comments',
        data: {
          songId: 50,
          userId: 10,
          content: 'This is my new comment.',
        },
      });
    });

    expect(await screen.findByText('This is my new comment.')).toBeInTheDocument();
    expect(textarea).toHaveValue('');
  });

  it('does not submit an empty comment', async () => {
    const user = userEvent.setup();

    setupApiMocks();

    renderCommentSection();

    const textarea = await screen.findByPlaceholderText(
      'Share your thoughts on this track...'
    );

    const form = textarea.closest('form');
    const submitButton = form.querySelector('.submit-button');

    expect(submitButton).toBeDisabled();

    await user.click(submitButton);

    expect(apiCall).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        url: '/v1/comments',
      })
    );
  });

  it('shows the comment limit message when the user has reached the comment limit', async () => {
    setupApiMocks({
      userLimit: {
        count: 3,
        limit: 3,
        remaining: 0,
        limitReached: true,
      },
    });

    renderCommentSection();

    expect(
      await screen.findByText(
        "You've used all 3 comments on this track. You can still reply when someone responds to your comments."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByPlaceholderText('Share your thoughts on this track...')
    ).not.toBeInTheDocument();
  });

  it('expands replies when the View replies button is clicked', async () => {
    const user = userEvent.setup();

    setupApiMocks();

    renderCommentSection();

    expect(await screen.findByText('This beat is serious.')).toBeInTheDocument();
    expect(screen.queryByText('Facts. The drums are crazy.')).not.toBeInTheDocument();

    await user.click(screen.getByText('View 1 reply'));

    expect(screen.getByText('Facts. The drums are crazy.')).toBeInTheDocument();

    await user.click(screen.getByText('Hide 1 reply'));

    expect(screen.queryByText('Facts. The drums are crazy.')).not.toBeInTheDocument();
  });

  it('submits a reply and auto-expands the replies section', async () => {
    const user = userEvent.setup();

    setupApiMocks({
      comments: [
        {
          commentId: 1,
          songId: 50,
          userId: 20,
          username: 'Maya',
          userJurisdictionName: 'Brooklyn',
          userPhotoUrl: null,
          content: 'Original comment',
          createdAt: new Date().toISOString(),
          replyCount: 0,
          replies: [],
        },
      ],
      count: { totalCount: 1, topLevelCount: 1 },
      postedReply: {
        commentId: 100,
        songId: 50,
        userId: 10,
        username: 'Charles',
        content: 'This is a reply.',
        createdAt: new Date().toISOString(),
        replies: [],
      },
    });

    renderCommentSection();

    expect(await screen.findByText('Original comment')).toBeInTheDocument();

    await user.click(screen.getByText('Reply'));

    const replyInput = screen.getByPlaceholderText('Reply to Maya...');
    await user.type(replyInput, 'This is a reply.');

    const replySubmitButton = replyInput
      .closest('.reply-input-container')
      .querySelector('.reply-submit');

    await user.click(replySubmitButton);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        method: 'post',
        url: '/v1/comments',
        data: {
          songId: 50,
          userId: 10,
          parentCommentId: 1,
          content: 'This is a reply.',
        },
      });
    });

    expect(await screen.findByText('This is a reply.')).toBeInTheDocument();
  });

  it('deletes a comment when the current user owns it', async () => {
    const user = userEvent.setup();

    setupApiMocks({
      comments: [
        {
          commentId: 1,
          songId: 50,
          userId: 10,
          username: 'Charles',
          userJurisdictionName: 'Harlem',
          userPhotoUrl: null,
          content: 'Delete this comment',
          createdAt: new Date().toISOString(),
          replyCount: 0,
          replies: [],
        },
      ],
      count: { totalCount: 1, topLevelCount: 1 },
    });

    renderCommentSection();

    expect(await screen.findByText('Delete this comment')).toBeInTheDocument();

    const commentItem = screen
      .getByText('Delete this comment')
      .closest('.comment-item');

    const menuButton = commentItem.querySelector('.menu-trigger');

    await user.click(menuButton);
    await user.click(within(commentItem).getByText('Delete'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        method: 'delete',
        url: '/v1/comments/1?userId=10',
      });
    });

    expect(screen.queryByText('Delete this comment')).not.toBeInTheDocument();
  });
});