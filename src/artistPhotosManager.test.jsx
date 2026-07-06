import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
const API = 'http://localhost:8080/api';
const reset = () => { localStorage.clear(); sessionStorage.clear(); cacheService.clearAll(); server.resetHandlers(); };
import ArtistPhotosManager from './artistPhotosManager';
import userEvent from '@testing-library/user-event'; // ★ item 9
describe('ArtistPhotosManager (smoke)', () => {
  beforeEach(reset); afterEach(() => { cleanup(); cacheService.clearAll(); });
  it('renders the uploaded photos', async () => {
    server.use(http.get(`${API}/v1/users/:id/photos`, () => HttpResponse.json({ photos: [{ photoId: 'p1', photoUrl: '/uploads/a.jpg' }], max: 15 })));
    const { container } = renderWithProviders(<ArtistPhotosManager artistId="a1" />, { as: 'artist' });
    expect(await screen.findByText(/Add photos/i)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('.apm__tile img')).toBeInTheDocument());
  });
  it('shows an error when photos fail to load', async () => {
    server.use(http.get(`${API}/v1/users/:id/photos`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<ArtistPhotosManager artistId="a1" />, { as: 'artist' });
    expect(await screen.findByText(/Could not load your photos/i)).toBeInTheDocument();
  });

  // ★ item 9: deletion is gated behind an explicit confirmation
  describe('delete confirmation', () => {
    const installOnePhoto = () => {
      let deleteCalls = 0;
      server.use(
        http.get(`${API}/v1/users/:id/photos`, () =>
          HttpResponse.json({ photos: [{ photoId: 'p1', photoUrl: '/uploads/a.jpg' }], max: 15 })),
        http.delete(`${API}/v1/users/:id/photos/:photoId`, () => {
          deleteCalls += 1;
          return HttpResponse.json({});
        }),
      );
      return () => deleteCalls;
    };

    it('does NOT delete on the first tap — it asks first', async () => {
      const getDeleteCalls = installOnePhoto();
      const user = userEvent.setup();
      renderWithProviders(<ArtistPhotosManager artistId="a1" />, { as: 'artist' });
      await user.click(await screen.findByRole('button', { name: /Remove photo/i }));
      expect(await screen.findByText(/Remove this photo\?/i)).toBeInTheDocument();
      expect(getDeleteCalls()).toBe(0);
    });

    it('keeps the photo when the user cancels', async () => {
      const getDeleteCalls = installOnePhoto();
      const user = userEvent.setup();
      const { container } = renderWithProviders(<ArtistPhotosManager artistId="a1" />, { as: 'artist' });
      await user.click(await screen.findByRole('button', { name: /Remove photo/i }));
      await user.click(screen.getByRole('button', { name: /Keep/i }));
      expect(screen.queryByText(/Remove this photo\?/i)).not.toBeInTheDocument();
      expect(container.querySelector('.apm__tile img')).toBeInTheDocument();
      expect(getDeleteCalls()).toBe(0);
    });

    it('deletes the photo only after explicit confirmation', async () => {
      const getDeleteCalls = installOnePhoto();
      const user = userEvent.setup();
      const { container } = renderWithProviders(<ArtistPhotosManager artistId="a1" />, { as: 'artist' });
      await user.click(await screen.findByRole('button', { name: /Remove photo/i }));
      await user.click(screen.getByRole('button', { name: /^Delete$/i }));
      await waitFor(() => expect(container.querySelector('.apm__tile')).not.toBeInTheDocument());
      expect(getDeleteCalls()).toBe(1);
    });
  });
});