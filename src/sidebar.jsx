// src/sidebar.jsx
// ─────────────────────────────────────────────────────────────
// The Unis sidebar (v3, Nov 2026 redesign).
//
// Desktop (>1024px): a floating rounded panel down the left side.
//   • Your turf: the user's jurisdiction in the serif italic the feed uses,
//     a live equaliser, and tonight's #1 song (today's song race, the same
//     standings call and URL the feed makes, so on the feed it comes from
//     the cache). Signed-out visitors get a "Now live · Harlem" card that
//     opens Find.
//   • Six links: Home, Discover, Charts, Vote, Messages (unread badge),
//     Unis Plus (+ Admin for admins). Vote is also in the header on purpose:
//     it's the heart of Unis. Awards, Find and Earnings are header-only.
//     (Leaderboards was dropped in Nov 2026: it read the same standings as
//     Charts, which shows everything it did and more. The page still exists
//     at /leaderboards, but nothing links to it.)
//   • Your playlists: the user's own and followed playlists with their
//     covers (already loaded by PlayerContext, no extra request). The one
//     the current song came from shows a moving equaliser. Only this list
//     scrolls, so no link is ever pushed out of view.
//   • Account row: avatar, lifetime earnings, Settings and Help buttons.
//   • Collapse: shrinks to a slim rail (icons keep small labels, playlists
//     show as covers). Remembered per device. The content column follows
//     through --sidebar-width.
// Phone and tablet (≤1024px): the same panel as a drawer over the page,
//   opened by the header's menu button ('unis:toggle-sidebar').
//
// Every control is a real <button> or link, so the browser's focus ring
// shows for keyboard users only (never after a click), and the panel itself
// never scrolls.
// ─────────────────────────────────────────────────────────────
import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import './sidebar.scss';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import { buildUrl } from './utils/buildUrl';
import { fetchStandings } from './utils/standings';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';

const DESKTOP_MIN = 1025;          // matches sidebar.scss and player.scss
const PANEL_W = 268;
const RAIL_W = 86;
const GUTTER = 8;                  // space around the floating panel
const COLLAPSE_KEY = 'unis-sidebar-collapsed';

// Signed-out visitors (and accounts without a jurisdiction yet) see the
// launch area. Change this when Unis opens beyond Harlem.
const GUEST_TURF = { name: 'Harlem', line: 'See who’s #1 uptown and downtown', path: '/findpage' };

const THEMES = ['blue', 'orange', 'red', 'green', 'purple', 'yellow', 'dianna'];

const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN;

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};

