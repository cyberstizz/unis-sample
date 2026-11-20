// src/uploadWizard.test.jsx
//
// Test suite for UploadWizard — the artist-facing flow that uploads a song or
// video with its details and, for explicit songs, an optional clean version.
//
// Wizard structure (current design):
//   Step 1 — media type (song / video)                    heading "Upload song"
//   Step 2 — title, description, ISRC, Sound & discovery   footer button "Review"
//            (songs only), explicit toggle, download
//            policy, media file, artwork
//   Step 3 — review, rights checkbox, "Upload now"         heading "Review upload"
//   Step 4 — explicit songs only: offer a clean version    heading "Clean version"
//
// Rules covered:
//   • show=false renders nothing; overlay and × close, inside clicks don't
//   • Review is disabled until there is a title and a file
//   • A song can't reach review without a subgenre and a mood; a video can
//   • File rules: MP3 for songs, MP4/MOV/AVI for videos, 50 MB cap
//   • Artwork rules: JPEG/PNG, 1 MB cap
//   • ISRC is uppercased and stripped to letters and digits
//   • Paid downloads: $0.94 minimum, price sent in cents
//   • The rights box must be ticked; nothing is sent without it
//   • Song payload carries the discovery fields and rightsConfirmed
//   • Video payload carries no song-only fields
//   • Explicit song → step 4; skip, or upload a clean MP3 and link it
//   • Server errors are shown; the button shows a busy state
//
// Pattern notes:
//   • apiCall is spied (not MSW) because FormData + MSW + axios + jsdom hangs.
//   • The taxonomy lists come from GET /v1/taxonomy, which the same spy answers.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

vi.mock('./uploadWizard.scss', () => ({}));
vi.mock('./soundDiscoveryFields.scss', () => ({}));
vi.mock('./RightsConfirm.scss', () => ({}));

import UploadWizard from './uploadWizard';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------
const RAP = '00000000-0000-0000-0000-000000000101';
const ROCK = '00000000-0000-0000-0000-000000000102';

const ARTIST_PROFILE = {
  userId: 'user-artist-001',
  username: 'testartist',
  displayName: 'Test Artist',
  role: 'artist',
  genreId: RAP,
  jurisdiction: { jurisdictionId: '00000000-0000-0000-0000-000000000003', name: 'Uptown Harlem' },
};

const TAXONOMY = {
  subgenres: [
    { subgenreId: 'sg-drill', genreId: RAP, name: 'Drill', soundsLike: 'sliding 808s' },
    { subgenreId: 'sg-boombap', genreId: RAP, name: 'Boom bap' },
    { subgenreId: 'sg-indie', genreId: ROCK, name: 'Indie rock' },
  ],
  moods: [
    { moodId: 'mood-hype', name: 'Hype' },
    { moodId: 'mood-chill', name: 'Chill' },
  ],
  languages: [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
  ],
};

function fakeFile({ name = 'track.mp3', type = 'audio/mpeg', sizeMB = 5 } = {}) {
  const file = new File(['x'.repeat(1024)], name, { type });
  Object.defineProperty(file, 'size', { value: Math.round(sizeMB * 1024 * 1024) });
  return file;
}

// fireEvent.change, not userEvent.upload: userEvent drops files the `accept`
// attribute rejects, which would hide the component's own type checks.
const selectFile = (input, file) => fireEvent.change(input, { target: { files: [file] } });

const fileInputs = () => document.querySelectorAll('input[type="file"]');
const mediaInput = () => fileInputs()[0];
const artworkInput = () => fileInputs()[1];

// ---------------------------------------------------------------------------
// apiCall spy — answers the taxonomy lookup, records everything else
// ---------------------------------------------------------------------------
let apiSpy;

function mockApi(handler = () => ({ data: { songId: 'song-new' } })) {
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    if (config.url === '/v1/taxonomy') return { data: TAXONOMY };
    return handler(config);
  });
  return apiSpy;
}

