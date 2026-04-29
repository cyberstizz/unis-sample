// src/deleteAccountWizard.test.jsx
//
// Comprehensive test suite for DeleteAccountWizard — the two-step modal that
// permanently deletes a UNIS artist account.
//
// Component behaviour summary:
//   • Returns null when show=false
//   • Step 1 — warning screen:
//       - Red AlertTriangle icon + "Delete Account Forever" heading
//       - Bullet list of consequences
//       - "I Understand — Continue" advances to step 2
//       - Close (×) calls onClose
//   • Step 2 — final confirmation:
//       - Three guards that ALL must pass before "Delete Forever" enables:
//           1. typedName === user.username
//           2. typedNameBackwards === username reversed
//           3. confirmed checkbox is checked
//       - Each username input shows green border when correct, red when not
//       - "Delete Forever" disabled until canProceed is true
//       - "Delete Forever" disabled while loading
//       - Happy path: DELETE /v1/users/me → logout() → navigate('/login')
//                     → alert success message
//       - Error path: alert failure message, logout/navigate NOT called
//       - Cancel button calls onClose
//       - Close (×) calls onClose
//
// Mocking notes:
//   • vi.spyOn(axiosModule, 'apiCall') — standard suite pattern
//   • useAuth mocked via vi.mock — provides { user, logout }
//   • useNavigate mocked via vi.mock — captures navigate calls
//   • window.alert spied throughout

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

// ---------------------------------------------------------------------------
// MOCKS — must be declared before any imports that use them
// ---------------------------------------------------------------------------
vi.mock('./deleteAccountWizard.scss', () => ({}));

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'testartist' },
    logout: mockLogout,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import DeleteAccountWizard from './deleteAccountWizard';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const USERNAME = 'testartist';
const USERNAME_BACKWARDS = 'tsitratset';  // 'testartist' reversed

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// RENDER HELPER
// ---------------------------------------------------------------------------
function renderWizard({
  show = true,
  onClose = vi.fn(),
} = {}) {
  return {
    onClose,
    ...render(
      <DeleteAccountWizard show={show} onClose={onClose} />
    ),
  };
}

// Helper — advance from step 1 to step 2
async function advanceToStep2(user) {
  await user.click(screen.getByRole('button', { name: /i understand.*continue/i }));
  expect(screen.getByText(/final confirmation required/i)).toBeInTheDocument();
}

// Helper — fill all three step-2 guards correctly
async function fillAllGuards(user) {
  const [usernameInput, backwardsInput] = screen.getAllByRole('textbox');
  await user.type(usernameInput, USERNAME);
  await user.type(backwardsInput, USERNAME_BACKWARDS);
  await user.click(screen.getByRole('checkbox'));
}

// ===========================================================================
// VISIBILITY GATING
// ===========================================================================
describe('DeleteAccountWizard — visibility', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderWizard({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders the overlay when show=true', () => {
    renderWizard();
    expect(document.querySelector('.upload-wizard-overlay')).not.toBeNull();
  });

  it('renders the wizard panel inside the overlay', () => {
    renderWizard();
    expect(document.querySelector('.upload-wizard')).not.toBeNull();
  });
});

// ===========================================================================
// STEP 1 — WARNING SCREEN
// ===========================================================================
describe('DeleteAccountWizard — step 1 warning screen', () => {
  it('shows the "Delete Account Forever" heading', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: /delete account forever/i })).toBeInTheDocument();
  });

  it('shows the permanent-action warning copy', () => {
    renderWizard();
    expect(screen.getByText(/permanent and cannot be undone/i)).toBeInTheDocument();
  });

  it('lists all five consequence bullet points', () => {
    renderWizard();
    expect(screen.getByText(/all your songs and videos will be deleted/i)).toBeInTheDocument();
    expect(screen.getByText(/all votes and awards will be removed/i)).toBeInTheDocument();
    expect(screen.getByText(/your profile will disappear from leaderboards/i)).toBeInTheDocument();
    expect(screen.getByText(/supporters will no longer see your content/i)).toBeInTheDocument();
    expect(screen.getByText(/there is no recovery.*ever/i)).toBeInTheDocument();
  });

  it('renders the "I Understand — Continue" button', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /i understand.*continue/i })).toBeInTheDocument();
  });

  it('does NOT show the step-2 confirmation fields on step 1', () => {
    renderWizard();
    expect(screen.queryByText(/final confirmation required/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('"I Understand — Continue" advances to step 2', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
  });

  it('renders the close (×) button on step 1', () => {
    renderWizard();
    expect(document.querySelector('.close-button')).not.toBeNull();
  });

  it('close (×) on step 1 calls onClose', async () => {
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(document.querySelector('.close-button'));
    expect(onClose).toHaveBeenCalled();
  });
});

// ===========================================================================
// STEP 2 — FORM RENDERING
// ===========================================================================
describe('DeleteAccountWizard — step 2 rendering', () => {
  it('shows the final-confirmation intro copy', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByText(/final confirmation required/i)).toBeInTheDocument();
  });

  it('renders the username text input', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByPlaceholderText(USERNAME)).toBeInTheDocument();
  });

  it('renders the backwards text input with the reversed username as placeholder', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByPlaceholderText(USERNAME_BACKWARDS)).toBeInTheDocument();
  });

  it('renders the confirmation checkbox', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders the checkbox label with the destruction copy', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByText(/permanently delete my account and all my data/i)).toBeInTheDocument();
  });

  it('renders the "Delete Forever" button', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeInTheDocument();
  });

  it('renders the Cancel button on step 2', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders the close (×) button on step 2', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(document.querySelector('.close-button')).not.toBeNull();
  });
});

