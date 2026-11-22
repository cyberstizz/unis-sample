// Visitors: people who joined Unis from outside an open area (the waitlist
// form at /waitlist/join). They can listen, like, make playlists, follow,
// comment and message. Voting and uploads wait until their own city opens;
// the server enforces both (VisitorService on the backend). Their profile
// shows their real city: "Dallas, TX · Visitor".
//
// The signed-in user (useAuth().user) and public profiles both carry:
//   visitor           true for a visitor
//   visitorCity       "Dallas" (or what they typed for "Other")
//   visitorStateCode  "TX"
//   visitorStateName  "Texas"

/** The one area open today; the visitor messages name it. */
export const OPEN_AREA_NAME = 'Harlem';

export const isVisitor = (user) => Boolean(user && user.visitor);

/** "Dallas, TX", or null for someone who isn't a visitor. */
export const visitorPlace = (user) => {
  if (!isVisitor(user)) return null;
  const city = (user.visitorCity || '').trim();
  const state = (user.visitorStateCode || '').trim();
  if (city && state) return `${city}, ${state}`;
  return city || state || null;
};

/** "Dallas" for sentences like "your vote opens the day Dallas does". */
export const visitorCity = (user) => (user?.visitorCity || '').trim() || 'your city';

/** "Dallas, TX · Visitor", for profile chips. */
export const visitorChip = (user) => {
  const place = visitorPlace(user);
  return place ? `${place} · Visitor` : null;
};

/**
 * Share a visitor's referral code: the phone's share sheet when there is one,
 * otherwise copy it. Every outcome gets a toast (feedback from useFeedback).
 */
export async function shareVisitorCode(user, feedback) {
  const code = user?.referralCode;
  if (!code) {
    feedback?.error?.('Your code isn’t ready yet. Try again in a moment.');
    return;
  }
  const city = visitorCity(user);
  const url = `${window.location.origin}/waitlist?ref=${encodeURIComponent(code)}`;
  const text = `I'm on Unis. Use my code ${code} to help open it in ${city}.`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Join me on Unis', text, url });
      feedback?.success?.('Shared');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // they closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    feedback?.success?.(`Copied your code, ${code}`);
  } catch {
    feedback?.info?.(`Your code: ${code}`);
  }
}
