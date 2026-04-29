// src/Onboarding.test.jsx
//
// Test suite for Onboarding — a 5-step wizard prototype.
//
// NOTE: This file appears to be an early prototype. No API calls fire,
// validation is a placeholder, and the role-based skip in step 4 mutates
// state during render. Tests cover what the file actually does today, not
// what it's meant to become. When this gets wired up to a real API, expect
// to overhaul this test file.
//
// Covers:
//   • Initial render: logo, step 1 content, progress dots
//   • Step 1: invite code input updates state
//   • Step 2: role radio selection
//   • Step 3: email, password, address inputs
//   • Step 4: support-artist select (listener path)
//   • Step 4 → 5: artist role skips support step
//   • Step 5: confirmation showing role
//   • Next/Back navigation
//   • Progress dot active states reflect current step
//   • Privacy Policy footer
//   • Back button hidden on step 1
//   • Next button doesn't advance past step 5

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// MOCKS — CSS, asset
// ---------------------------------------------------------------------------
vi.mock('./onboarding.scss', () => ({}));
vi.mock('./assets/unisLogo.svg', () => ({ default: 'unisLogo.svg' }));

import Onboarding from './onboarding';

// ===========================================================================
// INITIAL RENDER
// ===========================================================================
describe('Onboarding — initial render', () => {
  it('renders the UNIS logo', () => {
    render(<Onboarding />);
    expect(screen.getByAltText(/UNIS Logo/i)).toBeInTheDocument();
  });

  it('starts on step 1 with the Welcome heading', () => {
    render(<Onboarding />);
    expect(screen.getByRole('heading', { name: /welcome to unis/i })).toBeInTheDocument();
  });

  it('shows step 1 description copy referencing Harlem', () => {
    render(<Onboarding />);
    expect(screen.getByText(/harlem music revolution/i)).toBeInTheDocument();
  });

  it('renders 5 progress dots', () => {
    render(<Onboarding />);
    const dots = document.querySelectorAll('.progress-dot');
    expect(dots).toHaveLength(5);
  });

  it('marks only the first progress dot as active on mount', () => {
    render(<Onboarding />);
    const dots = document.querySelectorAll('.progress-dot');
    expect(dots[0].classList.contains('active')).toBe(true);
    expect(dots[1].classList.contains('active')).toBe(false);
    expect(dots[2].classList.contains('active')).toBe(false);
  });

  it('hides the Back button on step 1', () => {
    render(<Onboarding />);
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });

  it('renders the Next button on step 1', () => {
    render(<Onboarding />);
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });

  it('renders the Privacy Policy footer', () => {
    render(<Onboarding />);
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
  });

  it('renders the invite code input on step 1', () => {
    render(<Onboarding />);
    expect(screen.getByPlaceholderText(/invite code/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 1 — INVITE CODE
// ===========================================================================
describe('Onboarding — step 1 (invite code)', () => {
  it('updates the invite code input value as user types', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    const input = screen.getByPlaceholderText(/invite code/i);
    await user.type(input, 'HARLEM2026');
    expect(input.value).toBe('HARLEM2026');
  });

  it('clicking Next advances to step 2', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { name: /choose your role/i })).toBeInTheDocument();
  });

  it('clicking Next activates the second progress dot', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    const dots = document.querySelectorAll('.progress-dot');
    expect(dots[0].classList.contains('active')).toBe(true);
    expect(dots[1].classList.contains('active')).toBe(true);
    expect(dots[2].classList.contains('active')).toBe(false);
  });
});

// ===========================================================================
// STEP 2 — ROLE SELECTION
// ===========================================================================
describe('Onboarding — step 2 (role selection)', () => {
  async function advanceToStep2(user) {
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
  }

  it('renders both Listener and Artist radio cards', async () => {
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByLabelText(/listener/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist/i)).toBeInTheDocument();
  });

  it('Listener radio can be selected', async () => {
    const user = userEvent.setup();
    await advanceToStep2(user);
    const listenerRadio = screen.getByLabelText(/listener/i);
    await user.click(listenerRadio);
    expect(listenerRadio).toBeChecked();
  });

  it('Artist radio can be selected', async () => {
    const user = userEvent.setup();
    await advanceToStep2(user);
    const artistRadio = screen.getByLabelText(/artist/i);
    await user.click(artistRadio);
    expect(artistRadio).toBeChecked();
  });

  it('selecting Artist deselects Listener (mutually exclusive)', async () => {
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByLabelText(/listener/i));
    await user.click(screen.getByLabelText(/artist/i));
    expect(screen.getByLabelText(/listener/i)).not.toBeChecked();
    expect(screen.getByLabelText(/artist/i)).toBeChecked();
  });

  it('Back button is now visible on step 2', async () => {
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
  });

  it('Back button returns to step 1', async () => {
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /welcome to unis/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 3 — SIGNUP FIELDS
// ===========================================================================
describe('Onboarding — step 3 (signup)', () => {
  async function advanceToStep3(user) {
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 1→2
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 2→3
  }

  it('renders the Sign Up heading', async () => {
    const user = userEvent.setup();
    await advanceToStep3(user);
    expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument();
  });

  it('renders email, password, and address inputs', async () => {
    const user = userEvent.setup();
    await advanceToStep3(user);
    expect(screen.getByPlaceholderText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/harlem address/i)).toBeInTheDocument();
  });

  it('password input has type="password"', async () => {
    const user = userEvent.setup();
    await advanceToStep3(user);
    const pw = screen.getByPlaceholderText(/^password$/i);
    expect(pw.type).toBe('password');
  });

  it('email input accepts text', async () => {
    const user = userEvent.setup();
    await advanceToStep3(user);
    const email = screen.getByPlaceholderText(/^email$/i);
    await user.type(email, 'charles@unis.app');
    expect(email.value).toBe('charles@unis.app');
  });

  it('password input accepts text', async () => {
    const user = userEvent.setup();
    await advanceToStep3(user);
    const pw = screen.getByPlaceholderText(/^password$/i);
    await user.type(pw, 'secret123');
    expect(pw.value).toBe('secret123');
  });

  it('address input accepts text', async () => {
    const user = userEvent.setup();
    await advanceToStep3(user);
    const addr = screen.getByPlaceholderText(/harlem address/i);
    await user.type(addr, '123 Lenox Ave');
    expect(addr.value).toBe('123 Lenox Ave');
  });

  it('progress dots show steps 1, 2, 3 active', async () => {
    const user = userEvent.setup();
    await advanceToStep3(user);
    const dots = document.querySelectorAll('.progress-dot');
    expect(dots[0].classList.contains('active')).toBe(true);
    expect(dots[1].classList.contains('active')).toBe(true);
    expect(dots[2].classList.contains('active')).toBe(true);
    expect(dots[3].classList.contains('active')).toBe(false);
  });
});

// ===========================================================================
// STEP 4 — SUPPORT ARTIST (LISTENER PATH)
// ===========================================================================
describe('Onboarding — step 4 (listener: support artist)', () => {
  async function advanceToStep4AsListener(user) {
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 1→2
    await user.click(screen.getByLabelText(/listener/i));
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 2→3
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 3→4
  }

  it('renders the Support an Artist heading', async () => {
    const user = userEvent.setup();
    await advanceToStep4AsListener(user);
    expect(screen.getByRole('heading', { name: /support an artist/i })).toBeInTheDocument();
  });

  it('renders the 50% revenue callout', async () => {
    const user = userEvent.setup();
    await advanceToStep4AsListener(user);
    expect(screen.getByText(/50% of your revenue supports them/i)).toBeInTheDocument();
  });

  it('renders an artist select with default placeholder option', async () => {
    const user = userEvent.setup();
    await advanceToStep4AsListener(user);
    const select = document.querySelector('select[name="supportedArtistId"]');
    expect(select).not.toBeNull();
    expect(screen.getByText(/search artists/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 4 — ARTIST PATH (skip-to-step-5)
// ===========================================================================
describe('Onboarding — step 4 (artist skips support)', () => {
  // The component's role-skip is broken (mutates state during render):
  //   if (formData.role === 'artist') { setStep(5); return null; }
  // This works in practice because React schedules the setState update and
  // re-renders, but it triggers React warnings and is fragile.
  it('artist role skips step 4 and lands on step 5 confirmation', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 1→2
    await user.click(screen.getByLabelText(/artist/i));
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 2→3
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 3→4 (auto skips to 5)
    expect(await screen.findByRole('heading', { name: /confirm & join/i })).toBeInTheDocument();
  });

  it('artist confirmation shows their selected role', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByLabelText(/artist/i));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText(/role: artist/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 5 — CONFIRMATION
// ===========================================================================
describe('Onboarding — step 5 (confirmation)', () => {
  async function advanceToStep5AsListener(user) {
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 1→2
    await user.click(screen.getByLabelText(/listener/i));
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 2→3
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 3→4
    await user.click(screen.getByRole('button', { name: /^next$/i })); // 4→5
  }

  it('renders the Confirm & Join heading', async () => {
    const user = userEvent.setup();
    await advanceToStep5AsListener(user);
    expect(screen.getByRole('heading', { name: /confirm & join/i })).toBeInTheDocument();
  });

  it('listener confirmation shows their role', async () => {
    const user = userEvent.setup();
    await advanceToStep5AsListener(user);
    expect(screen.getByText(/role: listener/i)).toBeInTheDocument();
  });

  it('shows "N/A" for role when no role was selected', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    // Click Next 4 times without ever selecting a role.
    // Since formData.role is '', the step 4 listener path renders.
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/role: n\/a/i)).toBeInTheDocument();
  });

  it('all 5 progress dots are active on step 5', async () => {
    const user = userEvent.setup();
    await advanceToStep5AsListener(user);
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot) => expect(dot.classList.contains('active')).toBe(true));
  });

  it('clicking Next on step 5 does not advance further', async () => {
    const user = userEvent.setup();
    await advanceToStep5AsListener(user);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    // Still on step 5
    expect(screen.getByRole('heading', { name: /confirm & join/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// BACK NAVIGATION
// ===========================================================================
describe('Onboarding — back navigation', () => {
  it('Back from step 3 returns to step 2', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /choose your role/i })).toBeInTheDocument();
  });

  it('Back from step 5 returns to step 4 (for listener)', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByLabelText(/listener/i));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /support an artist/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// FORM STATE PERSISTENCE
// ===========================================================================
describe('Onboarding — form state persistence', () => {
  it('preserves invite code value when navigating forward and back', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    const input = screen.getByPlaceholderText(/invite code/i);
    await user.type(input, 'CODE123');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByPlaceholderText(/invite code/i).value).toBe('CODE123');
  });

  it('preserves selected role when navigating back to step 2', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByLabelText(/artist/i));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByLabelText(/artist/i)).toBeChecked();
  });
});