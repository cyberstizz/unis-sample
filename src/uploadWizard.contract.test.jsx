// src/uploadWizard.contract.test.jsx
//
// Focused contract tests for the upload payload, written against the CURRENT
// uploadWizard markup.
//
// Why this file exists separately: the legacy `uploadWizard.test.jsx` suite was
// written against a previous design of this component (it targets
// `.upload-wizard-overlay`, `select.input-field`, `.confirmation-summary`, and
// old heading text). 68 of its 72 tests fail on a pristine checkout, so it
// could not have caught anything. That suite needs a separate rewrite pass.
//
// What broke in production: the wizard built ONE metadata object for both
// media types and sent song-only keys (explicit, isrc, downloadPolicy,
// downloadPrice) on video uploads. `VideoUploadRequest` has no such fields and
// — unlike `SongUploadRequest` — lacked @JsonIgnoreProperties(ignoreUnknown),
// so Jackson rejected the entire body and every video upload 500'd with
// "JSON parse error". The old test asserted only the request URL and the
// FormData key, never the metadata itself, so it stayed green throughout.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';
import UploadWizard from './uploadWizard';

const ARTIST_PROFILE = {
  userId: 'user-artist-001',
  username: 'testartist',
  role: 'artist',
  photoUrl: null,
  jurisdiction: { jurisdictionId: '52740de0-e4e9-4c9e-b68e-1e170f6788c4', name: 'Harlem' },
};

// Fields the backend's VideoUploadRequest actually declares.
const VIDEO_ALLOWED_KEYS = ['title', 'description', 'genreId', 'artistId', 'jurisdictionId', 'duration'];
// Fields that exist only on SongUploadRequest.
const SONG_ONLY_KEYS = ['explicit', 'isrc', 'downloadPolicy', 'downloadPrice'];

const fakeFile = ({ name, type, sizeMB = 5 }) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeMB * 1024 * 1024 });
  return file;
};

/** Capture the metadata JSON and request config the wizard sends. */
const captureRequest = () => {
  const captured = {};
  vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    const fd = config.data;
    const key = Array.from(fd.keys()).find((k) => k === 'song' || k === 'video');
    captured.url = config.url;
    captured.key = key;
    captured.metadata = JSON.parse(fd.get(key));
    captured.timeout = config.timeout;
    return { data: { videoId: 'new-vid-1', songId: 'new-song-1' } };
  });
  return captured;
};

/** Walk the wizard from step 1 to a submitted upload. */
const submitUpload = async ({ mediaType, file }) => {
  const onUploadSuccess = vi.fn();
  render(
    <UploadWizard
      show
      onClose={vi.fn()}
      onUploadSuccess={onUploadSuccess}
      userProfile={ARTIST_PROFILE}
    />
  );
  const user = userEvent.setup();

  const next = () => document.querySelector('.uw__btn--next');

  // Step 1 — media type
  const typeSelect = document.querySelector('select.uw__select');
  if (mediaType === 'video') await user.selectOptions(typeSelect, 'video');
  await user.click(next());

  // Step 2 — title + file
  await user.type(document.querySelector('input.uw__input'), 'Test Title');
  const fileInput = document.querySelector('input[type="file"]');
  await user.upload(fileInput, file);
  await waitFor(() => expect(next()).not.toBeDisabled());
  await user.click(next());

  // Step 3 — submit
  const uploadBtn = await waitFor(() => {
    const b = document.querySelector('.uw__btn--upload');
    expect(b).not.toBeNull();
    return b;
  });
  await user.click(uploadBtn);

  return { onUploadSuccess };
};

describe('UploadWizard — upload payload contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom implements neither of these; the wizard calls them to preview the
    // selected file.
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:mock');
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends only VideoUploadRequest fields for a video upload', async () => {
    const captured = captureRequest();
    const { onUploadSuccess } = await submitUpload({
      mediaType: 'video',
      file: fakeFile({ name: 'clip.mp4', type: 'video/mp4' }),
    });

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalled());

    expect(captured.url).toBe('/v1/media/video');
    expect(captured.key).toBe('video');

    // This is the assertion that would have caught the production 500
    SONG_ONLY_KEYS.forEach((k) => expect(captured.metadata).not.toHaveProperty(k));
    Object.keys(captured.metadata).forEach((k) =>
      expect(VIDEO_ALLOWED_KEYS).toContain(k)
    );
  });

  it('still sends song-only fields for a song upload', async () => {
    const captured = captureRequest();
    const { onUploadSuccess } = await submitUpload({
      mediaType: 'song',
      file: fakeFile({ name: 'track.mp3', type: 'audio/mpeg' }),
    });

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalled());

    expect(captured.url).toBe('/v1/media/song');
    expect(captured.key).toBe('song');
    expect(captured.metadata).toHaveProperty('explicit');
    expect(captured.metadata).toHaveProperty('downloadPolicy');
  });

  it('uses an upload-sized timeout rather than the 10s global default', async () => {
    const captured = captureRequest();
    const { onUploadSuccess } = await submitUpload({
      mediaType: 'video',
      file: fakeFile({ name: 'clip.mp4', type: 'video/mp4', sizeMB: 45 }),
    });

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalled());

    // 45 MB cannot transfer in 10s on a normal connection
    expect(captured.timeout).toBeGreaterThanOrEqual(60_000);
  });
});