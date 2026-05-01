import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import TermsOfService from './termsOfService';

vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

describe('TermsOfService', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByText('Unis Terms of Service')).toBeInTheDocument();
  });

  it('shows the effective date', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByText(/March 31, 2026/)).toBeInTheDocument();
  });

  it('renders all 16 section headings', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    const headings = [
      '1. Eligibility',
      '2. Accounts & Security',
      '3. User Content & Licenses',
      '4. Acceptable Use',
      '5. Voting & Awards',
      '6. Third-Party Services',
      '7. Mobile Application & App Store Terms',
      '8. Copyright Policy (DMCA)',
      '9. Disclaimers & Limitation of Liability',
      '10. Indemnification',
      '11. Artist Revenue Sharing',
      '12. Supporter Ad Revenue Program',
      '13. Referral Income Program',
      '14. Jurisdiction Expansion',
      '15. Governing Law & Dispute Resolution',
      '16. Changes & Miscellaneous',
    ];
    headings.forEach(heading => {
      expect(screen.getByText(heading)).toBeInTheDocument();
    });
  });

  it('renders the 60% artist revenue share figure', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByText(/sixty percent \(60%\)/i)).toBeInTheDocument();
  });

  it('renders the referral tier percentages', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByText(/Level 1.*10%/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 2.*5%/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 3.*2%/i)).toBeInTheDocument();
  });

  it('renders the DMCA agent contact info', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByText(/Charles Lamb, DMCA Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/53 Lincoln Avenue/i)).toBeInTheDocument();
  });

  it('renders support email link with correct href', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: /support@unis.com/i });
    links.forEach(link => expect(link).toHaveAttribute('href', 'mailto:support@unis.com'));
  });

  it('renders dmca email link with correct href', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    const links = screen.getAllByRole('link', { name: /dmca@unis.com/i });
    links.forEach(link => expect(link).toHaveAttribute('href', 'mailto:dmca@unis.com'));
  });

  it('renders the $50 minimum payout threshold', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getAllByText(/\$50\.00/i).length).toBeGreaterThan(0);
  });

  it('renders the Harlem jurisdiction reference', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getAllByText(/Harlem/i).length).toBeGreaterThan(0);
  });

  it('renders the footer copyright notice', () => {
    render(<MemoryRouter><TermsOfService /></MemoryRouter>);
    expect(screen.getByText(/© 2026 EasyCode LLC/i)).toBeInTheDocument();
  });
});