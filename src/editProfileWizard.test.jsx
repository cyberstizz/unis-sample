// src/editProfileWizard.test.jsx
//
// Test suite for EditProfileWizard — a two-tab modal (Photo / Bio) for
// updating the user's profile photo and bio, each saved independently.
//
// Covers:
//   • show=false renders nothing
//   • Default tab is "photo"
//   • Tab switching between Photo and Bio
//   • Photo tab: preview, file picker, "Choose New Photo" label as input trigger
//   • Photo preview: builds API URL from relative photoUrl, passes through absolute,
//     falls back to /default-avatar.jpg when no photo
//   • Bio tab: textarea pre-filled from userProfile.bio, char counter, 500 max
//   • Save Photo button:
//       - disabled when no new file selected
//       - PATCH to /v1/users/profile with FormData containing 'photo'
//       - calls onSuccess + onClose on success, alert on error
//       - early-close when no photoFile (no API call)
//   • Save Bio button:
//       - disabled when bio matches userProfile.bio (no changes)
//       - PUT to /v1/users/profile/:userId/bio with JSON { bio: trimmed }
//       - calls onSuccess + onClose on success, alert on error
//       - early-close when bio unchanged (no API call)
//   • Loading state: button shows "Saving..." and disables during request
//   • Cancel button calls onClose
//   • Close (×) button calls onClose
//   • cacheService invalidation after successful save
//
// Pattern notes:
//   • Photo save uses FormData → use the apiCall spy bypass (gotcha #1).
//   • Bio save uses plain JSON → could go through MSW, but using the same
//     spy pattern for consistency and to inspect payload.

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

// Helper to grab the file input (it's hidden but reachable via DOM)
function getPhotoFileInput() {
  return document.querySelector('input[type="file"]');
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
    expect(document.querySelector('.upload-wizard-overlay')).not.toBeNull();
  });

  it('renders the "Edit Profile" heading', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: /edit profile/i })).toBeInTheDocument();
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
    const photoTab = screen.getByRole('button', { name: /^photo$/i });
    expect(photoTab.classList.contains('active')).toBe(true);
  });

  it('clicking the Bio tab switches to the bio editor', async () => {
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bio/i }));
    // The bio tab content shows "Tell the world about your sound..."
    expect(screen.getByText(/tell the world about your sound/i)).toBeInTheDocument();
  });

  it('clicking back to Photo tab restores the photo editor', async () => {
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bio/i }));
    await user.click(screen.getByRole('button', { name: /photo/i }));
    expect(screen.getByText(/profile photo/i)).toBeInTheDocument();
  });

  it('Bio tab has active class after switching', async () => {
    renderWizard();
    const user = userEvent.setup();
    const bioTab = screen.getByRole('button', { name: /bio/i });
    await user.click(bioTab);
    expect(bioTab.classList.contains('active')).toBe(true);
  });
});

// ===========================================================================
// PHOTO TAB — INITIAL RENDER + PREVIEW
// ===========================================================================
describe('EditProfileWizard — photo tab initial render', () => {
  it('renders the profile preview image', () => {
    renderWizard();
    const img = screen.getByAltText(/profile preview/i);
    expect(img).toBeInTheDocument();
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

  it('falls back to /default-avatar.jpg when no photoUrl', () => {
    renderWizard({ userProfile: baseProfile({ photoUrl: null }) });
    const img = screen.getByAltText(/profile preview/i);
    expect(img.src).toMatch(/default-avatar\.jpg$/);
  });

  it('renders the "Choose New Photo" label', () => {
    renderWizard();
    expect(screen.getByText(/choose new photo/i)).toBeInTheDocument();
  });

  it('does not show "Selected: filename" line until a file is picked', () => {
    renderWizard();
    expect(screen.queryByText(/^Selected:/i)).not.toBeInTheDocument();
  });

  it('shows the selected filename after picking a file', async () => {
    renderWizard();
    const file = fakeFile({ name: 'my-new-pic.jpg' });
    await selectFile(getPhotoFileInput(), file);
    expect(screen.getByText(/Selected: my-new-pic\.jpg/)).toBeInTheDocument();
  });

  it('updates the preview src to the blob URL after picking a file', async () => {
    renderWizard();
    await selectFile(getPhotoFileInput(), fakeFile());
    const img = screen.getByAltText(/profile preview/i);
    expect(img.src).toBe('blob:mock-photo-preview');
  });
});

// ===========================================================================
// PHOTO TAB — SAVE BUTTON STATE
// ===========================================================================
describe('EditProfileWizard — Save Photo button state', () => {
  it('Save Photo button is disabled when no file is selected', () => {
    renderWizard();
    const btn = screen.getByRole('button', { name: /save photo/i });
    expect(btn).toBeDisabled();
  });

  it('Save Photo button enables once a file is selected', async () => {
    renderWizard();
    await selectFile(getPhotoFileInput(), fakeFile());
    const btn = screen.getByRole('button', { name: /save photo/i });
    expect(btn).toBeEnabled();
  });
});

// ===========================================================================
// PHOTO TAB — SAVE FLOW
// ===========================================================================
describe('EditProfileWizard — Save Photo flow', () => {
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

  it('shows "Saving..." state while the PATCH is in flight', async () => {
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
      expect(screen.getByRole('button', { name: /saving\.\.\./i })).toBeDisabled();
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
    const userInvalidate = vi.spyOn(cacheService, 'invalidate');

    renderWizard({ userProfile: baseProfile({ userId: 'u-123' }) });
    await selectFile(getPhotoFileInput(), fakeFile());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save photo/i }));

    await waitFor(() => {
      expect(userInvalidate).toHaveBeenCalledWith('user', 'u-123');
      expect(userInvalidate).toHaveBeenCalledWith('artist', 'u-123');
    });
  });

  // The button is disabled when no file is selected, so this path
  // isn't directly reachable through the UI — but it's worth documenting.
  it('Save Photo button is disabled until a file is selected (no early-close path through UI)', () => {
    renderWizard();
    const btn = screen.getByRole('button', { name: /save photo/i });
    expect(btn).toBeDisabled();
  });
});

