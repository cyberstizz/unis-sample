// src/editProfileWizard.test.jsx
//
// Test suite for EditProfileWizard — a two-tab modal (Photo / Bio) for
// updating the user's profile photo and bio, each saved independently.
//
// ---------------------------------------------------------------------------
// ★ REWRITTEN against the redesigned (dark glass card / `epw-*`) component.
//   The previous suite was written against the pre-redesign markup and was
//   asserting on DOM that no longer exists. Every failure traced to one of
//   these eight renames — the component's BEHAVIOUR never regressed:
//
//     old test expected            →  component now renders
//     ─────────────────────────────────────────────────────────────────────
//     .upload-wizard-overlay       →  .epw-overlay
//     .close-button                →  .epw__close
//     tabs as role="button"        →  <button role="tab">  (role is OVERRIDDEN,
//                                     so getByRole('button', …) matched nothing —
//                                     this alone caused most of the 21 failures)
//     class "active"               →  class "is-active" (+ aria-selected)
//     "Saving..." (3 dots)         →  "Saving…"  (U+2026 ellipsis)
//     "5/500"                      →  "5 / 500"  (spaces around the slash)
//     "Selected: file.jpg"         →  bare "file.jpg"
//     /default-avatar.jpg fallback →  initial-letter fallback element
//
//   Behavioural coverage below is unchanged from the original suite.
// ---------------------------------------------------------------------------
//
// Pattern notes:
//   • Photo save uses FormData → use the apiCall spy bypass.
//   • Bio save uses plain JSON → same spy pattern, to inspect payload.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';
import cacheService from './services/cacheService';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------
vi.mock('./editProfileWizard.scss', () => ({}));

import EditProfileWizard from './editProfileWizard';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------
const baseProfile = (overrides = {}) => ({
  userId: 'user-listener-001',
  username: 'testlistener',
  bio: 'Original bio text',
  photoUrl: '/uploads/avatars/me.jpg',
  ...overrides,
});

function fakeFile({ name = 'new-photo.jpg', type = 'image/jpeg', sizeBytes = 1024 } = {}) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

async function selectFile(input, file) {
  fireEvent.change(input, { target: { files: [file] } });
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-photo-preview');
  global.URL.revokeObjectURL = vi.fn();
  cacheService.clearAll();
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
  onSuccess = vi.fn(),
  userProfile = baseProfile(),
} = {}) {
  return {
    onClose,
    onSuccess,
    userProfile,
    ...render(
      <EditProfileWizard
        show={show}
        onClose={onClose}
        onSuccess={onSuccess}
        userProfile={userProfile}
      />
    ),
  };
}

function getPhotoFileInput() {
  return document.querySelector('input[type="file"]');
}

// ★ tabs expose role="tab", NOT role="button"
const photoTab = () => screen.getByRole('tab', { name: /photo/i });
const bioTab = () => screen.getByRole('tab', { name: /bio/i });

async function switchToBio(user) {
  await user.click(bioTab());
}

