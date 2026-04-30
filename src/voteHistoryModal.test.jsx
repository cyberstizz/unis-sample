// src/voteHistoryModal.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoteHistoryModal from './voteHistoryModal';

vi.mock('./assets/rapperphotoOne.jpg', () => ({
  default: 'rapper-one.jpg',
}));

vi.mock('./assets/rapperphototwo.jpg', () => ({
  default: 'rapper-two.jpg',
}));

vi.mock('./assets/rapperphotothree.jpg', () => ({
  default: 'rapper-three.jpg',
}));

vi.mock('./assets/rapperphotofour.jpg', () => ({
  default: 'rapper-four.jpg',
}));

vi.mock('./assets/songartworkONe.jpeg', () => ({
  default: 'song-art-one.jpeg',
}));

vi.mock('./assets/songartworktwo.jpeg', () => ({
  default: 'song-art-two.jpeg',
}));

vi.mock('./assets/songartworkthree.jpeg', () => ({
  default: 'song-art-three.jpeg',
}));

vi.mock('./assets/songartworkfour.jpeg', () => ({
  default: 'song-art-four.jpeg',
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VoteHistoryModal', () => {
  it('does not render when show is false', () => {
    render(
      <VoteHistoryModal
        show={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Vote History')).not.toBeInTheDocument();
  });

  it('renders dummy vote history by default', () => {
    render(
      <VoteHistoryModal
        show={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Vote History')).toBeInTheDocument();
    expect(screen.getByText('8 votes cast')).toBeInTheDocument();

    expect(screen.getByText('Harlem Heat')).toBeInTheDocument();
    expect(screen.getByText('Streets of 125th')).toBeInTheDocument();
    expect(screen.getByText('Apollo Dreams')).toBeInTheDocument();

    expect(screen.getAllByText('Artist').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Song').length).toBeGreaterThan(0);
  });

  it('renders real votes when useDummyData is false', () => {
    const votes = [
      {
        voteId: 'real-1',
        targetType: 'artist',
        nomineeName: 'Real Artist',
        nomineeImage: 'https://example.com/artist.jpg',
        voteDate: '2026-04-15',
        interval: 'week',
      },
      {
        voteId: 'real-2',
        targetType: 'song',
        nomineeName: 'Real Song',
        nomineeImage: '/uploads/song.jpg',
        voteDate: '2026-03-02',
        interval: 'month',
      },
    ];

    render(
      <VoteHistoryModal
        show={true}
        onClose={vi.fn()}
        votes={votes}
        useDummyData={false}
      />
    );

    expect(screen.getByText('2 votes cast')).toBeInTheDocument();

    expect(screen.getByText('Real Artist')).toBeInTheDocument();
    expect(screen.getByText('Real Song')).toBeInTheDocument();

    expect(screen.getByText('4/15/26')).toBeInTheDocument();
    expect(screen.getByText('3/02/26')).toBeInTheDocument();

    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();

    const artistImage = screen.getByAltText('Real Artist');
    const songImage = screen.getByAltText('Real Song');

    expect(artistImage).toHaveAttribute('src', 'https://example.com/artist.jpg');
    expect(songImage.getAttribute('src')).toContain('/uploads/song.jpg');
  });

  it('shows empty state when there are no votes and dummy data is disabled', () => {
    render(
      <VoteHistoryModal
        show={true}
        onClose={vi.fn()}
        votes={[]}
        useDummyData={false}
      />
    );

    expect(screen.getByText('0 votes cast')).toBeInTheDocument();
    expect(screen.getByText('No votes yet')).toBeInTheDocument();
    expect(
      screen.getByText('Go support your favorite artists and songs!')
    ).toBeInTheDocument();
  });

  it('uses fallback text and placeholder when vote data is missing', () => {
    const votes = [
      {
        voteId: 'missing-data',
        targetType: 'song',
        nomineeName: '',
        nomineeImage: null,
        voteDate: '2026-01-09',
        interval: undefined,
      },
    ];

    render(
      <VoteHistoryModal
        show={true}
        onClose={vi.fn()}
        votes={votes}
        useDummyData={false}
      />
    );

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Song')).toBeInTheDocument();
    expect(screen.getByText('1/09/26')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();

    const placeholder = document.querySelector('.nominee-placeholder');
    expect(placeholder).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <VoteHistoryModal
        show={true}
        onClose={onClose}
      />
    );

    const overlay = document.querySelector('.vote-history-modal-overlay');

    await user.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <VoteHistoryModal
        show={true}
        onClose={onClose}
      />
    );

    const closeButton = document.querySelector('.close-button');

    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <VoteHistoryModal
        show={true}
        onClose={onClose}
      />
    );

    const modal = document.querySelector('.vote-history-modal');

    await user.click(modal);

    expect(onClose).not.toHaveBeenCalled();
  });
});