// src/artistCard.test.jsx

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import ArtistCard from './artistCard';

describe('ArtistCard', () => {
  let requestAnimationFrameSpy;
  let cancelAnimationFrameSpy;

  const mockArtist = {
    username: 'Nova Flame',
    jurisdictionName: 'Brooklyn',
    photoUrl: 'https://example.com/nova.jpg',
    score: 12500,
  };

  beforeEach(() => {
    vi.useFakeTimers();

    vi.spyOn(performance, 'now').mockReturnValue(0);

    requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        return setTimeout(() => callback(1000), 16);
      });

    cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => clearTimeout(id));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('renders the artist username and jurisdiction name', () => {
    render(
      <ArtistCard
        artist={mockArtist}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
      />
    );

    expect(screen.getByText('Nova Flame')).toBeInTheDocument();
    expect(screen.getByText('Brooklyn')).toBeInTheDocument();
  });

  test('renders "Your Area" when jurisdictionName is missing', () => {
    const artistWithoutJurisdiction = {
      ...mockArtist,
      jurisdictionName: undefined,
    };

    render(
      <ArtistCard
        artist={artistWithoutJurisdiction}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
      />
    );

    expect(screen.getByText('Your Area')).toBeInTheDocument();
  });

  test('renders the formatted score when score exists', () => {
    render(
      <ArtistCard
        artist={mockArtist}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
      />
    );

    expect(screen.getByText('12,500')).toBeInTheDocument();
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  test('does not render the score badge when score is null', () => {
    const artistWithoutScore = {
      ...mockArtist,
      score: null,
    };

    render(
      <ArtistCard
        artist={artistWithoutScore}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
      />
    );

    expect(screen.queryByText('12,500')).not.toBeInTheDocument();
    expect(screen.queryByText('★')).not.toBeInTheDocument();
  });

  test('calls onPress when the main card is clicked', () => {
    const onPress = vi.fn();

    render(
      <ArtistCard
        artist={mockArtist}
        onPress={onPress}
        onViewPress={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Nova Flame'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('calls onViewPress when the VIEW button is clicked', () => {
    const onViewPress = vi.fn();

    render(
      <ArtistCard
        artist={mockArtist}
        onPress={vi.fn()}
        onViewPress={onViewPress}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    expect(onViewPress).toHaveBeenCalledTimes(1);
  });

  test('clicking the VIEW button does not trigger onPress', () => {
    const onPress = vi.fn();
    const onViewPress = vi.fn();

    render(
      <ArtistCard
        artist={mockArtist}
        onPress={onPress}
        onViewPress={onViewPress}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /view/i }));

    expect(onViewPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('uses the artist photoUrl as the background image', () => {
    const { container } = render(
      <ArtistCard
        artist={mockArtist}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
      />
    );

    const photoDiv = Array.from(container.querySelectorAll('div')).find((div) =>
      div.style.backgroundImage.includes(mockArtist.photoUrl)
    );

    expect(photoDiv).toBeTruthy();
    expect(photoDiv.style.backgroundImage).toContain(mockArtist.photoUrl);
  });

  test('renders a monogram instead of a stock photo when photoUrl is missing', () => {
    const artistWithoutPhoto = {
      ...mockArtist,
      photoUrl: undefined,
    };

    const { container } = render(
      <ArtistCard
        artist={artistWithoutPhoto}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
      />
    );

    const photoDiv = container.querySelector('.ac-photo--monogram');

    expect(photoDiv).toBeTruthy();
    // No remote stock photo is requested for a photoless artist.
    expect(photoDiv.style.backgroundImage).not.toContain('picsum.photos');
    expect(container.querySelector('.ac-monogram')?.textContent)
      .toBe(mockArtist.username.charAt(0).toUpperCase());
  });

  // The entrance and the pulse are CSS animations now (ArtistCard.scss). The
  // only thing the component sets inline is the per-card stagger delay.
  test.each([
    [0, '0ms'],
    [1, '150ms'],
    [4, '600ms'],
  ])('staggers the entrance by 150ms per card (index %i → %s)', (index, delay) => {
    const { container } = render(
      <ArtistCard
        artist={mockArtist}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
        index={index}
      />
    );

    expect(container.firstChild).toHaveClass('ac-wrap');
    expect(container.firstChild.style.animationDelay).toBe(delay);
  });

  test('defaults to no delay when no index is given', () => {
    const { container } = render(
      <ArtistCard artist={mockArtist} onPress={vi.fn()} onViewPress={vi.fn()} />
    );

    expect(container.firstChild.style.animationDelay).toBe('0ms');
  });

  test('runs no JavaScript animation loop — nothing to leak on unmount', () => {
    const { unmount } = render(
      <ArtistCard
        artist={mockArtist}
        onPress={vi.fn()}
        onViewPress={vi.fn()}
      />
    );

    expect(requestAnimationFrameSpy).not.toHaveBeenCalled();

    unmount();

    expect(cancelAnimationFrameSpy).not.toHaveBeenCalled();
  });
});