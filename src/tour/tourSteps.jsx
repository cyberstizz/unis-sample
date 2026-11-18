// src/tour/tourSteps.jsx
// ─────────────────────────────────────────────────────────────
// What the welcome tour says, and what each step points at.
//
//   kind     'intro' | 'spot' | 'outro'
//   targets  CSS selectors, tried in order; the first one that is on the
//            page and visible gets the spotlight. Listed per screen size
//            where the layout differs (the sidebar is a drawer on phones,
//            so the menu step points at the menu button there). When no
//            target is found the step still shows, as a centered card.
//   title    a string with one *starred* phrase, set in the serif italic
//   guest    an extra line shown only to signed-out visitors
//
// Keep the copy in line with the Help Center (data/helpContent.jsx): the
// tour is the short version, Help is the full one.
// ─────────────────────────────────────────────────────────────
import React from 'react';
import { VoteIcon, FindIcon, EarningsIcon, MenuIcon } from '../icons/UnisIcons';
import { LiveGlyph, LensGlyph } from './tourGlyphs';

export const TOUR_STEPS = [
  {
    id: 'welcome',
    kind: 'intro',
    eyebrow: 'Welcome to Unis',
    title: 'Music from *your block*, ranked by the people on it.',
    body: 'A quick look around, about forty seconds. You can replay it any time from Help.',
    cta: 'Show me around',
    secondary: 'Not now',
  },
  {
    id: 'race',
    kind: 'spot',
    targets: ['.fm-spot'],
    glyph: LiveGlyph,
    eyebrow: 'The race',
    title: 'Who’s *winning* right now',
    body: 'Today’s race leader, plus this week’s winning song and artist. Swipe through, tap to listen.',
  },
  {
    id: 'lenses',
    kind: 'spot',
    targets: ['.lens-bar'],
    glyph: LensGlyph,
    eyebrow: 'Your feed',
    title: 'Four ways to *listen*',
    body: 'All shows everything. Charts has the rankings, Playlists has your neighborhood’s playlists, and Fresh has the newest drops.',
  },
  {
    id: 'vote',
    kind: 'spot',
    targets: ['.header-nav .nav-item:nth-child(1)'],
    glyph: VoteIcon,
    eyebrow: 'Vote',
    title: 'Your vote *picks the winners*',
    body: 'No editors, no gatekeepers. Daily, weekly and longer races each get their own vote, and every winner goes into Awards.',
    guest: 'Sign in to cast your votes.',
  },
  {
    id: 'find',
    kind: 'spot',
    targets: ['.header-nav .nav-item:nth-child(3)'],
    glyph: FindIcon,
    eyebrow: 'Find',
    title: 'Hear any *neighborhood*',
    body: 'Unis is a map of music. Pick a place to see who’s ranked there and hear what it sounds like.',
  },
  {
    id: 'earnings',
    kind: 'spot',
    targets: ['.header-nav .nav-item:nth-child(4)'],
    glyph: EarningsIcon,
    eyebrow: 'Earnings',
    title: 'Bring people in. *Get paid.*',
    body: 'Share your referral code and earn a cut of the Community Share for everyone you bring in, up to three steps out. The artist you support gets a cut of yours, too.',
    guest: 'Sign in to get your referral code.',
  },
  {
    id: 'menu',
    kind: 'spot',
    targets: ['.sidebar', '.header-hamburger'],
    glyph: MenuIcon,
    eyebrow: 'Everything else',
    title: 'The rest *lives here*',
    body: 'Discover, charts, messages, playlists, and the Help Center, where every rule on Unis is written out in plain language.',
  },
  {
    id: 'done',
    kind: 'outro',
    eyebrow: 'You’re all set',
    title: 'Now go find *your sound.*',
    body: 'Everything in this tour is covered in full in Help.',
    cta: 'Start listening',
    guestCta: 'Create your account',
    guestSecondary: 'Keep browsing',
  },
];

/** Splits 'Who is *winning* now' into text with the starred part in <em>. */
export function renderTitle(title) {
  const parts = String(title).split('*');
  return parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part));
}
