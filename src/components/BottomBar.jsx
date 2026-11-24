// src/components/BottomBar.jsx
//
// The bottom bar on phones and tablets (≤1024px), Nov 2026 (Scout → Sketch →
// Ship; canvas "Unis Home & bottom bar"). Desktop keeps the sidebar.
//
// Rules it follows:
//   • Five tabs, always labelled, in an order that never changes:
//     Home · Feed · Vote · Search · Library. Home bottom-left, Library
//     bottom-right (Spotify's users revolted when Library lost its corner).
//   • Vote is the one coloured tab: a pill in the listener's theme.
//   • It never shrinks, hides or moves while scrolling. It steps aside only
//     while the keyboard is up and while Now Playing is open.
//   • Tapping the tab you're on scrolls back to the top.
//
// It tells the rest of the app it's there:
//   • --unis-bar-lift on <html> (56px while shown, else 0) lifts the mini
//     player, its tray and everything stacked on it (--unp-stack).
//   • body.has-bottom-bar pads the page so nothing hides under it.
//   • body.unis-typing (phones/tablets, keyboard up) tucks the player away.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthGateSheet, { useAuthGate } from '../AuthGateSheet';
import './bottomBar.scss';

const QUERY = '(max-width: 1024px)';
const LIFT = '56px';

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M4 10.5 12 4l8 6.5V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19z" />
      <path d="M9.5 20.4v-5h5v5" />
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="fs" x="4" y="4" width="16" height="9" rx="2.4" />
      <path d="M4.5 16.6h15M4.5 20h9.5" />
    </svg>
  ),
  vote: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4.5" width="16" height="15" rx="3.4" />
      <path d="M8.4 12l2.4 2.4L15.6 9.4" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle className="fs" cx="10.8" cy="10.8" r="6.6" />
      <path d="M15.8 15.8L20.4 20.4" />
    </svg>
  ),
  library: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="fs" x="4" y="4" width="4" height="16" rx="1.2" />
      <rect className="fs" x="10" y="4" width="4" height="16" rx="1.2" />
      <path d="M16.4 5.2l3.5 14.4" />
    </svg>
  ),
};

const TABS = [
  { key: 'home', label: 'Home', to: '/', match: (p) => p === '/' },
  { key: 'feed', label: 'Feed', to: '/feed', match: (p) => p.startsWith('/feed') },
  { key: 'vote', label: 'Vote', to: '/voteawards', match: (p) => p.startsWith('/voteawards') },
  { key: 'search', label: 'Search', to: '/discover', match: (p) => p.startsWith('/discover') || p.startsWith('/browse') || p.startsWith('/search') },
  { key: 'library', label: 'Library', to: '/playlists', match: (p) => p.startsWith('/playlists') },
];

// Text fields that bring up the on-screen keyboard.
const isTextField = (el) => {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image', 'hidden'].includes(type);
};

const mql = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null);

export default function BottomBar() {
  const { isGuest } = useAuth();
  const { triggerGate, gateProps } = useAuthGate();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [small, setSmall] = useState(() => !!mql()?.matches);
  const [typing, setTyping] = useState(false);
  const [npOpen, setNpOpen] = useState(() => typeof document !== 'undefined' && document.body.classList.contains('unp-np-open'));

  // Phones and tablets only.
  useEffect(() => {
    const m = mql();
    if (!m) return undefined;
    const onChange = () => setSmall(m.matches);
    onChange();
    m.addEventListener?.('change', onChange);
    return () => m.removeEventListener?.('change', onChange);
  }, []);

  // Keyboard up = a text field has focus.
  useEffect(() => {
    const onIn = (e) => { if (isTextField(e.target)) setTyping(true); };
    const onOut = () => {
      // Focus may be moving to another field; check once it has landed.
      setTimeout(() => setTyping(isTextField(document.activeElement)), 0);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  // Now Playing open (player.jsx sets body.unp-np-open).
  useEffect(() => {
    const body = document.body;
    const sync = () => setNpOpen(body.classList.contains('unp-np-open'));
    const obs = new MutationObserver(sync);
    obs.observe(body, { attributes: true, attributeFilter: ['class'] });
    sync();
    return () => obs.disconnect();
  }, []);

  const shown = small && !typing && !npOpen;

  // Tell the player and the page the bar is there.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.style.setProperty('--unis-bar-lift', shown ? LIFT : '0px');
    body.classList.toggle('has-bottom-bar', shown);
    body.classList.toggle('unis-typing', small && typing);
    return () => {
      root.style.removeProperty('--unis-bar-lift');
      body.classList.remove('has-bottom-bar', 'unis-typing');
    };
  }, [shown, small, typing]);

  if (!small) return null;

  const go = (tab) => {
    if (tab.key === 'vote' && isGuest) { triggerGate('vote'); return; }
    if (tab.match(pathname)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.layout-content')?.scrollTo?.({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(tab.to);
  };

  return (
    <>
      <nav className={`unis-bar ${shown ? '' : 'is-away'}`} aria-label="Main" aria-hidden={!shown} inert={!shown}>
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          if (tab.key === 'vote') {
            return (
              <button key={tab.key} type="button" className={`unis-bar__tab unis-bar__tab--vote ${active ? 'is-on' : ''}`} onClick={() => go(tab)} aria-current={active ? 'page' : undefined}>
                <span className="unis-bar__pill">{ICONS.vote}</span>
                <span className="unis-bar__label">{tab.label}</span>
              </button>
            );
          }
          return (
            <button key={tab.key} type="button" className={`unis-bar__tab ${active ? 'is-on' : ''}`} onClick={() => go(tab)} aria-current={active ? 'page' : undefined}>
              {ICONS[tab.key]}
              <span className="unis-bar__label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <AuthGateSheet {...gateProps} />
    </>
  );
}
