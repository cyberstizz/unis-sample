// src/utils/plusStatus.test.jsx
//
// Unis Plus status, shared by every ad slot and the Plus page.
//
// What matters:
//   • a paying member must not be shown ads, and a non-member must be — so the
//     answer has to follow whoever is signed in
//   • every ad slot on a page shares ONE request, cached for five minutes
//   • if the status check fails, ads show (never a blank page) and it asks
//     again after 30 seconds
//   • after checkout, refreshPlusStatus() updates every slot at once

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import * as axiosModule from '../components/axiosInstance';
import {
  DEFAULT_PLUS_STATUS,
  fetchPlusStatus,
  refreshPlusStatus,
  peekPlusStatus,
  usePlusStatus,
  __resetPlusStatusCache,
} from './plusStatus';

const MEMBER = {
  available: true, priceCents: 499, plus: true, status: 'active',
  paidThrough: '2026-12-17', cancelAtPeriodEnd: false,
};
const NOT_MEMBER = { available: true, priceCents: 499, plus: false };

let apiSpy;

beforeEach(() => {
  __resetPlusStatusCache();
  localStorage.clear();
  localStorage.setItem('token', 'token-A');
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: MEMBER });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('plusStatus — fetching', () => {
  it('asks the server, bypassing the response cache', async () => {
    await fetchPlusStatus();
    expect(apiSpy).toHaveBeenCalledWith({ method: 'get', url: '/v1/plus/status', useCache: false });
  });

  it('returns the status', async () => {
    expect(await fetchPlusStatus()).toEqual(MEMBER);
  });

  it('fills in the fields the server left out', async () => {
    apiSpy.mockResolvedValue({ data: NOT_MEMBER });
    expect(await fetchPlusStatus()).toEqual({ ...DEFAULT_PLUS_STATUS, ...NOT_MEMBER });
  });

  it.each([null, undefined, '', 'oops', {}, { available: true }])(
    'treats an unusable answer (%p) as "not Plus"', async (data) => {
      apiSpy.mockResolvedValue({ data });
      expect(await fetchPlusStatus()).toEqual(DEFAULT_PLUS_STATUS);
    });

  it('the default is: not available, not Plus', () => {
    expect(DEFAULT_PLUS_STATUS).toMatchObject({ available: false, plus: false, priceCents: null });
    expect(Object.isFrozen(DEFAULT_PLUS_STATUS)).toBe(true);
  });
});

