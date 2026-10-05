// =============================================================================
// prelaunchConfig.js — the single switch for the pre-launch "Coming soon" gate.
//
// WHILE THE GATE IS ON:
//   • Every app route (/, /feed, /login, /artist/…, /admin…) shows <ComingSoon />.
//   • Visitors can still create an account from the Coming soon page.
//   • A short list of OPEN_PATHS keeps working, because signup, email
//     verification, password resets, legal pages and DMCA reports depend on them.
//   • The real app only opens for a signed-in account that has an admin role.
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
  '/waitlist',
];

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

// Who gets the real app before launch: any account with an admin role
// (moderator, admin or super_admin). AuthContext fills user.adminRole on load
// and on login.
export function canEnterApp(user) {
  return Boolean(user?.adminRole);
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
