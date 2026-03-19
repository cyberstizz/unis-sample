import React, { useState, useRef, useEffect } from "react";
import "./header.scss";
import unisLogo from './assets/unisLogoThree.svg';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
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

  const currentPath = location.pathname;

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
          <svg className="nav-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M4 3.5H8.5C9.9 3.5 11 4.4 11 5.5C11 6.6 9.9 7.5 8.5 7.5H4M4 7.5H9C10.4 7.5 11.5 8.4 11.5 9.5C11.5 10.6 10.4 11.5 9 11.5H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
          <img src={unisLogo} alt="UNIS" className="logo-img" />
        </div>

        {/* Center: Search */}
        <div className="header-center">
          <div className={`header-search ${searchFocused ? "focused" : ""}`}>
            <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
              <line x1="11.2" y1="11.2" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search artists, songs..."
              className="search-input"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
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
              <span className="avatar-initial">{getInitial()}</span>
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