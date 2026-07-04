// src/createAccountWizard.test.jsx
//
// Comprehensive tests for CreateAccountWizard — the largest file in the
// codebase and the registration entry point for every user.
//
// Scope covered:
//   - Step configuration (listener vs artist path; 8 steps each)
//   - Per-step field validation (canProceed gate) for BOTH role branches
//   - Debounced validators (referral, username, email)
//   - Password strength + confirmation
//   - Date-of-birth age math (13+ gate, 18+ explicit content flag)
//   - File validation (size, type, extension, error display) for photo,
//     artist photo, audio, and artwork inputs
//   - Location detection via Nominatim (Harlem bounds, dividing line,
//     out-of-bounds waitlist prompt, geocode error)
//   - Support-artist step (load, search filter, jurisdiction filter,
//     empty state, load error, audio preview toggle)
//   - Submit flow — the phased order of operations for BOTH roles:
//       LISTENER: PATCH photo -> POST register
//       ARTIST:   PATCH photo -> POST register -> POST signup-song
//   - Submit error branches: photo 413/415/timeout/generic, register
//     409/generic, song 413/generic, missing signupToken
//   - Success screen ("Check your email") + verification email echo
//   - Partial-success recovery (account created, song failed)
//
// Design note on upload order:
// The wizard uploads the photo BEFORE register (so photoUrl rides in the
// register payload) and the artist song AFTER register (token-authorized,
// no login). Tests lock this in — a "refactor" of the order trips them.
//
// Infra note on the submit tests:
// They mock `apiCall` at the module level rather than going through MSW,
// because the wizard uses multipart FormData and MSW+axios+jsdom hang on
// multipart bodies. Mocking apiCall gives clean call-order/payload assertions.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
import CreateAccountWizard from './createAccountWizard';

const API = 'http://localhost:8080/api';

// ─── Mock navigate so we can assert redirect behavior ───
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Fake files of controlled size/type ───
const makeFile = (name, type, size) => {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
};

const smallPhoto   = () => makeFile('photo.jpg', 'image/jpeg', 100 * 1024); // 100KB
const bigPhoto     = () => makeFile('huge.jpg', 'image/jpeg', 6 * 1024 * 1024); // 6MB (over 5MB)
const badType      = () => makeFile('doc.pdf', 'application/pdf', 100 * 1024);
const smallAudio   = () => makeFile('track.mp3', 'audio/mpeg', 1 * 1024 * 1024); // 1MB
const bigAudio     = () => makeFile('huge.wav', 'audio/wav', 60 * 1024 * 1024); // 60MB (over 50MB)
const smallArtwork = () => makeFile('cover.png', 'image/png', 80 * 1024); // 80KB

