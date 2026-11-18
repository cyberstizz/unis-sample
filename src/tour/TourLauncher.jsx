// src/tour/TourLauncher.jsx
// ─────────────────────────────────────────────────────────────
// Decides when the welcome tour opens. Tiny on purpose: the tour itself
// (UnisTour.jsx + its styles) downloads only when it is about to show.
//
// Opens by itself when ALL of these are true:
//   • someone is on the feed ('/'), the page every first visit lands on
//   • the launch splash is gone and the feed has drawn (its lens bar exists)
//   • this account (or this device, for signed-out visitors) hasn't
//     finished or skipped it before (tourStorage.js)
//   • the app isn't locked behind the pre-launch "Coming soon" page
// Opens on request when Help → "Take the tour" sends someone to the feed
// with { state: { unisTour: true } } (startTour() in tourStorage.js).
// ─────────────────────────────────────────────────────────────
import React, { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import lazyWithRetry from '../utils/lazyWithRetry';
import { useAuth } from '../context/AuthContext';
import { onSplashGone } from '../boot/bootSplash';
import { isPrelaunch, canEnterApp } from '../prelaunch/prelaunchConfig';
import { hasSeenTour, markTourSeen } from './tourStorage';

const UnisTour = lazyWithRetry(() => import('./UnisTour'));

const FEED_READY_SELECTOR = '.lens-bar';
const FEED_WAIT_MS = 12000;   // give up quietly if the feed never draws
const SETTLE_MS = 650;        // let the feed's own entrance finish first

// Calls back once the feed has drawn. Returns a cancel function.
function whenFeedReady(cb) {
  let done = false;
  let settleTimer = null;
  const started = Date.now();
  const poll = setInterval(() => {
    if (document.querySelector(FEED_READY_SELECTOR)) {
      clearInterval(poll);
      settleTimer = setTimeout(() => { if (!done) cb(); }, SETTLE_MS);
    } else if (Date.now() - started > FEED_WAIT_MS) {
      clearInterval(poll);
    }
  }, 150);
  return () => {
    done = true;
    clearInterval(poll);
    clearTimeout(settleTimer);
  };
}

export default function TourLauncher() {
  const { user, isGuest, authLoaded } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const autoTriedFor = useRef(null);

  const onFeed = location.pathname === '/';
  const locked = isPrelaunch() && !canEnterApp(user);
  const replayRequested = !!location.state?.unisTour;

  useEffect(() => onSplashGone(() => setSplashGone(true)), []);

  // Replay from Help.
  useEffect(() => {
    if (!onFeed || !replayRequested || locked) return undefined;
    navigate('/', { replace: true, state: null }); // one replay per click
    return whenFeedReady(() => setOpen(true));
  }, [onFeed, replayRequested, locked, navigate]);

  // First visit.
  useEffect(() => {
    if (open || !authLoaded || !splashGone || !onFeed || locked || replayRequested) return undefined;
    const who = user?.userId || 'guest';
    if (autoTriedFor.current === who || hasSeenTour(user)) return undefined;
    autoTriedFor.current = who;
    return whenFeedReady(() => setOpen(true));
  }, [open, authLoaded, splashGone, onFeed, locked, replayRequested, user]);

  // Leaving the feed (the tour blocks the page, but a back gesture can
  // still navigate) closes it without counting as seen.
  useEffect(() => {
    if (!onFeed && open) setOpen(false);
  }, [onFeed, open]);

  const handleClose = useCallback((how) => {
    markTourSeen(user, how);
    setOpen(false);
  }, [user]);

  const handleAction = useCallback((action) => {
    if (action === 'signup') navigate('/login?signup=1'); // opens the sign-up wizard
  }, [navigate]);

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <UnisTour isGuest={isGuest} onClose={handleClose} onAction={handleAction} />
    </Suspense>
  );
}
