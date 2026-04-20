# UNIS — Web Frontend Architecture Documentation

**Project:** Unis (React Web)
**Stack:** React 18, React Router DOM v6, Axios, Framer Motion, Leaflet, Recharts, jsPDF, Lucide React
**Base API URL:** Configured via `VITE_API_BASE_URL` (default `http://localhost:8080`)
**Auth:** JWT (Bearer Token, stored in localStorage)
**Deployment:** Netlify (frontend), Cloudflare R2 (media CDN)
**Last Updated:** April 2026

> **How to use this file:** Attach it at the start of any new AI thread working on this project. It replaces the need to paste individual component files for context.

---

## Table of Contents

1. [Project Entry Points](#1-project-entry-points)
2. [Global Contexts](#2-global-contexts)
3. [Navigation & Layout Shell](#3-navigation--layout-shell)
4. [Core Pages & Views](#4-core-pages--views)
5. [The Player System](#5-the-player-system)
6. [Queue System](#6-queue-system)
7. [Wizards & Modals](#7-wizards--modals)
8. [Playlist System](#8-playlist-system)
9. [Search System](#9-search-system)
10. [Comment System](#10-comment-system)
11. [Notifications](#11-notifications)
12. [Admin System](#12-admin-system)
13. [Earnings & Monetization](#13-earnings--monetization)
14. [Theming](#14-theming)
15. [Auth Gate (Guest Access)](#15-auth-gate-guest-access)
16. [Account Management](#16-account-management)
17. [Utility, Services & Infrastructure Files](#17-utility-services--infrastructure-files)
18. [Static Data Files](#18-static-data-files)
19. [API Endpoint Reference](#19-api-endpoint-reference)
20. [Known Issues & Refactor Flags](#20-known-issues--refactor-flags)
21. [Dead / Deprecated Files](#21-dead--deprecated-files)

---

## 1. Project Entry Points

### `main.jsx`

Mounts `<App />` into `document.getElementById('root')`. Wraps in React `StrictMode`. Imports `index.css` for global styles. Clean — no dead imports.

### `App.jsx`

Application root. Sets up global context providers, router, route map, and persistent UI elements.

**Provider hierarchy (order is critical):**

1. `AuthProvider` — outermost, initializes session and theme
2. `PlayerProvider` — inside Auth, listens for `unis:login` / `unis:logout` custom events
3. `BrowserRouter` — inside providers, enables navigation

**Inline Components:**

- `AuthRequiredRoute` — hard gate for pages that genuinely need a logged-in user. If `authLoaded` is false, renders null (prevents flash). If no user, redirects to `/login`. Used for: profile, earnings, artistDashboard, voteawards.
- `AppLayout` — uses `useLocation()` to detect auth pages (`/login`, `/register`, `/reset-password`). Hides Sidebar, Player, PlayChoiceModal, and notifications on auth pages. Invokes `useActivityTracker()` for page view analytics.

**Route Map:**

| Path | Component | Access |
|------|-----------|--------|
| `/login` | Login | Public |
| `/reset-password` | ResetPassword | Public |
| `/privacy` | PrivacyPolicy | Public |
| `/terms` | TermsOfService | Public |
| `/cookie` | CookiePolicy | Public |
| `/report` | ReportInfringement | Public |
| `/waitlist` | WaitlistPage | Public |
| `/` | Feed | Browsable (guests OK) |
| `/artist/:artistId` | ArtistPage | Browsable |
| `/song/:songId` | SongPage | Browsable |
| `/jurisdiction/:jurisdiction` | JurisdictionPage | Browsable |
| `/milestones` | MilestonesPage | Browsable |
| `/leaderboards` | Leaderboards | Browsable |
| `/findpage` | FindPage | Browsable |
| `/search` | SearchResultsPage | Browsable |
| `/voteawards` | VoteAwards | Auth Required |
| `/profile` | Profile | Auth Required |
| `/earnings` | Earnings | Auth Required |
| `/artistDashboard` | ArtistDashboard | Auth Required |
| `/admin` | AdminDashboard | Admin (moderator+) |
| `/admin/moderation` | ModerationQueue | Admin (moderator+) |
| `/admin/analytics` | AnalyticsPage | Admin (moderator+) |
| `/admin/playlists` | AdminPlaylistPage | Admin (moderator+) |
| `/admin/users` | UserManagement | Admin (admin+) |
| `/admin/users/:userId` | UserDetail | Admin (admin+) |
| `/admin/moderation/dmca/:claimId` | DmcaClaimDetail | Admin (admin+) |
| `/admin/audit` | AuditLog | Admin (super_admin) |
| `/admin/roles` | RoleManagement | Admin (super_admin) |

**Persistent UI (rendered outside Routes, hidden on auth pages):**

- `Sidebar` — primary navigation
- `Player` — global audio player
- `PlayChoiceModal` — "Play Now vs Add to Queue" prompt
- `WinnersNotification` — daily login notification (logged-in users only)
- `SongNotification` — toast on track change

**Global import:** `theme.scss` — CSS variable-based theme system.

---

## 2. Global Contexts

### `AuthContext.jsx` (`/src/context/`)

**Role:** Global session manager, theme manager, guest-mode controller.

**Exports:** `AuthProvider`, `useAuth()`

**State:**

- `user` (Object | null) — full profile of logged-in user; null = guest
- `loading` (Boolean) — true while checking for existing session on app mount
- `authLoaded` (Boolean) — true once the auth check is complete (regardless of outcome)
- `isGuest` (derived) — true when `authLoaded === true && user === null`
- `theme` (String) — current theme ID (default: `'blue'`)

**Theme System:**

- `VALID_THEMES`: `['blue', 'orange', 'red', 'green', 'purple', 'yellow', 'dianna']`
- `applyTheme(name)` — validates theme → sets `data-theme` attribute on root element → persists to localStorage
- `setTheme(name, userId)` — calls `applyTheme` locally then PUTs `{ themePreference }` to backend
- On mount, applies cached theme from localStorage immediately (prevents blue flash before profile loads)

**Key Functions:**

| Function | Logic |
|----------|-------|
| `init (useEffect)` | Reads JWT from localStorage → decodes `userId` via `atob()` → fetches `/v1/users/profile/{userId}` → applies theme from profile → checks admin role via `/v1/admin/roles` → sets `authLoaded`. On missing/invalid token → enters guest mode (no redirect). |
| `login(credentials)` | POST `/auth/login` → saves token → decodes userId → fetches profile → applies theme → checks admin role → dispatches `CustomEvent('unis:login')` for cross-context communication |
| `logout()` | Removes token → sets user to null → dispatches `CustomEvent('unis:logout')` → hard redirects to `/login` |

**Cross-Context Events:** `AuthContext` dispatches `unis:login` and `unis:logout` on `window`. `PlayerContext` listens for these to load/clear playlists without prop drilling.

---

### `PlayerContext.jsx` (`/src/context/playercontext.jsx`)

**Role:** Global media engine, queue manager, shuffle controller, playlist library manager.

**Exports:** `PlayerProvider`, `PlayerContext`

**State Groups:**

*Player state:*
- `currentMedia` — active song object
- `isPlaying` — Boolean
- `isExpanded` — mini vs full-screen player mode

*Queue state (session-based, ephemeral):*
- `queue` — current playback queue (array of song objects)
- `currentIndex` — position in queue
- `queueSource` — label for where the queue came from (e.g., playlist name)
- `isShuffled` — Boolean
- `originalQueue` — pre-shuffle order (for unshuffle restoration)
- `autoplay` — Boolean

*Play Choice Modal:*
- `playChoiceModal` — `{ open: Boolean, pendingSong: Object }` — drives PlayChoiceModal component

*Playlist Library:*
- `playlists` — user's own playlists
- `followedPlaylists` — playlists user is following
- `loading` — Boolean
- `showPlaylistManager` — toggles playlist modal

**Key Functions:**

| Function | Logic |
|----------|-------|
| `playMedia(media, queue, source)` | Sets currentMedia, replaces queue if new queue passed, finds song index. Plays via audioRef. |
| `requestPlay(song)` | Smart play: if queue empty → plays immediately. If queue has items → opens PlayChoiceModal. |
| `confirmPlayNow()` | Inserts song after current track, jumps to it, plays. Closes modal. |
| `confirmAddToQueue()` | Appends song to end of queue. Closes modal. |
| `next()` / `prev()` | Increments/decrements currentIndex, updates currentMedia. Stops at queue end. |
| `toggleShuffle()` | Fisher-Yates shuffle keeping current song at index 0. Unshuffle restores originalQueue. |
| `playNext(song)` / `playLater(song)` | Insert after current / append to end |
| `removeFromQueue(index)` | Removes track (blocks removal of currently playing track) |
| `clearQueue()` | Resets all queue state, pauses audio |
| `saveQueueAsPlaylist(name)` | Creates playlist → adds all queue tracks → refreshes library |
| `loadUserPlaylists()` | GET `/v1/playlists/mine` → normalizes → updates state |
| `loadFollowedPlaylists()` | GET `/v1/playlists/following` → normalizes → updates state |
| `loadPlaylistDetails(id)` | GET `/v1/playlists/{id}` → returns normalized playlist with tracks |
| `createPlaylist` / `addToPlaylist` / `removeFromPlaylist` / `reorderPlaylist` / `deletePlaylist` / `updatePlaylist` | Standard CRUD via API → reload |
| `followPlaylist` / `unfollowPlaylist` | POST/DELETE → reload followed list |
| `suggestSong` / `voteOnSuggestion` | Community playlist features |
| `blockSong` / `unblockSong` | Song blocking |
| `openPlaylistManager()` | Sets `showPlaylistManager` true. Self-healing: if token exists but playlists are empty, triggers a fetch (third line of defense after mount + login event). |

**Init & Event Listeners:** Three-strategy playlist loading to handle race conditions:
1. On mount: checks for existing token (handles page refresh while logged in)
2. Listens for `unis:login` custom event (handles fresh login)
3. Self-healing fetch in `openPlaylistManager()` (fallback if both miss)

On `unis:logout`: clears all playlist, queue, and media state.

**Audio Engine:** Uses `useRef` on an HTML5 `<audio>` element. Syncs play/pause/ended events to React state. On `ended`, auto-calls `next()`.

---

## 3. Navigation & Layout Shell

### `Sidebar.jsx`

**Role:** Primary navigation controller with mobile drawer support and guest gating.

**State:** `isOpen` (Boolean) — mobile drawer open/closed.

**Key Behavior:**

- Uses `useAuthGate()` to gate features for guests: Settings → triggers `triggerGate('profile')`, Earnings → triggers `triggerGate('earnings')`
- Profile navigation: Artist role → `/artistDashboard`, Listener → `/profile`
- Playlists: calls `openPlaylistManager()` from PlayerContext (no navigation)
- Admin link: only visible when `user.adminRole` is truthy
- Sidebar width is tracked via CSS variable `--sidebar-width` for layout calculations
- Renders `<AuthGateSheet>` for guest prompts

**Nav Items:** Home, Vote, Find, Leaderboards, Settings, Earnings, Playlists, Admin (conditional)

**Dependencies:** `AuthContext`, `PlayerContext`, `AuthGateSheet`, `lucide-react`, `react-router-dom`

---

### `Header.jsx`

**Role:** Top navigation bar (desktop/tablet).

**Logic:** If `user` exists → renders `username` + Logout button. If `user` is null → renders only Logout button.

**Dependencies:** `AuthContext`, `react-router-dom`, `unisLogoThree.svg`

---

### `Layout.jsx`

**Role:** Structural page wrapper. Provides consistent footer and dynamic background.

**Props:** `children` — page content, `backgroundImage` (String URL) — injected as CSS variable `--background-image`.

---

### `Footer.jsx`

**Role:** Persistent bottom navigation bar rendered on all pages via `Layout.jsx`. Contains legal page links and copyright notice.

**Links:** Privacy Policy (`/privacy`), Terms of Use (`/terms`), Cookie Policy (`/cookie`), Report Infringement (`/report`). All routes confirmed present in `App.jsx`.

---

## 4. Core Pages & Views

### `Feed.jsx`

**Role:** Landing page for both authenticated users and guests. Aggregates jurisdiction-scoped media.

**Data Sections:** Trending Today (plays/24h), Top Rated (score), New Releases (chronological), Popular Artists.

**Init Flow:**
1. Decodes JWT from localStorage → gets `userId` (or operates as guest)
2. GET `/v1/users/profile/{uid}` → gets `jurisdictionId`
3. Fires parallel API calls for trending, new, top-rated, leaderboards, popular artists
4. Fallback: defaults to hardcoded UUID if profile fetch fails

**Key Logic:**

| Function | Logic |
|----------|-------|
| `normalizeMedia` | Maps inconsistent backend responses → flat structure (`id`, `title`, `artist`, `mediaUrl`, `artworkUrl`). Handles relative vs absolute image URLs via `buildUrl`. |
| `handlePlayMedia` | Songs: plays directly via `requestPlay()`. Artists: fetches `default-song` first. Schedules play tracking via `playTracker`. Creates mini-queue. |
| Popular Artists fallback | If dedicated API returns nothing, scrapes unique artists from `trendingToday` and `newMedia` arrays. |

---

### `VoteAwards.jsx`

**Role:** Leaderboard and voting ballot. Users filter nominees and cast votes.

**Filters:** `selectedGenre`, `selectedType` (artist/song), `selectedInterval` (daily/weekly/etc.), `selectedJurisdiction`

**Key Logic:**

| Function | Logic |
|----------|-------|
| `fetchNominees` | Fires on any filter change. GET `/v1/vote/nominees` with mapped query params from `idMappings.js`. |
| Vote Flow | Sets `selectedNominee` → opens `VotingWizard` pre-filled with nominee + current filters |

---

### `MilestonesPage.jsx`

**Role:** Historical archive of past award winners. Query by date range, genre, jurisdiction.

**State Split:** `input state` updates live as user changes dropdowns. `displayedContext` is a frozen copy that only updates on "View" click (ensures page title matches results shown).

**Key Logic:**

| Function | Logic |
|----------|-------|
| `getDateRangeForInterval` | Converts single date → start/end range. Daily=same day. Weekly=Mon-Sun. Quarterly=3-month block. Midterm=H1 or H2. Annual=full year. |
| `handleView` | Validates IDs → GET `/v1/awards/past` with date range, jurisdiction, genre, interval |
| `getDeterminationBadge` | Renders win-method badge: `WEIGHTED_VOTES`, `PLAYS`, `LIKES`, or `SENIORITY` |
| Max date restriction | Blocks future dates. Annual interval: restricts to previous year. |

---

### `SongPage.jsx`

**Role:** Detailed track view with social features, comments, and ambient visual mode.

**Route Param:** `songId` (via `useParams`)

**Key Logic:**

| Function | Logic |
|----------|-------|
| `extractColor` (Ambient Mode) | Draws artwork onto 1x1 HTML5 Canvas → averages all pixels → sets `dominantColor` as RGBA → applied to CSS `--ambient-glow` |
| `fetchSongData` | GET `/v1/media/song/{id}` (no cache). Normalizes backend fields. |
| `handlePlay` | Queues song via `requestPlay()`. Schedules play tracking via `playTracker`. |
| Owner check | Compares `userId` with `song.artistId`. If match → shows "Edit Lyrics" button → opens `LyricsWizard` |

**Child Components:** `CommentSection`, `LyricsWizard`, `VotingWizard`

**Social Features:** Like (optimistic toggle), Comments (threaded), Follow artist button.

---

### `ArtistPage.jsx`

**Role:** Public artist portfolio page.

**Route Param:** `artistId` (via `useParams`)

**Key Logic:**

| Function | Logic |
|----------|-------|
| `fetchArtistData` | Parallel fetch: profile, follower count, songs, videos |
| `checkFollowStatus` | GET `/v1/users/{id}/is-following` (only if viewer ≠ artist) |
| `handleFollow` | Optimistic UI toggle + increment/decrement count. Rolls back on API failure. |
| "Fans Pick" | Client-side: finds highest-scoring song from `songs` array → highlights at top |
| Owner check | Hides Follow/Vote/Play buttons if `userId === artistId` |

---

### `JurisdictionPage.jsx`

**Role:** Hyper-local feed for a geographic area (e.g., "Uptown Harlem").

**Route Param:** `jurisdiction` (name string)

**Init Flow:**
1. GET `/v1/jurisdictions/byName/{name}` → resolves name to UUID
2. GET `/v1/jurisdictions/{id}/tops` → ranked lists
3. Normalizes response → `artistOfMonth`, `songOfWeek`, `topArtists`, `topSongs`

**Visuals:** Uses jurisdiction-specific GIFs (e.g., `downtownHarlem.gif`) for hero background.

---

### `ArtistDashboard.jsx`

**Role:** Full management interface for artist-role users.

**Capabilities:** Upload/edit/delete songs, view analytics, edit profile, manage featured song, view vote history and awards, download ownership contract (PDF), color theme selection, referral code display, change password.

**Init:** Parallel API calls on mount (all uncached): profile, songs, supporter count, follower count, vote history, default song, awards.

**Key Logic:**

| Function | Logic |
|----------|-------|
| `downloadOwnershipContract` | Uses `jsPDF` to generate a legal PDF client-side |
| `handleSocialMediaUpdate` | PUT on `onBlur` when social link input loses focus |
| `loadMoreAwards` | Offset pagination — appends items per page |
| Delete song validation | Blocks deletion if it's the only song or the current featured song |

**Child Components:** `LyricsWizard`, `UploadWizard`, `EditProfileWizard`, `EditSongWizard`, `DeleteAccountWizard`, `ChangeDefaultSongWizard`, `DeleteSongModal`, `ThemePicker`, `ReferralCodeCard`, `ChangePasswordWizard`

---

### `Profile.jsx`

**Role:** The listener-facing profile page. Allows non-artist users to view stats, manage supported artist, browse vote history, edit profile, view referral code, change theme, change password, and delete account.

**Init flow (3 parallel calls):**
1. GET `/v1/users/profile/{userId}` → sets `userProfile`
2. GET `/v1/users/profile/{supportedArtistId}` → sets `supportedArtist` (if exists)
3. GET `/v1/vote/history?limit=50` → sets `voteHistory`

**UI Sections:** Profile header (photo, bio, edit button), Supported Artist card with playback, Stats grid, Vote History with "View All", Referral Code card, Theme Picker, Change Password, Danger Zone (delete account).

**Child Components:** `EditProfileWizard`, `DeleteAccountWizard`, `VoteHistoryModal`, `ThemePicker`, `ReferralCodeCard`, `ChangePasswordWizard`

---

### `LeaderboardsPage.jsx`

**Role:** A filterable leaderboard showing top artists or songs by votes, scoped to jurisdiction, genre, and time interval.

**Filters:** `location` (jurisdiction), `genre`, `category` (artist/song), `interval` (daily/weekly/etc.)

**API:** GET `/v1/vote/leaderboards?jurisdictionId=&genreId=&targetType=&intervalId=&limit=50`

---

### `FindPage.jsx`

**Role:** Geographic discovery page using Leaflet maps. Allows users to explore jurisdictions visually and navigate to jurisdiction-specific feeds.

---

### `WaitlistPage.jsx`

**Role:** National pre-registration / waitlist signup form for users outside Harlem.

**Form Fields:** email, username, password, confirmPassword, displayName, userType (LISTENER/ARTIST), stateCode, metroRegion, cityFreetext, referredByCode.

**Key Logic:**
- Cascading dropdowns: state selection populates metro options from `Usstatesandmetros.js`
- "Other" metro option reveals freetext city input
- Referral code validation on blur
- Submit → POST to waitlist API → success confirmation with referral code display

**Dependencies:** `Usstatesandmetros.js`, `Layout`, `axiosInstance`

---

## 5. The Player System

### `Player.jsx`

**Role:** Persistent global media player. Follows user across all pages.

**Modes:** Mini Player (bottom bar) | Expanded View (full-screen overlay)

**State:** Playback (`isPlaying`, `currentTime`, `duration`), Interactions (`isLiked`, `likeCount`, `showMobileActions`), Wizards (`showVoteWizard`, `showPlaylistWizard`, `showDownloadModal`, `specificVoteData`)

**Key Logic:**

| Function | Logic |
|----------|-------|
| Track Change (`useEffect`) | Resets `currentTime` to 0 → sets `audioRef.src` → plays on `canplay` event → updates Media Session metadata |
| Event Sync | Binds `timeupdate`, `ended`, `play`, `pause` HTML5 events to React state for progress bar |
| `handleVoteClick` | Fetches `/v1/media/song/{id}` to get exact jurisdiction → constructs `nominee` object → opens `VotingWizard` |
| Like System | On mount/track change: GET `.../is-liked`. Toggle: optimistic UI update → POST or DELETE `.../like`. |
| Download | Opens `DownloadModal` with song data |
| Mobile Tray | `mobile-actions-tray` slides up revealing Vote/Add/Like/Download |

---

### `DownloadModal.jsx`

**Role:** Handles song download with three policies: free, paid, and unavailable.

**Props:** `isOpen`, `onClose`, `song`, `onPurchase`

**State:** `status` — `idle | downloading | purchased | complete | error`

**Key Logic:**
- Free downloads: fetches blob → creates download link → auto-closes on completion
- Paid downloads: shows price → calls `onPurchase` callback (Stripe integration ready)
- Unavailable: shows lock icon with explanation
- Animated modal with CSS transitions

---

## 6. Queue System

### `QueuePanel.jsx`

**Role:** Full queue management UI. Shows current playback queue with the currently playing track highlighted.

**Props:** `open`, `onClose`

**Capabilities:**
- View full queue with current track indicator
- Drag-and-drop reorder (HTML5 drag events, blocks dragging the currently playing track)
- Remove individual tracks (except currently playing)
- Shuffle toggle
- Clear entire queue
- Save queue as a new playlist (with name input modal)

**Dependencies:** `PlayerContext` (for `queue`, `currentIndex`, `removeFromQueue`, `reorderQueue`, `clearQueue`, `saveQueueAsPlaylist`, `toggleShuffle`, `isShuffled`), `lucide-react`

---

### `PlayChoiceModal.jsx`

**Role:** Lightweight modal that appears when the user clicks play on a song while another song is already in the queue.

**Behavior:** Reads `playChoiceModal` state from PlayerContext. Offers three options: "Play Now" (inserts after current track and jumps), "Add to Queue" (appends to end), "Cancel". Closes on Escape key or backdrop click.

**Context Functions Used:** `confirmPlayNow`, `confirmAddToQueue`, `cancelPlayChoice`

---

## 7. Wizards & Modals

### `VotingWizard.jsx`

**Steps:** 1 → Selection | 2 → Confirmation | 3 → Security Check (type name forwards + backwards)

**Props:** `show`, `onClose`, `onVoteSuccess`, `nominee`, `userId`, `filters`

**Init:** Fetches `/v1/jurisdictions/{id}/breadcrumb` to validate eligible jurisdictions.

**Submit payload to `POST /v1/vote/submit`:** `userId`, `targetType`, `targetId`, `genreId`, `jurisdictionId`, `intervalId`, `voteDate`

**Success:** `canvas-confetti` + vote receipt. **Error:** HTTP 409 = duplicate, 403 = ineligible.

---

### `UploadWizard.jsx`

**Steps:** 1 → Type Selection | 2 → File + Details | 3 → Confirmation/Preview

**File Validation:** Audio: `audio/mpeg` only, max 50MB. Video: `mp4/quicktime/avi`, max 50MB. Artwork: `jpeg/png`, max 1MB.

**Submission:** Uses `FormData`. Metadata is `JSON.stringify()`'d into a single form field. Blob URLs revoked on unmount.

---

### `CreateAccountWizard.jsx`

**Steps (Listener):** Basic Info → Location → Role → Photo → Bio → Support Artist → Review

**Steps (Artist):** ...same + Artist Profile → Song Upload → Support Artist → Review

**Key Logic:**

| Function | Logic |
|----------|-------|
| `validateReferralCode` | GET `/v1/users/validate-referral/{code}` |
| `validateUsername` / `validateEmail` | Debounced API availability checks |
| Geolocation (Nominatim) | Address → OpenStreetMap API → checks lat/lon against Harlem bounds → assigns jurisdictionId. `DIVIDING_LINE` lat `40.8095` (~130th St) splits Uptown vs Downtown. |
| `handleSubmit` | 1) Upload photo → get URL. 2) POST `/v1/users/register`. 3) (Artist only) Upload song with returned `userId`. |

---

### `EditProfileWizard.jsx`

**Tabs:** Photo | Bio

**Photo:** PATCH `/v1/users/profile` via `FormData`. Calls `cacheService.invalidate('user', id)` after save.

**Bio:** PUT `/v1/users/profile/{id}/bio`. Sends `{ bio: string }` wrapped in FormData.

---

### `EditSongWizard.jsx`

**Purpose:** Update song artwork or description.

**Submit:** PATCH `/v1/media/song/{id}` via `FormData`. Conditionally appends artwork and/or description only if changed.

---

### `LyricsWizard.jsx`

**Purpose:** Add/edit/remove lyrics for a track.

**Submit:** PATCH `/v1/media/song/{id}` — wraps lyrics string in `FormData`.

---

### `ChangeDefaultSongWizard.jsx`

**Purpose:** Set which song plays when someone clicks Play on the artist's profile.

**Submit:** PATCH `/v1/users/default-song` with `{ defaultSongId: uuid }`.

---

### `PlaylistWizard.jsx`

**Purpose:** Add a track to an existing playlist or create a new one.

**Props:** `open`, `onClose`, `selectedTrack`

**Delegates all API logic to PlayerContext** — this component is UI only.

---

### `DeleteAccountWizard.jsx`

**Steps:** 1 → Warning | 2 → Verification (checkbox + type username forwards + backwards)

**Delete:** DELETE `/v1/users/me` → `logout()` → redirect to `/login`.

---

### `DeleteSongModal.jsx`

**Purpose:** Simple "Are you sure?" confirmation before deleting a track.

No internal state or API logic — fully controlled by parent (`ArtistDashboard`).

---

## 8. Playlist System

### `PlaylistManager.jsx`

**Role:** Full-screen modal directory of all user playlists plus followed playlists. Clicking a playlist opens `PlaylistViewer` on top.

**Key features:**
- Displays personal playlists and followed playlists in separate sections
- Playlist covers: uses `firstFourArtworks` for a 4-panel grid, or `coverImageUrl`, or generic icon
- Create new playlist inline
- Opens PlaylistViewer for detail view

---

### `PlaylistViewer.jsx`

**Role:** Detail view for a single playlist. Play, reorder, remove tracks, rename, delete.

**Drag-and-Drop:** Native HTML5 drag events. Optimistic reorder → commits via API → reverts on failure.

---

### `PlaylistPanel.jsx`

**Role:** Compact sidebar panel displaying non-default playlists. Lightweight alternative to PlaylistManager.

---

### `Playlists.jsx`

**Role:** Dedicated page route for playlist library (simpler list view alternative to PlaylistManager modal).

**Refactor Flag:** Overlaps with `PlaylistManager`. Consider consolidating.

---

### `playlistService.jsx` (`/src/`)

**Role:** Service wrapper for playlist API calls. Duplicates functionality in `PlayerContext`. Not actively consumed.

**Refactor Flag:** Deprecate in favor of PlayerContext.

---

## 9. Search System

### `SearchBar.jsx` (`/src/components/`)

**Role:** Global search input with typeahead suggestions, trending queries, and recent search history.

**Features:**
- Debounced search (250ms) via custom `useDebounce` hook
- Fetches suggestions from `/v1/search/suggestions` as user types
- Shows trending searches on focus (from `/v1/search/trending`)
- Stores recent searches in localStorage (`unis_recent_searches`, capped at 5)
- Keyboard navigation (up/down arrows, Enter to select, Escape to close)
- Categorized suggestion groups (artists, songs, jurisdictions)
- Navigates to `/search?q=...` on submit or `/artist/:id`, `/song/:id` on direct selection

**Dependencies:** `buildUrl`, `react-router-dom`

---

### `SearchResultsPage.jsx` (`/src/pages/`)

**Role:** Full search results page with tab-based filtering.

**Tabs:** All, Artists, Songs, Jurisdictions

**Key Logic:**
- Reads query from `?q=` search param
- Primary search: GET `/v1/search?q={query}&type={tab}&limit=30`
- Fallback: GET `/v1/search/suggestions?q={query}&limit=30` if primary returns no results
- Client-side tab filtering on the result set
- Click handlers navigate to artist/song/jurisdiction detail pages

---

## 10. Comment System

### `CommentSection.jsx`

**Role:** Threaded comment system embedded in SongPage.

**Props:** `songId`, `userId`, `songArtistId`

**Features:**
- Top-level comments and nested replies
- Rate limiting: tracks user's comment count vs limit (3 per song per day)
- Expand/collapse reply threads
- Delete own comments (or any comment if `userId === songArtistId`)
- Auto-resize textarea
- Fetches comment count separately for header display

**API Endpoints:** GET `/v1/comments/song/{songId}`, POST `/v1/comments`, DELETE `/v1/comments/{id}`, GET `/v1/comments/song/{songId}/count`, GET `/v1/comments/song/{songId}/user-count`

---

## 11. Notifications

### `WinnersNotification.jsx`

**Role:** "Daily login" style notification that fires once per day. Fetches current leaderboard and displays one of three randomly selected notification types.

**Types:** `leading` (shows #1 artist), `trending` (top 3 competing), `community` (total votes today).

**Dedup:** Checks `localStorage('winnersNotificationShown')` against today's date. Shows for 5 seconds.

**Fallback:** Generic "Welcome to UNIS" if API fails.

---

### `LastWonNotification.jsx`

**Role:** Animated award notification celebrating recent award winners. Displays Song of Day/Week and Artist of Day with rich animations.

**Display Duration:** 12 seconds.

**Categories:** Song of the Day, Song of the Week, Artist of the Day — each with distinct badge, color scheme, and icon.

**Logic:** Fetches recent awards from `/v1/awards/past` for each category. Cycles through results with entrance animations.

---

### `SongNotification.jsx`

**Role:** Transient toast that appears when a new track starts playing. Auto-dismisses after 3 seconds.

**Watches:** `currentMedia` from PlayerContext. On change: shows track artwork, title, and artist.

---

## 12. Admin System

### `AdminRoute.jsx`

**Role:** Route guard for admin pages. Three-tier role hierarchy: `moderator < admin < super_admin`.

**Props:** `requiredLevel` (default: `'moderator'`)

**Logic:** Checks `user.adminRole` from AuthContext. If role is below required level → redirects to `/admin` (not `/login`). If no admin role at all → redirects to `/`.

---

### `admin/AdminDashboard.jsx`

**Role:** Admin home page. Shows platform overview stats, DAU chart (Recharts line chart), waitlist analytics, cron job status.

**Init (3 parallel calls):** `/v1/admin/analytics/overview`, `/v1/admin/analytics/dau`, `/v1/admin/analytics/waitlist`

**Child Component:** `CronStatusPanel`

---

### `admin/AdminPlaylistPage.jsx`

**Role:** Official/editorial playlist management. Create, edit, and populate platform playlists.

**Views:** `list` | `create` | `edit`

**Song Picker:** Two modes — `leaderboard` (top songs) and `search` (free-text search). Supports cover image upload, description, track add/remove/reorder.

**API:** `/v1/admin/playlists`, `/v1/admin/playlists/{id}/tracks`, `/v1/admin/playlists/{id}/cover`

---

### `admin/AnalyticsPage.jsx`

**Role:** Full analytics dashboard with platform metrics, charts, and trends.

---

### `admin/AuditLog.jsx`

**Role:** Admin audit log viewer. Shows admin actions with timestamps. Super_admin only.

**API:** GET `/v1/admin/audit`

---

### `admin/CronStatusPanel.jsx`

**Role:** Cron job monitoring panel embedded in AdminDashboard. Shows job statuses with expandable history.

**API:** GET `/v1/admin/cron/status`, GET `/v1/admin/cron/history/{jobName}`

---

### `admin/DmcaClaimDetail.jsx`

**Role:** DMCA claim lifecycle detail view. View claim details, update status, take action.

---

### `admin/ModerationQueue.jsx`

**Role:** Content moderation queue for flagged content.

---

### `admin/RoleManagement.jsx`

**Role:** Admin role assignment interface. Super_admin only. Assign/revoke moderator, admin, super_admin roles.

**API:** GET/POST/DELETE `/v1/admin/roles`

---

### `admin/UserManagement.jsx`

**Role:** User listing and management. Search, filter, view user details.

---

### `admin/UserDetail.jsx`

**Role:** Individual user detail/management view. View profile, activity, take moderation actions.

---

## 13. Earnings & Monetization

### `Earnings.jsx`

**Role:** Full earnings dashboard for both listeners and artists. Previously a placeholder — now fully implemented.

**Tabs:** `overview` | `referrals` | `history` | `payouts`

**Key Features:**
- Earnings summary: total, pending, available balance
- Referral tracking: list of referred users and earned amounts
- Earning history: timeline of all earning events
- Stripe Connect integration: onboarding, payout requests
- Artist-specific vs listener-specific earnings views

**Stripe Connect flow:**
- Checks URL params for `?stripe=complete` (post-onboarding redirect) or `?stripe=refresh` (incomplete onboarding)
- Connect Stripe button → POST to get onboarding URL → redirect
- Request Payout → POST with amount validation

**Init (parallel calls):** earnings summary, referrals, history, Stripe status, payouts

---

### `CashoutPanel.jsx`

**Role:** Stripe Connect payout UI component.

**Props:** `balance` (cents), `pendingBalance` (cents), `minimumPayout` (cents), `stripeConnected`, `onRequestPayout`, `onConnectStripe`, `payoutHistory`

**Features:**
- Balance display with available/pending split
- Minimum payout enforcement ($50.00)
- Custom amount input with validation
- Payout history table with status badges
- Stripe Connect onboarding prompt for unconnected users

**Contains inline backend implementation guide** documenting the required Spring Boot endpoints.

---

### `ReferralCodeCard.jsx`

**Role:** Displays user's referral code with copy-to-clipboard functionality.

**Props:** `userId`, `isArtist` (controls copy text: artists see +5/+2 points, listeners see +5 points)

**API:** GET `/v1/users/referral-code/{userId}`

**Used in:** Profile.jsx (listeners) and ArtistDashboard.jsx (artists)

---

## 14. Theming

### `ThemePicker.jsx`

**Role:** Color theme selector with 7 theme options.

**Themes:** Unis Blue (`#163387`), Orange (`#C44B0A`), Red (`#B51C24`), Green (`#0F7A3E`), Purple (`#4A1A8C`), Gold (`#C49A0A`), Dianna (cheetah-print pattern — uses CSS radial gradients, not a hex color).

**Behavior:** Selecting a theme calls `setTheme(themeId, userId)` from AuthContext, which applies locally immediately and persists to backend.

**Props:** `userId`

**Used in:** Profile.jsx, ArtistDashboard.jsx

---

### `theme.scss`

**Role:** CSS variable definitions for the theme system. Each theme ID maps to a set of CSS variables (`--unis-primary`, `--unis-primary-hover`, `--unis-primary-subtle`, etc.) applied via `[data-theme="..."]` attribute selectors on the root element.

**Selectors:** `[data-theme="blue"]`, `[data-theme="orange"]`, `[data-theme="red"]`, `[data-theme="green"]`, `[data-theme="purple"]`, `[data-theme="yellow"]`, `[data-theme="dianna"]`

---

## 15. Auth Gate (Guest Access)

### `AuthGateSheet.jsx`

**Role:** Context-aware bottom sheet that prompts guests to sign up when they try to access gated features. Replaces hard redirects — guests can browse the feed, artist pages, and song pages freely.

**Exports:** `AuthGateSheet` (default), `useAuthGate` (hook), `incrementGateSongCount`, `getGateSongCount`

**Gate Contexts:** `vote`, `earnings`, `wallet`, `profile`, `generic` — each with unique icon, headline, subtext, and accent text.

**Value Props (shown on every gate):** Earn passively, Vote on winners, Refer & earn more.

**Usage Pattern:**
```jsx
const { triggerGate, gateProps } = useAuthGate();
// In handler:
if (!user) { triggerGate('vote'); return; }
// In JSX:
<AuthGateSheet {...gateProps} />
```

**Song Count Tracking:** `incrementGateSongCount()` is called during guest playback. If `songCount > 0`, the gate shows "X songs listened to — sign up to start earning from every play".

**Actions:** "Create Free Account" → `/createaccount`, "Already have an account? Sign in" → `/login`, "Continue browsing" → closes sheet.

---

### `PrivateRoute.jsx` (`/src/components/`)

**Role:** Route guard for browsable routes. **No longer redirects to login.** Waits for `authLoaded` (prevents flash of wrong state), then always renders child routes. Guests browse freely. Individual features gate themselves via `useAuthGate()`.

---

### `ArtistCard.jsx`

**Role:** Animated artist card component used in Feed and other list views. Features a sinusoidal pulse animation effect and staggered slide-in entrance.

**Props:** `artist`, `onPress`, `onViewPress`, `index`

---

## 16. Account Management

### `ForgotPasswordWizard.jsx`

**Role:** Forgot password flow triggered from Login page.

**Steps:** 1 → Email input | 2 → Success confirmation

**Anti-enumeration:** Always shows success message regardless of whether email exists (backend always returns 200).

**API:** POST `/auth/forgot-password` with `{ email }`

---

### `ResetPassword.jsx` (`/src/pages/`)

**Role:** Token-based password reset page. Public route at `/reset-password`.

**Logic:** Reads `token` from URL search params (`?token=...`). Validates password length (8+) and match. Submits to API. Shows success with "Go to Login" link.

**API:** POST `/auth/reset-password` with `{ token, newPassword }`

---

### `ChangePasswordWizard.jsx`

**Role:** Change password from within an authenticated session (from Profile or ArtistDashboard).

**Props:** `show`, `onClose`, `userId`

**Fields:** Current password, new password, confirm new password.

**API:** PUT `/v1/users/change-password` with `{ currentPassword, newPassword }`

---

### `ResetPassword.jsx` (`/src/` root — legacy)

**Note:** There is a separate `ResetPassword.jsx` in the src root. This appears to be an older version. The active one used by the router is in `/src/pages/ResetPassword.jsx`.

---

## 17. Utility, Services & Infrastructure Files

### `axiosInstance.jsx` (`/src/components/`)

**Role:** Primary authenticated HTTP client for the entire app. Wraps Axios with token injection, automatic caching, and cache invalidation on mutations.

**Environment Config:**

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Production API base URL |
| `VITE_USE_REAL_API` | `'true'` = hit real backend, else use mock |
| `import.meta.env.DEV` | If true + USE_REAL_API, uses `localhost:8080/api` |

**Request Interceptor:** Injects Bearer token. Sets Content-Type (deletes for FormData). Checks cache for GET requests.

**Response Interceptor:** Caches successful GET responses. On mutation: invalidates related cache entries. On 401: clears token + cache → redirects to `/login`.

**Exports:** `default axiosInstance`, `apiCall(config)` (cache-aware wrapper), `invalidateCache(type, id)`, `invalidateCacheType(type)`, `logoutUser()`

---

### `buildUrl.js` (`/src/utils/`)

**Role:** Centralized URL builder handling Cloudflare R2 private-to-public URL rewriting and safe encoding.

**Public CDN Base:** `https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev`

**Logic:**
1. Private R2 URLs (`r2.cloudflarestorage.com`) → rewritten to public CDN path
2. Full URLs (`http...`) → safe-encoded and passed through
3. Relative paths → prepended with API base URL

**Safe encoding:** Decodes first (prevents double-encoding `%20` → `%2520`), then re-encodes.

**Exports:** `buildUrl` (named + default)

---

### `playTracker.js` (`/src/utils/`)

**Role:** Centralized play-tracking utility with 30-second delay (Spotify-standard).

**Exports:**
- `schedulePlayTracking(songId, userId)` — starts a 30-second timer. If called again before it fires (user skips), the previous timer is cancelled.
- `cancelPlayTracking()` — cancels any pending timer (call on skip/unmount)
- `getCurrentTrackingId()` — returns songId being tracked (debug)

**API call:** POST `/v1/media/song/{songId}/play?userId={userId}` after 30 seconds. Silent failure — never interrupts UX.

---

### `idMappings.js` (`/src/utils/`)

**Role:** Single source of truth mapping human-readable string keys to backend UUIDs.

**Exports:** `GENRE_IDS`, `JURISDICTION_IDS`, `INTERVAL_IDS` (string→UUID), `GENRE_NAMES`, `JURISDICTION_NAMES`, `INTERVAL_NAMES` (UUID→string reverse), `getGenreId()`, `getJurisdictionId()`, `getIntervalId()` (safe lookup with console.warn on miss).

**Current mappings:** rap/hip-hop → `...0101`, rock → `...0102`, pop → `...0103`, uptown-harlem → `52740de0-...`, downtown-harlem → `4b09eaa2-...`, harlem → `1cf6ceb1-...`, daily through midterm → `...0201` through `...0206`.

**Note:** `Hip-Hip` key (capital H, typo) maps to the same rap UUID as `hip-hop`. Should be cleaned up.

---

### `useActivityTracker.js` (`/src/hooks/`)

**Role:** Custom hook that fires a page view tracking event on every route change.

**Logic:** Watches `location.pathname` via `useLocation()`. On change, if token exists, fires POST `/v1/activity/track` with `{ activityType: 'page_view', page: pathname }`. Fire-and-forget (errors silently caught).

**Used by:** `AppLayout` in `App.jsx`.

---

### `cacheService.jsx` (`/src/services/`)

**Role:** Two-layer (memory + localStorage) caching service with TTL expiry. Used exclusively by `axiosInstance`.

**TTL by type:** `song` 30min, `artist` 10min, `user` 5min, `trending` 3min, `playlists` 2min, `feed` 1min.

**Public API:** `get()`, `set()`, `invalidate()`, `invalidateType()`, `clearAll()`, `getStats()`

---

### `api.js` (`/src/services/`)

**Role:** Legacy Axios instance. Predates `axiosInstance`. Only used by `Register.jsx`.

**Refactor Flag:** Delete alongside `Register.jsx`.

---

### `IntervalDatePicker.jsx`

**Role:** Reusable custom date picker that adapts UI based on interval prop. Handles 6 modes: daily (native input), weekly (calendar grid), monthly (month grid), quarterly (Q1-Q4 buttons), midterm (H1/H2), annual (year grid).

**Used by:** `MilestonesPage.jsx`

---

## 18. Static Data Files

### `Usstatesandmetros.js` (`/src/data/`)

**Role:** Static dataset of all 50 US states plus DC with their metro areas. Used by `WaitlistPage.jsx` for cascading state→metro dropdowns.

**Format:** `{ stateCode: { name: 'State Name', metros: ['Metro1', 'Metro2', ...] } }`

---

## 19. API Endpoint Reference

### Auth
| Method | Endpoint | Used By |
|--------|----------|---------|
| POST | `/auth/login` | AuthContext |
| POST | `/auth/forgot-password` | ForgotPasswordWizard |
| POST | `/auth/reset-password` | ResetPassword (pages) |
| DELETE | `/v1/users/me` | DeleteAccountWizard |

### Users & Profiles
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/users/profile/{id}` | AuthContext, Feed, ArtistDashboard, Profile |
| PUT | `/v1/users/profile/{id}` | ArtistDashboard (social links, theme) |
| PUT | `/v1/users/profile/{id}/bio` | EditProfileWizard |
| PATCH | `/v1/users/profile` | EditProfileWizard (photo) |
| PUT | `/v1/users/change-password` | ChangePasswordWizard |
| GET | `/v1/users/artists/active` | CreateAccountWizard |
| GET | `/v1/users/{id}/default-song` | ArtistPage, VoteAwards, JurisdictionPage |
| PATCH | `/v1/users/default-song` | ChangeDefaultSongWizard |
| GET | `/v1/users/validate-referral/{code}` | CreateAccountWizard, WaitlistPage |
| GET | `/v1/users/referral-code/{userId}` | ReferralCodeCard |
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
| POST | `/v1/media/song/{id}/play` | playTracker.js |
| GET | `/v1/media/song/{id}/is-liked` | Player |
| POST/DELETE | `/v1/media/song/{id}/like` | Player |
| POST | `/v1/media/video` | UploadWizard |
| GET | `/v1/media/songs/artist/{id}` | ArtistDashboard, ArtistPage |
| GET | `/v1/media/trending/today` | Feed |
| GET | `/v1/media/trending` | Feed |
| GET | `/v1/media/new` | Feed |

### Search
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/search?q=&type=&limit=&offset=` | SearchResultsPage |
| GET | `/v1/search/suggestions?q=&limit=` | SearchBar, SearchResultsPage (fallback) |
| GET | `/v1/search/trending?limit=` | SearchBar |

### Comments
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/comments/song/{songId}` | CommentSection |
| POST | `/v1/comments` | CommentSection |
| DELETE | `/v1/comments/{id}` | CommentSection |
| GET | `/v1/comments/song/{songId}/count` | CommentSection |
| GET | `/v1/comments/song/{songId}/user-count` | CommentSection |

### Voting & Awards
| Method | Endpoint | Used By |
|--------|----------|---------|
| POST | `/v1/vote/submit` | VotingWizard |
| GET | `/v1/vote/nominees` | VoteAwards |
| GET | `/v1/vote/leaderboards` | LeaderboardsPage, WinnersNotification, LastWonNotification |
| GET | `/v1/vote/history` | ArtistDashboard, Profile |
| GET | `/v1/awards/leaderboards` | Feed |
| GET | `/v1/awards/past` | MilestonesPage, LastWonNotification |
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
| GET | `/v1/playlists/mine` | PlayerContext |
| GET | `/v1/playlists/following` | PlayerContext |
| GET | `/v1/playlists/{id}` | PlayerContext (loadPlaylistDetails) |
| POST | `/v1/playlists` | PlayerContext (createPlaylist) |
| PUT | `/v1/playlists/{id}` | PlayerContext (updatePlaylist) |
| DELETE | `/v1/playlists/{id}` | PlayerContext (deletePlaylist) |
| POST | `/v1/playlists/{id}/tracks` | PlayerContext (addToPlaylist) |
| DELETE | `/v1/playlists/{id}/tracks/{itemId}` | PlayerContext (removeFromPlaylist) |
| PUT | `/v1/playlists/{id}/reorder` | PlayerContext (reorderPlaylist) |
| POST | `/v1/playlists/{id}/follow` | PlayerContext (followPlaylist) |
| DELETE | `/v1/playlists/{id}/follow` | PlayerContext (unfollowPlaylist) |
| POST | `/v1/playlists/{id}/suggestions` | PlayerContext (suggestSong) |
| POST | `/v1/playlists/{id}/suggestions/{suggId}/vote` | PlayerContext (voteOnSuggestion) |
| POST | `/v1/playlists/{id}/block` | PlayerContext (blockSong) |
| DELETE | `/v1/playlists/{id}/block/{songId}` | PlayerContext (unblockSong) |

### Earnings
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/earnings/{userId}/summary` | Earnings |
| GET | `/v1/earnings/{userId}/referrals` | Earnings |
| GET | `/v1/earnings/{userId}/history` | Earnings |
| GET | `/v1/earnings/{userId}/stripe-status` | Earnings |
| POST | `/v1/earnings/{userId}/stripe-onboard` | Earnings |
| GET | `/v1/earnings/{userId}/payouts` | Earnings |
| POST | `/v1/earnings/{userId}/payout` | Earnings, CashoutPanel |

### Supporters & Followers
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/supporters/count` | ArtistDashboard |
| GET | `/v1/followers/count` | ArtistDashboard |

### Activity Tracking
| Method | Endpoint | Used By |
|--------|----------|---------|
| POST | `/v1/activity/track` | useActivityTracker |

### Admin
| Method | Endpoint | Used By |
|--------|----------|---------|
| GET | `/v1/admin/analytics/overview` | AdminDashboard |
| GET | `/v1/admin/analytics/dau` | AdminDashboard |
| GET | `/v1/admin/analytics/waitlist` | AdminDashboard |
| GET | `/v1/admin/cron/status` | CronStatusPanel |
| GET | `/v1/admin/cron/history/{jobName}` | CronStatusPanel |
| GET | `/v1/admin/roles` | AuthContext, RoleManagement |
| POST/DELETE | `/v1/admin/roles` | RoleManagement |
| GET | `/v1/admin/audit` | AuditLog |
| GET/POST/PUT/DELETE | `/v1/admin/playlists` | AdminPlaylistPage |
| POST | `/v1/admin/playlists/{id}/tracks` | AdminPlaylistPage |
| POST | `/v1/admin/playlists/{id}/cover` | AdminPlaylistPage |

---

## 20. Known Issues & Refactor Flags

### Resolved from Previous Documentation

| Previous Issue | Status |
|----------------|--------|
| Missing routes for `/privacy`, `/terms`, `/cookie`, `/report` | ✅ Resolved — all routes present in App.jsx |
| Guest login state: Header shows only "Logout" when user is null | ✅ Resolved — guest mode now uses AuthGateSheet instead of hard redirects |
| Hardcoded referral bypass `UNIS-LAUNCH-2024` | ⚠️ Verify — check if still present in CreateAccountWizard |
| `PrivateRoute` only checks token existence, not validity | ✅ Resolved — now uses `authLoaded` from AuthContext, no longer checks token directly |
| Play tracking fires immediately on click | ✅ Resolved — `playTracker.js` implements 30-second delay |
| `buildUrl` was inline in multiple files | ✅ Resolved — extracted to `/src/utils/buildUrl.js` |

### Remaining Issues

| Flag | Component | Issue |
|------|-----------|-------|
| Hardcoded UUIDs | `UploadWizard`, `Feed` | Fallback genre/jurisdiction UUIDs are hardcoded. Brittle if DB IDs change. |
| Hardcoded geofence | `CreateAccountWizard` | Harlem boundary coordinates in frontend. Needs backend handling for scale. |
| Nominatim rate limits | `CreateAccountWizard` | Public OSM API will get blocked at scale. Needs paid geocoding service. |
| `Hip-Hip` typo | `idMappings.js` | Uppercase typo key maps to rap UUID. Should clean up. |
| Unicode reversal | `DeleteAccountWizard` | Username reversal breaks on emoji. Restrict usernames to alphanumeric on sign-up. |
| Logout inconsistency | `AuthContext` vs `DeleteAccountWizard` | Auth uses hard redirect (`window.location.href`), Delete may use client routing. Standardize. |
| Welcome popup | `ArtistDashboard` | `showWelcomePopup` may reset to `true` on every mount. Persist "seen" state. |
| Duplicate lyrics UI | `ArtistDashboard` | May have both `LyricsWizard` import AND a raw JSX lyrics modal. Verify. |
| Dashboard API load | `ArtistDashboard` | 6+ requests on load. Consider a single `/dashboard-summary` endpoint. |
| Playlist redundancy | `Playlists.jsx` | Overlaps with `PlaylistManager`. Consider consolidating. |
| `playlistService.jsx` | `/src/` | Duplicates PlayerContext functionality. Not consumed. Deprecate or delete. |
| Legacy `ResetPassword.jsx` | `/src/` root | Duplicate of `/src/pages/ResetPassword.jsx`. Verify which is active and delete the other. |
| DMCA backend | `ReportInfringement.jsx` | Frontend complete but submission only logs to console. Needs backend POST endpoint. |

---

## 21. Dead / Deprecated Files

| File | Status | Notes |
|------|--------|-------|
| `explorefind.jsx` + `.scss` | Deprecated prototype | Hardcoded dummy data, no API. Superseded by `FindPage.jsx`. |
| `onboarding.jsx` + `.scss` | Deprecated prototype | Placeholder step UI. Superseded by `CreateAccountWizard.jsx`. |
| `mapDemo.jsx` + `.scss` | Deprecated prototype | `react-simple-maps` with dummy data. Superseded by `FindPage.jsx`. |
| `Register.jsx` (`/src/pages/`) | Deprecated stub | Plain form, no styling. Superseded by `CreateAccountWizard.jsx`. |
| `api.js` (`/src/services/`) | Legacy stub | Only used by `Register.jsx`. Delete together. |
| `playlistService.jsx` | Unused | Duplicates `PlayerContext` functions. Not consumed by any component. |
| `ResetPassword.jsx` (`/src/` root) | Likely superseded | `/src/pages/ResetPassword.jsx` is the one wired to the router. Verify and delete. |

---

## 22. Complete File Index

### Source Root (`/src/`)

| File | Size | Purpose |
|------|------|---------|
| `App.jsx` | 6.0K | Application root, routing, providers |
| `App.scss` | 1.0K | App-level styles |
| `AdminRoute.jsx` | 1.0K | Three-tier admin route guard |
| `AuthGateSheet.jsx` | 6.0K | Guest feature-gating bottom sheet |
| `CashoutPanel.jsx` | 23K | Stripe Connect payout UI |
| `DownloadModal.jsx` | 15K | Song download flow (free/paid) |
| `LastWonNotification.jsx` | 15K | Animated award notification |
| `PlayChoiceModal.jsx` | 2.5K | Play Now vs Add to Queue prompt |
| `QueuePanel.jsx` | 7.5K | Queue management UI |
| `ReferralCodeCard.jsx` | 4.0K | Referral code display + copy |
| `ResetPassword.jsx` | 5.5K | Legacy reset password (verify if active) |
| `ThemePicker.jsx` | 4.5K | 7-theme color selector |
| `UnisPauseButton.jsx` | 1.5K | Custom SVG pause icon |
| `UnisPlayButton.jsx` | 1.0K | Custom SVG play icon |
| `WaitlistPage.jsx` | 20K | National pre-registration form |
| `artistCard.jsx` | 7.5K | Animated artist card component |
| `artistDashboard.jsx` | 38K | Artist management interface |
| `artistpage.jsx` | 18K | Public artist portfolio |
| `changeDefaultSongWizard.jsx` | 5.0K | Set featured song |
| `changePasswordWizard.jsx` | 6.5K | Change password wizard |
| `commentSection.jsx` | 15K | Threaded comment system |
| `cookiePolicy.jsx` | 10K | Cookie policy legal page |
| `createAccountWizard.jsx` | 91K | Multi-step registration wizard |
| `deleteAccountWizard.jsx` | 5.5K | Account deletion wizard |
| `deleteSongModal.jsx` | 1.5K | Song deletion confirmation |
| `earnings.jsx` | 25K | Full earnings dashboard |
| `editProfileWizard.jsx` | 6.0K | Profile edit wizard |
| `editSongWizard.jsx` | 10K | Song edit wizard |
| `feed.jsx` | 23K | Main feed / landing page |
| `findpage.jsx` | 31K | Geographic discovery (Leaflet) |
| `footer.jsx` | 1.0K | Footer with legal links |
| `forgotPasswordWizard.jsx` | 4.5K | Forgot password flow |
| `header.jsx` | 7.5K | Top navigation bar |
| `intervalDatePicker.jsx` | 14K | Multi-mode date picker |
| `jurisdictionPage.jsx` | 17K | Jurisdiction-specific feed |
| `layout.jsx` | 512B | Page wrapper |
| `leaderboardsPage.jsx` | 12K | Filterable leaderboard |
| `lyricsWizard.jsx` | 2.5K | Lyrics editor |
| `main.jsx` | 512B | Entry point |
| `milestonesPage.jsx` | 17K | Historical award archive |
| `player.jsx` | 21K | Global media player |
| `playlistManager.jsx` | 23K | Playlist library modal |
| `playlistPanel.jsx` | 2.0K | Compact playlist sidebar |
| `playlistViewer.jsx` | 29K | Playlist detail view |
| `playlistWizard.jsx` | 13K | Add to playlist wizard |
| `playlists.jsx` | 1.5K | Playlist page (legacy) |
| `privacyPolicy.jsx` | 19K | Privacy policy legal page |
| `profile.jsx` | 13K | Listener profile page |
| `reportInfringement.jsx` | 14K | DMCA takedown form |
| `sidebar.jsx` | 4.5K | Primary navigation |
| `songNotification.jsx` | 1.5K | Track change toast |
| `songPage.jsx` | 19K | Song detail page |
| `termsOfService.jsx` | 40K | Terms of Service legal page |
| `theme.scss` | 4.0K | CSS variable theme definitions |
| `uploadWizard.jsx` | 22K | Song/video upload wizard |
| `voteHistoryModal.jsx` | 6.0K | Vote history modal |
| `voteawards.jsx` | 16K | Voting ballot page |
| `votingWizard.jsx` | 21K | Multi-step voting wizard |
| `winnersNotification.jsx` | 7.0K | Daily login notification |

### Subdirectories

| Directory | Files | Purpose |
|-----------|-------|---------|
| `admin/` | 10 files | Admin dashboard, moderation, analytics, roles, audit, playlists |
| `assets/` | Media | Images, videos, audio samples, logos |
| `components/` | 3 files | `PrivateRoute.jsx`, `SearchBar.jsx`, `axiosInstance.jsx` |
| `context/` | 2 files | `AuthContext.jsx`, `playercontext.jsx` |
| `data/` | 1 file | `Usstatesandmetros.js` |
| `hooks/` | 1 file | `useActivityTracker.js` |
| `pages/` | 4 files | `Login.jsx`, `Register.jsx` (deprecated), `ResetPassword.jsx`, `SearchResultsPage.jsx` |
| `services/` | 2 files | `api.js` (deprecated), `cacheService.jsx` |
| `utils/` | 3 files | `buildUrl.js`, `idMappings.js`, `playTracker.js` |