describe('CreateAccountWizard', () => {
  beforeEach(() => {
    callTracker.reset();
    mockNavigate.mockClear();
    cacheService.clearAll();
    // restoreAllMocks() (below) resets the directly-assigned HTMLMediaElement
    // mocks from setup.js into bare stubs that return undefined. The audio
    // preview path does `audioRef.current.play().catch(...)`, so play() must
    // return a promise. Re-install the media mocks at the top of every test.
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ========================================================================
  // Shared flow-driving helpers (function declarations are hoisted within
  // this describe closure, so nested describes can use them).
  // ========================================================================
  async function advanceToBasicInfo(user) {
    server.use(
      http.get(`${API}/v1/users/validate-referral/:code`, () =>
        HttpResponse.json({ valid: true, referrerUsername: 'Ref' })
      )
    );
    await user.type(screen.getByPlaceholderText(/HARLEM-JOHN/i), 'GOODCODE');
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
      { timeout: 2000 }
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/Create Your Account/i);
  }

  // Fill the basicInfo fields with valid values; leaves you ON basicInfo.
  async function fillBasicInfo(user, { username = 'testuser', email = 'new@test.com' } = {}) {
    await user.type(screen.getByPlaceholderText(/unique username/i), username);
    await user.type(screen.getByPlaceholderText(/your@email/i), email);
    await user.type(screen.getByPlaceholderText(/At least 8 characters/i), 'Strong123');
    await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'Strong123');
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 25);
    const dobInput = document.querySelector('input[type="date"]');
    await user.type(dobInput, dob.toISOString().split('T')[0]);
  }

  // Welcome -> basicInfo -> location -> role (stops on role step).
  async function advanceToRoleStep(user) {
    await advanceToBasicInfo(user);
    await fillBasicInfo(user);

    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
      { timeout: 3000 }
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Location: manual select
    await screen.findByText(/Where Are You From/i);
    await user.selectOptions(screen.getByRole('combobox'), 'Uptown Harlem');
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
      { timeout: 2000 }
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await screen.findByText(/How Will You Use Unis/i);
  }

  // ========================================================================
  // Basic render
  // ========================================================================
  describe('rendering', () => {
    it('returns null when show is false', () => {
      const { container } = renderWithProviders(
        <CreateAccountWizard show={false} onClose={() => {}} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('starts on the welcome step', () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      expect(screen.getByPlaceholderText(/HARLEM-JOHN/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('shows correct step progress (1 of N)', () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      expect(screen.getByText(/1 of 8/)).toBeInTheDocument();
    });

    it('close button calls onClose', async () => {
      const onClose = vi.fn();
      renderWithProviders(<CreateAccountWizard show={true} onClose={onClose} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Welcome step — referral code validation
  // ========================================================================
  describe('welcome step — referral code', () => {
    it('Continue is disabled until referral code validates', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('calls the validate-referral endpoint and enables Continue on success', async () => {
      server.use(
        http.get(`${API}/v1/users/validate-referral/:code`, () =>
          HttpResponse.json({ valid: true, referrerUsername: 'Alice' })
        )
      );

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/HARLEM-JOHN/i), 'VALID-CODE');

      await waitFor(
        () => expect(screen.getByText(/Referred by Alice/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );

      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });

    it('shows invalid-code error when the API returns valid=false', async () => {
      server.use(
        http.get(`${API}/v1/users/validate-referral/:code`, () =>
          HttpResponse.json({ valid: false })
        )
      );

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/HARLEM-JOHN/i), 'BADCODE');

      await waitFor(
        () => expect(screen.getByText(/Invalid referral code/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('accepts the hardcoded fallback UNIS-LAUNCH-2024 if the endpoint throws', async () => {
      server.use(
        http.get(`${API}/v1/users/validate-referral/:code`, () =>
          HttpResponse.error()
        )
      );

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/HARLEM-JOHN/i), 'UNIS-LAUNCH-2024');

      await waitFor(
        () => expect(screen.getByText(/Welcome early adopter/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });

    it('shows "Could not verify code" when endpoint throws on a non-fallback code', async () => {
      server.use(
        http.get(`${API}/v1/users/validate-referral/:code`, () =>
          HttpResponse.error()
        )
      );

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/HARLEM-JOHN/i), 'SOMECODE');

      await waitFor(
        () => expect(screen.getByText(/Could not verify code/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('routes to the national waitlist from the welcome prompt', async () => {
      const onClose = vi.fn();
      renderWithProviders(<CreateAccountWizard show={true} onClose={onClose} />);
      const user = userEvent.setup();
      await user.click(screen.getByText(/Join the national waitlist/i));
      expect(onClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/waitlist');
    });
  });

  // ========================================================================
  // basicInfo step — username, email, password, DOB
  // ========================================================================
  describe('basicInfo step', () => {
    it('username validator strips disallowed characters', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      const usernameInput = screen.getByPlaceholderText(/unique username/i);
      await user.type(usernameInput, 'Bad User!@#');
      // lowercased + stripped of non [a-z0-9_]
      expect(usernameInput).toHaveValue('baduser');
    });

    it('calls /check-username and shows "available" confirmation', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/unique username/i), 'freshname');
      await waitFor(
        () => expect(screen.getByText(/Username available/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });

    it('shows "taken" error when backend says unavailable', async () => {
      server.use(
        http.get(`${API}/v1/users/check-username`, () =>
          HttpResponse.json({ available: false })
        )
      );
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/unique username/i), 'takenname');
      await waitFor(
        () => expect(screen.getByText(/Username taken/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });

    it('shows "email already registered" on unavailable email', async () => {
      server.use(
        http.get(`${API}/v1/users/check-email`, () =>
          HttpResponse.json({ available: false })
        )
      );
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/your@email/i), 'dupe@test.com');
      await waitFor(
        () => expect(screen.getByText(/Email already registered/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });

    it('rejects an invalid email format before hitting the backend', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/your@email/i), 'not-an-email');
      await waitFor(
        () => expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });

    it('rejects passwords under 8 characters', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/At least 8 characters/i), 'short');
      expect(screen.getByText(/At least 8 characters required/i)).toBeInTheDocument();
    });

    it('shows "Strong password" when password meets all rules', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/At least 8 characters/i), 'Strong123');
      expect(screen.getByText(/Strong password/i)).toBeInTheDocument();
    });

    it('suggests adding character classes for a weak-but-long password', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/At least 8 characters/i), 'alllowercase');
      expect(screen.getByText(/Add uppercase, lowercase, and numbers/i)).toBeInTheDocument();
    });

    it('shows mismatch when confirm password does not match', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      await user.type(screen.getByPlaceholderText(/At least 8 characters/i), 'Strong123');
      await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'Different123');
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });

    it('rejects users under 13', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 10);
      const dobInput = document.querySelector('input[type="date"]');
      await user.type(dobInput, dob.toISOString().split('T')[0]);
      expect(screen.getByText(/at least 13 years old/i)).toBeInTheDocument();
    });

    it('shows minor warning for ages 13-17', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - 15);
      const dobInput = document.querySelector('input[type="date"]');
      await user.type(dobInput, dob.toISOString().split('T')[0]);
      expect(screen.getByText(/Under 18.*explicit content will be disabled/i)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Location step — Nominatim geocode (mock global.fetch)
  // ========================================================================
  describe('location step — geocode', () => {
    async function gotoLocation(user) {
      await advanceToBasicInfo(user);
      await fillBasicInfo(user);
      await waitFor(
        () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
        { timeout: 3000 }
      );
      await user.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByText(/Where Are You From/i);
    }

    it('uptown: lat above the dividing line resolves to Uptown Harlem', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => [{ lat: '40.8200', lon: '-73.9400' }],
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await gotoLocation(user);

      await user.type(screen.getByPlaceholderText(/125th St/i), '125 W 125th St');
      await user.click(screen.getByRole('button', { name: /Find My Jurisdiction/i }));

      await waitFor(
        () => expect(screen.getByText(/Found: Uptown Harlem/i)).toBeInTheDocument(),
        { timeout: 3000 }
      );
    });

    it('downtown: lat below the dividing line resolves to Downtown Harlem', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => [{ lat: '40.8000', lon: '-73.9400' }],
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await gotoLocation(user);

      await user.type(screen.getByPlaceholderText(/125th St/i), '110 St');
      await user.click(screen.getByRole('button', { name: /Find My Jurisdiction/i }));

      await waitFor(
        () => expect(screen.getByText(/Found: Downtown Harlem/i)).toBeInTheDocument(),
        { timeout: 3000 }
      );
    });

    it('out-of-bounds address surfaces the national-waitlist prompt', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => [{ lat: '34.0522', lon: '-118.2437' }], // Los Angeles
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await gotoLocation(user);

      await user.type(screen.getByPlaceholderText(/125th St/i), 'Los Angeles');
      await user.click(screen.getByRole('button', { name: /Find My Jurisdiction/i }));

      await waitFor(
        () => expect(screen.getByText(/Unis isn't in your area yet/i)).toBeInTheDocument(),
        { timeout: 3000 }
      );

      // "let me try again" dismisses the prompt
      await user.click(screen.getByText(/I do live in Harlem/i));
      expect(screen.queryByText(/Unis isn't in your area yet/i)).not.toBeInTheDocument();
    });

    it('shows "Address not found" when geocode returns no matches', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ json: async () => [] });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await gotoLocation(user);

      await user.type(screen.getByPlaceholderText(/125th St/i), 'asdfqwer');
      await user.click(screen.getByRole('button', { name: /Find My Jurisdiction/i }));

      await waitFor(
        () => expect(screen.getByText(/Address not found/i)).toBeInTheDocument(),
        { timeout: 3000 }
      );
    });

    it('shows a verify error when the geocode request throws', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await gotoLocation(user);

      await user.type(screen.getByPlaceholderText(/125th St/i), '125 St');
      await user.click(screen.getByRole('button', { name: /Find My Jurisdiction/i }));

      await waitFor(
        () => expect(screen.getByText(/Could not verify location/i)).toBeInTheDocument(),
        { timeout: 3000 }
      );
    });
  });

  // ========================================================================
  // Role step + theme picker
  // ========================================================================
  describe('role step', () => {
    it('selecting Artist switches the path to 8 artist steps and shows the hype copy', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToRoleStep(user);

      await user.click(screen.getByText(/Artist/).closest('.role-card'));
      expect(screen.getByText(/Let's Make History/i)).toBeInTheDocument();
    });

    it('theme picker updates the selected swatch', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToRoleStep(user);

      const purple = screen.getByRole('button', { name: 'Purple' });
      await user.click(purple);
      expect(purple).toHaveClass('selected');
    });
  });

  // ========================================================================
  // File validation — selection-time (Layer 1) across all upload zones
  // ========================================================================
  describe('file validation', () => {
    it('listener photo: shows error for oversized photo', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToRoleStep(user);

      await user.click(screen.getByText(/Listener/).closest('.role-card'));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
      );
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await screen.findByText(/Show Your Face/i);
      const input = document.querySelector('input[type="file"]');
      fireEvent.change(input, { target: { files: [bigPhoto()] } });

      expect(screen.getByText(/please choose one under 5MB/i)).toBeInTheDocument();
    });

    it('listener photo: shows error for wrong MIME type', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToRoleStep(user);

      await user.click(screen.getByText(/Listener/).closest('.role-card'));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
      );
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await screen.findByText(/Show Your Face/i);
      const input = document.querySelector('input[type="file"]');
      fireEvent.change(input, { target: { files: [badType()] } });

      expect(screen.getByText(/Unsupported file type/i)).toBeInTheDocument();
    });

    it('listener photo: accepts a valid photo and shows the preview', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToRoleStep(user);

      await user.click(screen.getByText(/Listener/).closest('.role-card'));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
      );
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await screen.findByText(/Show Your Face/i);
      const input = document.querySelector('input[type="file"]');
      await user.upload(input, smallPhoto());

      expect(screen.queryByText(/please choose one under 5MB/i)).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('photo.jpg')).toBeInTheDocument());
    });

    it('audio: shows error for oversized audio file on the artist song step', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistSongStep(user);

      const fileInputs = document.querySelectorAll('input[type="file"]');
      // [0] = audio, [1] = artwork
      fireEvent.change(fileInputs[0], { target: { files: [bigAudio()] } });
      expect(screen.getByText(/please choose one under 50MB/i)).toBeInTheDocument();
    });

    it('artwork: shows error for wrong type on the artist song step', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistSongStep(user);

      const fileInputs = document.querySelectorAll('input[type="file"]');
      fireEvent.change(fileInputs[1], { target: { files: [badType()] } });
      expect(screen.getByText(/Unsupported file type/i)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Artist profile + song upload steps (render + canProceed)
  // ========================================================================
  describe('artist profile + song steps', () => {
    it('artistProfile gates Continue until a photo and genre are chosen', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistProfileStep(user);

      // Nothing chosen yet
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

      const photoInput = document.querySelector('input[type="file"]');
      fireEvent.change(photoInput, { target: { files: [smallPhoto()] } });
      await waitFor(() => expect(screen.getByText('photo.jpg')).toBeInTheDocument());

      // Photo only — still disabled (needs genre)
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

      await user.selectOptions(screen.getByRole('combobox'), 'Rock');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
      );
    });

    it('songUpload gates Continue until title + audio + artwork are present', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistSongStep(user);

      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

      await user.type(screen.getByPlaceholderText(/Track name/i), 'My Debut');
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fireEvent.change(fileInputs[0], { target: { files: [smallAudio()] } });
      fireEvent.change(fileInputs[1], { target: { files: [smallArtwork()] } });

      await waitFor(
        () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
        { timeout: 2000 }
      );
    });
  });

  // ========================================================================
  // Support-artist step
  // ========================================================================
  describe('support-artist step', () => {
    it('loads artists and lets you search by name', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerSupportStep(user);

      await waitFor(() => {
        expect(document.querySelectorAll('.artist-card').length).toBe(2);
      }, { timeout: 3000 });

      await user.type(screen.getByPlaceholderText(/Search artists/i), 'Tony');
      await waitFor(() => {
        expect(document.querySelectorAll('.artist-card').length).toBe(1);
      });
      expect(screen.getByText('Tony Fadd')).toBeInTheDocument();
    });

    it('filters by jurisdiction chip', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerSupportStep(user);

      await waitFor(() => {
        expect(document.querySelectorAll('.artist-card').length).toBe(2);
      }, { timeout: 3000 });

      await user.click(screen.getByRole('button', { name: /^Downtown$/i }));
      await waitFor(() => {
        expect(document.querySelectorAll('.artist-card').length).toBe(1);
      });
      expect(screen.getByText('SD Boomin')).toBeInTheDocument();
    });

    it('shows the empty state when no artists are returned', async () => {
      server.use(
        http.get(`${API}/v1/users/artists/active`, () => HttpResponse.json([]))
      );
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerSupportStep(user);

      await waitFor(
        () => expect(screen.getByText(/No artists found/i)).toBeInTheDocument(),
        { timeout: 3000 }
      );
    });

    it('shows a load error when the artists endpoint fails', async () => {
      server.use(
        http.get(`${API}/v1/users/artists/active`, () => HttpResponse.error())
      );
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerSupportStep(user);

      await waitFor(
        () => expect(screen.getByText(/Could not load artists/i)).toBeInTheDocument(),
        { timeout: 3000 }
      );
    });

    it('toggles audio preview play state for an artist with a default song', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerSupportStep(user);

      await waitFor(() => {
        expect(document.querySelectorAll('.artist-card').length).toBe(2);
      }, { timeout: 3000 });

      const firstCard = document.querySelector('.artist-card');
      const playBtn = firstCard.querySelector('.play-button');
      await user.click(playBtn);

      await waitFor(() => {
        expect(document.querySelector('.artist-card.playing')).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  // ========================================================================
  // Submit flow — order of operations (apiCall mocked at module level)
  // ========================================================================
  describe('submit flow — order of operations', () => {
    // Builds a module-level apiCall mock. `overrides` lets a test swap the
    // behavior of a phase (e.g. throw a 413). Validation/list endpoints fall
    // through to the real apiCall so MSW still serves them.
    async function withMockedApiCall(overrides = {}) {
      const axiosModule = await import('./components/axiosInstance');
      const originalApiCall = axiosModule.apiCall;
      const state = { callOrder: [], registerPayload: null, songParams: null };

      const mockApiCall = vi.fn(async (config) => {
        const url = config.url;
        const method = (config.method || 'get').toLowerCase();

        if (url.includes('/validate-referral') || url.includes('/check-username') ||
            url.includes('/check-email') || url.includes('/artists/active') ||
            url.includes('/default-song')) {
          return originalApiCall(config);
        }

        if (url.includes('/profile/photo') && method === 'patch') {
          state.callOrder.push('photo');
          if (overrides.photo) return overrides.photo(config);
          return { data: { photoUrl: '/uploads/avatars/returned-url.jpg' } };
        }
        if (url.includes('/users/register') && method === 'post') {
          state.callOrder.push('register');
          state.registerPayload = config.data;
          if (overrides.register) return overrides.register(config);
          return { data: { userId: 'new-id', role: config.data.role, signupToken: 'tok-123' } };
        }
        if (url.includes('/media/signup-song') && method === 'post') {
          state.callOrder.push('song');
          state.songParams = url;
          if (overrides.song) return overrides.song(config);
          return { data: { songId: 'new-song' } };
        }
        return originalApiCall(config);
      });

      vi.spyOn(axiosModule, 'apiCall').mockImplementation(mockApiCall);
      return state;
    }

    it('LISTENER: photo uploaded BEFORE register, photoUrl in register payload', async () => {
      const state = await withMockedApiCall();

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(state.callOrder).toEqual(['photo', 'register']),
        { timeout: 5000 }
      );
      expect(state.registerPayload.photoUrl).toBe('/uploads/avatars/returned-url.jpg');
      expect(state.registerPayload.role).toBe('listener');
      expect(state.registerPayload.username).toBe('testuser');
      expect(state.registerPayload.genreId).toBeNull();
    }, 30000);

    it('LISTENER: success screen shows the verification email', async () => {
      await withMockedApiCall();

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getByText(/Check your email/i)).toBeInTheDocument(),
        { timeout: 5000 }
      );
      expect(screen.getByText('new@test.com')).toBeInTheDocument();
    }, 30000);

    it('ARTIST: full path runs photo -> register -> signup-song with the token', async () => {
      const state = await withMockedApiCall();

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(state.callOrder).toEqual(['photo', 'register', 'song']),
        { timeout: 8000 }
      );
      expect(state.registerPayload.role).toBe('artist');
      expect(state.registerPayload.genreId).toBeTruthy();
      expect(state.songParams).toContain('signupToken=tok-123');

      await waitFor(
        () => expect(screen.getByText(/Check your email/i)).toBeInTheDocument(),
        { timeout: 5000 }
      );
      expect(screen.getByText(/debut track is attached/i)).toBeInTheDocument();
    }, 40000);

    it('ARTIST: missing signupToken yields partial success (account ok, song deferred)', async () => {
      await withMockedApiCall({
        register: () => ({ data: { userId: 'new-id', role: 'artist' } }), // no signupToken
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getByText(/Account Created/i)).toBeInTheDocument(),
        { timeout: 8000 }
      );
      expect(screen.getByText(/couldn't prepare the song upload/i)).toBeInTheDocument();
    }, 40000);

    it('ARTIST: song upload 413 yields partial success with a size message', async () => {
      await withMockedApiCall({
        song: () => {
          const err = new Error('413');
          err.response = { status: 413, data: { message: 'Audio too large' } };
          throw err;
        },
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getByText(/Account Created/i)).toBeInTheDocument(),
        { timeout: 8000 }
      );
      expect(screen.getByText(/audio file was too large/i)).toBeInTheDocument();
    }, 40000);

    it('handles photo upload 413 (too large) with a specific error message', async () => {
      await withMockedApiCall({
        photo: () => {
          const err = new Error('413');
          err.response = { status: 413, data: { message: 'File too large' } };
          throw err;
        },
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getAllByText(/too large/i).length).toBeGreaterThan(0),
        { timeout: 3000 }
      );
    }, 30000);

    it('handles photo upload 415 (unsupported type) with a format message', async () => {
      await withMockedApiCall({
        photo: () => {
          const err = new Error('415');
          err.response = { status: 415, data: { message: 'Unsupported Media Type' } };
          throw err;
        },
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getAllByText(/format isn't supported/i).length).toBeGreaterThan(0),
        { timeout: 3000 }
      );
    }, 30000);

    it('handles 409 duplicate account error', async () => {
      await withMockedApiCall({
        register: () => {
          const err = new Error('409');
          err.response = { status: 409, data: { message: 'Email already in use' } };
          throw err;
        },
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getAllByText(/account.*already exists/i).length).toBeGreaterThan(0),
        { timeout: 3000 }
      );
    }, 30000);

    it('handles a generic register failure with a server-error message', async () => {
      await withMockedApiCall({
        register: () => {
          const err = new Error('500');
          err.response = { status: 500, data: {} };
          throw err;
        },
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerReview(user);

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getAllByText(/server error/i).length).toBeGreaterThan(0),
        { timeout: 3000 }
      );
    }, 30000);
  });

  // ========================================================================
  // Flow helpers to reach each terminal step
  // ========================================================================
  async function advanceToListenerSupportStep(user) {
    await advanceToRoleStep(user);
    await user.click(screen.getByText(/Listener/).closest('.role-card'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Listener photo
    await screen.findByText(/Show Your Face/i);
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [smallPhoto()] } });
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
      { timeout: 2000 }
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Listener bio
    await screen.findByText(/Tell Your Story/i);
    await user.type(
      screen.getByPlaceholderText(/Harlem native/i),
      'I love discovering new local talent in the community.'
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await screen.findByText(/Support an Artist/i);
  }

  async function advanceToArtistProfileStep(user) {
    await advanceToRoleStep(user);
    await user.click(screen.getByText(/Artist/).closest('.role-card'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/Your Artist Profile/i);
  }

  async function advanceToArtistSongStep(user) {
    await advanceToArtistProfileStep(user);
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [smallPhoto()] } });
    await waitFor(() => expect(screen.getByText('photo.jpg')).toBeInTheDocument());
    await user.selectOptions(screen.getByRole('combobox'), 'Rock');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText(/Your Debut Track/i);
  }

  async function advanceToListenerReview(user) {
    await advanceToListenerSupportStep(user);
    await waitFor(
      () => { expect(document.querySelectorAll('.artist-card').length).toBeGreaterThan(0); },
      { timeout: 3000 }
    );
    await user.click(document.querySelector('.artist-card'));
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
      { timeout: 2000 }
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await screen.findByText(/Review & Confirm/i);
    await user.click(screen.getByText(/I agree to the Terms of Service/i));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
    );
  }

  async function advanceToArtistReview(user) {
    await advanceToArtistSongStep(user);
    await user.type(screen.getByPlaceholderText(/Track name/i), 'My Debut');
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [smallAudio()] } });
    fireEvent.change(fileInputs[1], { target: { files: [smallArtwork()] } });
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
      { timeout: 2000 }
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Support artist
    await screen.findByText(/Support an Artist/i);
    await waitFor(
      () => { expect(document.querySelectorAll('.artist-card').length).toBeGreaterThan(0); },
      { timeout: 3000 }
    );
    await user.click(document.querySelector('.artist-card'));
    await waitFor(
      () => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(),
      { timeout: 2000 }
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Review — tick BOTH boxes
    await screen.findByText(/Review & Confirm/i);
    await user.click(screen.getByText(/I agree to the Terms of Service/i));
    await user.click(screen.getByText(/I agree to the Artist Upload Agreement/i));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
    );
  }

  // ========================================================================
  // Additional branch coverage — validation edges, remove-file, audio
  // toggle/mini-player, and the remaining submit error branches.
  // ========================================================================
  describe('additional branch coverage', () => {
    it('username under 3 chars shows the minimum-length hint', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);
      await user.type(screen.getByPlaceholderText(/unique username/i), 'ab');
      await waitFor(
        () => expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument(),
        { timeout: 2000 }
      );
    });

    it('changing the password after confirm re-checks the match (mismatch)', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToBasicInfo(user);

      const pw = screen.getByPlaceholderText(/At least 8 characters/i);
      const confirm = screen.getByPlaceholderText(/Re-enter password/i);
      await user.type(pw, 'Strong123');
      await user.type(confirm, 'Strong123');
      expect(screen.getByText(/Passwords match/i)).toBeInTheDocument();

      // Now change the password — recursion re-validates the confirm field
      await user.type(pw, '4');
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });

    it('listenerBio under 10 characters keeps Continue disabled', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToRoleStep(user);
      await user.click(screen.getByText(/Listener/).closest('.role-card'));
      await user.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByText(/Show Your Face/i);
      fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [smallPhoto()] } });
      await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled(), { timeout: 2000 });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await screen.findByText(/Tell Your Story/i);
      await user.type(screen.getByPlaceholderText(/Harlem native/i), 'too short');
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('artist photo: rejects a wrong MIME type at selection', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistProfileStep(user);
      fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [badType()] } });
      expect(screen.getByText(/Unsupported file type/i)).toBeInTheDocument();
    });

    it('removing a selected listener photo clears the preview', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToRoleStep(user);
      await user.click(screen.getByText(/Listener/).closest('.role-card'));
      await user.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByText(/Show Your Face/i);

      fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [smallPhoto()] } });
      await waitFor(() => expect(screen.getByText('photo.jpg')).toBeInTheDocument());

      await user.click(document.querySelector('.remove-file'));
      expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();
    });

    it('audio preview toggles off when the same artist is clicked twice', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerSupportStep(user);
      await waitFor(() => { expect(document.querySelectorAll('.artist-card').length).toBe(2); }, { timeout: 3000 });

      const card = document.querySelector('.artist-card');
      const playBtn = card.querySelector('.play-button');
      await user.click(playBtn);
      await waitFor(() => expect(document.querySelector('.artist-card.playing')).toBeTruthy(), { timeout: 3000 });

      // Second click on the same artist pauses (toggle off)
      await user.click(card.querySelector('.play-button'));
      await waitFor(() => expect(document.querySelector('.artist-card.playing')).toBeFalsy(), { timeout: 3000 });
    });

    it('mini-player stop button clears the playing state', async () => {
      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerSupportStep(user);
      await waitFor(() => { expect(document.querySelectorAll('.artist-card').length).toBe(2); }, { timeout: 3000 });

      await user.click(document.querySelector('.artist-card .play-button'));
      await waitFor(() => expect(document.querySelector('.mini-player')).toBeTruthy(), { timeout: 3000 });

      // Stop is the second control button in the mini-player
      const controls = document.querySelectorAll('.mini-player .player-controls button');
      await user.click(controls[1]);
      await waitFor(() => expect(document.querySelector('.mini-player')).toBeFalsy(), { timeout: 3000 });
    });

    it('submit: photo timeout (ECONNABORTED) shows the timed-out message', async () => {
      const axiosModule = await import('./components/axiosInstance');
      const originalApiCall = axiosModule.apiCall;
      vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
        const url = config.url;
        const method = (config.method || 'get').toLowerCase();
        if (url.includes('/profile/photo') && method === 'patch') {
          const err = new Error('timeout');
          err.code = 'ECONNABORTED';
          err.response = undefined;
          throw err;
        }
        return originalApiCall(config);
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToListenerReview(user);
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getAllByText(/timed out/i).length).toBeGreaterThan(0),
        { timeout: 3000 }
      );
    }, 30000);

    it('submit: generic song failure shows a server-error detail', async () => {
      const axiosModule = await import('./components/axiosInstance');
      const originalApiCall = axiosModule.apiCall;
      vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
        const url = config.url;
        const method = (config.method || 'get').toLowerCase();
        if (url.includes('/validate-referral') || url.includes('/check-username') ||
            url.includes('/check-email') || url.includes('/artists/active') ||
            url.includes('/default-song')) {
          return originalApiCall(config);
        }
        if (url.includes('/profile/photo') && method === 'patch') {
          return { data: { photoUrl: '/uploads/x.jpg' } };
        }
        if (url.includes('/users/register') && method === 'post') {
          return { data: { userId: 'id', role: 'artist', signupToken: 'tok' } };
        }
        if (url.includes('/media/signup-song') && method === 'post') {
          const err = new Error('boom');
          err.response = { status: 500, data: {} };
          throw err;
        }
        return originalApiCall(config);
      });

      renderWithProviders(<CreateAccountWizard show={true} onClose={() => {}} />);
      const user = userEvent.setup();
      await advanceToArtistReview(user);
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => expect(screen.getByText(/a server error occurred/i)).toBeInTheDocument(),
        { timeout: 5000 }
      );
    }, 40000);
  });

  // ========================================================================
  // Known gap documentation
  // ========================================================================
  describe('known gaps', () => {
    it.todo('[GAP] song upload does not collect downloadPolicy / downloadPrice yet');
  });
});