// ===========================================================================
// STEP 2 — canProceed GUARD LOGIC
// ===========================================================================
describe('DeleteAccountWizard — canProceed guard', () => {
  it('"Delete Forever" is disabled when all fields are empty', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('"Delete Forever" stays disabled with only correct username typed', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [usernameInput] = screen.getAllByRole('textbox');
    await user.type(usernameInput, USERNAME);
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('"Delete Forever" stays disabled with correct username + correct backwards but no checkbox', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [usernameInput, backwardsInput] = screen.getAllByRole('textbox');
    await user.type(usernameInput, USERNAME);
    await user.type(backwardsInput, USERNAME_BACKWARDS);
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('"Delete Forever" stays disabled with checkbox + correct backwards but wrong username', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [usernameInput, backwardsInput] = screen.getAllByRole('textbox');
    await user.type(usernameInput, 'wrongname');
    await user.type(backwardsInput, USERNAME_BACKWARDS);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('"Delete Forever" stays disabled with checkbox + correct username but wrong backwards', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [usernameInput, backwardsInput] = screen.getAllByRole('textbox');
    await user.type(usernameInput, USERNAME);
    await user.type(backwardsInput, 'nottherightanswer');
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('"Delete Forever" stays disabled with only the checkbox checked', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('"Delete Forever" becomes enabled when all three guards pass', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    expect(screen.getByRole('button', { name: /delete forever/i })).not.toBeDisabled();
  });

  it('unchecking the checkbox after all guards pass re-disables "Delete Forever"', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('checkbox')); // uncheck
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });

  it('clearing the username after all guards pass re-disables "Delete Forever"', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    const [usernameInput] = screen.getAllByRole('textbox');
    await user.clear(usernameInput);
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
  });
});

// ===========================================================================
// STEP 2 — INPUT BORDER COLOUR FEEDBACK
// ===========================================================================
describe('DeleteAccountWizard — input border colour feedback', () => {
  it('username input has red border when value does not match username', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [usernameInput] = screen.getAllByRole('textbox');
    await user.type(usernameInput, 'wrongname');
    expect(usernameInput.style.borderColor).toBe('#dc3545');
  });

  it('username input has green border when value matches username exactly', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [usernameInput] = screen.getAllByRole('textbox');
    await user.type(usernameInput, USERNAME);
    expect(usernameInput.style.borderColor).toBe('#28a745');
  });

  it('backwards input has red border when value does not match', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [, backwardsInput] = screen.getAllByRole('textbox');
    await user.type(backwardsInput, 'wrongbackwards');
    expect(backwardsInput.style.borderColor).toBe('#dc3545');
  });

  it('backwards input has green border when value matches the reversed username', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [, backwardsInput] = screen.getAllByRole('textbox');
    await user.type(backwardsInput, USERNAME_BACKWARDS);
    expect(backwardsInput.style.borderColor).toBe('#28a745');
  });

  it('username input starts with a red border (empty ≠ username)', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const [usernameInput] = screen.getAllByRole('textbox');
    expect(usernameInput.style.borderColor).toBe('#dc3545');
  });
});

// ===========================================================================
// SUBMIT — HAPPY PATH
// ===========================================================================
describe('DeleteAccountWizard — submit happy path', () => {
  it('fires DELETE /v1/users/me', async () => {
    let capturedConfig = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedConfig = config;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => {
      expect(capturedConfig.method).toBe('delete');
      expect(capturedConfig.url).toBe('/v1/users/me');
    });
  });

  it('calls logout() after a successful delete', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  it('navigates to /login after a successful delete', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  it('alerts the success message after a successful delete', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringMatching(/permanently deleted/i)
      )
    );
  });

  it('shows "Deleting..." and disables the button while in-flight', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      await pending;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting\.\.\./i })).toBeDisabled();
    });
    resolveFn();
  });

  it('only makes one API call per submit', async () => {
    let callCount = 0;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      callCount++;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(callCount).toBe(1));
  });

  it('logout is called before navigate', async () => {
    const callOrder = [];
    mockLogout.mockImplementation(() => callOrder.push('logout'));
    mockNavigate.mockImplementation(() => callOrder.push('navigate'));
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(callOrder).toEqual(['logout', 'navigate']));
  });
});

// ===========================================================================
// SUBMIT — ERROR PATH
// ===========================================================================
describe('DeleteAccountWizard — submit error path', () => {
  it('alerts the failure message when the API throws', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('Server error'));

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringMatching(/failed to delete account/i)
      )
    );
  });

  it('does NOT call logout() when the API throws', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('boom'));

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(mockLogout).not.toHaveBeenCalled());
  });

  it('does NOT navigate when the API throws', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('boom'));

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
  });

  it('re-enables "Delete Forever" after a failed request', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('Flaky'));

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await fillAllGuards(user);
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete forever/i })).not.toBeDisabled();
    });
  });

  it('does not call the API at all when canProceed is false', async () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    // Only fill username — backwards and checkbox still wrong/empty
    const [usernameInput] = screen.getAllByRole('textbox');
    await user.type(usernameInput, USERNAME);
    // Button should be disabled; verify no API call
    expect(screen.getByRole('button', { name: /delete forever/i })).toBeDisabled();
    expect(apiSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// CLOSE / CANCEL BEHAVIOUR
// ===========================================================================
describe('DeleteAccountWizard — close and cancel', () => {
  it('close (×) on step 2 calls onClose', async () => {
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(document.querySelector('.close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel button on step 2 calls onClose', async () => {
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel does not trigger an API call', async () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it('Cancel does not call logout or navigate', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});