const uploadCalls = () =>
  apiSpy.mock.calls.map(([config]) => config).filter((c) => c.url !== '/v1/taxonomy');

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
  global.URL.revokeObjectURL = vi.fn();
  mockApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function renderWizard({
  onClose = vi.fn(),
  onUploadSuccess = vi.fn(),
  userProfile = ARTIST_PROFILE,
  show = true,
} = {}) {
  return {
    onClose,
    onUploadSuccess,
    ...render(
      <UploadWizard
        show={show}
        onClose={onClose}
        onUploadSuccess={onUploadSuccess}
        userProfile={userProfile}
      />
    ),
  };
}

async function goToStep2(user, { mediaType = 'song' } = {}) {
  if (mediaType === 'video') {
    await user.selectOptions(screen.getByRole('combobox'), 'video');
  }
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
}

async function pickDiscovery(user, { subgenre = 'sg-drill', mood = 'Hype' } = {}) {
  const primary = await screen.findByLabelText(/^subgenre/i);
  if (subgenre) await user.selectOptions(primary, subgenre);
  if (mood) await user.click(screen.getByRole('button', { name: mood }));
}

async function fillStep2(user, {
  mediaType = 'song',
  title = 'My Track',
  file,
  artwork = null,
  isrc = '',
  explicit = false,
  downloadPolicy = null,
  downloadPrice = '',
  discovery = true,
} = {}) {
  await goToStep2(user, { mediaType });
  if (title) await user.type(screen.getByPlaceholderText(/enter song or video title/i), title);
  if (isrc) await user.type(screen.getByPlaceholderText(/usrc/i), isrc);
  if (mediaType === 'song' && discovery) await pickDiscovery(user);
  if (explicit) await user.click(screen.getByRole('switch'));
  if (downloadPolicy) {
    const label = { free: 'Free', paid: 'Paid', unavailable: 'No download' }[downloadPolicy];
    await user.click(screen.getByRole('button', { name: label }));
  }
  if (downloadPrice) await user.type(screen.getByPlaceholderText('0.94'), downloadPrice);
  const media = file === undefined
    ? (mediaType === 'song' ? fakeFile() : fakeFile({ name: 'clip.mp4', type: 'video/mp4' }))
    : file;
  if (media) selectFile(mediaInput(), media);
  if (artwork) selectFile(artworkInput(), artwork);
}

async function goToReview(user, options = {}) {
  await fillStep2(user, options);
  await user.click(screen.getByRole('button', { name: /^review$/i }));
  expect(screen.getByRole('heading', { name: /review upload/i })).toBeInTheDocument();
}

const tickRights = (user) => user.click(screen.getByRole('checkbox'));

async function submit(user, { rights = true } = {}) {
  if (rights) await tickRights(user);
  await user.click(screen.getByRole('button', { name: /upload now/i }));
}

/** The JSON metadata part of an upload call's FormData. */
const metadataOf = (config, part = 'song') => JSON.parse(config.data.get(part));

/** The <dd> next to a review-row label. */
const summaryValue = (label) => {
  const dt = screen.getAllByText(label).find((el) => el.tagName === 'DT');
  return dt.nextElementSibling;
};

