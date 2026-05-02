// src/pages/__tests__/ModerationQueue.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';   // ← Add this import
import ModerationQueue from './ModerationQueue';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeDmcaClaim = (overrides = {}) => ({
  claimId: 'claim-abc123',
  claimantName: 'John Doe',
  infringingUrl: 'https://unis.com/song/123',
  status: 'submitted',
  createdAt: '2026-04-20T10:00:00Z',
  ...overrides,
});

const makeComment = (overrides = {}) => ({
  commentId: 'comm-456',
  content: 'This song is fire 🔥',
  createdAt: '2026-04-25T15:30:00Z',
  user: { username: 'musicfan42' },
  song: { title: 'Summer Vibes' },
  ...overrides,
});

const makeClaimsResponse = (claims = []) => ({ data: { content: claims } });
const makeCommentsResponse = (comments = []) => ({ data: { content: comments } });

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
});

// Updated render helper with AuthProvider
const renderWithProviders = () => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin/moderation']}>
        <Routes>
          <Route path="/admin/moderation" element={<ModerationQueue />} />
          <Route path="/admin/moderation/dmca/:claimId" element={<div>Claim Detail Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('ModerationQueue', () => {

  it('renders DMCA Claims tab by default and shows loading', () => {
    apiCall.mockResolvedValue(makeClaimsResponse());
    renderWithProviders();
    expect(screen.getByText('Moderation Queue')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('switches between DMCA and Comments tabs', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce(makeClaimsResponse())
      .mockResolvedValueOnce(makeCommentsResponse());

    renderWithProviders();

    await user.click(screen.getByText('Comments'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/admin/comments/recent',
        method: 'get',
      });
    });
  });

  it('fetches and displays DMCA claims', async () => {
    const claims = [makeDmcaClaim(), makeDmcaClaim({ claimantName: 'Jane Smith' })];

    apiCall.mockResolvedValue(makeClaimsResponse(claims));
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('navigates to claim detail on row click', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makeClaimsResponse([makeDmcaClaim()]));

    renderWithProviders();

    await waitFor(() => screen.getByText('John Doe'));
    await user.click(screen.getByText('John Doe'));

    await waitFor(() =>
      expect(screen.getByText('Claim Detail Page')).toBeInTheDocument()
    );
  });

  it('deletes a comment successfully', async () => {
    const user = userEvent.setup();
    const comment = makeComment();

    apiCall
      .mockResolvedValueOnce(makeCommentsResponse([comment]))
      .mockResolvedValueOnce({});

    renderWithProviders();
    await user.click(screen.getByText('Comments'));

    await waitFor(() => screen.getByText('Delete'));
    await user.click(screen.getByText('Delete'));

    expect(window.confirm).toHaveBeenCalled();
    expect(apiCall).toHaveBeenCalledWith({
      url: `/v1/admin/comments/${comment.commentId}`,
      method: 'delete',
      data: { reason: 'Removed by moderator' },
    });
  });

  it('shows empty state messages', async () => {
    apiCall.mockResolvedValue(makeClaimsResponse([]));
    renderWithProviders();

    await waitFor(() =>
      expect(screen.getByText('No claims found.')).toBeInTheDocument()
    );
  });
});