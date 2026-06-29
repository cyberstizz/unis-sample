import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
const API = 'http://localhost:8080/api';
const reset = () => { localStorage.clear(); sessionStorage.clear(); cacheService.clearAll(); server.resetHandlers(); };
import FanbaseFunnel from './fanbaseFunnle';
const fb = `${API}/v1/artist-analytics/artist/:id/fanbase`;
describe('FanbaseFunnel (smoke)', () => {
  beforeEach(reset); afterEach(() => { cleanup(); cacheService.clearAll(); });
  it('mounts without crashing on a minimal payload', async () => {
    server.use(http.get(fb, () => HttpResponse.json({})));
    const { container } = renderWithProviders(<FanbaseFunnel artistId="a1" artistName="Test" />, { as: 'artist' });
    await waitFor(() => expect(container.querySelector('.fanbase')).toBeInTheDocument());
  });
  it('shows an error when fanbase analytics fail', async () => {
    server.use(http.get(fb, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<FanbaseFunnel artistId="a1" artistName="Test" />, { as: 'artist' });
    expect(await screen.findByText(/Could not load your fanbase analytics/i)).toBeInTheDocument();
  });
});