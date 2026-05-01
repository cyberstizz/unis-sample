// src/deleteSongModal.test.jsx
//
// Unit tests for DeleteSongModal — a presentational modal that confirms
// destructive song deletion. Covers visibility, content rendering,
// interaction handlers, and the loading/disabled state.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import DeleteSongModal from './deleteSongModal';

describe('DeleteSongModal', () => {
  const defaultProps = {
    show: true,
    songTitle: 'Test Song Title',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isDeleting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Visibility
  // ========================================================================
  describe('visibility', () => {
    it('renders nothing when show is false', () => {
      const { container } = renderWithProviders(
        <DeleteSongModal {...defaultProps} show={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders the modal when show is true', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} />);
      expect(screen.getByRole('heading', { name: /Delete Song\?/i })).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Content rendering
  // ========================================================================
  describe('content', () => {
    it('displays the song title in the confirmation message', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} songTitle="My Cool Track" />);
      expect(screen.getByText(/My Cool Track/)).toBeInTheDocument();
    });

    it('shows the permanent removal warning', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} />);
      expect(
        screen.getByText(/This action cannot be undone\. The song will be permanently removed/i)
      ).toBeInTheDocument();
    });

    it('renders Cancel and Delete buttons', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Song/i })).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Interactions
  // ========================================================================
  describe('interactions', () => {
    it('calls onCancel when the close (X) button is clicked', async () => {
      const onCancel = vi.fn();
      renderWithProviders(<DeleteSongModal {...defaultProps} onCancel={onCancel} />);

      const user = userEvent.setup();
      const closeBtn = screen.getByRole('button', { name: /close/i });
      await user.click(closeBtn);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when the Cancel button is clicked', async () => {
      const onCancel = vi.fn();
      renderWithProviders(<DeleteSongModal {...defaultProps} onCancel={onCancel} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when the Delete Song button is clicked', async () => {
      const onConfirm = vi.fn();
      renderWithProviders(<DeleteSongModal {...defaultProps} onConfirm={onConfirm} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Delete Song/i }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // Deleting state
  // ========================================================================
  describe('deleting state', () => {
    it('disables the close (X) button while deleting', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} isDeleting={true} />);
      expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
    });

    it('disables the Cancel button while deleting', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} isDeleting={true} />);
      expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeDisabled();
    });

    it('disables the Delete button while deleting', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} isDeleting={true} />);
      expect(screen.getByRole('button', { name: /Deleting/i })).toBeDisabled();
    });

    it('shows "Deleting..." text on the delete button while deleting', () => {
      renderWithProviders(<DeleteSongModal {...defaultProps} isDeleting={true} />);
      expect(screen.getByRole('button', { name: /Deleting\.\.\./i })).toBeInTheDocument();
    });

    it('does not call onConfirm when clicked while deleting', async () => {
      const onConfirm = vi.fn();
      renderWithProviders(
        <DeleteSongModal {...defaultProps} onConfirm={onConfirm} isDeleting={true} />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Deleting\.\.\./i }));

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});