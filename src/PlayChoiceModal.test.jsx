// src/PlayChoiceModal.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, test, expect, vi, afterEach } from 'vitest';
import PlayChoiceModal from './PlayChoiceModal';
import { PlayerContext } from './context/playercontext';

const renderWithPlayerContext = (contextOverrides = {}) => {
  const defaultContext = {
    playChoiceModal: {
      open: true,
      pendingSong: {
        title: 'Midnight Drive',
        artist: 'Nova Flame',
        artwork: 'https://example.com/artwork.jpg',
      },
    },
    confirmPlayNow: vi.fn(),
    confirmAddToQueue: vi.fn(),
    cancelPlayChoice: vi.fn(),
  };

  const contextValue = {
    ...defaultContext,
    ...contextOverrides,
  };

  const utils = render(
    <PlayerContext.Provider value={contextValue}>
      <PlayChoiceModal />
    </PlayerContext.Provider>
  );

  return {
    ...utils,
    contextValue,
  };
};

describe('PlayChoiceModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders nothing when modal is not open', () => {
    const { container } = renderWithPlayerContext({
      playChoiceModal: {
        open: false,
        pendingSong: {
          title: 'Midnight Drive',
          artist: 'Nova Flame',
        },
      },
    });

    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when there is no pending song', () => {
    const { container } = renderWithPlayerContext({
      playChoiceModal: {
        open: true,
        pendingSong: null,
      },
    });

    expect(container.firstChild).toBeNull();
  });

  test('renders song title, artist, eyebrow text, and action buttons when open', () => {
    renderWithPlayerContext();

    expect(screen.getByText('Add to your queue')).toBeInTheDocument();
    expect(screen.getByText('Midnight Drive')).toBeInTheDocument();
    expect(screen.getByText('Nova Flame')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /play now/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /add to queue/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /cancel/i })
    ).toBeInTheDocument();
  });

  test('renders artwork when artwork is provided', () => {
    renderWithPlayerContext();

    const image = screen.getByAltText('Midnight Drive');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/artwork.jpg');
  });

  test('uses artworkUrl when artwork is missing', () => {
    renderWithPlayerContext({
      playChoiceModal: {
        open: true,
        pendingSong: {
          title: 'City Lights',
          artist: 'Echo Ray',
          artworkUrl: 'https://example.com/artwork-url.jpg',
        },
      },
    });

    const image = screen.getByAltText('City Lights');

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/artwork-url.jpg');
  });

  test('does not render artwork image when artwork and artworkUrl are missing', () => {
    renderWithPlayerContext({
      playChoiceModal: {
        open: true,
        pendingSong: {
          title: 'No Cover Song',
          artist: 'No Cover Artist',
        },
      },
    });

    expect(screen.queryByAltText('No Cover Song')).not.toBeInTheDocument();
  });

  test('uses fallback title and artist when song data is missing', () => {
    renderWithPlayerContext({
      playChoiceModal: {
        open: true,
        pendingSong: {},
      },
    });

    expect(screen.getByText('Untitled')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  test('uses artistData username when artist is missing', () => {
    renderWithPlayerContext({
      playChoiceModal: {
        open: true,
        pendingSong: {
          title: 'Hidden Artist Track',
          artistData: {
            username: 'Artist From Data',
          },
        },
      },
    });

    expect(screen.getByText('Hidden Artist Track')).toBeInTheDocument();
    expect(screen.getByText('Artist From Data')).toBeInTheDocument();
  });

  test('calls confirmPlayNow when Play Now button is clicked', () => {
    const confirmPlayNow = vi.fn();

    renderWithPlayerContext({
      confirmPlayNow,
    });

    fireEvent.click(screen.getByRole('button', { name: /play now/i }));

    expect(confirmPlayNow).toHaveBeenCalledTimes(1);
  });

  test('calls confirmAddToQueue when Add to Queue button is clicked', () => {
    const confirmAddToQueue = vi.fn();

    renderWithPlayerContext({
      confirmAddToQueue,
    });

    fireEvent.click(screen.getByRole('button', { name: /add to queue/i }));

    expect(confirmAddToQueue).toHaveBeenCalledTimes(1);
  });

  test('calls cancelPlayChoice when Cancel button is clicked', () => {
    const cancelPlayChoice = vi.fn();

    renderWithPlayerContext({
      cancelPlayChoice,
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(cancelPlayChoice).toHaveBeenCalledTimes(1);
  });

  test('calls cancelPlayChoice when backdrop is clicked', () => {
    const cancelPlayChoice = vi.fn();

    const { container } = renderWithPlayerContext({
      cancelPlayChoice,
    });

    const backdrop = container.querySelector('.pcm-backdrop');

    fireEvent.click(backdrop);

    expect(cancelPlayChoice).toHaveBeenCalledTimes(1);
  });

  test('does not call cancelPlayChoice when modal content is clicked', () => {
    const cancelPlayChoice = vi.fn();

    const { container } = renderWithPlayerContext({
      cancelPlayChoice,
    });

    const modal = container.querySelector('.pcm-modal');

    fireEvent.click(modal);

    expect(cancelPlayChoice).not.toHaveBeenCalled();
  });

  test('calls cancelPlayChoice when Escape key is pressed while open', () => {
    const cancelPlayChoice = vi.fn();

    renderWithPlayerContext({
      cancelPlayChoice,
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(cancelPlayChoice).toHaveBeenCalledTimes(1);
  });

  test('does not call cancelPlayChoice for non-Escape key presses', () => {
    const cancelPlayChoice = vi.fn();

    renderWithPlayerContext({
      cancelPlayChoice,
    });

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(cancelPlayChoice).not.toHaveBeenCalled();
  });

  test('adds and removes keydown listener when modal is open', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderWithPlayerContext();

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
  });

  test('does not add keydown listener when modal is closed', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderWithPlayerContext({
      playChoiceModal: {
        open: false,
        pendingSong: {
          title: 'Midnight Drive',
          artist: 'Nova Flame',
        },
      },
    });

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
  });
});