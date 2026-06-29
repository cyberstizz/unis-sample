import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
const API = 'http://localhost:8080/api';
const reset = () => { localStorage.clear(); sessionStorage.clear(); cacheService.clearAll(); server.resetHandlers(); };
import VoteHistorySection from './VoteHistorySection';
describe('VoteHistorySection (smoke)', () => {
  beforeEach(reset); afterEach(() => { cleanup(); cacheService.clearAll(); });
  it('shows the empty state when there are no votes', async () => {
    server.use(http.get(`${API}/v1/vote/history`, () => HttpResponse.json([])));
    renderWithProviders(<VoteHistorySection userId="u1" />, { as: 'artist' });
    expect(await screen.findByText(/No votes yet/i)).toBeInTheDocument();
  });
  it('shows an error when the fetch fails', async () => {
    server.use(http.get(`${API}/v1/vote/history`, () => HttpResponse.json({}, { status: 500 })));
    renderWithProviders(<VoteHistorySection userId="u1" />, { as: 'artist' });
    expect(await screen.findByText(/Could not load your vote history/i)).toBeInTheDocument();
  });
});