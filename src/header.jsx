import React, { useState, useRef, useEffect, useContext } from "react";
import "./header.scss";
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
import { buildUrl } from './utils/buildUrl';
import { attachMediaElement, subscribeBass, ensureRunning, isPulseEnabled } from './utils/bassReactor';
import { DollarSign, House, Music, MapPin, Search, Menu, LogIn } from 'lucide-react';
import logoblue from './assets/unisLogoThree.svg';
import logoorange from './assets/logo-orange.png';
import logored from './assets/logo-red.png';
import logogreen from './assets/logo-green.png';
import logopurple from './assets/logo-purple.png';
import logoyellow from './assets/logo-gold.png';
import logodianna from './assets/logo-dianna.png';


const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isGuest, theme } = useAuth();
  const { audioRef, isPlaying } = useContext(PlayerContext) || {};
  const { triggerGate, gateProps } = useAuthGate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [shouldBreathe, setShouldBreathe] = useState(false);
  const menuRef = useRef(null);
  const logoImgRef = useRef(null);

  // Breath animation: only on first page load of session
  useEffect(() => {
    try {
      const hasPlayed = sessionStorage.getItem('unis-logo-breathed');
      if (!hasPlayed) {
        setShouldBreathe(true);
        sessionStorage.setItem('unis-logo-breathed', 'true');
      }
    } catch (e) {
      // sessionStorage may be unavailable (private mode, etc.) — skip silently
    }
  }, []);

  // ─── BASS-REACTIVE LOGO ────────────────────────────────────────
  // While a track is playing, the shared media element is routed through
  // bassReactor's analyser and the logo pulses with the ~20–160 Hz band
  // (kick/bass). We mutate the <img> style directly inside the rAF
  // callback — no React state, no re-renders, 60fps for free.
  //
  // Requirements handled elsewhere:
  //  • player.jsx renders <audio>/<video> with crossOrigin="anonymous"
  //  • the R2 bucket must have a CORS policy allowing this origin,
  //    otherwise attachMediaElement refuses / audio would go silent
  //  • prefers-reduced-motion disables the effect entirely
  //  • isPulseEnabled() is a localStorage kill switch ('unis-logo-pulse')
  useEffect(() => {
    const img = logoImgRef.current;
    if (!img) return;

    const reduced = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const clear = () => {
      img.style.transform = '';
      img.style.filter = '';
    };

    if (reduced || !isPulseEnabled() || !isPlaying || !audioRef?.current) {
      clear();
      return;
    }

    const attached = attachMediaElement(audioRef.current);
    if (!attached) {
      clear();
      return;
    }

    const unsubscribe = subscribeBass((level) => {
      // Subtle by design: max +13% scale on the hardest hits.
      img.style.transform = `scale(${(1 + level * 0.13).toFixed(4)})`;
      img.style.filter = level > 0.03
        ? `drop-shadow(0 0 ${(level * 15).toFixed(1)}px var(--unis-primary-glow))`
        : '';
    });
    ensureRunning();

    return () => {
      unsubscribe();
      clear();
    };
  }, [isPlaying, audioRef]);

  const handleHome = () => {
    if (location.pathname !== '/') {
      navigate('/');
    }
  };
  const handleMilestones = () => navigate('/milestones');
  const handleFind = () => navigate('/findpage');

  // Gated nav handlers — these require auth
  const handleClick = () => {
    if (isGuest) { triggerGate('vote'); return; }
    navigate('/voteawards');
  };

  const handleEarnings = () => {
    if (isGuest) { triggerGate('earnings'); return; }
    navigate('/earnings');
  };

  const handleLogout = async () => { logout(); };

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const currentPath = location.pathname;

  const LOGO_MAP = {
    blue: logoblue,
    orange: logoorange,
    red: logored,
    green: logogreen,
    purple: logopurple,
    yellow: logoyellow,
    dianna: logodianna,
  };

  // When the user is a guest, force the brand logo back to the default blue
  // mark so the header never shows the last logged-in user's themed logo.
  const activeLogo = isGuest ? logoblue : (LOGO_MAP[theme] || logoblue);


  const FAVICON_MAP = {
    blue: "../public/favicons/logo-blue.ico",
    orange: "../public/favicons/logo-orange.ico",
    red: "../public/favicons/logo-red.ico",
    green: "../public/favicons/logo-green.ico",
    purple: "../public/favicons/logo-purple.ico",
    yellow: "../public/favicons/logo-gold.ico",
    dianna: "../public/favicons/logo-dianna.ico",
  };

  const THEME_COLOR_FALLBACKS = {
    blue: "#1d42a8",
    orange: "#f97316",
    red: "#ef4444",
    green: "#22c55e",
    purple: "#8b5cf6",
    yellow: "#d4a017",
    dianna: "#d4a017",
  };


  useEffect(() => {
    // Guests always resolve to the blue theme so favicon + browser chrome
    // never carry over a previous user's color.
    const fallbackTheme = "blue";
    const safeTheme = isGuest ? fallbackTheme : (theme || fallbackTheme);

    // 1. Update favicon
    const faviconHref = FAVICON_MAP[safeTheme] || FAVICON_MAP[fallbackTheme];

    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }

    favicon.type = "image/x-icon";

    // The query string helps force browsers to refresh the icon instead of using cache.
    favicon.href = `${faviconHref}?theme=${safeTheme}`;

    // 2. Update browser top theme color
    const rootStyles = getComputedStyle(document.documentElement);

    // For guests, prefer the hardcoded blue fallback over the (possibly stale)
    // --unis-primary custom property.
    const cssThemeColor = isGuest
      ? THEME_COLOR_FALLBACKS[fallbackTheme]
      : (rootStyles.getPropertyValue("--unis-primary").trim() ||
         THEME_COLOR_FALLBACKS[safeTheme] ||
         THEME_COLOR_FALLBACKS[fallbackTheme]);

    let themeColorMeta = document.querySelector("meta[name='theme-color']");
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.setAttribute("content", cssThemeColor);

    // Optional: useful for pinned tiles / some browser integrations
    let tileColorMeta = document.querySelector("meta[name='msapplication-TileColor']");
    if (!tileColorMeta) {
      tileColorMeta = document.createElement("meta");
      tileColorMeta.name = "msapplication-TileColor";
      document.head.appendChild(tileColorMeta);
    }

    tileColorMeta.setAttribute("content", cssThemeColor);
  }, [theme, isGuest]);

  const navItems = [
    { label: "Vote", path: "/voteawards", handler: handleClick, icon: "vote" },
    { label: "Awards", path: "/milestones", handler: handleMilestones, icon: "awards" },
    { label: "Find", path: "/findpage", handler: handleFind, icon: "find" },
    { label: "Earnings", path: "/earnings", handler: handleEarnings, icon: "earnings" },
  ];

  const getInitial = () => {
    if (user?.username) return user.username.charAt(0).toUpperCase();
    return "U";
  };

  const renderIcon = (type) => {
    switch (type) {
      case "vote":
        return (
          <svg className="nav-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.2L8.6 4.9L12.6 5.3L9.5 8L10.4 12L7 10L3.6 12L4.5 8L1.4 5.3L5.4 4.9L7 1.2Z" fill="currentColor" />
          </svg>
        );
      case "awards":
        return (
          <svg className="nav-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 10L4 13.5L7 12L10 13.5L9 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "find":
        return <MapPin height={15} />;
      case "earnings":
        return <DollarSign height={15} />;
      default:
        return null;
    }
  };

  return (
    <header className={`app-header ${isGuest ? 'app-header--guest' : ''}`}>
      <div className="header-inner">
        {/* Left: Hamburger + Logo */}
        <div className="header-left">
          <button
            type="button"
            className="header-hamburger"
            onClick={() => window.dispatchEvent(new CustomEvent('unis:toggle-sidebar'))}
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="header-logo"
            onClick={handleHome}
            aria-label="Go to Unis home"
          >
            <img
              ref={logoImgRef}
              src={activeLogo}
              alt="UNIS"
              className={`logo-img ${shouldBreathe ? 'logo-breathe' : ''}`}
              draggable="false"
            />
          </button>
        </div>

        {/* Center: Search */}
        <div className="header-center">
          <SearchBar />
        </div>

        {/* Right: Nav items + User/Guest buttons */}
        <div className="header-right">
          {/* Mobile-only search trigger */}
          <button
            className="mobile-search-trigger"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          {/* Fullscreen mobile search overlay */}
          {mobileSearchOpen && (
            <div className="mobile-search-overlay" onClick={(e) => {
              if (e.target === e.currentTarget) setMobileSearchOpen(false);
            }}>
              <div className="mobile-search-container">
                <SearchBar
                  autoFocusOnMount
                  openOnMount
                  onMobileSelect={() => setMobileSearchOpen(false)}
                />
                <button
                  className="mobile-search-close"
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label="Close search"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <nav className="header-nav">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`nav-item ${currentPath === item.path ? "active" : ""}`}
                onClick={item.handler}
              >
                {renderIcon(item.icon)}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="header-divider" />

          {/* Authenticated: User avatar + dropdown */}
          {user && (
            <div className="header-user" ref={menuRef}>
              <button
                className="user-avatar"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="User menu"
              >
                {buildUrl(user?.photoUrl) ? (
                  <img
                    src={buildUrl(user.photoUrl)}
                    alt="User avatar"
                    className="avatar-image"
                  />
                ) : (
                  <span className="avatar-initial">{getInitial()}</span>
                )}
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-user-info">
                    <span className="dropdown-username">{user.username}</span>
                  </div>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      navigate(user?.role === 'artist' ? '/artistDashboard' : '/profile');
                      setUserMenuOpen(false);
                    }}
                  >
                    {user?.role === 'artist' ? 'Dashboard' : 'Profile'}
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item logout" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}

  {/* Guest: Single Sign In button */}
          {isGuest && (
            <button
              className="header-signin-btn"
              onClick={() => navigate('/login')}
              aria-label="Sign in to Unis"
            >
              <LogIn size={14} strokeWidth={2} />
              <span className="header-signin-btn__label">Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Auth gate bottom sheet */}
      <AuthGateSheet {...gateProps} />
    </header>
  );
};

export default Header;