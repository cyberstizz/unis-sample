// src/voteHistoryModal.test.jsx
// ★ item 11: rewritten against the CURRENT component contract. The old suite
//   targeted a retired API (useDummyData prop, "Vote History" title, single
//   "N votes cast" text node, asset-file dummy data) and had 3 failures on
//   pristine HEAD before this session's changes. The component is now purely
//   presentational: it receives `votes` and renders them — no dummy data.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoteHistoryModal from './voteHistoryModal';

beforeEach(() => {
  vi.clearAllMocks();
});

const VOTES = [
  {
    voteId: 'real-1',
    targetType: 'artist',
    nomineeName: 'Real Artist',
    nomineeImage: 'https://example.com/artist.jpg',
    // NOTE: time components keep parsing in LOCAL time; the component also
    // hardens bare YYYY-MM-DD strings against the UTC day-shift (see below).
    voteDate: '2026-04-15T12:00:00',
    interval: 'week',
  },
  {
    voteId: 'real-2',
    targetType: 'song',
    nomineeName: 'Real Song',
    nomineeImage: '/uploads/song.jpg',
    voteDate: '2026-03-02T12:00:00',
    interval: 'month',
  },
];

describe('VoteHistoryModal', () => {
  it('does not render when show is false', () => {
    render(<VoteHistoryModal show={false} onClose={vi.fn()} votes={VOTES} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the header with the vote count', () => {
    render(<VoteHistoryModal show onClose={vi.fn()} votes={VOTES} />);
    expect(screen.getByRole('heading', { name: /vote history/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/votes cast/i)).toBeInTheDocument();
  });

  it('uses the singular label for exactly one vote', () => {
    render(<VoteHistoryModal show onClose={vi.fn()} votes={[VOTES[0]]} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/^vote cast$/i)).toBeInTheDocument();
  });

  it('renders vote rows with names, types, dates, and interval labels', () => {
    render(<VoteHistoryModal show onClose={vi.fn()} votes={VOTES} />);

    expect(screen.getByText('Real Artist')).toBeInTheDocument();
    expect(screen.getByText('Real Song')).toBeInTheDocument();
    expect(screen.getByText('Artist')).toBeInTheDocument();
    expect(screen.getByText('Song')).toBeInTheDocument();
    expect(screen.getByText('4/15/26')).toBeInTheDocument();
    expect(screen.getByText('3/02/26')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();

    const artistImage = screen.getByAltText('Real Artist');
    const songImage = screen.getByAltText('Real Song');
    expect(artistImage).toHaveAttribute('src', 'https://example.com/artist.jpg');
    // relative paths go through buildUrl
    expect(songImage.getAttribute('src')).toContain('/uploads/song.jpg');
  });

  it('does not shift bare YYYY-MM-DD dates back a day in western timezones', () => { // ★ item 11
    render(
      <VoteHistoryModal
        show
        onClose={vi.fn()}
        votes={[{ ...VOTES[0], voteId: 'bare-date', voteDate: '2026-04-15' }]}
      />,
    );
    expect(screen.getByText('4/15/26')).toBeInTheDocument();
  });

  it('shows the empty state when there are no votes', () => {
    render(<VoteHistoryModal show onClose={vi.fn()} votes={[]} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('No votes yet')).toBeInTheDocument();
    expect(screen.getByText(/Go support your favorite artists and songs/i)).toBeInTheDocument();
  });

  it('uses fallback text and placeholder when vote data is missing', () => {
    const votes = [
      {
        voteId: 'missing-data',
        targetType: 'song',
        nomineeName: '',
        nomineeImage: null,
        voteDate: '2026-01-09T12:00:00',
        interval: undefined,
      },
    ];

    render(<VoteHistoryModal show onClose={vi.fn()} votes={votes} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Song')).toBeInTheDocument();
    expect(screen.getByText('1/09/26')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(document.querySelector('.nominee-placeholder')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<VoteHistoryModal show onClose={onClose} votes={VOTES} />);
    await user.click(document.querySelector('.vote-history-modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<VoteHistoryModal show onClose={onClose} votes={VOTES} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<VoteHistoryModal show onClose={onClose} votes={VOTES} />);
    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
});