// ===========================================================================
// VISIBILITY GATING
// ===========================================================================
describe('EditProfileWizard — visibility', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderWizard({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal overlay when show=true', () => {
    renderWizard();
    expect(document.querySelector('.epw-overlay')).not.toBeNull();
  });

  it('renders the "Edit profile" heading', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: /edit profile/i })).toBeInTheDocument();
  });

  it('exposes the modal as a dialog', () => {
    renderWizard();
    expect(screen.getByRole('dialog', { name: /edit profile/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// TAB NAVIGATION
// ===========================================================================
describe('EditProfileWizard — tab navigation', () => {
  it('starts on the Photo tab', () => {
    renderWizard();
    expect(screen.getByText(/profile photo/i)).toBeInTheDocument();
  });

  it('Photo tab is marked active by default', () => {
    renderWizard();
    expect(photoTab()).toHaveAttribute('aria-selected', 'true');
    expect(photoTab().classList.contains('is-active')).toBe(true);
  });

  it('clicking the Bio tab switches to the bio editor', async () => {
    renderWizard();
    const user = userEvent.setup();
    await switchToBio(user);
    expect(screen.getByText(/tell the world about your sound/i)).toBeInTheDocument();
  });

  it('clicking back to Photo tab restores the photo editor', async () => {
    renderWizard();
    const user = userEvent.setup();
    await switchToBio(user);
    await user.click(photoTab());
    expect(screen.getByText(/profile photo/i)).toBeInTheDocument();
  });

  it('Bio tab is marked active after switching', async () => {
    renderWizard();
    const user = userEvent.setup();
    await switchToBio(user);
    expect(bioTab()).toHaveAttribute('aria-selected', 'true');
    expect(bioTab().classList.contains('is-active')).toBe(true);
    expect(photoTab()).toHaveAttribute('aria-selected', 'false');
  });
});

// ===========================================================================
// PHOTO TAB — INITIAL RENDER + PREVIEW
// ===========================================================================
describe('EditProfileWizard — photo tab initial render', () => {
  it('renders the profile preview image', () => {
    renderWizard();
    expect(screen.getByAltText(/profile preview/i)).toBeInTheDocument();
  });

  it('builds preview URL from relative photoUrl with API base', () => {
    renderWizard({ userProfile: baseProfile({ photoUrl: '/uploads/me.jpg' }) });
    const img = screen.getByAltText(/profile preview/i);
    expect(img.src).toBe('http://localhost:8080/uploads/me.jpg');
  });

  it('passes absolute photo URLs through unchanged', () => {
    renderWizard({ userProfile: baseProfile({ photoUrl: 'https://cdn.test/me.jpg' }) });
    const img = screen.getByAltText(/profile preview/i);
    expect(img.src).toBe('https://cdn.test/me.jpg');
  });

  // ★ the /default-avatar.jpg fallback was replaced by an initial-letter element
  it('falls back to the initial-letter avatar when there is no photoUrl', () => {
    renderWizard({ userProfile: baseProfile({ photoUrl: null, username: 'testlistener' }) });
    expect(screen.queryByAltText(/profile preview/i)).not.toBeInTheDocument();
    expect(document.querySelector('.epw__photo-fallback')).not.toBeNull();
    expect(document.querySelector('.epw__photo-fallback').textContent).toBe('T');
  });

  it('renders the "Choose new photo" label', () => {
    renderWizard();
    expect(screen.getByText(/choose new photo/i)).toBeInTheDocument();
  });

  it('does not show a filename line until a file is picked', () => {
    renderWizard();
    expect(document.querySelector('.epw__file-name')).toBeNull();
  });

  it('shows the selected filename after picking a file', async () => {
    renderWizard();
    await selectFile(getPhotoFileInput(), fakeFile({ name: 'my-new-pic.jpg' }));
    expect(screen.getByText('my-new-pic.jpg')).toBeInTheDocument();
  });

  it('updates the preview src to the blob URL after picking a file', async () => {
    renderWizard();
    await selectFile(getPhotoFileInput(), fakeFile());
    expect(screen.getByAltText(/profile preview/i).src).toBe('blob:mock-photo-preview');
  });
});

// ===========================================================================
// PHOTO TAB — SAVE BUTTON STATE
// ===========================================================================
describe('EditProfileWizard — Save photo button state', () => {
  it('Save photo button is disabled when no file is selected', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /save photo/i })).toBeDisabled();
  });

  it('Save photo button enables once a file is selected', async () => {
    renderWizard();
    await selectFile(getPhotoFileInput(), fakeFile());
    expect(screen.getByRole('button', { name: /save photo/i })).toBeEnabled();
  });
});

// ===========================================================================
// PHOTO TAB — SAVE FLOW
// ===========================================================================
describe('EditProfileWizard — Save photo flow', () => {
  it('PATCHes /v1/users/profile with FormData containing the photo', async () => {
    let capturedConfig = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedConfig = { ...config, fileName: config.data.get('photo')?.name };
      return { data: { success: true } };
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();
    renderWizard({ onSuccess, onClose });

    await selectFile(getPhotoFileInput(), fakeFile({ name: 'avatar.jpg' }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save photo/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(capturedConfig.method).toBe('patch');
    expect(capturedConfig.url).toBe('/v1/users/profile');
    expect(capturedConfig.fileName).toBe('avatar.jpg');
    expect(onClose).toHaveBeenCalled();
  });

  // ★ the in-flight label is "Saving…" (U+2026), not "Saving..."
  it('shows the "Saving…" state while the PATCH is in flight', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      await pending;
      return { data: {} };
    });

    renderWizard();
    await selectFile(getPhotoFileInput(), fakeFile());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
    resolveFn();
  });

  it('shows alert and does not close on save failure', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      throw new Error('Network error');
    });

    const onClose = vi.fn();
    const onSuccess = vi.fn();
    renderWizard({ onClose, onSuccess });

    await selectFile(getPhotoFileInput(), fakeFile());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save photo/i }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toMatch(/failed to update photo/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('invalidates user and artist caches on photo save success', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({ data: {} }));
    const invalidateSpy = vi.spyOn(cacheService, 'invalidate');

    renderWizard({ userProfile: baseProfile({ userId: 'u-123' }) });
    await selectFile(getPhotoFileInput(), fakeFile());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save photo/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith('user', 'u-123');
      expect(invalidateSpy).toHaveBeenCalledWith('artist', 'u-123');
    });
  });

  it('Save photo stays disabled until a file is selected (no early-close path through UI)', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /save photo/i })).toBeDisabled();
  });
});

