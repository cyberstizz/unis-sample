// src/main.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

describe('main.jsx', () => {
  let rootMock;
  let createRootSpy;

  beforeEach(() => {
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);

    rootMock = { render: vi.fn() };
    createRootSpy = vi.fn(() => rootMock);

    vi.doMock('react-dom/client', () => ({
      createRoot: createRootSpy,
    }));

    vi.doMock('./App.jsx', () => ({
      default: function App() { return null; },
    }));
  });

  afterEach(() => {
    vi.doUnmock('react-dom/client');
    vi.doUnmock('./App.jsx');
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