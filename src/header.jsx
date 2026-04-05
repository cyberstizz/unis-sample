import React, { useState, useRef, useEffect } from "react";
import "./header.scss";
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';
import { DollarSign, House, Music } from 'lucide-react';
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
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleClick = () => navigate('/voteawards');
  const handleEarnings = () => navigate('/earnings');
  const handleHome = () => navigate('/');
  const handleMilestones = () => navigate('/milestones');
  const handleFind = () => navigate('/findpage');
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


  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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

  // Inside your Sidebar component:
  const { theme } = useAuth();
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
        return (
          <svg className="nav-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="10" x2="13" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );
      case "earnings":
        return (
          <DollarSign height={15} />
          // <svg className="nav-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
          //   <path d="M7 1V13M4 3.5H8.5C9.9 3.5 11 4.4 11 5.5C11 6.6 9.9 7.5 8.5 7.5H4M4 7.5H9C10.4 7.5 11.5 8.4 11.5 9.5C11.5 10.6 10.4 11.5 9 11.5H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          // </svg>
        );
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

        {/* Right: Nav items with icons + User */}
        <div className="header-right">
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

          {/* User Avatar / Menu */}
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
                {user && (
                  <div className="dropdown-user-info">
                    <span className="dropdown-username">{user.username}</span>
                  </div>
                )}
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
        </div>
      </div>
    </header>
  );
};

export default Header;