// ===========================================================================
// BIO TAB — INITIAL RENDER + INPUT
// ===========================================================================
describe('EditProfileWizard — bio tab', () => {
  it('pre-fills the textarea with userProfile.bio', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'Harlem rapper since day one' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    expect(screen.getByPlaceholderText(/musical journey/i).value).toBe('Harlem rapper since day one');
  });

  it('starts empty when userProfile has no bio', async () => {
    renderWizard({ userProfile: baseProfile({ bio: null }) });
    const user = userEvent.setup();
    await switchToBio(user);
    expect(screen.getByPlaceholderText(/musical journey/i).value).toBe('');
  });

  it('updates the textarea on user input', async () => {
    renderWizard({ userProfile: baseProfile({ bio: '' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.type(ta, 'New bio content');
    expect(ta.value).toBe('New bio content');
  });

  // ★ counter renders as "5 / 500", with spaces
  it('shows the character counter (length / 500)', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'hello' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    expect(screen.getByText('5 / 500')).toBeInTheDocument();
  });

  it('character counter updates as user types', async () => {
    renderWizard({ userProfile: baseProfile({ bio: '' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    await user.type(screen.getByPlaceholderText(/musical journey/i), 'abc');
    expect(screen.getByText('3 / 500')).toBeInTheDocument();
  });

  it('textarea has maxLength=500', async () => {
    renderWizard();
    const user = userEvent.setup();
    await switchToBio(user);
    expect(screen.getByPlaceholderText(/musical journey/i).maxLength).toBe(500);
  });
});

// ===========================================================================
// BIO TAB — SAVE BUTTON STATE
// ===========================================================================
describe('EditProfileWizard — Save bio button state', () => {
  it('Save bio button is disabled when bio matches userProfile.bio', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'Original bio text' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    expect(screen.getByRole('button', { name: /save bio/i })).toBeDisabled();
  });

  it('Save bio button enables when bio is changed', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'Old' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    await user.type(screen.getByPlaceholderText(/musical journey/i), ' new');
    expect(screen.getByRole('button', { name: /save bio/i })).toBeEnabled();
  });
});

// ===========================================================================
// BIO TAB — SAVE FLOW
// ===========================================================================
describe('EditProfileWizard — Save bio flow', () => {
  it('PUTs /v1/users/profile/:userId/bio with trimmed bio JSON', async () => {
    let capturedConfig = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedConfig = config;
      return { data: { success: true } };
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();
    renderWizard({
      userProfile: baseProfile({ userId: 'u-42', bio: 'Old' }),
      onSuccess,
      onClose,
    });

    const user = userEvent.setup();
    await switchToBio(user);
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.clear(ta);
    await user.type(ta, '  New bio  ');
    await user.click(screen.getByRole('button', { name: /save bio/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(capturedConfig.method).toBe('put');
    expect(capturedConfig.url).toBe('/v1/users/profile/u-42/bio');
    expect(capturedConfig.data).toEqual({ bio: 'New bio' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows alert and does not close on bio save failure', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      throw new Error('Bio save failed');
    });

    const onClose = vi.fn();
    const onSuccess = vi.fn();
    renderWizard({ userProfile: baseProfile({ bio: 'Old' }), onClose, onSuccess });

    const user = userEvent.setup();
    await switchToBio(user);
    await user.type(screen.getByPlaceholderText(/musical journey/i), ' added');
    await user.click(screen.getByRole('button', { name: /save bio/i }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toMatch(/failed to update bio/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('invalidates user and artist caches on bio save success', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({ data: {} }));
    const invalidateSpy = vi.spyOn(cacheService, 'invalidate');

    renderWizard({ userProfile: baseProfile({ userId: 'u-77', bio: 'Old' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    await user.type(screen.getByPlaceholderText(/musical journey/i), ' new content');
    await user.click(screen.getByRole('button', { name: /save bio/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith('user', 'u-77');
      expect(invalidateSpy).toHaveBeenCalledWith('artist', 'u-77');
    });
  });

  it('shows the "Saving…" state during bio save', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      await pending;
      return { data: {} };
    });

    renderWizard({ userProfile: baseProfile({ bio: 'Old' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    await user.type(screen.getByPlaceholderText(/musical journey/i), ' more');
    await user.click(screen.getByRole('button', { name: /save bio/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
    resolveFn();
  });
});

// ===========================================================================
// CLOSE / CANCEL
// ===========================================================================
describe('EditProfileWizard — close and cancel', () => {
  it('clicking Cancel calls onClose', async () => {
    const onClose = vi.fn();
    renderWizard({ onClose });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  // ★ close button is .epw__close, and carries aria-label="Close"
  it('clicking the × button calls onClose', async () => {
    const onClose = vi.fn();
    renderWizard({ onClose });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel does not call onSuccess or fire any API call', async () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({ data: {} }));
    const onSuccess = vi.fn();
    renderWizard({ onSuccess });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(apiSpy).not.toHaveBeenCalled();
  });
});