// ===========================================================================
// VISIBILITY AND CLOSING
// ===========================================================================
describe('UploadWizard — visibility and closing', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderWizard({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders a modal dialog when show=true', () => {
    renderWizard();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('closes when the overlay is clicked', async () => {
    const { onClose } = renderWizard();
    await userEvent.setup().click(document.querySelector('.uw-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the wizard itself is clicked', async () => {
    const { onClose } = renderWizard();
    await userEvent.setup().click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the × button', async () => {
    const { onClose } = renderWizard();
    await userEvent.setup().click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the artist initial when there is no profile photo', () => {
    renderWizard();
    expect(document.querySelector('.uw__avatar-fallback')).toHaveTextContent('T');
  });

  it('shows the profile photo when there is one', () => {
    renderWizard({ userProfile: { ...ARTIST_PROFILE, photoUrl: '/uploads/me.jpg' } });
    expect(screen.getByAltText('Test Artist')).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 1 — MEDIA TYPE
// ===========================================================================
describe('UploadWizard — step 1 (media type)', () => {
  it('starts on step 1 as a song upload', () => {
    renderWizard();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /upload song/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('song');
  });

  it('switches the heading when video is picked', async () => {
    renderWizard();
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'video');
    expect(screen.getByRole('heading', { name: /upload video/i })).toBeInTheDocument();
  });

  it('shows Next but no Back', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });

  it('shows the three progress steps with step 1 active', () => {
    renderWizard();
    const progress = screen.getByLabelText(/upload progress/i);
    ['Type', 'Details', 'Review'].forEach((label) => {
      expect(within(progress).getByText(label)).toBeInTheDocument();
    });
    expect(progress.querySelector('.is-active')).toHaveTextContent('Type');
  });
});

// ===========================================================================
// NAVIGATION
// ===========================================================================
describe('UploadWizard — navigation', () => {
  it('Next moves to step 2', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    expect(screen.getByPlaceholderText(/enter song or video title/i)).toBeInTheDocument();
  });

  it('Back from step 2 returns to step 1', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToStep2(user);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
  });

  it('Review is disabled until there is a title and a file', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToStep2(user);
    const review = screen.getByRole('button', { name: /^review$/i });
    expect(review).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/enter song or video title/i), 'My Track');
    expect(review).toBeDisabled();

    selectFile(mediaInput(), fakeFile());
    expect(review).toBeEnabled();
  });

  it('a complete song reaches the review step', async () => {
    renderWizard();
    await goToReview(userEvent.setup());
    expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
  });

  it('the review step has no Back/Next footer', async () => {
    renderWizard();
    await goToReview(userEvent.setup());
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^review$/i })).not.toBeInTheDocument();
  });

  it('marks earlier steps as done in the progress bar', async () => {
    renderWizard();
    await goToReview(userEvent.setup());
    const progress = screen.getByLabelText(/upload progress/i);
    expect(progress.querySelectorAll('.is-done')).toHaveLength(2);
    expect(progress.querySelector('.is-active')).toHaveTextContent('Review');
  });
});

// ===========================================================================
// STEP 2 — SOUND & DISCOVERY GATE
// ===========================================================================
describe('UploadWizard — sound & discovery', () => {
  it('shows the discovery block for songs', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    expect(await screen.findByRole('group', { name: /sound & discovery/i })).toBeInTheDocument();
  });

  it('hides the discovery block for videos', async () => {
    renderWizard();
    await goToStep2(userEvent.setup(), { mediaType: 'video' });
    expect(screen.queryByText(/sound & discovery/i)).not.toBeInTheDocument();
  });

  it('only offers the artist\'s own genre as the primary subgenre', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    const primary = await screen.findByLabelText(/^subgenre/i);
    expect(within(primary).getByRole('option', { name: 'Drill' })).toBeInTheDocument();
    expect(within(primary).queryByRole('option', { name: 'Indie rock' })).not.toBeInTheDocument();
  });

  it('blocks review when no subgenre is picked', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2(user, { discovery: false });
    await user.click(screen.getByRole('button', { name: /^review$/i }));

    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(document.querySelector('.uw__error')).toHaveTextContent(/pick the subgenre/i);
  });

  it('blocks review when a subgenre is picked but no mood', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2(user, { discovery: false });
    await pickDiscovery(user, { mood: null });
    await user.click(screen.getByRole('button', { name: /^review$/i }));

    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(document.querySelector('.uw__error')).toHaveTextContent(/pick at least one mood/i);
  });

  it('clears the error once the missing pick is made', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2(user, { discovery: false });
    await user.click(screen.getByRole('button', { name: /^review$/i }));
    expect(document.querySelector('.uw__error')).not.toBeNull();

    await pickDiscovery(user);
    expect(document.querySelector('.uw__error')).toBeNull();
  });

  it('a video reaches review without any discovery picks', async () => {
    renderWizard();
    await goToReview(userEvent.setup(), { mediaType: 'video' });
    expect(screen.getByRole('heading', { name: /review upload/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 2 — FILES
// ===========================================================================
describe('UploadWizard — media file rules', () => {
  it('accepts an MP3 for a song and shows its name and size', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(mediaInput(), fakeFile({ name: 'banger.mp3', sizeMB: 4.2 }));
    expect(screen.getByText(/banger\.mp3 — 4\.2 MB/)).toBeInTheDocument();
  });

  it('rejects a non-MP3 for a song', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(mediaInput(), fakeFile({ name: 'track.wav', type: 'audio/wav' }));
    expect(document.querySelector('.uw__error')).toHaveTextContent(/song must be MP3/i);
    expect(screen.getByRole('button', { name: /^review$/i })).toBeDisabled();
  });

  it('rejects a song over 50 MB', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(mediaInput(), fakeFile({ sizeMB: 51 }));
    expect(document.querySelector('.uw__error')).toHaveTextContent(/file too large \(max 50 MB\)/i);
  });

  it('accepts a file of exactly 50 MB', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(mediaInput(), fakeFile({ sizeMB: 50 }));
    expect(document.querySelector('.uw__error')).toBeNull();
  });

  it.each([
    ['clip.mp4', 'video/mp4'],
    ['clip.mov', 'video/quicktime'],
    ['clip.avi', 'video/x-msvideo'],
  ])('accepts %s for a video', async (name, type) => {
    renderWizard();
    await goToStep2(userEvent.setup(), { mediaType: 'video' });
    selectFile(mediaInput(), fakeFile({ name, type }));
    expect(document.querySelector('.uw__error')).toBeNull();
    expect(screen.getByText(new RegExp(`${name.replace('.', '\\.')} —`))).toBeInTheDocument();
  });

  it('rejects an MP3 for a video', async () => {
    renderWizard();
    await goToStep2(userEvent.setup(), { mediaType: 'video' });
    selectFile(mediaInput(), fakeFile());
    expect(document.querySelector('.uw__error')).toHaveTextContent(/video must be MP4 \/ MOV \/ AVI/i);
  });

  it('a valid file clears an earlier file error', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(mediaInput(), fakeFile({ type: 'audio/wav' }));
    expect(document.querySelector('.uw__error')).not.toBeNull();
    selectFile(mediaInput(), fakeFile());
    expect(document.querySelector('.uw__error')).toBeNull();
  });
});

