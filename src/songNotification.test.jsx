// src/songNotification.test.jsx

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import SongNotification from './songNotification';
import { PlayerContext } from './context/playercontext';

const renderWithPlayerContext = (contextValue) => {
  return render(
    <PlayerContext.Provider value={contextValue}>
      <SongNotification />
    </PlayerContext.Provider>
  );
};

describe('SongNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test('renders nothing when currentMedia is null', () => {
    const { container } = renderWithPlayerContext({
      currentMedia: null,
    });

    expect(container.firstChild).toBeNull();
  });

  test('renders song notification when currentMedia exists', () => {
    renderWithPlayerContext({
      currentMedia: {
        title: 'Midnight Drive',
        artist: 'Nova Flame',
        artwork: 'https://example.com/artwork.jpg',
      },
    });

    expect(screen.getByText('Midnight Drive')).toBeInTheDocument();
    expect(screen.getByText('Nova Flame')).toBeInTheDocument();
    expect(screen.getByAltText('Artwork')).toBeInTheDocument();
  });

  test('uses currentMedia artwork for the image src', () => {
    renderWithPlayerContext({
      currentMedia: {
        title: 'Midnight Drive',
        artist: 'Nova Flame',
        artwork: 'https://example.com/artwork.jpg',
      },
    });

    const artwork = screen.getByAltText('Artwork');

    expect(artwork).toHaveAttribute('src', 'https://example.com/artwork.jpg');
  });

  test('uses currentMedia artwork for the ambient background image', () => {
    const { container } = renderWithPlayerContext({
      currentMedia: {
        title: 'Midnight Drive',
        artist: 'Nova Flame',
        artwork: 'https://example.com/artwork.jpg',
      },
    });

    const ambientBg = container.querySelector('.ambient-bg');

    expect(ambientBg).toBeInTheDocument();
    expect(ambientBg.style.backgroundImage).toContain(
      'https://example.com/artwork.jpg'
    );
  });

  test('uses default artwork when currentMedia artwork is missing', () => {
    renderWithPlayerContext({
      currentMedia: {
        title: 'Midnight Drive',
        artist: 'Nova Flame',
      },
    });

    const artwork = screen.getByAltText('Artwork');

    expect(artwork).toHaveAttribute('src', '/default-artwork.png');
  });

  test('renders fallback title and artist when missing', () => {
    renderWithPlayerContext({
      currentMedia: {},
    });

    expect(screen.getByText('Unknown Track')).toBeInTheDocument();
    expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
  });

  test('hides notification after 3 seconds', () => {
    renderWithPlayerContext({
      currentMedia: {
        title: 'Midnight Drive',
        artist: 'Nova Flame',
        artwork: 'https://example.com/artwork.jpg',
      },
    });

    expect(screen.getByText('Midnight Drive')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Midnight Drive')).not.toBeInTheDocument();
  });

  test('clears timeout when component unmounts', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    const { unmount } = renderWithPlayerContext({
      currentMedia: {
        title: 'Midnight Drive',
        artist: 'Nova Flame',
        artwork: 'https://example.com/artwork.jpg',
      },
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});