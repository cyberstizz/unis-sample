// src/test/setup.js
// Loaded once before every test file. Do global wiring here, not in individual tests.

import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

// ─── JSDOM doesn't implement these; polyfill so components don't crash ───
if (typeof window !== 'undefined') {
  // matchMedia (used by theme system + responsive components)
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  // IntersectionObserver (used by Framer Motion + lazy components)
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // ResizeObserver (used by recharts + layout components)
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Scroll-to (used by some wizards)
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();

  // HTMLMediaElement playback (the audio element — critical for Player tests)
  if (typeof window.HTMLMediaElement !== 'undefined') {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
  }
}

// ─── MSW lifecycle ───
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllTimers();
  vi.useRealTimers(); // Always restore real timers in case a test forgot
});
afterAll(() => server.close());

// ─── Timer default: real. Individual tests can opt into fake timers. ───
vi.useRealTimers();
