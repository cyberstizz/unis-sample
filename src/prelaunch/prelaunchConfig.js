// =============================================================================
// prelaunchConfig.js — the single switch for the pre-launch "Coming soon" gate.
//
// WHILE THE GATE IS ON:
//   • Every app route (/, /feed, /login, /artist/…, /admin…) shows <ComingSoon />.
//   • Visitors can still create an account from the Coming soon page.
//   • A short list of OPEN_PATHS keeps working, because signup, email
//     verification, password resets, legal pages and DMCA reports depend on them.
//   • The real app only opens for a signed-in account that has an admin role,
//     or for any account that signed in on the backstage page (BACKSTAGE PASS,
//     below; the Railway variable UNIS_PRELAUNCH decides who can sign in).
//   • The login form lives at a secret path (VITE_BACKSTAGE_PATH), so the only
//     way to reach it is to know that path.
//
// ENV VARIABLES (set in Netlify, or in .env.local for local work):
//   VITE_PRELAUNCH        "true"  → gate forced ON (any environment)
//                         "false" → gate forced OFF (launch day: set this, redeploy)
//                         unset   → ON in production builds, OFF in `npm run dev` / tests
//   VITE_BACKSTAGE_PATH   e.g. "/backstage-k7q2m9xw" — the hidden login page.
//                         Unset = no hidden login page (nobody can log in).
//
// Values are read on every call (not cached at import) so tests can stub them.
// =============================================================================

export const OPEN_PATHS = [
  '/verify-email',
  '/reset-password',
  '/privacy',
  '/terms',
  '/cookie',
  '/report',
  '/waitlist',  // and /waitlist/join (sub-paths are open too)
  '/sponsor',   // Sponsor Harlem: shop owners book from a QR code, before and after launch
  '/help',      // the help center, linked from the Coming Soon page
  '/join',      // /join/CODE: poster, QR and ad links open sign-up with the code filled in
  '/team',      // the street team: pitch page, join form, meetup replies (email links)
];

// The launch moment the Coming soon countdown counts down to: midnight in
// Harlem (Eastern time) on Saturday, November 22, 2026. If the date moves, set
// VITE_LAUNCH_AT in Netlify to any ISO date (e.g. 2026-12-05T00:00:00-05:00)
// and redeploy; no code change needed.
export const DEFAULT_LAUNCH_AT = '2026-11-22T00:00:00-05:00';

export function getLaunchAt() {
  const raw = String(import.meta.env.VITE_LAUNCH_AT ?? '').trim();
  const parsed = Date.parse(raw || DEFAULT_LAUNCH_AT);
  return Number.isFinite(parsed) ? parsed : Date.parse(DEFAULT_LAUNCH_AT);
}

export function isPrelaunch() {
  const flag = String(import.meta.env.VITE_PRELAUNCH ?? '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return Boolean(import.meta.env.PROD);
}

export function getBackstagePath() {
  const raw = String(import.meta.env.VITE_BACKSTAGE_PATH ?? '').trim();
  if (!raw) return null;
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const clean = withSlash.replace(/\/+$/, '');
  // Refuse a path that would swallow the whole site or a public page.
  if (clean === '' || clean === '/' || isOpenPath(clean)) return null;
  return clean;
}

function normalize(pathname = '/') {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function isOpenPath(pathname) {
  const p = normalize(pathname);
  return OPEN_PATHS.some((open) => p === open || p.startsWith(`${open}/`));
}

export function isBackstagePath(pathname) {
  const backstage = getBackstagePath();
  return Boolean(backstage) && normalize(pathname) === backstage;
}

// ── BACKSTAGE PASS ──────────────────────────────────────────────────────────
// Anyone who signs in ON THE BACKSTAGE PAGE gets the full app in that browser,
// not just admins (Login.jsx grants the pass; logout clears it). The pass is
// tied to that one account, so someone else signing in on the same browser
// through the normal pages doesn't inherit it.
//
// Who can sign in at all is decided by the SERVER, so that is the switch:
//   Railway UNIS_PRELAUNCH = "true"  → only admin accounts can sign in (normal)
//   Railway UNIS_PRELAUNCH = "false" → any verified account can sign in on the
//                                      backstage page (e.g. a test artist)
// The public keeps seeing the Coming soon page either way, because only the
// backstage page hands out the pass. Turn VITE_PRELAUNCH off only on launch day.
const BACKSTAGE_PASS_KEY = 'unis_backstage_pass';

export function grantBackstagePass(userId) {
  if (!userId) return;
  try { localStorage.setItem(BACKSTAGE_PASS_KEY, String(userId)); } catch { /* storage blocked */ }
}

export function clearBackstagePass() {
  try { localStorage.removeItem(BACKSTAGE_PASS_KEY); } catch { /* storage blocked */ }
}

function hasBackstagePass(user) {
  try {
    const passFor = localStorage.getItem(BACKSTAGE_PASS_KEY);
    return Boolean(passFor && user?.userId && passFor === String(user.userId));
  } catch {
    return false;
  }
}

// Who gets the real app before launch: any account with an admin role
// (moderator, admin or super_admin), plus any account that signed in on the
// backstage page. AuthContext fills user.adminRole on load and on login.
export function canEnterApp(user) {
  return Boolean(user?.adminRole) || hasBackstagePass(user);
}

/**
 * Decides what AppLayout renders for this request.
 *   'app'        → the full app, exactly as today
 *   'open'       → the page on its own (no sidebar, player or notifications)
 *   'backstage'  → the login form, on the secret path
 *   'enter'      → an admin who is already signed in hit the secret path;
 *                  send them into the app
 *   'comingSoon' → the Coming soon page
 *   'wait'       → auth hasn't resolved yet; render nothing (no flash)
 */
export function resolveGate({ pathname, user, authLoaded }) {
  if (!isPrelaunch()) return 'app';
  if (!authLoaded) return 'wait';
  if (canEnterApp(user)) return isBackstagePath(pathname) ? 'enter' : 'app';
  if (isBackstagePath(pathname)) return 'backstage';
  if (isOpenPath(pathname)) return 'open';
  return 'comingSoon';
}