describe('UploadWizard — artwork rules', () => {
  it.each([
    ['cover.jpg', 'image/jpeg'],
    ['cover.png', 'image/png'],
  ])('accepts %s', async (name, type) => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(artworkInput(), fakeFile({ name, type, sizeMB: 0.5 }));
    expect(document.querySelector('.uw__error')).toBeNull();
    expect(screen.getByText(new RegExp(`${name.replace('.', '\\.')} —`))).toBeInTheDocument();
  });

  it('rejects a GIF', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(artworkInput(), fakeFile({ name: 'cover.gif', type: 'image/gif', sizeMB: 0.5 }));
    expect(document.querySelector('.uw__error')).toHaveTextContent(/artwork must be JPEG or PNG/i);
  });

  it('rejects artwork over 1 MB', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    selectFile(artworkInput(), fakeFile({ name: 'cover.jpg', type: 'image/jpeg', sizeMB: 1.5 }));
    expect(document.querySelector('.uw__error')).toHaveTextContent(/artwork too large \(max 1 MB\)/i);
  });
});

// ===========================================================================
// STEP 2 — ISRC, EXPLICIT, DOWNLOAD POLICY
// ===========================================================================
describe('UploadWizard — ISRC, explicit and download policy', () => {
  it('uppercases the ISRC and strips anything that is not a letter or digit', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToStep2(user);
    const isrc = screen.getByPlaceholderText(/usrc/i);
    await user.type(isrc, 'us-rc1 76_07839');
    expect(isrc).toHaveValue('USRC17607839');
  });

  it('caps the ISRC at 15 characters', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    expect(screen.getByPlaceholderText(/usrc/i)).toHaveAttribute('maxLength', '15');
  });

  it('the explicit switch starts off and toggles on click', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToStep2(user);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/prompted to add an optional clean version/i)).toBeInTheDocument();
  });

  it('the explicit switch works from the keyboard', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToStep2(user);
    const toggle = screen.getByRole('switch');
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('hides the explicit switch and download policy for videos', async () => {
    renderWizard();
    await goToStep2(userEvent.setup(), { mediaType: 'video' });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText(/download availability/i)).not.toBeInTheDocument();
  });

  it('defaults to a free download', async () => {
    renderWizard();
    await goToStep2(userEvent.setup());
    expect(screen.getByRole('button', { name: 'Free' })).toHaveClass('is-active');
    expect(screen.getByText(/download this track for free/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('0.94')).not.toBeInTheDocument();
  });

  it('Paid reveals the price box; switching away hides and clears it', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToStep2(user);
    await user.click(screen.getByRole('button', { name: 'Paid' }));
    await user.type(screen.getByPlaceholderText('0.94'), '1.99');

    await user.click(screen.getByRole('button', { name: 'No download' }));
    expect(screen.queryByPlaceholderText('0.94')).not.toBeInTheDocument();
    expect(screen.getByText(/stream but not download/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Paid' }));
    expect(screen.getByPlaceholderText('0.94')).toHaveValue(null);
  });

  it('tells the artist what they receive at a valid price', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToStep2(user);
    await user.click(screen.getByRole('button', { name: 'Paid' }));
    await user.type(screen.getByPlaceholderText('0.94'), '1.99');
    expect(screen.getByText(/at \$1\.99 you receive \$1\.62/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 3 — REVIEW
// ===========================================================================
describe('UploadWizard — review step', () => {
  it('lists what was entered', async () => {
    renderWizard();
    await goToReview(userEvent.setup(), {
      title: 'Uptown Anthem',
      isrc: 'USRC17607839',
      file: fakeFile({ name: 'anthem.mp3' }),
      artwork: fakeFile({ name: 'cover.png', type: 'image/png', sizeMB: 0.4 }),
    });
    expect(summaryValue('Title')).toHaveTextContent('Uptown Anthem');
    expect(summaryValue('File')).toHaveTextContent('anthem.mp3');
    expect(summaryValue('Artwork')).toHaveTextContent('cover.png');
    expect(summaryValue('ISRC')).toHaveTextContent('USRC17607839');
    expect(summaryValue('Subgenre')).toHaveTextContent('Drill');
    expect(summaryValue('Mood')).toHaveTextContent('Hype');
    expect(summaryValue('Language')).toHaveTextContent('English');
    expect(summaryValue('Explicit')).toHaveTextContent('No');
    expect(summaryValue('Download')).toHaveTextContent('Free');
  });

  it('shows a dash for the optional fields left blank', async () => {
    renderWizard();
    await goToReview(userEvent.setup());
    expect(summaryValue('Description')).toHaveTextContent('—');
    expect(summaryValue('Artwork')).toHaveTextContent('—');
    expect(summaryValue('ISRC')).toHaveTextContent('—');
  });

  it('shows the paid price and the explicit flag', async () => {
    renderWizard();
    await goToReview(userEvent.setup(), { explicit: true, downloadPolicy: 'paid', downloadPrice: '1.5' });
    expect(summaryValue('Explicit')).toHaveTextContent('Yes');
    expect(summaryValue('Download')).toHaveTextContent('$1.50');
  });

  it('shows "Not available" when downloads are off', async () => {
    renderWizard();
    await goToReview(userEvent.setup(), { downloadPolicy: 'unavailable' });
    expect(summaryValue('Download')).toHaveTextContent('Not available');
  });

  it('leaves the song-only rows out for a video', async () => {
    renderWizard();
    await goToReview(userEvent.setup(), { mediaType: 'video' });
    ['Subgenre', 'Mood', 'Explicit', 'Download'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  it('previews the audio and the artwork', async () => {
    renderWizard();
    await goToReview(userEvent.setup(), {
      artwork: fakeFile({ name: 'cover.png', type: 'image/png', sizeMB: 0.4 }),
    });
    expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:mock-preview-url');
    expect(screen.getByAltText(/artwork preview/i)).toBeInTheDocument();
  });

  it('warns that the upload cannot be undone', async () => {
    renderWizard();
    await goToReview(userEvent.setup());
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 3 — RIGHTS BOX
// ===========================================================================
describe('UploadWizard — rights confirmation', () => {
  it('shows the rights box unticked', async () => {
    renderWizard();
    await goToReview(userEvent.setup());
    expect(screen.getByRole('group', { name: /your rights to this song/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('words the box for the music in a video', async () => {
    renderWizard();
    await goToReview(userEvent.setup(), { mediaType: 'video' });
    expect(screen.getByRole('group', { name: /your rights to the music in this video/i })).toBeInTheDocument();
  });

  it('sends nothing and shows an alert when the box is not ticked', async () => {
    const { onUploadSuccess } = renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user, { rights: false });

    expect(await screen.findByRole('alert')).toHaveTextContent(/check the box to upload this song/i);
    expect(uploadCalls()).toHaveLength(0);
    expect(onUploadSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /upload now/i })).toBeEnabled();
  });

  it('ticking the box clears the alert', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user, { rights: false });
    await screen.findByRole('alert');

    await tickRights(user);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// SUBMIT — SONG
// ===========================================================================
describe('UploadWizard — song upload', () => {
  it('POSTs multipart form data to /v1/media/song with a long timeout', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);

    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    const [call] = uploadCalls();
    expect(call.url).toBe('/v1/media/song');
    expect(call.method).toBe('post');
    expect(call.data).toBeInstanceOf(FormData);
    expect(call.headers['Content-Type']).toBe('multipart/form-data');
    expect(call.timeout).toBe(10 * 60 * 1000);
  });

  it('sends the details, discovery picks and rights confirmation', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { title: 'Uptown Anthem', isrc: 'USRC17607839' });
    await submit(user);

    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    expect(metadataOf(uploadCalls()[0])).toEqual({
      title: 'Uptown Anthem',
      description: '',
      genreId: RAP,
      artistId: 'user-artist-001',
      jurisdictionId: '00000000-0000-0000-0000-000000000003',
      rightsConfirmed: true,
      explicit: false,
      isrc: 'USRC17607839',
      downloadPolicy: 'free',
      downloadPrice: null,
      primarySubgenreId: 'sg-drill',
      subgenreWriteIn: null,
      secondarySubgenreId: null,
      primaryMoodId: 'mood-hype',
      secondaryMoodId: null,
      language: 'en',
    });
  });

  it('attaches the file, and the artwork when there is one', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, {
      file: fakeFile({ name: 'anthem.mp3' }),
      artwork: fakeFile({ name: 'cover.png', type: 'image/png', sizeMB: 0.4 }),
    });
    await submit(user);

    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    const { data } = uploadCalls()[0];
    expect(data.get('file').name).toBe('anthem.mp3');
    expect(data.get('artwork').name).toBe('cover.png');
  });

  it('leaves the artwork part out when none was chosen', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);
    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    expect(uploadCalls()[0].data.has('artwork')).toBe(false);
  });

  it('sends a null ISRC when left blank', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);
    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    expect(metadataOf(uploadCalls()[0]).isrc).toBeNull();
  });

  it('falls back to the default genre and jurisdiction when the profile has none', async () => {
    renderWizard({ userProfile: { userId: 'user-artist-001' } });
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);
    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    const meta = metadataOf(uploadCalls()[0]);
    expect(meta.genreId).toBe(RAP);
    expect(meta.jurisdictionId).toBe('00000000-0000-0000-0000-000000000002');
  });

  it('on success reports the song, closes, and resets to step 1', async () => {
    mockApi(() => ({ data: { songId: 'song-123', title: 'My Track' } }));
    const { onClose, onUploadSuccess } = renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith({ songId: 'song-123', title: 'My Track' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
  });

  it('shows a busy button while the upload is in flight', async () => {
    let finish;
    mockApi(() => new Promise((resolve) => { finish = resolve; }));
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);

    const busy = await screen.findByRole('button', { name: /uploading/i });
    expect(busy).toBeDisabled();
    finish({ data: { songId: 'song-1' } });
    await waitFor(() => expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument());
  });
});

// ===========================================================================
// SUBMIT — PAID DOWNLOADS
// ===========================================================================
describe('UploadWizard — paid download price', () => {
  it('sends the price in cents', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { downloadPolicy: 'paid', downloadPrice: '1.99' });
    await submit(user);
    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    const meta = metadataOf(uploadCalls()[0]);
    expect(meta.downloadPolicy).toBe('paid');
    expect(meta.downloadPrice).toBe(199);
  });

  it('accepts the $0.94 minimum', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { downloadPolicy: 'paid', downloadPrice: '0.94' });
    await submit(user);
    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    expect(metadataOf(uploadCalls()[0]).downloadPrice).toBe(94);
  });

  it('refuses a price under $0.94', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { downloadPolicy: 'paid', downloadPrice: '0.93' });
    await submit(user);
    expect(document.querySelector('.uw__error')).toHaveTextContent(/minimum download price is \$0\.94/i);
    expect(uploadCalls()).toHaveLength(0);
  });

  it('refuses a paid download with no price', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { downloadPolicy: 'paid' });
    await submit(user);
    expect(document.querySelector('.uw__error')).toHaveTextContent(/minimum download price/i);
    expect(uploadCalls()).toHaveLength(0);
  });

  it('sends a null price when downloads are off', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { downloadPolicy: 'unavailable' });
    await submit(user);
    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    const meta = metadataOf(uploadCalls()[0]);
    expect(meta.downloadPolicy).toBe('unavailable');
    expect(meta.downloadPrice).toBeNull();
  });
});

