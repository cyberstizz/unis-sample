// A random ID for this browser, used only to count plays by people who aren't
// logged in (logged-out listening). It isn't tied to a person or an account,
// and it's never used for points, play counts or awards.
const KEY = 'unis_visitor_id';

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers: an RFC 4122 version-4 shaped ID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export function getVisitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode or storage blocked: a fresh ID per page load still counts the play.
    return randomId();
  }
}
