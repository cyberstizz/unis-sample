// src/main.test.jsx
//
// Unit tests for main.jsx — the application entry point.
// Covers root creation, StrictMode wrapping, and DOM mounting.
// Does NOT import main.jsx directly to avoid side-effects during test setup.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

describe('main.jsx', () => {
  let rootMock;
  let createRootSpy;

  beforeEach(() => {
    // Setup a fake DOM element for React to mount into
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);

    // Mock createRoot to return a controllable root object
    rootMock = { render: vi.fn() };
    createRootSpy = vi.fn(() => rootMock);

    vi.doMock('react-dom/client', () => ({
      createRoot: createRootSpy,
    }));
  });

  afterEach(() => {
    vi.doUnmock('react-dom/client');
    document.body.innerHTML = '';
    vi.resetModules();
  });

  it('calls createRoot with the #root DOM element', async () => {
    await import('./main.jsx');
    expect(createRootSpy).toHaveBeenCalledTimes(1);
    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('root'));
  });

  it('renders inside StrictMode', async () => {
    await import('./main.jsx');
    expect(rootMock.render).toHaveBeenCalledTimes(1);

    const renderedArg = rootMock.render.mock.calls[0][0];
    expect(renderedArg.type).toBe(React.StrictMode);
  });

  it('renders App as the child of StrictMode', async () => {
    await import('./main.jsx');
    const strictModeChildren = rootMock.render.mock.calls[0][0].props.children;
    expect(strictModeChildren.type.name).toBe('App');
  });
});