// ===========================================================================
// SUBMIT — VIDEO
// ===========================================================================
describe('UploadWizard — video upload', () => {
  it('POSTs to /v1/media/video with no song-only fields', async () => {
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { mediaType: 'video', title: 'My Video' });
    await submit(user);

    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    const [call] = uploadCalls();
    expect(call.url).toBe('/v1/media/video');
    expect(metadataOf(call, 'video')).toEqual({
      title: 'My Video',
      description: '',
      genreId: RAP,
      artistId: 'user-artist-001',
      jurisdictionId: '00000000-0000-0000-0000-000000000003',
      rightsConfirmed: true,
    });
    expect(call.data.has('song')).toBe(false);
  });

  it('closes after a video upload without offering a clean version', async () => {
    const { onClose, onUploadSuccess } = renderWizard();
    const user = userEvent.setup();
    await goToReview(user, { mediaType: 'video' });
    await submit(user);
    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: /clean version/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// SUBMIT — ERRORS
// ===========================================================================
describe('UploadWizard — upload errors', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows the server message', async () => {
    mockApi(() => Promise.reject({ response: { data: { message: 'Title already used' } } }));
    const { onClose, onUploadSuccess } = renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);

    await waitFor(() => expect(document.querySelector('.uw__error')).toHaveTextContent('Title already used'));
    expect(onUploadSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to the error message, then to "Upload failed"', async () => {
    mockApi(() => Promise.reject(new Error('Network Error')));
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);
    await waitFor(() => expect(document.querySelector('.uw__error')).toHaveTextContent('Network Error'));

    mockApi(() => Promise.reject({}));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    await waitFor(() => expect(document.querySelector('.uw__error')).toHaveTextContent('Upload failed'));
  });

  it('re-enables the button after a failure and logs it', async () => {
    mockApi(() => Promise.reject(new Error('boom')));
    renderWizard();
    const user = userEvent.setup();
    await goToReview(user);
    await submit(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /upload now/i })).toBeEnabled());
    expect(console.error).toHaveBeenCalledWith('Upload error:', expect.any(Error));
  });
});

