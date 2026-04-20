// src/test/mocks/handlers.js
// Default handlers — represent the "happy path" backend. Override per-test with server.use().

import { http, HttpResponse } from 'msw';

const API = 'http://localhost:8080/api';

// ─── Fixture data ───
export const fixtures = {
  users: {
    listener: {
      userId: 'user-listener-001',
      username: 'testlistener',
      email: 'listener@test.com',
      role: 'listener',
      jurisdiction: { jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem' },
      genre: { genreId: '00000000-0000-0000-0000-000000000101', name: 'Rap' },
      supportedArtistId: 'user-artist-001',
      themePreference: 'blue',
    },
    artist: {
      userId: 'user-artist-001',
      username: 'testartist',
      email: 'artist@test.com',
      role: 'artist',
      jurisdiction: { jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem' },
      genre: { genreId: '00000000-0000-0000-0000-000000000101', name: 'Rap' },
      themePreference: 'blue',
    },
  },
  songs: [
    { id: 'song-001', songId: 'song-001', title: 'Track One', artist: 'testartist', artistId: 'user-artist-001', mediaUrl: 'https://cdn.test/song-001.mp3', artworkUrl: 'https://cdn.test/song-001.jpg', score: 100, playsToday: 10 },
    { id: 'song-002', songId: 'song-002', title: 'Track Two', artist: 'testartist', artistId: 'user-artist-001', mediaUrl: 'https://cdn.test/song-002.mp3', artworkUrl: 'https://cdn.test/song-002.jpg', score: 85, playsToday: 5 },
  ],
  earnings: {
    referralEarnings: { lifetime: 12.5, thisMonth: 5.0, level1: { lifetime: 8.0, thisMonth: 3.0 }, level2: { lifetime: 3.0, thisMonth: 1.5 }, level3: { lifetime: 1.5, thisMonth: 0.5 } },
    supporterEarnings: { lifetime: 10.0, thisMonth: 4.0 },
    totalEarnings: { lifetime: 22.5, thisMonth: 9.0 },
    referralCount: 3,
    supporterCount: 5,
    referralViewsThisMonth: 200,
    currentBalance: 22.5,
    payoutThreshold: 50.0,
    payoutReady: false,
    cpm: 3.5,
  },
};

// ─── JWT helpers — tokens are opaque to the frontend except for the payload ───
export function makeToken(userId) {
  // Minimal JWT shape that AuthContext.decodeToken can parse
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ userId, sub: userId, iat: Date.now() / 1000 }));
  return `${header}.${payload}.fake-signature`;
}

// ─── Call-count tracking — many tests assert "was this endpoint hit?" ───
export const callTracker = {
  counts: {},
  payloads: {},
  reset() { this.counts = {}; this.payloads = {}; },
  track(key) { this.counts[key] = (this.counts[key] || 0) + 1; },
  get(key) { return this.counts[key] || 0; },
  store(key, value) { this.payloads[key] = value; },
  retrieve(key) { return this.payloads[key]; },
};

