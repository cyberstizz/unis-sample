import React, { useState, useRef, useEffect, useContext, useCallback } from "react";
import "./header.scss";
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
import { buildUrl } from './utils/buildUrl';
import { attachMediaElement, subscribeBeat, ensureRunning, isPulseEnabled } from './utils/bassReactor';
import { createLogoMotionState, stepLogoMotion, logoStyle } from './utils/logoMotion';
import {
  GESTURE_CONFIG, playLogoGesture, isGestureRunning, createPlaybackGestureTracker,
} from './utils/logoGestures';
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
  const { audioRef, isPlaying, currentMedia, navDirectionRef } = useContext(PlayerContext) || {};
  const mediaId = currentMedia
    ? (currentMedia.id ?? currentMedia.songId ?? currentMedia.url ?? currentMedia.fileUrl ?? null)
    : null;
  const { triggerGate, gateProps } = useAuthGate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [shouldBreathe, setShouldBreathe] = useState(false);
  const menuRef = useRef(null);
  const logoImgRef = useRef(null);
  const logoBtnRef = useRef(null);

  // ─── LOGO GESTURES (see utils/logoGestures.js) ─────────────────
  const gestureRef = useRef(null);          // the Animation currently playing
  const trackerRef = useRef(null);
  if (!trackerRef.current) trackerRef.current = createPlaybackGestureTracker();
  const prevMediaIdRef = useRef(mediaId);   // restored song on load ≠ a change
  const prevPlayingRef = useRef(isPlaying);
  const pauseTimerRef = useRef(null);
  const hasPlayedRef = useRef(false);       // any playback yet this page session?

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

  const runGesture = useCallback((name, opts = {}) => {
    const anim = playLogoGesture(logoImgRef.current, name, { ...opts, current: gestureRef.current });
    if (anim) gestureRef.current = anim;
  }, []);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  // Song change → sway; resume → hop; pause → squash.
  useEffect(() => {
    const now = performance.now();
    const tracker = trackerRef.current;

    if (mediaId !== prevMediaIdRef.current) {
      const hadPrevious = prevMediaIdRef.current != null;
      prevMediaIdRef.current = mediaId;
      if (mediaId != null) {
        clearPauseTimer(); // a "pause" while switching songs isn't a pause
        const result = tracker.songChanged({
          hadPrevious, navMarker: navDirectionRef?.current, nowMs: now,
        });
        if (navDirectionRef) navDirectionRef.current = null;
        if (result) runGesture('sway', { direction: result.direction });
      }
    }

    if (isPlaying !== prevPlayingRef.current) {
      prevPlayingRef.current = isPlaying;
      if (isPlaying) {
        hasPlayedRef.current = true;
        clearPauseTimer();
        if (tracker.playStarted({ nowMs: now }) === 'hop') runGesture('hop');
      } else if (tracker.playStopped({ ended: !!audioRef?.current?.ended, nowMs: now })) {
        clearPauseTimer();
        pauseTimerRef.current = setTimeout(() => {
          pauseTimerRef.current = null;
          const media = audioRef?.current;
          if (media && !media.paused) return; // it was a blip, not a pause
          tracker.pauseConfirmed();
          runGesture('squash');
        }, GESTURE_CONFIG.pauseConfirmMs);
      }
    }
  }, [mediaId, isPlaying, audioRef, navDirectionRef, runGesture]);

  // Playback failure → shake. Media 'error' events don't bubble, so we listen
  // in the capture phase on document; that also survives the player swapping
  // between its <audio> and <video> elements. Ignored: errors from clearing
  // the player (empty src) and a stale restored song failing to preload
  // before the user has played anything.
  useEffect(() => {
    const onError = (e) => {
      const media = audioRef?.current;
      if (!media || e.target !== media) return;
      if (!media.getAttribute('src')) return;
      if (!hasPlayedRef.current && media.paused) return;
      runGesture('shake');
    };
    document.addEventListener('error', onError, true);
    return () => document.removeEventListener('error', onError, true);
  }, [audioRef, runGesture]);

  // Unmount: stop any pending squash and running gesture.
  useEffect(() => () => {
    clearPauseTimer();
    if (gestureRef.current) {
      try { gestureRef.current.cancel(); } catch { /* already finished */ }
    }
  }, []);

  // Press-in on tap (the look is CSS: .header-logo.is-pressed).
  const pressLogo = () => logoBtnRef.current?.classList.add('is-pressed');
  const releaseLogo = () => logoBtnRef.current?.classList.remove('is-pressed');

  // ─── BEAT-REACTIVE LOGO ────────────────────────────────────────
  // While a track is playing, the shared media element is routed through
  // bassReactor, which detects kick, snare and hi-hat hits. On each hit the
  // logo pops bigger with a glow and eases back to rest (utils/logoMotion.js).
  // Pops are held at rest while muted (volume 0) and while a gesture plays.
  // We mutate the <img> style directly in the rAF callback: no React state,
  // no re-renders.
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

    const m = createLogoMotionState();

    const unsubscribe = subscribeBeat((beat) => {
      const media = audioRef.current;
      if (!media || media.muted || media.volume === 0 || isGestureRunning(gestureRef.current)) {
        m.pulse = 0;
        img.style.transform = '';
        img.style.filter = '';
        return;
      }
      const { transform, filter } = logoStyle(stepLogoMotion(m, beat));
      img.style.transform = transform;
      img.style.filter = filter;
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
            ref={logoBtnRef}
            type="button"
            className="header-logo"
            onClick={handleHome}
            onPointerDown={pressLogo}
            onPointerUp={releaseLogo}
            onPointerLeave={releaseLogo}
            onPointerCancel={releaseLogo}
            aria-label="Go to Unis home"
          >
            <img
              ref={logoImgRef}
              src={activeLogo}
              alt="UNIS"
              className={`logo-img ${shouldBreathe ? 'logo-breathe' : ''}`}
              draggable="false"
              onAnimationEnd={() => setShouldBreathe(false)}
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