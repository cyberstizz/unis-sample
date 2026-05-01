// src/Footer.test.jsx
//
// Unit tests for the Footer. Footer is purely presentational —
// four legal links + a dynamic copyright year.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./footer.scss', () => ({}));

import Footer from './footer';

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );

describe('Footer', () => {

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Links
  // =========================================================================
  describe('legal links', () => {
    it.each([
      ['Privacy Policy',     '/privacy'],
      ['Terms of Use',       '/terms'],
      ['Cookie Policy',      '/cookie'],
      ['Report Infringement', '/report'],
    ])('renders the "%s" link pointing to %s', (label, href) => {
      renderFooter();
      const link = screen.getByRole('link', { name: label });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe(href);
    });

    it('renders exactly four links', () => {
      renderFooter();
      expect(screen.getAllByRole('link')).toHaveLength(4);
    });

    it('renders three "|" separators between links', () => {
      renderFooter();
      const separators = document.querySelectorAll('.footer-separator');
      expect(separators).toHaveLength(3);
      separators.forEach((sep) => expect(sep.textContent).toBe('|'));
    });
  });

  // =========================================================================
  // Copyright
  // =========================================================================
  describe('copyright', () => {
    it('shows the current year', () => {
      renderFooter();
      const year = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${year} Unis`))).toBeInTheDocument();
    });

    it('updates the year dynamically (verified via fake timers)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2030-06-15T00:00:00Z'));
      renderFooter();
      expect(screen.getByText(/© 2030 Unis/)).toBeInTheDocument();
    });

    it('includes the "All rights reserved." tagline', () => {
      renderFooter();
      expect(screen.getByText(/All rights reserved\./)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Structure
  // =========================================================================
  it('renders inside a <footer> element with the layout-footer class', () => {
    const { container } = renderFooter();
    const footer = container.querySelector('footer.layout-footer');
    expect(footer).toBeInTheDocument();
  });
});