// src/utils/teamActing.js — which artist's page a team member is working on.
//
// While set, every API request carries "X-Unis-Act-As: <artistId>". The
// backend (TeamActAsFilter) only honours it on dashboard requests — uploads,
// edits, releases, stats — for accepted team members. Everything else (likes,
// votes, messages, payouts…) always runs as the member themself, so leaving
// it set while browsing is safe.
//
// Kept per browser tab (sessionStorage) and tied to the signed-in member, so
// it never carries over to another account.

const KEY = 'unis-acting-artist';
const listeners = new Set();

const read = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let current = read();

/** { artistId, username, photoUrl, role: 'MANAGER'|'VIEWER', memberId } or null. */
export const getActing = () => current;

export const setActing = (value) => {
  current = value && value.artistId ? value : null;
  try {
    if (current) sessionStorage.setItem(KEY, JSON.stringify(current));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage off: still works for this page view */
  }
  listeners.forEach((fn) => fn(current));
};

export const subscribeActing = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