export const handlers = [
  // ─── Auth ───
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = await request.json();
    if (body.email === 'listener@test.com') {
      return HttpResponse.json({ token: makeToken(fixtures.users.listener.userId) });
    }
    if (body.email === 'artist@test.com') {
      return HttpResponse.json({ token: makeToken(fixtures.users.artist.userId) });
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),

  // ─── User profiles ───
  http.get(`${API}/v1/users/profile/:userId`, ({ params }) => {
    const { userId } = params;
    if (userId === fixtures.users.listener.userId) return HttpResponse.json(fixtures.users.listener);
    if (userId === fixtures.users.artist.userId) return HttpResponse.json(fixtures.users.artist);
    return new HttpResponse(null, { status: 404 });
  }),

  // ─── Admin roles (called by AuthContext login/init) ───
  http.get(`${API}/v1/admin/roles`, () => HttpResponse.json([])),

  // ─── Media / plays ───
  http.get(`${API}/v1/media/trending/today`, () => HttpResponse.json(fixtures.songs)),
  http.get(`${API}/v1/media/trending`, () => HttpResponse.json(fixtures.songs)),
  http.get(`${API}/v1/media/new`, () => HttpResponse.json(fixtures.songs)),
  http.get(`${API}/v1/media/song/:songId`, ({ params }) => {
    const song = fixtures.songs.find((s) => s.id === params.songId);
    if (!song) return new HttpResponse(null, { status: 404 });
    // Return the "full" shape (what SongPage expects)
    return HttpResponse.json({
      songId: song.id,
      title: song.title,
      artist: { userId: song.artistId, username: song.artist, photoUrl: null },
      jurisdiction: { jurisdictionId: fixtures.users.listener.jurisdiction.jurisdictionId, name: 'Harlem' },
      genre: { genreId: '00000000-0000-0000-0000-000000000101', name: 'Rap' },
      artworkUrl: song.artworkUrl,
      fileUrl: song.mediaUrl,
      score: song.score,
      playCount: song.playsToday * 10,
      playsToday: song.playsToday,
      explicit: false,
      description: 'Test description',
      duration: 180000, // ms
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      lyrics: '',
    });
  }),
  http.post(`${API}/v1/media/song/:songId/play`, ({ params }) => {
    callTracker.track(`play:${params.songId}`);
    return HttpResponse.json({ tracked: true });
  }),
  // Like system — shapes match Player.jsx expectations
  http.get(`${API}/v1/media/song/:songId/is-liked`, () =>
    HttpResponse.json({ isLiked: false })
  ),
  http.get(`${API}/v1/media/song/:songId/likes/count`, () =>
    HttpResponse.json({ count: 0 })
  ),
  http.post(`${API}/v1/media/song/:songId/like`, ({ params }) => {
    callTracker.track(`like:${params.songId}`);
    return HttpResponse.json({ success: true });
  }),
  http.delete(`${API}/v1/media/song/:songId/like`, ({ params }) => {
    callTracker.track(`unlike:${params.songId}`);
    return HttpResponse.json({ success: true });
  }),
  http.post(`${API}/v1/media/video/:videoId/play`, () => HttpResponse.json({ tracked: true })),

  // ─── Ad tracking ───
  http.post(`${API}/v1/earnings/track-view`, () => {
    callTracker.track('ad-view');
    return HttpResponse.json({ tracked: true });
  }),

  // ─── Earnings ───
  http.get(`${API}/v1/earnings/my-summary`, () => HttpResponse.json(fixtures.earnings)),
  http.get(`${API}/v1/earnings/my-referrals`, () => HttpResponse.json([])),
  http.get(`${API}/v1/earnings/my-history`, () => HttpResponse.json([])),

  // ─── Stripe Connect ───
  http.get(`${API}/v1/stripe/status`, () =>
    HttpResponse.json({ hasAccount: true, onboardingComplete: true, payoutsEnabled: true, stripeAccountId: 'acct_test' })
  ),
  http.get(`${API}/v1/stripe/payouts`, () => HttpResponse.json([])),
  http.post(`${API}/v1/stripe/onboard`, () => HttpResponse.json({ url: 'https://stripe.test/onboard' })),
  http.post(`${API}/v1/stripe/payout`, () =>
    HttpResponse.json({ success: true, payoutId: 'po_test', amount: 50.0, status: 'completed' })
  ),

  // ─── Votes / leaderboards / awards ───
  http.get(`${API}/v1/vote/leaderboards`, () => HttpResponse.json([])),
  http.get(`${API}/v1/vote/nominees`, () => HttpResponse.json([])),
  http.get(`${API}/v1/vote/history`, () => HttpResponse.json([])),
  http.post(`${API}/v1/vote/submit`, () => {
    callTracker.track('vote-submit');
    return HttpResponse.json({ success: true });
  }),
  http.get(`${API}/v1/awards/past`, () => HttpResponse.json([])),
  http.get(`${API}/v1/awards/leaderboards`, () => HttpResponse.json([])),

  // ─── Comments ───
  http.get(`${API}/v1/comments/song/:songId`, () => HttpResponse.json([])),
  http.get(`${API}/v1/comments/song/:songId/count`, () =>
    HttpResponse.json({ totalCount: 0, topLevelCount: 0 })
  ),
  http.get(`${API}/v1/comments/song/:songId/user-count`, () =>
    HttpResponse.json({ count: 0, limit: 3, remaining: 3, limitReached: false })
  ),

  // ─── Artist-specific ───
  http.get(`${API}/v1/users/:id/followers/count`, () => HttpResponse.json({ count: 0 })),
  http.post(`${API}/v1/users/:id/follow`, () => {
    callTracker.track('follow');
    return HttpResponse.json({ success: true });
  }),
  http.delete(`${API}/v1/users/:id/follow`, () => {
    callTracker.track('unfollow');
    return HttpResponse.json({ success: true });
  }),

  // ─── CreateAccountWizard endpoints ───
  http.get(`${API}/v1/users/validate-referral/:code`, ({ params }) => {
    callTracker.track(`validate-referral:${params.code}`);
    // Default: valid for any code (individual tests override)
    return HttpResponse.json({ valid: true, referrerUsername: 'TestReferrer' });
  }),
  http.get(`${API}/v1/users/check-username`, ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    callTracker.track(`check-username:${username}`);
    return HttpResponse.json({ available: true });
  }),
  http.get(`${API}/v1/users/check-email`, ({ request }) => {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    callTracker.track(`check-email:${email}`);
    return HttpResponse.json({ available: true });
  }),
  http.get(`${API}/v1/users/artists/active`, () => HttpResponse.json([
    { userId: 'artist-1', username: 'Tony Fadd', photoUrl: null, jurisdiction: { jurisdictionId: '52740de0-e4e9-4c9e-b68e-1e170f6788c4', name: 'Uptown Harlem' }, defaultSongId: 'song-001', defaultSong: { title: 'First Track' } },
    { userId: 'artist-2', username: 'SD Boomin', photoUrl: null, jurisdiction: { jurisdictionId: '4b09eaa2-03bc-4778-b7c2-db8b42c9e732', name: 'Downtown Harlem' }, defaultSongId: 'song-002', defaultSong: { title: 'Late Night' } },
  ])),
  http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.json({
    songId: 'song-001', title: 'First Track', fileUrl: '/uploads/test.mp3',
  })),
  http.patch(`${API}/v1/users/profile/photo`, () => {
    callTracker.track('upload-photo');
    return HttpResponse.json({ photoUrl: '/uploads/avatars/test-user.jpg' });
  }),
  http.post(`${API}/v1/users/register`, async ({ request }) => {
    const body = await request.json();
    callTracker.track('register');
    callTracker.store('register-payload', body);
    return HttpResponse.json({
      userId: 'new-user-id',
      username: body.username,
      email: body.email,
      role: body.role,
    });
  }),
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = await request.json();
    callTracker.track('login');
    callTracker.store('login-payload', body);
    return HttpResponse.json({ token: 'new-session-token', userId: 'new-user-id' });
  }),
  http.post(`${API}/v1/media/song`, () => {
    callTracker.track('upload-song');
    return HttpResponse.json({ songId: 'new-song-id', title: 'Uploaded Track' });
  }),

  // ─── Jurisdictions ───
  http.get(`${API}/v1/jurisdictions/byName/:name`, () =>
    HttpResponse.json({ jurisdictionId: fixtures.users.listener.jurisdiction.jurisdictionId, name: 'Harlem' })
  ),
  http.get(`${API}/v1/jurisdictions/:id/tops`, () => HttpResponse.json({ topArtists: [], topSongs: [] })),
  http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () => HttpResponse.json([])),

  // ─── Playlists ───
  http.get(`${API}/v1/playlists/mine`, () => HttpResponse.json([])),
  http.get(`${API}/v1/playlists/following`, () => HttpResponse.json([])),

  // ─── Activity tracking ───
  http.post(`${API}/v1/activity/track`, () => HttpResponse.json({ tracked: true })),

  // ─── User-related misc ───
  http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.json(fixtures.songs[0])),
  http.get(`${API}/v1/users/referral-code/:id`, () => HttpResponse.json({ referralCode: 'TEST-REF-CODE' })),
  http.get(`${API}/v1/users/:id/is-following`, () => HttpResponse.json({ following: false })),
  http.get(`${API}/v1/media/songs/artist/:id`, () => HttpResponse.json(fixtures.songs)),
  http.get(`${API}/v1/users/artist/top`, () => HttpResponse.json([fixtures.users.artist])),
  http.get(`${API}/v1/supporters/count`, () => HttpResponse.json({ count: 5 })),
  http.get(`${API}/v1/followers/count`, () => HttpResponse.json({ count: 10 })),
];
