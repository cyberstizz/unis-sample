import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
const API = 'http://localhost:8080/api';
const reset = () => { localStorage.clear(); sessionStorage.clear(); cacheService.clearAll(); server.resetHandlers(); };
import DemographicsSection from './dempgraphicsSection';
const pie = `${API}/v1/artist-analytics/artist/:id/demographics/top-jurisdictions`;
const ter = `${API}/v1/artist-analytics/artist/:id/demographics/territory`;
describe('DemographicsSection (smoke)', () => {
  beforeEach(() => { reset(); server.use(http.get(pie, () => HttpResponse.json([])), http.get(ter, () => HttpResponse.json([]))); });
  afterEach(() => { cleanup(); cacheService.clearAll(); });
  it('renders the demographics section', async () => {
    renderWithProviders(<DemographicsSection artistId="a1" />, { as: 'artist' });
    expect(await screen.findByText('Demographics')).toBeInTheDocument();
  });
  it('shows an error when top areas fail to load', async () => {
    server.use(http.get(pie, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<DemographicsSection artistId="a1" />, { as: 'artist' });
    expect(await screen.findByText(/Could not load your top areas/i)).toBeInTheDocument();
  });
});