const initials = (name) => (name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'U';

// ★ Custom inline-SVG icon set (outline by default, duotone when active).
//   Inline SVGs are required here: Lucide does not render reliably inside
//   buttons in the web app, and the outline→duotone active swap needs a
//   fillable primary shape (class `fs`) plus accent-fill detail (`fs2`).
//   Stroke / fill are driven entirely by sidebar.scss.
const ICONS = {
  // ★ Nov 2026 bottom bar: Feed got its own page (/feed); Find, Awards,
  //   Earnings and Log out joined the phone menu.
  feed: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="fs" x="4" y="4" width="16" height="9" rx="2.4" />
      <path d="M4.5 16.6h15M4.5 20h9.5" />
    </svg>
  ),
  find: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  awards: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M5 5h3v1.5a2.5 2.5 0 0 0 2.4 2.5M16 5h3v1.5A2.5 2.5 0 0 1 16.6 9M12 13v4M8.5 20h7" />
    </svg>
  ),
  earnings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle className="fs" cx="12" cy="12" r="8.4" />
      <path d="M12 6.5v11M14.6 9.2c0-1.1-1.2-1.8-2.6-1.8s-2.6.7-2.6 1.8 1.2 1.6 2.6 1.8 2.6.8 2.6 1.9-1.2 1.8-2.6 1.8-2.6-.7-2.6-1.8" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4.5h3.6A1.4 1.4 0 0 1 19 5.9v12.2a1.4 1.4 0 0 1-1.4 1.4H14M10 16l-4-4 4-4M6 12h9" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M4 10.5 12 4l8 6.5V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19z" />
      <path d="M9.5 20.4v-5h5v5" />
    </svg>
  ),
  discover: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle className="fs" cx="12" cy="12" r="8.4" />
      <path className="fs2" d="M15.4 8.6l-2.1 4.7-4.7 2.1 2.1-4.7z" />
    </svg>
  ),
  vote: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="fs" x="4" y="4.5" width="16" height="15" rx="3.4" />
      <path d="M8.4 12l2.4 2.4L15.6 9.4" />
    </svg>
  ),
  charts: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M4.5 5h3v3h-3z" />
      <path d="M4.5 5h3v3h-3zM10.5 6.5h9M4.5 11h3M10.5 12.5h9M4.5 17h3M10.5 18.5h6" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M5 5.6h14a1.5 1.5 0 0 1 1.5 1.5v7.8A1.5 1.5 0 0 1 19 16.4h-9l-4 3.2v-3.2H5A1.5 1.5 0 0 1 3.5 14.9V7.1A1.5 1.5 0 0 1 5 5.6z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M12 3.6l2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.4l-5 2.65.95-5.6L3.9 9.5l5.6-.8z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M12 2.9c.5 0 1 .06 1.45.18l.5 1.86c.57.22 1.1.53 1.58.92l1.86-.55c.6.58 1.1 1.28 1.5 2.04l-1.36 1.38c.1.5.16 1.03.16 1.57s-.06 1.07-.16 1.57l1.36 1.38c-.4.76-.9 1.46-1.5 2.04l-1.86-.55c-.48.39-1 .7-1.58.92l-.5 1.86c-.46.12-.95.18-1.45.18s-1-.06-1.45-.18l-.5-1.86a7.2 7.2 0 0 1-1.58-.92l-1.86.55a7.9 7.9 0 0 1-1.5-2.04l1.36-1.38A7.5 7.5 0 0 1 5.3 12c0-.54.06-1.07.16-1.57L4.1 9.05c.4-.76.9-1.46 1.5-2.04l1.86.55c.48-.39 1-.7 1.58-.92l.5-1.86C9.99 2.96 10.5 2.9 12 2.9z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle className="fs" cx="12" cy="12" r="8.4" />
      <path d="M9.7 9.4a2.4 2.4 0 1 1 3.1 2.9c-.6.2-.8.7-.8 1.3v.5" />
      <circle className="fs2" cx="12" cy="16.8" r="0.9" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M12 3.4l6.6 2.4v5.2c0 4.1-2.8 6.8-6.6 8.1-3.8-1.3-6.6-4-6.6-8.1V5.8z" />
      <path d="M9.2 12l2 2 3.6-4" />
    </svg>
  ),
  // ── Panel controls (drawn to the same rules) ──
  collapse: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M9.5 4.5v15M15.5 10l-2 2 2 2" />
    </svg>
  ),
  expand: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M9.5 4.5v15M13.5 10l2 2-2 2" />
    </svg>
  ),
  add: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
  ),
};

// A playlist's cover: its own image, else a 2×2 mosaic of its first four
// songs (one image if it has fewer), else a music note.
const PlaylistCover = ({ playlist }) => {
  const [broken, setBroken] = useState(false);
  const cover = playlist.coverImageUrl && !broken ? buildUrl(playlist.coverImageUrl) : null;
  const art = (playlist.firstFourArtworks || []).filter(Boolean).map((u) => buildUrl(u));

  if (cover) {
    return <span className="sb-cover"><img src={cover} alt="" loading="lazy" onError={() => setBroken(true)} /></span>;
  }
  if (art.length >= 4) {
    return (
      <span className="sb-cover sb-cover--mosaic">
        {art.slice(0, 4).map((u, i) => <img key={i} src={u} alt="" loading="lazy" />)}
      </span>
    );
  }
  if (art.length) {
    return <span className="sb-cover"><img src={art[0]} alt="" loading="lazy" /></span>;
  }
  return <span className="sb-cover sb-cover--empty">{ICONS.note}</span>;
};

