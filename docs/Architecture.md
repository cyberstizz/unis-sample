# UNIS — Web Frontend Architecture Documentation
**Project:** Unis (React Web)
**Stack:** React, React Router DOM, Axios, Framer Motion, Leaflet, jsPDF
**Base API URL:** `http://localhost:8080`
**Auth:** JWT (Bearer Token, stored in localStorage)

> **How to use this file:** Attach it at the start of any new AI thread working on this project. It replaces the need to paste individual component files for context.

---

## Table of Contents
1. [Project Entry Points](#1-project-entry-points)
2. [Global Contexts](#2-global-contexts)
3. [Navigation & Layout Shell](#3-navigation--layout-shell)
4. [Core Pages & Views](#4-core-pages--views)
5. [The Player System](#5-the-player-system)
6. [Wizards & Modals](#6-wizards--modals)
7. [Playlist System](#7-playlist-system)
8. [Utility & Mapping Files](#8-utility--mapping-files)
9. [API Endpoint Reference](#9-api-endpoint-reference)
10. [Known Issues & Refactor Flags](#10-known-issues--refactor-flags)

---

## 1. Project Entry Points

### `Main.jsx`
- Mounts `<App />` into `document.getElementById('root')`.
- Wraps app in React `StrictMode`.
- Imports `index.css` for global styles.
- **Dead Code Warning:** Contains unused imports (`BrowserRouter`, `Feed`, `Onboarding`, `ExploreFind`). Safe to delete — routing is handled inside `App.jsx`.

### `App.jsx`
- Application root. Sets up global context providers, router, and route map.
- **Provider hierarchy (order is critical):**
  1. `AuthProvider` — outermost, initializes session
  2. `PlayerProvider` — inside Auth, needs user data to fetch playlists
  3. `BrowserRouter` — inside providers, enables navigation
- **Conditional Layout (`AppLayout`):**
  - Uses `useLocation()` to detect if current path is `/login` or `/register`.
  - On auth pages: `Sidebar`, `Player`, and `Notifications` are all hidden.
- **Route Map:**

| Path | Component | Access |
|------|-----------|--------|
| `/login` | Login | Public |
| `/register` | CreateAccountWizard | Public |
| `/` | Feed | Protected |
| `/artist/:artistId` | ArtistPage | Protected |
| `/song/:songId` | SongPage | Protected |
| `/jurisdiction/:jurisdiction` | JurisdictionPage | Protected |
| `/artistDashboard` | ArtistDashboard | Protected (Artist role) |

- Protected routes are wrapped in `<PrivateRoute />` which checks `useAuth().user` and redirects to `/login` if null.

---

## 2. Global Contexts

### `AuthContext.js`
**Role:** Global session manager.

**Exports:** `AuthProvider`, `useAuth()`

**State:**
- `user` (Object | null) — full profile of logged-in user; null = guest
- `loading` (Boolean) — true while checking for existing session on app mount

**Key Functions:**

| Function | Logic |
|----------|-------|
| `init (useEffect)` | Reads JWT from `localStorage`, decodes `userId` via `atob()`, fetches `/v1/users/profile/{userId}`. Clears storage on 401/404. |
| `login(credentials)` | POST `/auth/login` → saves token → decodes userId → fetches profile → sets `user` state |
| `logout()` | Removes token from `localStorage`, sets `user` to null, hard redirects to `/login` via `window.location.href` |

**Porting Note (React Native):** Replace `localStorage` with `expo-av` SecureStore. Replace `window.location.href` with React Navigation's `navigation.navigate()`.

---

### `PlayerContext.js`
**Role:** Global media engine and playlist library manager.

**Exports:** `PlayerProvider`, `PlayerContext`

**State:**
- `currentMedia` — active song object
- `isPlaying` — Boolean
- `playlist` — current queue (array of song objects)
- `currentIndex` — position in queue
- `playlists` — user's saved playlist library (from backend)
- `isExpanded` — mini vs full-screen player mode
- `showPlaylistManager` — toggles playlist modal

**Key Functions:**

| Function | Logic |
|----------|-------|
| `playMedia(track, queue)` | Sets `currentMedia`. Replaces queue if `newPlaylist` passed; otherwise finds song index in existing queue. |
| `next()` / `prev()` | Increments/decrements `currentIndex`, updates `currentMedia` |
| `loadUserPlaylists()` | GET `/v1/playlists` → normalizes data (maps `songId` → `id`) → updates state |
| `createPlaylist(name)` | POST to API → calls `loadUserPlaylists()` |
| `addToPlaylist(id, track)` | POST to API → calls `loadUserPlaylists()` |
| `reorderPlaylist` / `deletePlaylist` | API calls → reload |
| `openPlaylistManager()` | Sets `showPlaylistManager` to true (called from Sidebar) |

**Audio Engine:** Uses `useRef` on an HTML5 `<audio>` element. Listens for `play`, `pause`, `ended` events to sync React state. On `ended`, auto-calls `next()`.

**Keyboard:** Global `keydown` listener — Spacebar toggles play/pause (ignores if focus is on an input).

**Porting Note (React Native):** Replace HTML5 Audio with `expo-av`. Remove keyboard listener.

---

## 3. Navigation & Layout Shell

### `Sidebar.jsx`
**Role:** Primary navigation controller with mobile drawer support.

**Props:** `onProfileClick` (Function) — defined but unused; internal logic handles navigation.

**State:** `isOpen` (Boolean) — mobile drawer open/closed.

**Navigation Logic:**

| Handler | Behavior |
|---------|----------|
| `handleProfile` | Checks `user.role` from AuthContext. Artist → `/artistDashboard`. User → `/profile` |
| `handlePlaylists` | Does NOT navigate. Calls `openPlaylistManager()` from PlayerContext to open overlay |
| `handleHome`, `handleEarnings`, etc. | Standard `useNavigate()` calls |
| `closeSidebar` | If `window.innerWidth <= 1024`, sets `isOpen(false)` after any nav click |

**Dependencies:** `react-router-dom`, `lucide-react`, `AuthContext`, `PlayerContext`

---

### `Header.jsx`
**Role:** Top navigation bar (desktop/tablet).

**Logic:**
- If `user` exists → renders `username` + Logout button
- If `user` is null → renders only Logout button *(Note: missing Login button for guests — potential future fix)*
- Navigation via `onClick` handlers to `/voteawards`, `/earnings`, etc.

**Dependencies:** `AuthContext`, `react-router-dom`, `unisLogoThree.svg`

---

### `Layout.jsx`
**Role:** Structural page wrapper. Provides consistent `Header`, `Footer`, and dynamic background.

**Props:**
- `children` — page content
- `backgroundImage` (String URL) — injected as CSS variable `--background-image` for SCSS to handle rendering/opacity without React re-renders.

---

## 4. Core Pages & Views

### `Feed.jsx`
**Role:** Landing page for authenticated users. Aggregates jurisdiction-scoped media.

**Data Sections:** Trending Today (plays/24h), Top Rated (score), New Releases (chronological), Popular Artists.

**Init Flow:**
1. Decodes JWT from `localStorage` → gets `userId`
2. GET `/v1/users/profile/{uid}` → gets `jurisdictionId`
3. Fires 6 parallel API calls (see endpoint reference)
4. Fallback: defaults to hardcoded UUID (`...002`) if profile fetch fails

**Key Logic:**

| Function | Logic |
|----------|-------|
| `normalizeMedia` | Maps inconsistent backend responses → flat structure (`id`, `title`, `artist`, `mediaUrl`, `artworkUrl`). Handles relative vs absolute image URLs via `buildUrl`. |
| `handlePlayMedia` | Songs: plays directly. Artists: fetches `default-song` first, then plays. Sends play-tracking POST. Creates mini-queue (clicked song + 2 new releases). |
| Popular Artists (client fallback) | If dedicated API returns nothing, scrapes unique artists from `trendingToday` and `newMedia` arrays to ensure section is never empty. |

---

### `VoteAwards.jsx`
**Role:** Leaderboard and voting ballot. Users filter nominees and cast votes.

**Filters:** `selectedGenre`, `selectedType` (artist/song), `selectedInterval` (daily/weekly/etc.), `selectedJurisdiction`

**Key Logic:**

| Function | Logic |
|----------|-------|
| `fetchNominees` | Fires on any filter change. GET `/v1/vote/nominees` with mapped query params from `idMappings.js`. Normalizes Artist (`userId`→`id`) and Song (`songId`→`id`) responses. |
| Artist Playback | Fetches `/v1/users/{id}/default-song` → plays featured track |
| Song Playback | Calls `playMedia` directly + tracking POST |
| Vote Flow | Sets `selectedNominee` → opens `VotingWizard` pre-filled with nominee + current filters |

**Dependencies:** `idMappings.js`, `VotingWizard`, `PlayerContext`, `Layout`

---

### `MilestonesPage.jsx`
**Role:** Historical archive of past award winners. Query by date range, genre, jurisdiction.

**State Split (important pattern):**
- `input state` — updates live as user changes dropdowns
- `displayedContext` — frozen copy, only updates on "View" click. Ensures page title matches results shown.

**Key Logic:**

| Function | Logic |
|----------|-------|
| `getDateRangeForInterval` | Converts single date → start/end range. Daily=same day. Weekly=Mon-Sun. Quarterly=3-month block. Midterm=H1 or H2. Annual=full year. |
| `handleView` | Validates IDs → GET `/v1/awards/past` with `startDate`, `endDate`, `jurisdictionId`, `genreId`, `intervalId` |
| `getDeterminationBadge` | Renders win-method badge: `WEIGHTED_VOTES`, `PLAYS`, `LIKES`, or `SENIORITY` |
| Max date restriction | Blocks future dates. Annual interval: restricts to previous year. |

**Dependencies:** `IntervalDatePicker` (custom), `idMappings.js`

---

### `SongPage.jsx`
**Role:** Detailed track view with social features and ambient visual mode.

**Route Param:** `songId` (via `useParams`)

**Key Logic:**

| Function | Logic |
|----------|-------|
| `extractColor` (Ambient Mode) | Draws artwork onto 1x1 HTML5 Canvas → averages all pixels → sets `dominantColor` as RGBA string → applied to CSS variable `--ambient-glow` |
| `fetchSongData` | GET `/v1/media/song/{id}` (no cache). Normalizes backend fields to flat structure. |
| `handlePlay` | Queues song in PlayerContext. Optimistically increments `playCount`/`playsToday`. Fire-and-forget POST to play endpoint. |
| Owner check | Compares `userId` (from token) with `song.artistId`. If match → shows "Edit Lyrics" button → opens `LyricsWizard` |

**Social Features:** Like (optimistic toggle), Comments (fetch/post), Follow artist button.

---

### `ArtistPage.jsx`
**Role:** Public artist portfolio page.

**Route Param:** `artistId` (via `useParams`)

**Key Logic:**

| Function | Logic |
|----------|-------|
| `fetchArtistData` | Parallel fetch: profile, follower count, songs, videos |
| `checkFollowStatus` | GET `/v1/users/{id}/is-following` (only if viewer ≠ artist) |
| `handleFollow` | Optimistic UI toggle + increment/decrement count. Rolls back on API failure. POST or DELETE `/v1/users/{id}/follow` |
| "Fans Pick" | Client-side: finds highest-scoring song from `songs` array → highlights at top |
| Owner check | Hides Follow/Vote/Play buttons if `userId === artistId` |

**Dependencies:** `VotingWizard`, `PlayerContext`, `lucide-react`

---

### `JurisdictionPage.jsx`
**Role:** Hyper-local feed for a geographic area (e.g., "Uptown Harlem").

**Route Param:** `jurisdiction` (name string)

**Init Flow:**
1. GET `/v1/jurisdictions/byName/{name}` → resolves name to UUID
2. GET `/v1/jurisdictions/{id}/tops` → ranked lists
3. Normalizes response → `artistOfMonth`, `songOfWeek`, `topArtists`, `topSongs`

**Visuals:** Uses jurisdiction-specific GIFs (e.g., `downtownHarlem.gif`) for hero background.

**Playback:** All play events fire tracking POST to ensure jurisdiction stats stay accurate.

---

### `ArtistDashboard.jsx`
**Role:** Full management interface for artist-role users.

**Capabilities:** Upload/edit/delete songs, view analytics, edit profile, manage featured song, view vote history and awards, download ownership contract (PDF).

**Init:** 6 parallel API calls on mount (all `useCache: false`): profile, songs, supporter count, follower count, vote history, default song, awards.

**Key Logic:**

| Function | Logic |
|----------|-------|
| `downloadOwnershipContract` | Uses `jsPDF` to generate a legal PDF client-side with artist name, date, and "UNIS" watermark |
| `handleSocialMediaUpdate` | PUT `/v1/users/profile/{id}` on `onBlur` — triggered when social link input loses focus |
| `loadMoreAwards` | Offset pagination — appends 10 items per page to `awards` array |
| Delete song validation | Blocks deletion if it's the only song or the current featured song |

**Child Wizards:** `LyricsWizard`, `UploadWizard`, `EditProfileWizard`, `EditSongWizard`, `DeleteAccountWizard`, `ChangeDefaultSongWizard`, `DeleteSongModal`

---

## 5. The Player System

### `Player.jsx`
**Role:** Persistent global media player. Follows user across all pages.

**Modes:** Mini Player (bottom bar) | Expanded View (full-screen overlay)

**State:**
- Playback: `isPlaying`, `currentTime`, `duration`
- Interactions: `isLiked`, `likeCount`, `showMobileActions`
- Wizards: `showVoteWizard`, `showPlaylistWizard`, `specificVoteData`

**Key Logic:**

| Function | Logic |
|----------|-------|
| Track Change (`useEffect`) | Resets `currentTime` to 0 → sets `audioRef.src` → plays on `canplay` event |
| Event Sync | Binds `timeupdate`, `ended`, `play`, `pause` HTML5 events to React state for progress bar |
| `handleVoteClick` | Fetches `/v1/media/song/{id}` (no cache) to get exact jurisdiction → constructs `nominee` object → opens `VotingWizard` |
| Like System | On mount/track change: GET `.../is-liked`. Toggle: optimistic UI update → POST or DELETE `.../like`. |
| Download | `fetch` + `Blob` to force download. CORS fallback: opens URL in `_blank`. |
| Mobile Tray | `mobile-actions-tray` slides up on small screens revealing Vote/Add/Like/Download |

**Note on vote logic:** Uses `useMemo` to build default `voteNominee`. Overrides with `specificVoteData` if async fetch in `handleVoteClick` succeeds. This dual-path is intentional for accuracy.

---

## 6. Wizards & Modals

### `VotingWizard.jsx`
**Steps:** 1 → Selection | 2 → Confirmation | 3 → Security Check (type name forwards + backwards)

**Props:** `show`, `onClose`, `onVoteSuccess`, `nominee`, `userId`, `filters`

**Key State:** `step`, `currentFilters`, `voteResult` (`idle|success|duplicate|ineligible|error`), `eligibleJurisdictionIds`

**Init:** Fetches `/v1/jurisdictions/{id}/breadcrumb` to validate eligible jurisdictions. Fallback: nominee's home jurisdiction + "Harlem".

**Submit payload to `POST /v1/vote/submit`:** `userId`, `targetType`, `targetId`, `genreId`, `jurisdictionId`, `intervalId`, `voteDate`

**Success:** Triggers `canvas-confetti` + renders vote receipt. **Error:** HTTP 409 = duplicate, 403 = ineligible.

**Dependencies:** `framer-motion`, `canvas-confetti`, `idMappings.js`

---

### `UploadWizard.jsx`
**Steps:** 1 → Type Selection | 2 → File + Details | 3 → Confirmation/Preview

**Props:** `show`, `onClose`, `onUploadSuccess`, `userProfile`

**File Validation:**
- Audio: `audio/mpeg` only, max 50MB
- Video: `mp4/quicktime/avi`, max 50MB
- Artwork: `jpeg/png`, max 1MB

**Submission:** Uses `FormData`. Metadata is `JSON.stringify()`'d into a single form field (backend requirement). Blob URLs revoked on unmount to prevent memory leaks.

**API:** POST `/v1/media/song` or `/v1/media/video`

**Refactor Flag:** Hardcoded fallback UUIDs for genre/jurisdiction if `userProfile` is missing data.

---

### `CreateAccountWizard.jsx`
**Steps (Listener):** Basic Info → Location → Role → Photo → Bio → Support Artist → Review

**Steps (Artist):** ...same + Artist Profile → Song Upload → Support Artist → Review

**Key Logic:**

| Function | Logic |
|----------|-------|
| `validateReferralCode` | GET `/v1/users/validate-referral/{code}`. Hardcoded bypass: `UNIS-LAUNCH-2024` |
| `validateUsername` / `validateEmail` | Debounced API availability checks |
| Geolocation (Nominatim) | User enters address → OpenStreetMap API → checks lat/lon against hardcoded Harlem bounds → assigns jurisdictionId. `DIVIDING_LINE` lat `40.8095` (~130th St) splits Uptown vs Downtown. |
| `handleSubmit` | 1) Upload photo → get URL. 2) POST `/v1/users/register`. 3) (Artist only) Upload song with returned `userId`. |

**Refactor Flags:**
- Hardcoded geofence coordinates — fragile if expanding to new areas
- `UNIS-LAUNCH-2024` bypass — remove for production
- Nominatim rate limits — needs paid geocoding service at scale

---

### `EditProfileWizard.jsx`
**Tabs:** Photo | Bio

**Photo:** PATCH `/v1/users/profile` via `FormData`. Calls `cacheService.invalidate('user', id)` after save.

**Bio:** PUT `/v1/users/profile/{id}/bio`. Sends `{ bio: string }` wrapped in FormData (backend requirement).

---

### `EditSongWizard.jsx`
**Purpose:** Update song artwork or description.

**Submit:** PATCH `/v1/media/song/{id}` via `FormData`. Conditionally appends artwork and/or description only if changed (`hasChanges` check disables button otherwise).

---

### `LyricsWizard.jsx`
**Purpose:** Add/edit/remove lyrics for a track.

**Submit:** PATCH `/v1/media/song/{id}` — wraps lyrics string in `FormData` (same generic endpoint as EditSongWizard).

---

### `ChangeDefaultSongWizard.jsx`
**Purpose:** Set which song plays when someone clicks Play on the artist's profile.

**Submit:** PATCH `/v1/users/default-song` with `{ defaultSongId: uuid }`.

**Empty state:** Renders "No Songs Yet" prompt if `songs` array is empty.

---

### `PlaylistWizard.jsx`
**Purpose:** Add a track to an existing playlist or create a new one.

**Props:** `open`, `onClose`, `selectedTrack` (requires `id`/`songId`, `title`, `artist`, `artwork`)

**Delegates all API logic to `PlayerContext`** — this component is UI only.

**Add flow:** `addToPlaylist` → success message (1.5s) → `onClose`. Specific error for "already in playlist".

**Create flow:** `createPlaylist` → clears input → keeps modal open so user can immediately add song to new list.

---

### `DeleteAccountWizard.jsx`
**Steps:** 1 → Warning | 2 → Verification (checkbox + type username forwards + backwards)

**Delete:** DELETE `/v1/users/me` → `logout()` → redirect to `/login`.

**Refactor Flag:** Username reversal uses `split('').reverse().join('')` — breaks on emoji/unicode usernames.

---

### `DeleteSongModal.jsx`
**Purpose:** Simple "Are you sure?" confirmation before deleting a track.

**No internal state or API logic** — fully controlled by parent (`ArtistDashboard`). `isDeleting` prop disables both buttons during network request.

---

## 7. Playlist System

### `PlaylistManager.jsx`
**Purpose:** Grid modal directory of all user playlists. Clicking a playlist opens `PlaylistViewer` on top.

**Artwork:** Uses `pl.tracks[0].artworkUrl` as cover. Falls back to generic icon if playlist is empty.

**Empty state:** Directs user to use "Create (+)" button on the main Player (this component has no create button itself).

**Porting Note:** Convert nested modal pattern to Stack Navigation in React Native.

---

### `PlaylistViewer.jsx`
**Purpose:** Detail view for a single playlist. Play, reorder, remove tracks, rename, delete.

**Drag-and-Drop:** Native HTML5 drag events. Optimistic reorder in `localTracks` → commits via `reorderPlaylist` API → reverts on failure.

**Porting Note:** HTML5 drag events don't exist in React Native. Use `react-native-draggable-flatlist`. Replace `confirm()` with `Alert.alert()`.

---

### `Playlists.jsx`
**Purpose:** Dedicated page route for playlist library (simpler list view alternative to PlaylistManager modal).

**Refactor Flag:** Overlaps significantly with `PlaylistManager.jsx`. Consider deprecating in React Native port — consolidate into a single "Library" screen.

---

## 8. Utility, Services & Infrastructure Files

### `idMappings.js` (`/src/utils/`)
**Purpose:** Single source of truth mapping human-readable string keys to backend UUIDs. Also provides reverse mappings (UUID → string) for displaying API responses in the UI.

**Exports:**

| Export | Type | Purpose |
|--------|------|---------|
| `GENRE_IDS` | Object | String key → UUID |
| `JURISDICTION_IDS` | Object | String key → UUID |
| `INTERVAL_IDS` | Object | String key → UUID |
| `GENRE_NAMES` | Object | UUID → string (reverse) |
| `JURISDICTION_NAMES` | Object | UUID → string (reverse) |
| `INTERVAL_NAMES` | Object | UUID → string (reverse) |
| `getGenreId(key)` | Function | Safe lookup with console.warn on miss |
| `getJurisdictionId(key)` | Function | Safe lookup with console.warn on miss |
| `getIntervalId(key)` | Function | Safe lookup with console.warn on miss |

**Current UUID mappings:**

| Key | UUID |
|-----|------|
| `rap` / `rap-hiphop` / `hip-hop` | `...0101` |
| `rock` | `...0102` |
| `pop` | `...0103` |
| `uptown-harlem` | `52740de0-...` |
| `downtown-harlem` | `4b09eaa2-...` |
| `harlem` | `1cf6ceb1-...` |
| `daily` | `...0201` |
| `weekly` | `...0202` |
| `monthly` | `...0203` |
| `quarterly` | `...0204` |
| `annual` | `...0205` |
| `midterm` | `...0206` |

**Used by:** `VotingWizard`, `VoteAwards`, `MilestonesPage`

**Critical:** If UUIDs change in the database, this file must be updated. It is the only place these mappings live on the frontend.

**Note:** `Hip-Hip` key (capital H, typo) maps to the same rap UUID as `hip-hop`. Should be cleaned up.

---

### `axiosInstance.js` (`/src/components/`)
**Purpose:** The primary authenticated HTTP client for the entire app. Wraps Axios with token injection, automatic caching, and cache invalidation on mutations.

**Environment Config:**

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Production API base URL |
| `VITE_USE_REAL_API` | `'true'` = hit real backend, else use mock |
| `import.meta.env.DEV` | If true + USE_REAL_API, uses `localhost:8080/api` |

**Request Interceptor logic:**
1. Injects `Authorization: Bearer {token}` from localStorage
2. Sets `Content-Type: application/json` by default; deletes it for `FormData` (lets browser set multipart boundary)
3. For GET requests: checks `cacheService` — if hit, returns cached data without making a network call

**Response Interceptor logic:**
1. Caches successful GET responses via `cacheService`
2. On mutation (POST/PUT/PATCH/DELETE): calls `invalidateCachesForMutation()` to clear related cache entries
3. On 401: clears token + all cache → hard redirects to `/login`

**Cache invalidation rules (by URL pattern):**

| Trigger | Invalidates |
|---------|------------|
| `/play` | `song`, `trending`, `feed`, `user`, `artist` |
| `/api/playlists` | `playlists` |
| `/vote` | `song`, `trending`, `user`, `artist` |
| `/media/song` or `/media/video` (POST/DELETE) | `trending`, `feed`, `artist` |
| `/v1/users/` (PUT/PATCH) | `user`, `artist` |
| `/media/song` (PATCH) | `song`, `trending`, `feed` |
| `/like` | `song`, `trending`, `artist` |

**Exports:**

| Export | Purpose |
|--------|---------|
| `default axiosInstance` | Raw Axios instance — used directly by most components |
| `apiCall(config)` | Cache-aware wrapper — falls back to mock if `USE_REAL_API` is false. Re-throws errors on mutations. |
| `invalidateCache(type, id)` | Manual cache invalidation for UI actions |
| `invalidateCacheType(type)` | Invalidate all entries of a type |
| `logoutUser()` | POST `/auth/logout` → clears token + cache → redirects |

**Mock fallbacks:** When `USE_REAL_API` is false, returns mock data for `/auth/login` and `/v1/users/profile`. All other endpoints return `{ data: [] }`.

---

### `api.js` (`/src/services/`)
**Purpose:** A minimal, secondary Axios instance. Predates `axiosInstance.js` and is simpler — no caching, no mock fallback.

**Base URL:** Hardcoded `http://localhost:8080/api`

**Interceptor:** Injects Bearer token from localStorage (same pattern as axiosInstance).

**Exports:**

| Export | Purpose |
|--------|---------|
| `login(email, password)` | POST `/auth/login` |
| `register(userData)` | POST `/auth/register` |
| `default api` | Raw Axios instance |

**Used by:** `Register.jsx` (calls `register()`). Most of the app uses `axiosInstance` instead.

**Refactor Flag:** This file is a legacy stub. `Register.jsx` is itself largely superseded by `CreateAccountWizard.jsx`. Consider consolidating — `api.js` and `Register.jsx` may both be candidates for deprecation.

---

### `cacheService.js` (`/src/services/`)
**Purpose:** A two-layer (memory + localStorage) caching service with TTL expiry. Used exclusively by `axiosInstance.js` — components do not call it directly except `EditProfileWizard` (which calls `invalidate` after a photo update).

**Cache layers:**
1. **Memory (`Map`)** — fastest, lost on page refresh
2. **localStorage** — survives refresh, skipped for entries over 500KB

**TTL by data type:**

| Type | TTL |
|------|-----|
| `song` | 30 minutes |
| `artist` | 10 minutes |
| `user` | 5 minutes |
| `trending` | 3 minutes |
| `playlists` | 2 minutes |
| `feed` | 1 minute |

**Key format:** `type:id:paramString` (e.g., `song:abc-123:{}`)

**Public API:**

| Method | Purpose |
|--------|---------|
| `get(type, id, params)` | Returns cached data or null |
| `set(type, id, data, params)` | Stores in memory + localStorage |
| `invalidate(type, id, params)` | Removes specific entry |
| `invalidateType(type)` | Removes all entries of a type |
| `clearAll()` | Clears everything except the auth `token` key |
| `getStats()` | Returns memory size + localStorage key count (debug) |

**Porting Note (React Native):** Replace localStorage layer with `AsyncStorage` or `expo-secure-store`. Memory layer (`Map`) works as-is.

---

### `PrivateRoute.jsx` (`/src/components/`)
**Purpose:** Route guard that protects all authenticated pages. Checks for JWT presence in localStorage. If missing, redirects to `/login`.

**Logic:**
```
localStorage.getItem('token') exists? → render <Outlet /> (child route)
                                  no? → <Navigate to="/login" />
```

**Used by:** `App.jsx` — wraps all protected routes.

**Note:** Only checks for token *existence*, not validity. Token expiry or tampering is caught downstream by the 401 interceptor in `axiosInstance.js`, which clears the token and redirects.

---

### `Login.jsx` (`/src/pages/`)
**Purpose:** The authentication entry point. Renders a full-screen video background login form and provides access to `CreateAccountWizard` for new users.

**State:** `email`, `password`, `error`, `loading`, `showWizard`

**Submit flow:**
1. Calls `login({ email, password })` from `AuthContext`
2. On success → `navigate('/')`
3. On failure → displays `result.error` message

**UI features:**
- Full-screen `<video>` background (`space-bg.mp4`) with overlay
- Inline `CreateAccountWizard` modal (controlled by `showWizard`)
- `onSuccess` callback navigates to `/feed` after registration

**Dependencies:** `AuthContext`, `CreateAccountWizard`, `react-router-dom`, `unisLogoThree.svg`, `Login.scss`

---

### `Register.jsx` (`/src/pages/`)
**Purpose:** A basic standalone registration form. Calls `register()` from `api.js` and redirects to `/login` on success.

**State:** `email`, `password`, `username`

**Status:** Largely superseded by `CreateAccountWizard.jsx`, which handles the full multi-step onboarding flow including role selection, geolocation, photo upload, and referral validation. `Register.jsx` has no styling and is a plain HTML form.

**Refactor Flag:** This component is a legacy stub. The `/register` route in `App.jsx` should confirm which component it actually renders — if it's `CreateAccountWizard`, `Register.jsx` can be deprecated.

---

## 9. API Endpoint Reference

### Auth
| Method | Endpoint | Used By |
|--------|----------|---------|
| POST | `/auth/login` | AuthContext |
| DELETE | `/v1/users/me` | DeleteAccountWizard |

### Users & Profiles
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/users/profile/{id}` | AuthContext, Feed, ArtistDashboard |
| PUT | `/v1/users/profile/{id}/bio` | EditProfileWizard |
| PATCH | `/v1/users/profile` | EditProfileWizard (photo) |
| PUT | `/v1/users/profile/{id}` | ArtistDashboard (social links) |
| GET | `/v1/users/artists/active` | CreateAccountWizard |
| GET | `/v1/users/{id}/default-song` | ArtistPage, VoteAwards, JurisdictionPage |
| PATCH | `/v1/users/default-song` | ChangeDefaultSongWizard |
| GET | `/v1/users/validate-referral/{code}` | CreateAccountWizard |
| POST | `/v1/users/register` | CreateAccountWizard |
| POST/DELETE | `/v1/users/{id}/follow` | ArtistPage |
| GET | `/v1/users/{id}/is-following` | ArtistPage |
| GET | `/v1/users/artist/top` | Feed |

### Media
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/media/song/{id}` | SongPage, Player |
| POST | `/v1/media/song` | UploadWizard |
| PATCH | `/v1/media/song/{id}` | EditSongWizard, LyricsWizard |
| DELETE | `/v1/media/song/{id}` | ArtistDashboard |
| POST | `/v1/media/song/{id}/play` | Feed, SongPage, VoteAwards, JurisdictionPage |
| GET | `/v1/media/song/{id}/is-liked` | Player |
| POST/DELETE | `/v1/media/song/{id}/like` | Player |
| POST | `/v1/media/video` | UploadWizard |
| GET | `/v1/media/songs/artist/{id}` | ArtistDashboard, ArtistPage |
| GET | `/v1/media/trending/today` | Feed |
| GET | `/v1/media/trending` | Feed |
| GET | `/v1/media/new` | Feed |

### Voting & Awards
| Method | Endpoint | Used By |
|--------|----------|---------|
| POST | `/v1/vote/submit` | VotingWizard |
| GET | `/v1/vote/nominees` | VoteAwards |
| GET | `/v1/vote/history` | ArtistDashboard |
| GET | `/v1/awards/leaderboards` | Feed |
| GET | `/v1/awards/past` | MilestonesPage |
| GET | `/v1/awards/artist/{id}` | ArtistDashboard |

### Jurisdictions
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/jurisdictions/{id}/breadcrumb` | VotingWizard |
| GET | `/v1/jurisdictions/byName/{name}` | JurisdictionPage |
| GET | `/v1/jurisdictions/{id}/tops` | JurisdictionPage |

### Playlists
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/playlists` | PlayerContext |
| POST | `/v1/playlists` | PlayerContext (createPlaylist) |
| POST | `/v1/playlists/{id}/tracks` | PlayerContext (addToPlaylist) |
| PATCH | `/v1/playlists/{id}/reorder` | PlayerContext (reorderPlaylist) |
| DELETE | `/v1/playlists/{id}` | PlayerContext (deletePlaylist) |

### Supporters & Followers
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/supporters/count` | ArtistDashboard |
| GET | `/v1/followers/count` | ArtistDashboard |

---

## 10. Known Issues & Refactor Flags

| Flag | Component | Issue |
|------|-----------|-------|
| Hardcoded UUIDs | `UploadWizard`, `Feed` | Fallback genre/jurisdiction UUIDs are hardcoded. Brittle if DB IDs change. |
| Hardcoded geofence | `CreateAccountWizard` | Harlem boundary coordinates in frontend. Needs backend handling for scale. |
| Referral code bypass | `CreateAccountWizard` | `UNIS-LAUNCH-2024` hardcoded. Remove before production. |
| Nominatim rate limits | `CreateAccountWizard` | Public OSM API will get blocked at scale. Needs paid geocoding service. |
| Unused prop | `Sidebar` | `onProfileClick` prop defined but never used. |
| Dead imports | `Main.jsx` | Unused imports. Safe to delete. |
| Welcome popup | `ArtistDashboard` | `showWelcomePopup` resets to `true` on every mount. Should persist "seen" state in localStorage. |
| Duplicate lyrics UI | `ArtistDashboard` | Has both `LyricsWizard` import AND a raw JSX lyrics modal. Verify which is intended. |
| Dashboard API load | `ArtistDashboard` | 6+ requests on load causes "popcorn" UI. Consider a single `/dashboard-summary` endpoint. |
| Playlist redundancy | `Playlists.jsx` | Overlaps with `PlaylistManager`. Consider consolidating. |
| Unicode reversal | `DeleteAccountWizard` | Username reversal breaks on emoji. Restrict usernames to alphanumeric on sign-up. |
| Logout inconsistency | `AuthContext` vs `DeleteAccountWizard` | Auth uses hard redirect (`window.location.href`), Delete uses client routing (`navigate()`). Standardize. |
| Guest login state | `Header.jsx` | Shows only "Logout" when user is null. Should show "Login" button instead. |

---

## 11. Dead / Deprecated Files

These files exist in the repo but are not actively used in the live application. They should be reviewed and removed to reduce confusion for future developers.

| File | Status | Reason |
|------|--------|--------|
| `Register.jsx` | Deprecated | Superseded by `CreateAccountWizard.jsx`. Plain unstyled form with no role/geo/referral logic. Confirm `/register` route target before deleting. |
| `api.js` | Legacy stub | Only used by `Register.jsx`. `axiosInstance.js` handles all real API calls. Delete alongside `Register.jsx`. |
| `ExploreFind.jsx` | Dead import | Imported in `Main.jsx` but never rendered. Routing handled in `App.jsx`. |
| `Onboarding.jsx` | Unconfirmed | Listed in master file but not referenced in routing or any component. Verify before deleting. |
| `MapDemo.jsx` | Unconfirmed | Likely a dev prototype for `FindPage.jsx`. Verify before deleting. |
| `cookiePolicy.jsx` | Not routed | No route defined in `App.jsx`. May need a route added or can be deleted. |
| `privacyPolicy.jsx` | Not routed | Same as above. |
| `termsOfService.jsx` | Not routed | Same as above. |
| `reportInfringement.jsx` | Not routed | Same as above. |