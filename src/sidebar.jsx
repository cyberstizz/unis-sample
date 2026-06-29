import React, { useState, useContext, useRef, useEffect } from 'react';
import './sidebar.scss';
import { useNavigate, useLocation } from 'react-router-dom';        // ★ useLocation drives the real active state
import { useAuth } from './context/AuthContext';                    // ★ theme comes from here too
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import { buildUrl } from './utils/buildUrl';                        // ★ avatar photo
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';

// ★ Themed logo set — identical map to header.jsx so the drawer brand
//   tracks the active theme exactly like the global header does.
import logoblue   from './assets/unisLogoThree.svg';
import logoorange from './assets/logo-orange.png';
import logored    from './assets/logo-red.png';
import logogreen  from './assets/logo-green.png';
import logopurple from './assets/logo-purple.png';
import logoyellow from './assets/logo-gold.png';
import logodianna from './assets/logo-dianna.png';

const LOGO_MAP = {                                                  // ★
  blue: logoblue,
  orange: logoorange,
  red: logored,
  green: logogreen,
  purple: logopurple,
  yellow: logoyellow,
  dianna: logodianna,
};

// ★ Custom inline-SVG icon set (outline by default, duotone when active).
//   Inline SVGs are required here — Lucide does not render reliably inside
//   buttons in the web app, and the outline→duotone active swap needs a
//   fillable primary shape (class `fs`) plus accent-fill detail (`fs2`).
//   Stroke / fill are driven entirely by sidebar.scss.
const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M4 10.5 12 4l8 6.5V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19z" />
      <path d="M9.5 20.4v-5h5v5" />
    </svg>
  ),
  find: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle className="fs" cx="11" cy="11" r="6.4" />
      <path d="M16 16l4 4" />
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
  leaderboards: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M7 4.5h10V8a5 5 0 0 1-10 0z" />
      <path d="M7 5.6H4.8A2 2 0 0 0 7 8.4M17 5.6h2.2A2 2 0 0 1 17 8.4M12 13v3.4M9 20h6M9.4 20a2.6 2.6 0 0 1 5.2 0" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M5 5.6h14a1.5 1.5 0 0 1 1.5 1.5v7.8A1.5 1.5 0 0 1 19 16.4h-9l-4 3.2v-3.2H5A1.5 1.5 0 0 1 3.5 14.9V7.1A1.5 1.5 0 0 1 5 5.6z" />
    </svg>
  ),
  playlists: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M4 12h7M4 17h7" />
      <circle className="fs2" cx="17" cy="16" r="2.5" />
      <path d="M19.5 16V8.6l-3 .9" />
    </svg>
  ),
  earnings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle className="fs" cx="12" cy="12" r="8.4" />
      <path d="M12 7v10M14.6 9.3c0-1.2-1.2-1.9-2.6-1.9s-2.6.8-2.6 2 .9 1.7 2.6 2 2.6.9 2.6 2.1-1.2 2-2.6 2-2.6-.8-2.6-2" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M12 2.9c.5 0 1 .06 1.45.18l.5 1.86c.57.22 1.1.53 1.58.92l1.86-.55c.6.58 1.1 1.28 1.5 2.04l-1.36 1.38c.1.5.16 1.03.16 1.57s-.06 1.07-.16 1.57l1.36 1.38c-.4.76-.9 1.46-1.5 2.04l-1.86-.55c-.48.39-1 .7-1.58.92l-.5 1.86c-.46.12-.95.18-1.45.18s-1-.06-1.45-.18l-.5-1.86a7.2 7.2 0 0 1-1.58-.92l-1.86.55a7.9 7.9 0 0 1-1.5-2.04l1.36-1.38A7.5 7.5 0 0 1 5.3 12c0-.54.06-1.07.16-1.57L4.1 9.05c.4-.76.9-1.46 1.5-2.04l1.86.55c.48-.39 1-.7 1.58-.92l.5-1.86C9.99 2.96 10.5 2.9 12 2.9z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fs" d="M12 3.4l6.6 2.4v5.2c0 4.1-2.8 6.8-6.6 8.1-3.8-1.3-6.6-4-6.6-8.1V5.8z" />
      <path d="M9.2 12l2 2 3.6-4" />
    </svg>
  ),
};

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isGuest, theme } = useAuth();                      // ★ theme
  const { triggerGate, gateProps } = useAuthGate();
  const { openPlaylistManager } = useContext(PlayerContext);
  const navigate = useNavigate();
  const location = useLocation();                                  // ★

  const toggleOpen = () => setIsOpen((o) => !o);
  const sidebarRef = useRef(null);

  // ── Unread messages badge ──────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || isGuest) { setUnreadCount(0); return undefined; }
    let alive = true;
    const load = async () => {
      try {
        const res = await apiCall({ url: '/v1/conversations', useCache: false });
        if (!alive) return;
        const total = (res.data || []).reduce((n, c) => n + (c.unreadCount || 0), 0);
        setUnreadCount(total);
      } catch (_) { /* ignore */ }
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('unis:messages-updated', onUpdate);
    window.addEventListener('focus', onUpdate);
    return () => {
      alive = false;
      window.removeEventListener('unis:messages-updated', onUpdate);
      window.removeEventListener('focus', onUpdate);
    };
  }, [user, isGuest]);

  // ★ Lifetime earnings for the account footer (referral + supporter, or an
  //   explicit lifetime total if the summary provides one). Guarded so it
  //   never throws; simply hides the figure if the call fails.
  const [lifetime, setLifetime] = useState(null);
  useEffect(() => {
    if (!user || isGuest) { setLifetime(null); return undefined; }
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
      } catch (_) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [user, isGuest]);

  // ── Desktop sidebar width broadcast (unchanged behaviour) ───
  useEffect(() => {
    const updateSidebarWidth = () => {
      const isMobile = window.innerWidth <= 1024;
      const width = isMobile ? 0 : (sidebarRef.current ? sidebarRef.current.offsetWidth : 0);
      document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    };
    updateSidebarWidth();
    window.addEventListener('resize', updateSidebarWidth);
    return () => window.removeEventListener('resize', updateSidebarWidth);
  }, []);

  // ── Header hamburger toggle (unchanged) ─────────────────────
  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    window.addEventListener('unis:toggle-sidebar', handleToggle);
    return () => window.removeEventListener('unis:toggle-sidebar', handleToggle);
  }, []);

  const closeSidebar = () => {
    if (window.innerWidth <= 1024) setIsOpen(false);
  };

  const handleNav = (path) => {
    navigate(path);
    closeSidebar();
  };

  const handlePlaylists = () => {
    openPlaylistManager();
    closeSidebar();
  };

  const handleProfile = () => {
    if (user?.role === 'artist') handleNav('/artistDashboard');
    else handleNav('/profile');
  };

  // ── Gated handlers (behaviour preserved exactly) ────────────
  const onMessages = () => { if (isGuest) { triggerGate('profile'); return; } handleNav('/messages'); };
  const onEarnings = () => { if (isGuest) { triggerGate('earnings'); return; } handleNav('/earnings'); };
  const onSettings = () => { if (isGuest) { triggerGate('profile'); return; } handleProfile(); };

  const path = location?.pathname || '/';

  // ★ Sectioned information architecture (Browse / Community / Your space).
  const sections = [
    {
      label: 'Browse',
      items: [
        { key: 'home',     label: 'Home',     icon: 'home',     onClick: () => handleNav('/'),            match: (p) => p === '/' },
        { key: 'find',     label: 'Find',     icon: 'find',     onClick: () => handleNav('/findpage'),    match: (p) => p.startsWith('/findpage') },
        { key: 'discover', label: 'Discover', icon: 'discover', onClick: () => handleNav('/discover'),    match: (p) => p.startsWith('/discover') },
      ],
    },
    {
      label: 'Community',
      items: [
        { key: 'vote',         label: 'Vote',         icon: 'vote',         onClick: () => handleNav('/voteawards'),   match: (p) => p.startsWith('/voteawards') },
        { key: 'leaderboards', label: 'Leaderboards', icon: 'leaderboards', onClick: () => handleNav('/leaderboards'), match: (p) => p.startsWith('/leaderboards') },
        { key: 'messages',     label: 'Messages',     icon: 'messages',     onClick: onMessages, badge: unreadCount,  match: (p) => p.startsWith('/messages') },
      ],
    },
    {
      label: 'Your space',
      items: [
        { key: 'playlists', label: 'Playlists', icon: 'playlists', onClick: handlePlaylists, match: () => false },
        { key: 'earnings',  label: 'Earnings',  icon: 'earnings',  onClick: onEarnings,      match: (p) => p.startsWith('/earnings') },
        { key: 'settings',  label: 'Settings',  icon: 'settings',  onClick: onSettings,      match: (p) => p === '/profile' || p === '/artistDashboard' },
        ...(user && user.adminRole
          ? [{ key: 'admin', label: 'Admin', icon: 'admin', onClick: () => handleNav('/admin'), match: (p) => p.startsWith('/admin') }]
          : []),
      ],
    },
  ];

  const activeLogo = LOGO_MAP[theme] || logoblue;                  // ★
  const jName = user?.jurisdiction?.name || null;                 // ★
  const jId = user?.jurisdiction?.jurisdictionId || null;         // ★
  const goJurisdiction = () => handleNav(jId ? `/jurisdiction/${jId}` : '/discover'); // ★

  const formatMoney = (amount) => {                               // ★
    const n = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!Number.isFinite(n)) return '$0';
    if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
    return `$${n.toFixed(2)}`;
  };

  const avatarUrl = buildUrl(user?.photoUrl);                     // ★
  const initial = (user?.username || 'U').charAt(0).toUpperCase();

  return (
    <>
      {/* ★ Pill trigger (mobile/tablet) — hides itself while the drawer is open */}
      <button
        type="button"
        className={`sidebar-trigger ${isOpen ? 'hidden' : ''}`}
        onClick={toggleOpen}
        aria-label="Open navigation"
      >
        <span className="pill-handle" />
      </button>

      <nav className={`sidebar ${isOpen ? 'open' : ''}`} ref={sidebarRef}>
        {/* ★ Brand + jurisdiction identity */}
        <div className="sidebar-head">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => handleNav('/')}
            aria-label="Unis home"
          >
            <img className="sidebar-logo-img" src={activeLogo} alt="UNIS" draggable="false" />
          </button>

          {jName && (
            <button type="button" className="sidebar-juris" onClick={goJurisdiction}>
              <span className="sidebar-juris__dot" />
              <span className="sidebar-juris__text">
                <span className="sidebar-juris__name">{jName}</span>
                {/* <span className="sidebar-juris__sub">Your jurisdiction</span> */}
              </span>
            </button>
          )}
        </div>

        <ul>
          {sections.map((sec) => (
            <React.Fragment key={sec.label}>
              <li className="sidebar-section" aria-hidden="true">{sec.label}</li>
              {sec.items.map((it) => (
                <li
                  key={it.key}
                  className={`sidebar-link ${it.match(path) ? 'active' : ''}`}
                  onClick={it.onClick}
                >
                  <span className="sidebar-icon">
                    {ICONS[it.icon]}
                    {it.badge > 0 && (
                      <span className="sidebar-badge">{it.badge > 9 ? '9+' : it.badge}</span>
                    )}
                  </span>
                  <span className="sidebar-text">{it.label}</span>
                </li>
              ))}
            </React.Fragment>
          ))}
        </ul>

        {/* ★ Account footer — lifetime earnings for members, sign-in for guests */}
        <div className="sidebar-foot">
          {user && !isGuest ? (
            <button type="button" className="sidebar-account" onClick={handleProfile}>
              <span className="sidebar-account__av">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initial}</span>}
              </span>
              <span className="sidebar-account__id">
                <span className="sidebar-account__name">{user?.username || 'You'}</span>
                <span className="sidebar-account__handle">@{user?.username || 'you'}</span>
              </span>
              {lifetime != null && (
                <span className="sidebar-account__earn">
                  <span className="e1">Lifetime</span>
                  <span className="e2">{formatMoney(lifetime)}</span>
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="sidebar-account sidebar-account--guest"
              onClick={() => handleNav('/login')}
            >
              <span className="sidebar-account__av"><span>↗</span></span>
              <span className="sidebar-account__id">
                <span className="sidebar-account__name">Sign in</span>
                <span className="sidebar-account__handle">Track your earnings</span>
              </span>
            </button>
          )}
        </div>
      </nav>

      {isOpen && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
      )}
      <AuthGateSheet {...gateProps} />
    </>
  );
};

export default Sidebar;