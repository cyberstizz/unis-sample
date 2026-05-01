import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import CookiePolicy from './cookiePolicy';

vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

describe('CookiePolicy', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByText('Cookie Policy')).toBeInTheDocument();
  });

  it('shows the effective date', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByText(/November 30, 2025/)).toBeInTheDocument();
  });

  it('renders all 8 section headings', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    const headings = [
      '1. What Are Cookies and Similar Technologies?',
      '2. How Unis Uses Cookies & Storage',
      '3. How to Manage Cookies & Storage',
      '4. Do Not Track',
      '5. International Users',
      '6. Data Retention',
      '7. Updates to This Policy',
      '8. Contact Us',
    ];
    headings.forEach(heading => {
      expect(screen.getByText(heading)).toBeInTheDocument();
    });
  });

  it('renders the Privacy Policy internal link', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: /privacy policy/i });
    links.forEach(link => expect(link).toHaveAttribute('href', '/privacy-policy'));
  });

  it('renders the Google Analytics opt-out links with correct href', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: /https:\/\/tools\.google\.com\/dlpage\/gaoptout/i });
    links.forEach(link =>
      expect(link).toHaveAttribute('href', 'https://tools.google.com/dlpage/gaoptout')
    );
  });

  it('renders the Google privacy policy link', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /privacy policy/i, hidden: false });
    expect(link).toBeInTheDocument();
  });

  it('discloses JWT storage in local storage', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByText(/JSON Web Tokens \(JWT\)/i)).toBeInTheDocument();
  });

  it('mentions Google Analytics', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getAllByText(/Google Analytics/i).length).toBeGreaterThan(0);
  });

  it('mentions Cloudflare for CDN', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByText(/Cloudflare/i)).toBeInTheDocument();
  });

  it('discloses that clearing local storage logs you out', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getAllByText(/log you out/i).length).toBeGreaterThan(0);
  });

  it('covers GDPR for EU/UK users', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByText(/GDPR/i)).toBeInTheDocument();
  });

  it('covers CCPA for California users', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByText(/CCPA/i)).toBeInTheDocument();
  });

  it('renders the browser management instructions for all four browsers', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    ['Chrome', 'Firefox', 'Safari', 'Edge'].forEach(browser => {
      expect(screen.getByText(new RegExp(browser, 'i'))).toBeInTheDocument();
    });
  });

  it('renders privacy and support email links with correct hrefs', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    const privacyLinks = screen.getAllByRole('link', { name: /privacy@unis\.com/i });
    privacyLinks.forEach(link => expect(link).toHaveAttribute('href', 'mailto:privacy@unis.com'));

    const supportLinks = screen.getAllByRole('link', { name: /support@unis\.com/i });
    supportLinks.forEach(link => expect(link).toHaveAttribute('href', 'mailto:support@unis.com'));
  });

  it('renders the footer copyright notice', () => {
    render(<MemoryRouter><CookiePolicy /></MemoryRouter>);
    expect(screen.getByText(/© 2025 Unis Inc\./i)).toBeInTheDocument();
  });
});