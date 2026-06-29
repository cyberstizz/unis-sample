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
});