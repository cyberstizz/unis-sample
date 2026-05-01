import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ReportInfringement from './reportInfringement';

vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/full legal name/i), { target: { value: 'John Doe' } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'john@example.com' } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '5551234567' } });
  fireEvent.change(screen.getByLabelText(/are you the copyright owner/i), { target: { value: 'owner' } });
  fireEvent.change(screen.getByLabelText(/describe the copyrighted work/i), { target: { value: 'Summer Nights by Jane Doe' } });
  fireEvent.change(screen.getByLabelText(/url of infringing content/i), { target: { value: 'https://unis.com/song/12345' } });
  fireEvent.change(screen.getByLabelText(/electronic signature/i), { target: { value: 'John Doe' } });
  fireEvent.click(screen.getByLabelText(/good faith belief/i));
  fireEvent.click(screen.getByLabelText(/information in this notification is accurate/i));
  fireEvent.click(screen.getByLabelText(/filing a fraudulent/i));
};

beforeEach(() => vi.clearAllMocks());

// ─── rendering ───────────────────────────────────────────────────────────────

describe('rendering', () => {
  it('renders the page header', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    expect(screen.getByText('Report Copyright Infringement')).toBeInTheDocument();
    expect(screen.getByText('DMCA Takedown Notice')).toBeInTheDocument();
  });

  it('renders all six form sections', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    expect(screen.getByText('1. Your Contact Information')).toBeInTheDocument();
    expect(screen.getByText('2. Copyright Ownership')).toBeInTheDocument();
    expect(screen.getByText('3. Copyrighted Work')).toBeInTheDocument();
    expect(screen.getByText('4. Infringing Material on Unis')).toBeInTheDocument();
    expect(screen.getByText('5. Statements (Required by Law)')).toBeInTheDocument();
    expect(screen.getByText('6. Signature')).toBeInTheDocument();
  });

  it('pre-fills the date field with today\'s date', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    const today = new Date().toISOString().split('T')[0];
    expect(screen.getByLabelText(/^date/i)).toHaveValue(today);
  });

  it('renders the DMCA warning about false filings', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    expect(screen.getByText(/filing a false or fraudulent dmca/i)).toBeInTheDocument();
  });

  it('renders counter-notice and alternative contact sections', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    expect(screen.getByText('Counter-Notification')).toBeInTheDocument();
    expect(screen.getByText('Alternative Contact Methods')).toBeInTheDocument();
  });
});

// ─── form interaction ────────────────────────────────────────────────────────

describe('form interaction', () => {
  it('updates text fields on change', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    const input = screen.getByLabelText(/full legal name/i);
    fireEvent.change(input, { target: { value: 'Jane Smith' } });
    expect(input).toHaveValue('Jane Smith');
  });

  it('toggles checkboxes', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    const checkbox = screen.getByLabelText(/good faith belief/i);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('updates the copyright owner dropdown', () => {
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    const select = screen.getByLabelText(/are you the copyright owner/i);
    fireEvent.change(select, { target: { value: 'agent' } });
    expect(select).toHaveValue('agent');
  });
});

// ─── submission — missing checkboxes ─────────────────────────────────────────

describe('submission — missing statement checkboxes', () => {
  it('alerts and does not submit when checkboxes are not all checked', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    global.fetch = vi.fn();
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);

    // Fill fields but skip checkboxes
    fireEvent.change(screen.getByLabelText(/full legal name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText(/are you the copyright owner/i), { target: { value: 'owner' } });
    fireEvent.change(screen.getByLabelText(/describe the copyrighted work/i), { target: { value: 'A song' } });
    fireEvent.change(screen.getByLabelText(/url of infringing content/i), { target: { value: 'https://unis.com/song/1' } });
    fireEvent.change(screen.getByLabelText(/electronic signature/i), { target: { value: 'John Doe' } });

    fireEvent.click(screen.getByRole('button', { name: /submit dmca notice/i }));

    expect(alertMock).toHaveBeenCalledWith('Please check all required statements to submit your DMCA notice.');
    expect(global.fetch).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });
});

// ─── successful submission ───────────────────────────────────────────────────

describe('successful submission', () => {
  it('shows the success state with the submitted email', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /submit dmca notice/i }));

    expect(await screen.findByText('✓ DMCA Notice Submitted')).toBeInTheDocument();
    expect(screen.getByText(/john@example.com/i)).toBeInTheDocument();
  });

  it('sends the correct payload to /v1/dmca/submit', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /submit dmca notice/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/dmca/submit'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"claimantName":"John Doe"'),
        })
      );
    });
  });

  it('shows a reference number in the success state', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /submit dmca notice/i }));

    expect(await screen.findByText(/DMCA-/)).toBeInTheDocument();
  });
});

// ─── failed submission ───────────────────────────────────────────────────────

describe('failed submission', () => {
  it('alerts the user and does not show success state on API failure', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /submit dmca notice/i }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining('Failed to submit DMCA notice')
      );
    });
    expect(screen.queryByText('✓ DMCA Notice Submitted')).not.toBeInTheDocument();

    alertMock.mockRestore();
  });

  it('alerts on network error', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    render(<MemoryRouter><ReportInfringement /></MemoryRouter>);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /submit dmca notice/i }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining('Failed to submit DMCA notice')
      );
    });

    alertMock.mockRestore();
  });
});