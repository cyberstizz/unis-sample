import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import PrivacyPolicy from './privacyPolicy';

vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

describe('PrivacyPolicy', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText('Unis Privacy Policy')).toBeInTheDocument();
  });

  it('shows the effective date', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/March 31, 2026/)).toBeInTheDocument();
  });

  it('renders all 10 section headings', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    const headings = [
      '1. Information We Collect',
      '2. How We Use Your Information',
      '3. How We Share Your Information',
      '4. Local Storage & Tracking',
      '5. Data Retention & Your Rights',
      '6. Children\'s Privacy',
      '7. International Transfers',
      '8. Security',
      '9. Changes to This Policy',
      '10. Contact Us',
    ];
    headings.forEach(heading => {
      expect(screen.getByText(heading)).toBeInTheDocument();
    });
  });

  it('renders the EasyCode LLC company name and address', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getAllByText(/EasyCode LLC/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/53 Lincoln Avenue/i).length).toBeGreaterThan(0);
  });

  it('renders privacy email link with correct href', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: /privacy@unis.com/i });
    links.forEach(link => expect(link).toHaveAttribute('href', 'mailto:privacy@unis.com'));
  });

  it('renders support email link with correct href', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: /support@unis.com/i });
    links.forEach(link => expect(link).toHaveAttribute('href', 'mailto:support@unis.com'));
  });

  it('discloses Stripe as the payment processor', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getAllByText(/Stripe/i).length).toBeGreaterThan(0);
  });

  it('discloses Railway as the backend host', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/Railway/i)).toBeInTheDocument();
  });

  it('mentions Cloudflare R2 for media storage', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/Cloudflare R2/i)).toBeInTheDocument();
  });

  it('states that data is not sold', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/We do not sell your data/i)).toBeInTheDocument();
  });

  it('references COPPA and the age-13 minimum', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/COPPA/i)).toBeInTheDocument();
    expect(screen.getByText(/under 13/i)).toBeInTheDocument();
  });

  it('mentions bcrypt password hashing in the security section', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/bcrypt/i)).toBeInTheDocument();
  });

  it('renders the footer copyright notice', () => {
    render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
    expect(screen.getByText(/© 2026 EasyCode LLC/i)).toBeInTheDocument();
  });
});