// Four little level bars: the same mark as the launch splash and the tour.
const Equalizer = ({ label }) => (
  <span
    className="sb-eq"
    {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
  >
    <i /><i /><i /><i />
  </span>
);

const songsWord = (n) => `${n} ${n === 1 ? 'song' : 'songs'}`;

const formatMoney = (amount) => {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(n)) return '$0.00';
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(2)}`;
};

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);          // the phone/tablet drawer
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [desktop, setDesktop] = useState(isDesktop);
  const { user, isGuest, theme, logout } = useAuth();
  const { triggerGate, gateProps } = useAuthGate();
  const player = useContext(PlayerContext) || {};
  const {
    playlists = [],
    followedPlaylists = [],
    currentMedia,
    isPlaying,
  } = player;
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);
  const animTimer = useRef(null);

  const path = location?.pathname || '/';
  const signedIn = !!user && !isGuest;
  const rail = desktop && collapsed;

  // ── Unread messages badge ──────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!signedIn) { setUnreadCount(0); return undefined; }
    let alive = true;
    const load = async () => {
      try {
        // Chats only: a message request never adds to the badge.
        const res = await apiCall({ url: '/v1/conversations/summary', useCache: false });
        if (!alive) return;
        setUnreadCount(Number(res.data?.unread) || 0);
      } catch (err) {
        console.error('[Sidebar] message count failed (badge hidden):', err?.message || err);
      }
    };
    load();
    window.addEventListener('unis:messages-updated', load);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.removeEventListener('unis:messages-updated', load);
      window.removeEventListener('focus', load);
    };
  }, [signedIn]);

  // ── Lifetime earnings for the account row ──────────────────
  const [lifetime, setLifetime] = useState(null);
  useEffect(() => {
    if (!signedIn) { setLifetime(null); return undefined; }
    let alive = true;
    (async () => {
      try {
        const res = await apiCall({ url: '/v1/earnings/my-summary' });
        if (!alive) return;
        const s = res?.data || {};
        const ref = Number(s?.referralEarnings?.lifetime) || 0;
        const sup = Number(s?.supporterEarnings?.lifetime) || 0;
        const explicit = Number(s?.totalEarnings?.lifetime);
        setLifetime(Number.isFinite(explicit) && explicit > 0 ? explicit : ref + sup);
      } catch (err) {
        console.error('[Sidebar] lifetime earnings failed (figure hidden):', err?.message || err);
      }
    })();
    return () => { alive = false; };
  }, [signedIn]);

  // ── Tonight's #1 in the user's jurisdiction ────────────────
  // Same call (and URL) as the feed's daily race, so it's a cache hit there.
  const jName = user?.jurisdiction?.name || null;
  const jId = user?.jurisdiction?.jurisdictionId || null;
  const [leader, setLeader] = useState(null);

  useEffect(() => {
    if (!jId) { setLeader(null); return undefined; }
    let alive = true;
    const load = () => fetchStandings({ type: 'song', jurisdictionId: jId, genre: 'all', period: 'daily', limit: 50 })
      .then((board) => {
        if (!alive) return;
        const top = (board?.entries || []).find((e) => e.points > 0);
        setLeader(top
          ? { name: top.name, artistName: top.artistName, live: (board.state || 'LIVE') === 'LIVE' }
          : null);
      })
      .catch((err) => {
        console.error('[Sidebar] tonight’s #1 failed (line hidden):', err?.message || err);
        if (alive) setLeader(null);
      });
    load();
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.removeEventListener('focus', load);
    };
  }, [jId]);

  // ── Width the content column leaves for us ──────────────────
  useEffect(() => {
    const apply = () => {
      const d = isDesktop();
      setDesktop(d);
      if (d) setIsOpen(false);
      const width = d ? (collapsed ? RAIL_W : PANEL_W) + GUTTER * 2 : 0;
      document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* private mode */ }
  }, [collapsed]);

  useEffect(() => () => clearTimeout(animTimer.current), []);

  // The content column glides with the panel only while it's being toggled
  // (sidebar.scss → .sb-animating), never on page load.
  const toggleCollapsed = () => {
    const root = document.documentElement;
    root.classList.add('sb-animating');
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => root.classList.remove('sb-animating'), 450);
    setCollapsed((c) => !c);
  };

  // ── The drawer (phone / tablet) ─────────────────────────────
  useEffect(() => {
    const onToggle = () => setIsOpen((prev) => !prev);
    window.addEventListener('unis:toggle-sidebar', onToggle);
    return () => window.removeEventListener('unis:toggle-sidebar', onToggle);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const closeDrawer = () => setIsOpen(false);

  const handleNav = (to) => {
    navigate(to);
    if (!isDesktop()) setIsOpen(false);
  };

  const handleProfile = () => {
    if (user?.role === 'artist') handleNav('/artistDashboard');
    else handleNav('/profile');
  };

  // ★ Playlists live on their own page now (/playlists). New playlist opens
  // its create sheet there; the old popup manager is no longer opened.
  const handleNewPlaylist = () => handleNav('/playlists?new=1');
  const handleLibrary = () => handleNav('/playlists');

  // Gated actions (same behaviour as before the redesign)
  const onMessages = () => { if (isGuest) { triggerGate('profile'); return; } handleNav('/messages'); };
  const onPlus = () => { if (isGuest) { triggerGate('plus'); return; } handleNav('/plus'); };
  const onSettings = () => { if (isGuest) { triggerGate('profile'); return; } handleProfile(); };

  const onEarnings = () => { if (isGuest) { triggerGate('profile'); return; } handleNav('/earnings'); };
  const onLogout = () => { setIsOpen(false); logout(); };

  // bar: also in the phone bottom bar or header, so the phone menu leaves it
  //      out. menu: phone menu only (the desktop header already has these).
  const allLinks = [
    { key: 'home',         label: 'Home',         icon: 'home',         onClick: () => handleNav('/'),             match: (p) => p === '/', bar: true },
    { key: 'feed',         label: 'Feed',         icon: 'feed',         onClick: () => handleNav('/feed'),         match: (p) => p.startsWith('/feed'), bar: true },
    { key: 'discover',     label: 'Discover',     icon: 'discover',     onClick: () => handleNav('/discover'),     match: (p) => p.startsWith('/discover'), bar: true },
    { key: 'charts',       label: 'Charts',       icon: 'charts',       onClick: () => handleNav('/charts'),       match: (p) => p.startsWith('/charts') },
    { key: 'vote',         label: 'Vote',         icon: 'vote',         onClick: () => handleNav('/voteawards'),   match: (p) => p.startsWith('/voteawards'), bar: true },
    { key: 'messages',     label: 'Messages',     icon: 'messages',     onClick: onMessages, badge: unreadCount,  match: (p) => p.startsWith('/messages'), bar: true },
    { key: 'find',         label: 'Find on the map', icon: 'find',      onClick: () => handleNav('/findpage'),     match: (p) => p.startsWith('/findpage'), menu: true },
    { key: 'awards',       label: 'Awards',       icon: 'awards',       onClick: () => handleNav('/milestones'),   match: (p) => p.startsWith('/milestones'), menu: true },
    { key: 'earnings',     label: 'Earnings',     icon: 'earnings',     onClick: onEarnings,                       match: (p) => p.startsWith('/earnings'), menu: true },
    { key: 'plus',         label: 'Unis Plus',    icon: 'plus',         onClick: onPlus,                          match: (p) => p.startsWith('/plus') },
    ...(user && user.adminRole
      ? [{ key: 'admin', label: 'Admin', icon: 'admin', onClick: () => handleNav('/admin'), match: (p) => p.startsWith('/admin') }]
      : []),
    ...(signedIn
      ? [{ key: 'logout', label: 'Log out', icon: 'logout', onClick: onLogout, match: () => false, menu: true }]
      : []),
  ];
  const links = allLinks.filter((it) => (desktop ? !it.menu : !it.bar));

  // Own playlists first, then followed ones, never the same one twice.
  const library = useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (pl, mine) => {
      const id = pl?.playlistId || pl?.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ ...pl, id, mine });
    };
    (playlists || []).forEach((pl) => add(pl, true));
    (followedPlaylists || []).forEach((pl) => add(pl, false));
    return out;
  }, [playlists, followedPlaylists]);

  const playingFrom = isPlaying && currentMedia?.origin?.type === 'playlist'
    ? currentMedia.origin.playlistId
    : null;

  const turf = jName
    ? {
      eyebrow: 'Your turf',
      name: jName,
      // The jurisdiction page looks places up by name (/jurisdiction/:name),
      // so the link carries the name. It used to carry the id, which the
      // page couldn't find ("Couldn't load …").
      open: () => handleNav(`/jurisdiction/${encodeURIComponent(jName)}`),
      line: leader
        ? (
          <>
            <span className="sb-turf__rank">{leader.live ? '#1 tonight' : 'Yesterday’s #1'}</span>
            <span aria-hidden="true">·</span>
            <span className="sb-turf__song">
              {leader.name}{leader.artistName ? ` — ${leader.artistName}` : ''}
            </span>
          </>
        )
        : <span className="sb-turf__song">Open your neighborhood</span>,
    }
    : {
      eyebrow: 'Now live',
      name: GUEST_TURF.name,
      open: () => handleNav(GUEST_TURF.path),
      line: <span className="sb-turf__song">{GUEST_TURF.line}</span>,
    };

  const safeTheme = signedIn && THEMES.includes(theme) ? theme : 'blue';
  const wordmark = `/brand/splash/wordmark-${safeTheme}.${safeTheme === 'blue' ? 'svg' : 'png'}`;
  const avatarUrl = buildUrl(user?.photoUrl);
  const initial = (user?.username || 'U').charAt(0).toUpperCase();
  const currentPlaylistId = path.startsWith('/playlist/') ? path.split('/')[2] : null;

  return (
    <>
      <nav
        className={`sidebar ${isOpen ? 'open' : ''} ${rail ? 'sidebar--rail' : ''} ${isGuest ? 'sidebar--guest' : ''}`}
        ref={sidebarRef}
        aria-label="Sidebar"
      >
        {/* Phone / tablet: the drawer's own top bar */}
        {!desktop && (
          <div className="sb-drawer-top">
            <img className="sb-drawer-top__logo" src={wordmark} alt="Unis" draggable="false" />
            <button type="button" className="sb-icon-btn" onClick={closeDrawer} aria-label="Close menu">
              {ICONS.close}
            </button>
          </div>
        )}

        {/* ── Your turf ── */}
        {rail ? (
          <button
            type="button"
            className="sb-turf-badge"
            onClick={turf.open}
            title={turf.name}
            aria-label={turf.name}
          >
            <Equalizer />
            <span className="sb-turf-badge__initials">{initials(turf.name)}</span>
          </button>
        ) : (
          <div className="sb-turf">
            <div className="sb-turf__top">
              <Equalizer />
              <span className="sb-turf__eyebrow">{turf.eyebrow}</span>
              {desktop && (
                <button
                  type="button"
                  className="sb-icon-btn sb-icon-btn--sm"
                  onClick={toggleCollapsed}
                  aria-label="Collapse sidebar"
                  aria-expanded="true"
                  title="Collapse sidebar"
                >
                  {ICONS.collapse}
                </button>
              )}
            </div>
            <button type="button" className="sb-turf__open" onClick={turf.open}>
              <span className="sb-turf__name">{turf.name}</span>
              <span className="sb-turf__line">{turf.line}</span>
            </button>
          </div>
        )}

        {/* ── Links ── */}
        <ul className="sb-links">
          {links.map((it) => {
            const active = it.match(path);
            return (
              <li key={it.key}>
                <button
                  type="button"
                  className={`sb-link ${active ? 'active' : ''}`}
                  onClick={it.onClick}
                  aria-current={active ? 'page' : undefined}
                  title={rail ? it.label : undefined}
                >
                  <span className="sb-link__icon">
                    {ICONS[it.icon]}
                    {rail && it.badge > 0 && (
                      <span className="sb-badge sb-badge--corner">{it.badge > 9 ? '9+' : it.badge}</span>
                    )}
                  </span>
                  <span className="sb-link__label">{it.label}</span>
                  {!rail && it.badge > 0 && (
                    <span className="sb-badge" aria-label={`${it.badge} unread`}>{it.badge > 99 ? '99+' : it.badge}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="sb-divider" />

        {/* ── Your playlists ──
            Everything in this zone gives way (shrinks, then scrolls) before
            the account row below it does: Settings is never pushed off. */}
        <div className="sb-zone">
        {!signedIn ? (
          !rail && (
            <div className="sb-card">
              <p className="sb-card__title">Make it yours</p>
              <p className="sb-card__body">
                Sign in to save songs, build playlists and earn from every listener you bring.
              </p>
              <button type="button" className="sb-card__btn sb-card__btn--light" onClick={() => handleNav('/login')}>
                Sign in
              </button>
            </div>
          )
        ) : library.length === 0 ? (
          rail ? (
            <button type="button" className="sb-icon-btn" onClick={handleNewPlaylist} aria-label="New playlist" title="New playlist">
              {ICONS.add}
            </button>
          ) : (
            <>
              <div className="sb-lib-head">
                <button type="button" className="sb-lib-head__title sb-lib-head__link" onClick={handleLibrary}>Your playlists</button>
              </div>
              {/* One playlist-sized row, not a card, so it never crowds out
                  the account row. */}
              <button type="button" className="sb-pl sb-pl--new" onClick={handleNewPlaylist} aria-label="New playlist">
                <span className="sb-cover sb-cover--new" aria-hidden="true">{ICONS.add}</span>
                <span className="sb-pl__text">
                  <span className="sb-pl__name">Create your first playlist</span>
                  <span className="sb-pl__meta">Collect the songs you love</span>
                </span>
              </button>
            </>
          )
        ) : (
          <>
            {rail ? (
              <button type="button" className="sb-icon-btn sb-rail-add" onClick={handleNewPlaylist} aria-label="New playlist" title="New playlist">
                {ICONS.add}
              </button>
            ) : (
              <div className="sb-lib-head">
                <button type="button" className="sb-lib-head__title sb-lib-head__link" onClick={handleLibrary}>Your playlists</button>
                <button type="button" className="sb-icon-btn" onClick={handleNewPlaylist} aria-label="New playlist" title="New playlist">
                  {ICONS.add}
                </button>
              </div>
            )}
            <ul className="sb-lib" aria-label="Your playlists">
              {library.map((pl) => {
                const playing = playingFrom && String(playingFrom) === String(pl.id);
                const here = currentPlaylistId && String(currentPlaylistId) === String(pl.id);
                const meta = pl.mine || !pl.creatorName
                  ? `Playlist · ${songsWord(pl.songCount || 0)}`
                  : `Playlist · ${pl.creatorName}`;
                return (
                  <li key={pl.id}>
                    <button
                      type="button"
                      className={`sb-pl ${playing ? 'is-playing' : ''} ${here ? 'active' : ''}`}
                      onClick={() => handleNav(`/playlist/${pl.id}`)}
                      aria-current={here ? 'page' : undefined}
                      title={rail ? pl.name : undefined}
                      aria-label={rail ? `${pl.name}${playing ? ', playing' : ''}` : undefined}
                    >
                      <PlaylistCover playlist={pl} />
                      {!rail && (
                        <>
                          <span className="sb-pl__text">
                            <span className="sb-pl__name">{pl.name}</span>
                            <span className="sb-pl__meta">{meta}</span>
                          </span>
                          {playing && <Equalizer label="Playing" />}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        </div>

        {/* ── Account ── */}
        <div className="sb-foot">
          {rail && (
            <button type="button" className="sb-icon-btn" onClick={toggleCollapsed} aria-label="Expand sidebar" aria-expanded="false" title="Expand sidebar">
              {ICONS.expand}
            </button>
          )}
          {signedIn ? (
            rail ? (
              <button type="button" className="sb-avatar-btn" onClick={handleProfile} aria-label="Your profile" title={user?.username || 'Your profile'}>
                <span className="sb-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</span>
              </button>
            ) : (
              <div className="sb-account">
                <button type="button" className="sb-account__me" onClick={handleProfile}>
                  <span className="sb-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</span>
                  <span className="sb-account__id">
                    <span className="sb-account__name">{user?.username || 'You'}</span>
                    <span className="sb-account__sub">
                      {lifetime != null
                        ? <>Lifetime <span className="sb-account__money">{formatMoney(lifetime)}</span></>
                        : `@${user?.username || 'you'}`}
                    </span>
                  </span>
                </button>
                <button type="button" className="sb-icon-btn" onClick={onSettings} aria-label="Settings" title="Settings">{ICONS.settings}</button>
                <button type="button" className="sb-icon-btn" onClick={() => handleNav('/help')} aria-label="Help" title="Help">{ICONS.help}</button>
              </div>
            )
          ) : (
            rail ? (
              <button type="button" className="sb-icon-btn" onClick={() => handleNav('/help')} aria-label="Help" title="Help">{ICONS.help}</button>
            ) : (
              <div className="sb-account">
                <button type="button" className="sb-account__join" onClick={() => handleNav('/login?signup=1')}>Create account</button>
                <button type="button" className="sb-icon-btn" onClick={() => handleNav('/help')} aria-label="Help" title="Help">{ICONS.help}</button>
              </div>
            )
          )}
        </div>
      </nav>

      {isOpen && !desktop && (
        <div className="sidebar-overlay" onClick={closeDrawer} aria-hidden="true" />
      )}
      <AuthGateSheet {...gateProps} />
    </>
  );
};

export default Sidebar;
