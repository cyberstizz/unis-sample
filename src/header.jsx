import React, { useState, useRef, useEffect } from "react";
import "./header.scss";
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import { useAuth } from './context/AuthContext';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
import { buildUrl } from './utils/buildUrl';
import { DollarSign, House, Music, MapPin, Search } from 'lucide-react';
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
  const { triggerGate, gateProps } = useAuthGate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const menuRef = useRef(null);

  const handleHome = () => navigate('/');
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

  const activeLogo = LOGO_MAP[theme] || logoblue;

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
    <header className="app-header">
      <div className="header-inner">
        {/* Left: Logo */}
        <div className="header-logo" onClick={handleHome}>
          <img src={activeLogo} alt="UNIS" className="logo-img" />
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
                <SearchBar onMobileSelect={() => setMobileSearchOpen(false)} />
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
                  <button className="dropdown-item" onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}>
                    Profile
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item logout" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Guest: Sign In / Sign Up buttons */}
          {isGuest && (
            <div className="header-guest-actions">
              <button
                className="header-signin-btn"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
              <button
                className="header-signup-btn"
                onClick={() => navigate('/login')}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auth gate bottom sheet */}
      <AuthGateSheet {...gateProps} />
    </header>
  );
};

export default Header;