// ===========================================================================
// BIO TAB — INITIAL RENDER + INPUT
// ===========================================================================
describe('EditProfileWizard — bio tab', () => {
  async function switchToBio(user) {
    await user.click(screen.getByRole('button', { name: /bio/i }));
  }

  it('pre-fills the textarea with userProfile.bio', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'Harlem rapper since day one' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    const ta = screen.getByPlaceholderText(/musical journey/i);
    expect(ta.value).toBe('Harlem rapper since day one');
  });

  it('starts empty when userProfile has no bio', async () => {
    renderWizard({ userProfile: baseProfile({ bio: null }) });
    const user = userEvent.setup();
    await switchToBio(user);
    const ta = screen.getByPlaceholderText(/musical journey/i);
    expect(ta.value).toBe('');
  });

  it('updates the textarea on user input', async () => {
    renderWizard({ userProfile: baseProfile({ bio: '' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.type(ta, 'New bio content');
    expect(ta.value).toBe('New bio content');
  });

  it('shows the character counter (length/500)', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'hello' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    expect(screen.getByText('5/500')).toBeInTheDocument();
  });

  it('character counter updates as user types', async () => {
    renderWizard({ userProfile: baseProfile({ bio: '' }) });
    const user = userEvent.setup();
    await switchToBio(user);
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.type(ta, 'abc');
    expect(screen.getByText('3/500')).toBeInTheDocument();
  });

  it('textarea has maxLength=500', async () => {
    renderWizard();
    const user = userEvent.setup();
    await switchToBio(user);
    const ta = screen.getByPlaceholderText(/musical journey/i);
    expect(ta.maxLength).toBe(500);
  });
});

// ===========================================================================
// BIO TAB — SAVE BUTTON STATE
// ===========================================================================
describe('EditProfileWizard — Save Bio button state', () => {
  it('Save Bio button is disabled when bio matches userProfile.bio', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'Original bio text' }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bio/i }));
    const btn = screen.getByRole('button', { name: /save bio/i });
    expect(btn).toBeDisabled();
  });

  it('Save Bio button enables when bio is changed', async () => {
    renderWizard({ userProfile: baseProfile({ bio: 'Old' }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bio/i }));
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.type(ta, ' new');
    const btn = screen.getByRole('button', { name: /save bio/i });
    expect(btn).toBeEnabled();
  });
});

// ===========================================================================
// BIO TAB — SAVE FLOW
// ===========================================================================
describe('EditProfileWizard — Save Bio flow', () => {
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
    await user.click(screen.getByRole('button', { name: /bio/i }));
    const ta = screen.getByPlaceholderText(/musical journey/i);
    // Replace the existing bio with new content, with surrounding whitespace
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
    renderWizard({
      userProfile: baseProfile({ bio: 'Old' }),
      onClose,
      onSuccess,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bio/i }));
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.type(ta, ' added');
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
    await user.click(screen.getByRole('button', { name: /bio/i }));
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.type(ta, ' new content');
    await user.click(screen.getByRole('button', { name: /save bio/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith('user', 'u-77');
      expect(invalidateSpy).toHaveBeenCalledWith('artist', 'u-77');
    });
  });

  it('shows "Saving..." state during bio save', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      await pending;
      return { data: {} };
    });

    renderWizard({ userProfile: baseProfile({ bio: 'Old' }) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /bio/i }));
    const ta = screen.getByPlaceholderText(/musical journey/i);
    await user.type(ta, ' more');
    await user.click(screen.getByRole('button', { name: /save bio/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving\.\.\./i })).toBeDisabled();
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

  it('clicking the × button calls onClose', async () => {
    const onClose = vi.fn();
    renderWizard({ onClose });
    const user = userEvent.setup();
    await user.click(document.querySelector('.close-button'));
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