// ===========================================================================
// STEP 4 — CLEAN VERSION
// ===========================================================================
describe('UploadWizard — clean version (explicit songs)', () => {
  async function uploadExplicit(user, handler) {
    mockApi(handler || ((config) => {
      if (config.method === 'patch') return { data: {} };
      const meta = JSON.parse(config.data.get('song'));
      return { data: { songId: meta.isCleanVersion ? 'song-clean' : 'song-explicit', title: meta.title } };
    }));
    const utils = renderWizard();
    await goToReview(user, { title: 'Raw Cut', explicit: true });
    await submit(user);
    expect(await screen.findByRole('heading', { name: /clean version/i })).toBeInTheDocument();
    return utils;
  }

  it('an explicit song moves to the clean-version step instead of closing', async () => {
    const { onClose, onUploadSuccess } = await uploadExplicit(userEvent.setup());
    expect(screen.getByText(/"Raw Cut"/)).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.queryByLabelText(/upload progress/i)).not.toBeInTheDocument();
    expect(onUploadSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the explicit upload itself is flagged explicit', async () => {
    await uploadExplicit(userEvent.setup());
    expect(metadataOf(uploadCalls()[0]).explicit).toBe(true);
  });

  it('"No, skip for now" reports the explicit song and closes', async () => {
    const user = userEvent.setup();
    const { onClose, onUploadSuccess } = await uploadExplicit(user);
    await user.click(screen.getByRole('button', { name: /no, skip for now/i }));

    expect(onUploadSuccess).toHaveBeenCalledWith({ songId: 'song-explicit', title: 'Raw Cut' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(uploadCalls()).toHaveLength(1);
  });

  it('"Yes" shows the clean-file picker with upload disabled until a file is chosen', async () => {
    const user = userEvent.setup();
    await uploadExplicit(user);
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));

    expect(screen.getByText(/"Raw Cut \(Clean\)"/)).toBeInTheDocument();
    const upload = screen.getByRole('button', { name: /^upload clean version$/i });
    expect(upload).toBeDisabled();

    selectFile(mediaInput(), fakeFile({ name: 'raw-clean.mp3' }));
    expect(upload).toBeEnabled();
  });

  it('rejects a clean file that is not an MP3', async () => {
    const user = userEvent.setup();
    await uploadExplicit(user);
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));
    selectFile(mediaInput(), fakeFile({ name: 'raw.wav', type: 'audio/wav' }));
    expect(document.querySelector('.uw__error')).toHaveTextContent(/clean version must be MP3/i);
  });

  it('rejects a clean file over 50 MB', async () => {
    const user = userEvent.setup();
    await uploadExplicit(user);
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));
    selectFile(mediaInput(), fakeFile({ sizeMB: 60 }));
    expect(document.querySelector('.uw__error')).toHaveTextContent(/file too large/i);
  });

  it('uploads the clean song with the inherited details, then links it', async () => {
    const user = userEvent.setup();
    const { onClose, onUploadSuccess } = await uploadExplicit(user);
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));
    selectFile(mediaInput(), fakeFile({ name: 'raw-clean.mp3' }));
    await user.click(screen.getByRole('button', { name: /^upload clean version$/i }));

    await waitFor(() => expect(uploadCalls()).toHaveLength(3));
    const [, cleanCall, linkCall] = uploadCalls();

    expect(cleanCall.url).toBe('/v1/media/song');
    expect(cleanCall.method).toBe('post');
    expect(cleanCall.timeout).toBe(10 * 60 * 1000);
    expect(cleanCall.data.get('file').name).toBe('raw-clean.mp3');
    expect(metadataOf(cleanCall)).toMatchObject({
      title: 'Raw Cut (Clean)',
      explicit: false,
      isrc: null,
      isCleanVersion: true,
      rightsConfirmed: true,
      genreId: RAP,
      primarySubgenreId: 'sg-drill',
      primaryMoodId: 'mood-hype',
      language: 'en',
    });

    expect(linkCall.url).toBe('/v1/media/song/song-explicit');
    expect(linkCall.method).toBe('patch');
    expect(linkCall.data.get('cleanVersionId')).toBe('song-clean');

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith({ songId: 'song-explicit', title: 'Raw Cut' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('skips the link call when the server returns no clean song id', async () => {
    const user = userEvent.setup();
    const { onUploadSuccess } = await uploadExplicit(user, (config) => {
      const meta = JSON.parse(config.data.get('song'));
      return { data: meta.isCleanVersion ? {} : { songId: 'song-explicit' } };
    });
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));
    selectFile(mediaInput(), fakeFile());
    await user.click(screen.getByRole('button', { name: /^upload clean version$/i }));

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledTimes(1));
    expect(uploadCalls().some((c) => c.method === 'patch')).toBe(false);
  });

  it('shows an error and stays open when the clean upload fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { onClose } = await uploadExplicit(user, (config) => {
      const meta = JSON.parse(config.data.get('song'));
      if (meta.isCleanVersion) return Promise.reject({ response: { data: { message: 'Clean upload refused' } } });
      return { data: { songId: 'song-explicit' } };
    });
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));
    selectFile(mediaInput(), fakeFile());
    await user.click(screen.getByRole('button', { name: /^upload clean version$/i }));

    await waitFor(() => expect(document.querySelector('.uw__error')).toHaveTextContent('Clean upload refused'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^upload clean version$/i })).toBeEnabled();
  });

  it('the Skip button on the picker also finishes the upload', async () => {
    const user = userEvent.setup();
    const { onClose, onUploadSuccess } = await uploadExplicit(user);
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));
    await user.click(screen.getByRole('button', { name: /^skip$/i }));
    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