describe('plusStatus — one request, shared and cached', () => {
  it('several callers at once share a single request', async () => {
    const results = await Promise.all([fetchPlusStatus(), fetchPlusStatus(), fetchPlusStatus()]);
    expect(apiSpy).toHaveBeenCalledTimes(1);
    results.forEach((r) => expect(r).toEqual(MEMBER));
  });

  it('a second call within five minutes uses the cached answer', async () => {
    vi.useFakeTimers();
    await fetchPlusStatus();
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    await fetchPlusStatus();
    expect(apiSpy).toHaveBeenCalledTimes(1);
  });

  it('asks again after five minutes', async () => {
    vi.useFakeTimers();
    await fetchPlusStatus();
    vi.advanceTimersByTime(5 * 60 * 1000);
    await fetchPlusStatus();
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('peekPlusStatus is null before the first fetch and the status after', async () => {
    expect(peekPlusStatus()).toBeNull();
    await fetchPlusStatus();
    expect(peekPlusStatus()).toEqual(MEMBER);
  });
});

describe('plusStatus — follows whoever is signed in', () => {
  it('signing in as someone else asks again — one account\'s Plus never carries over', async () => {
    await fetchPlusStatus();
    localStorage.setItem('token', 'token-B');
    apiSpy.mockResolvedValue({ data: NOT_MEMBER });

    expect(peekPlusStatus()).toBeNull();
    expect((await fetchPlusStatus()).plus).toBe(false);
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('signing out asks again as a guest', async () => {
    await fetchPlusStatus();
    localStorage.removeItem('token');
    apiSpy.mockResolvedValue({ data: { plus: false } });

    expect(peekPlusStatus()).toBeNull();
    expect((await fetchPlusStatus()).plus).toBe(false);
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });

  it('guests are answered too', async () => {
    localStorage.clear();
    apiSpy.mockResolvedValue({ data: { plus: false, available: true, priceCents: 499 } });
    expect(await fetchPlusStatus()).toMatchObject({ plus: false, available: true });
  });
});

describe('plusStatus — when the check fails', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('answers "not Plus" so ads still show, instead of throwing', async () => {
    apiSpy.mockRejectedValue(new Error('down'));
    await expect(fetchPlusStatus()).resolves.toEqual(DEFAULT_PLUS_STATUS);
  });

  it('keeps the last good answer for this account rather than dropping a member to ads', async () => {
    await fetchPlusStatus();
    apiSpy.mockRejectedValue(new Error('down'));
    expect(await refreshPlusStatus()).toEqual(MEMBER);
  });

  it('asks again after 30 seconds, not five minutes', async () => {
    vi.useFakeTimers();
    apiSpy.mockRejectedValue(new Error('down'));
    await fetchPlusStatus();

    vi.advanceTimersByTime(29 * 1000);
    await fetchPlusStatus();
    expect(apiSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    apiSpy.mockResolvedValue({ data: MEMBER });
    expect(await fetchPlusStatus()).toEqual(MEMBER);
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });
});

describe('plusStatus — refresh after checkout', () => {
  it('always asks the server, even with a fresh cached answer', async () => {
    apiSpy.mockResolvedValue({ data: NOT_MEMBER });
    await fetchPlusStatus();

    apiSpy.mockResolvedValue({ data: MEMBER });
    expect((await refreshPlusStatus()).plus).toBe(true);
    expect(apiSpy).toHaveBeenCalledTimes(2);
    expect(peekPlusStatus().plus).toBe(true);
  });
});

describe('plusStatus — usePlusStatus hook', () => {
  const Slot = ({ name, userKey }) => {
    const { status, loaded } = usePlusStatus(userKey);
    return <div data-testid={name}>{loaded ? (status.plus ? 'plus' : 'ads') : 'loading'}</div>;
  };

  it('starts unloaded with the default, then reports the status', async () => {
    render(<Slot name="a" userKey="u1" />);
    expect(screen.getByTestId('a')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('plus'));
  });

  it('every slot on the page shares one request', async () => {
    render(<><Slot name="a" userKey="u1" /><Slot name="b" userKey="u1" /><Slot name="c" userKey="u1" /></>);
    await waitFor(() => expect(screen.getByTestId('c')).toHaveTextContent('plus'));
    expect(apiSpy).toHaveBeenCalledTimes(1);
  });

  it('a slot mounted later starts from the cached answer — no flash of ads', async () => {
    await fetchPlusStatus();
    render(<Slot name="late" userKey="u1" />);
    expect(screen.getByTestId('late')).toHaveTextContent('plus');
  });

  it('a refresh updates every mounted slot at once', async () => {
    apiSpy.mockResolvedValue({ data: NOT_MEMBER });
    render(<><Slot name="a" userKey="u1" /><Slot name="b" userKey="u1" /></>);
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('ads'));

    apiSpy.mockResolvedValue({ data: MEMBER });
    await act(async () => { await refreshPlusStatus(); });
    expect(screen.getByTestId('a')).toHaveTextContent('plus');
    expect(screen.getByTestId('b')).toHaveTextContent('plus');
  });

  it('re-asks when the signed-in user changes', async () => {
    const { rerender } = render(<Slot name="a" userKey="u1" />);
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('plus'));

    localStorage.setItem('token', 'token-B');
    apiSpy.mockResolvedValue({ data: NOT_MEMBER });
    rerender(<Slot name="a" userKey="u2" />);
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('ads'));
  });

  it('an unmounted slot is not updated', async () => {
    const { unmount } = render(<Slot name="a" userKey="u1" />);
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('plus'));
    unmount();
    await expect(refreshPlusStatus()).resolves.toBeDefined();
  });
});
