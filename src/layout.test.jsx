// src/layout.test.jsx
// =============================================================================
//
// Unit tests for the Layout shell component.
// Layout is presentational: it renders Header, Footer, and children inside
// the main content area.
//
// NOTE:
// backgroundImage is intentionally accepted by Layout for backwards
// compatibility, but it is no longer used to set --background-image.
// The global atmospheric gradient is now handled elsewhere.
//
// =============================================================================

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./header', () => ({
  default: () => <header data-testid="Header" />,
}));

vi.mock('./footer', () => ({
  default: () => <footer data-testid="Footer" />,
}));

vi.mock('./layout.scss', () => ({}));

import Layout from './layout';

describe('Layout', () => {
  it('renders Header', () => {
    render(
      <Layout>
        <p>content</p>
      </Layout>
    );

    expect(screen.getByTestId('Header')).toBeInTheDocument();
  });

  it('renders Footer', () => {
    render(
      <Layout>
        <p>content</p>
      </Layout>
    );

    expect(screen.getByTestId('Footer')).toBeInTheDocument();
  });

  it('renders children inside the main content area', () => {
    render(
      <Layout>
        <span>Hello world</span>
      </Layout>
    );

    const main = document.querySelector('.layout-content');

    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('Hello world');
  });

  it('applies the layout-container class to the root element', () => {
    render(
      <Layout>
        <p />
      </Layout>
    );

    expect(document.querySelector('.layout-container')).toBeInTheDocument();
  });

  it('accepts backgroundImage without applying an inline CSS variable', () => {
    render(
      <Layout backgroundImage="/images/hero.jpg">
        <p />
      </Layout>
    );

    const container = document.querySelector('.layout-container');

    expect(container).toBeInTheDocument();
    expect(container.style.getPropertyValue('--background-image')).toBe('');
  });

  it('does not set --background-image when backgroundImage is omitted', () => {
    render(
      <Layout>
        <p />
      </Layout>
    );

    const container = document.querySelector('.layout-container');

    expect(container).toBeInTheDocument();
    expect(container.style.getPropertyValue('--background-image')).toBe('');
  });

  it('renders multiple children correctly', () => {
    render(
      <Layout>
        <p data-testid="child-1">First</p>
        <p data-testid="child-2">Second</p>
      </Layout>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });

  it('renders no children when none are passed', () => {
    render(<Layout />);

    const main = document.querySelector('.layout-content');

    expect(main).toBeInTheDocument();
    expect(main.childElementCount).toBe(0);
  });
});