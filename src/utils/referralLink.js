// Referral links. A code can arrive in a link in two ways:
//
//   https://<app>/join/HARLEM      the link printed on posters, QR codes and ads
//   https://<app>/anything?ref=CODE  any page, e.g. a creator's link
//
// Either way the code is kept in this browser for 30 days and filled into the
// sign-up form's code step, so nobody has to type it. A newer link replaces
// an older one. Codes are letters, numbers and hyphens, upper case.
const KEY = 'unis_referral_code';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function cleanReferral(raw) {
  return String(raw || '').replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, 64);
}

export function storeReferral(raw) {
  const code = cleanReferral(raw);
  if (code.length < 3) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Storage blocked: the code just won't be filled in for them.
  }
}

/** Reads ?ref= from the current address, if there is one. Called once on load. */
export function captureReferral() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) storeReferral(ref);
  } catch {
    // Nothing to capture.
  }
}

export function getStoredReferral() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved?.code || Date.now() - saved.at > MAX_AGE_MS) return '';
    return cleanReferral(saved.code);
  } catch {
    return '';
  }
}

/** The link to share or print for a code. */
export function joinLink(code, origin = window.location.origin) {
  return `${origin}/join/${encodeURIComponent(cleanReferral(code))}`;
}
