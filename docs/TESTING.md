# Unis Frontend Test Suite

## Running tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-runs on file changes)
npm run test:findings # Run only the 9-concern audit tests
npm run test:coverage # Generate coverage report
npm run test:ui       # Open Vitest UI in the browser
```

## Structure

```
src/
├── test/
│   ├── setup.js              # Global test setup (JSDOM polyfills, MSW lifecycle)
│   ├── utils.jsx             # renderWithProviders() helper
│   ├── mocks/
│   │   ├── server.js         # MSW server instance
│   │   └── handlers.js       # Default API mocks + call tracker
│   └── findings/             # Tests organized by QA finding #
│       ├── 01-02-earnings.test.jsx
│       ├── 03-playTracker.integration.test.jsx
│       └── 04-09-remaining.test.jsx
└── utils/
    └── playTracker.test.js   # Co-located unit tests
```

## Test naming convention

### `[BUG #N]` prefix = intended-to-fail test

Tests prefixed with `[BUG #N]` are **designed to fail** against the current
production codebase. Each one documents a specific bug from `docs/QA_FINDINGS.md`
and will automatically flip to passing once the corresponding fix is applied.

This makes the test run output itself a live launch-blocker checklist.

When `npm test` shows:
```
× [BUG #4] LastWonNotification does NOT display awards dated in the future
× [BUG #6] should call /v1/awards/past, not /v1/vote/leaderboards
× [BUG #6] skips the API call when user.jurisdiction is missing
```
Each × is a known bug waiting on a fix. Green rows are confirmed correct behavior.

### `.todo` tests = intentional scaffolding

Tests marked `it.todo(...)` are stubs for future coverage. They don't run or
fail — they just appear in the report as a reminder. Flesh them out as the
feature surface grows.

## Fixture data

All tests share fixtures from `src/test/mocks/handlers.js`:

- `fixtures.users.listener` — logged-in listener (UUID, Harlem jurisdiction, rap genre)
- `fixtures.users.artist` — logged-in artist
- `fixtures.songs` — two test songs by `fixtures.users.artist`
- `fixtures.earnings` — a default earnings summary response

Override per-test with:
```js
server.use(
  http.get(`${API}/v1/earnings/my-summary`, () => HttpResponse.json({ ... }))
);
```

## Auth state in tests

`renderWithProviders` accepts an `as` option:

```js
renderWithProviders(<Feed />, { as: 'listener' });  // signed-in listener
renderWithProviders(<Feed />, { as: 'artist' });    // signed-in artist
renderWithProviders(<Feed />, { as: 'guest' });     // not signed in (default)
```

This injects a valid JWT into localStorage before mounting, so AuthContext
initializes into the right state.

## Call tracking

`callTracker` in `handlers.js` records every hit on certain endpoints. Use it
to assert "was this endpoint called?" without needing a vi.fn spy:

```js
import { callTracker } from '../mocks/handlers';

// ...in test:
callTracker.reset();
// ...render component...
expect(callTracker.get('ad-view')).toBe(1);          // /track-view was hit once
expect(callTracker.get('play:song-001')).toBe(0);    // song-001 /play was NOT hit
```

## Adding a new test

1. If it's for a **specific concern**, drop it in `src/test/findings/` and
   prefix the `it()` with `[BUG #N]` if it documents a known bug.
2. If it's for a **utility module**, co-locate it next to the module
   (e.g. `src/utils/buildUrl.test.js` next to `src/utils/buildUrl.js`).
3. If it's for a **component**, put it next to the component file
   (e.g. `src/feed.test.jsx` next to `src/feed.jsx`).

## Current state (as of April 2026)

```
Test Files  3 passed | 1 failed (4)
Tests       22 passed | 3 failed | 18 todo (43)
```

The 3 failing tests are the [BUG #N] tests listed above. All fix direction is
documented in `docs/QA_FINDINGS.md`.
