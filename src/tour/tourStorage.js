// src/tour/tourStorage.js
// Remembers who has seen the welcome tour, so it starts by itself only once.
// Kept per account (a second account on the same phone still gets it) and
// once for signed-out visitors on this device. Bump TOUR_VERSION when the
// tour changes enough that everyone should see it again.

const TOUR_VERSION = 'v1';

export const tourKey = (user) => {
  const id = user?.userId;
  return `unis-tour-${TOUR_VERSION}:${id || 'guest'}`;
};

export function hasSeenTour(user) {
  try {
    return !!localStorage.getItem(tourKey(user));
  } catch {
    return true; // storage blocked: never nag
  }
}

/** how: 'finished' | 'skipped' */
export function markTourSeen(user, how) {
  try {
    localStorage.setItem(tourKey(user), JSON.stringify({ how, at: Date.now() }));
  } catch {
    /* storage blocked */
  }
}

/** Replays the tour from anywhere: goes to the feed and starts it there. */
export function startTour(navigate) {
  navigate('/', { state: { unisTour: true } });
}
