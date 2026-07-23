// src/components/ScrollToTop.jsx
//
// Resets scroll position on navigation.
//
// WHY THIS IS NEEDED
// React Router does not scroll on navigation. The browser keeps whatever
// scroll offset the previous page had, so going from a long Feed (scrolled
// halfway) to a short page drops you into the middle of it. That is the
// "pages don't start at the top" symptom.
//
// WHY NOT <ScrollRestoration />
// React Router ships a <ScrollRestoration /> component, but it ONLY works
// inside a data router (createBrowserRouter + RouterProvider). App.jsx uses
// <BrowserRouter>, so it is not available without restructuring routing.
// This component does the same job for a component router.
//
// WHY behavior: 'instant' — IMPORTANT
// Three page stylesheets (reportInfringement.scss, cookiePolicy.scss,
// privacyPolicy.scss) each declare `html { scroll-behavior: smooth; }`.
// Component-imported SCSS is still GLOBAL css: once a user visits any one of
// those pages, smooth scrolling applies to the whole app for the rest of the
// session. A plain window.scrollTo(0, 0) would then ANIMATE on every
// navigation — the new page visibly slides up from wherever you were, which
// looks broken. Passing behavior: 'instant' overrides the CSS per call.
// (Worth also scoping those three `html` rules to their own pages.)
//
// WHY POP IS SKIPPED
// On back/forward the browser restores the previous scroll offset, and users
// expect to land where they left. Forcing the top on POP breaks that. We only
// reset on PUSH and REPLACE.

import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Any element that could be the real scroller. Today the window scrolls —
// html, body and #root all use min-height with no height/overflow lock, and
// `.layout-content { overflow-y: auto }` never engages because it has no
// constrained height. This list means the component keeps working if that
// layout changes later.
const SCROLL_CONTAINER_SELECTORS = ['.layout-content', '.app-wrapper'];

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Let the browser restore position on back/forward.
    if (navigationType === 'POP') return;

    // Honour in-page anchors (/terms#section-4) instead of fighting them.
    if (hash) {
      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Defensive: reset any inner scroller too, so this keeps working if the
    // layout ever moves to a fixed-height container.
    SCROLL_CONTAINER_SELECTORS.forEach((selector) => {
      const el = document.querySelector(selector);
      if (el && el.scrollTop > 0) el.scrollTop = 0;
    });
  }, [pathname, hash, navigationType]);

  return null;
};

export default ScrollToTop;