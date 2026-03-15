import React, { useState, useContext } from 'react';
import './sidebar.scss';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, Vote, Search, Trophy, Settings, DollarSign, Music, Shield } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';
import unisLogo from './assets/unisLogoThree.svg';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { openPlaylistManager } = useContext(PlayerContext);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleOpen = () => setIsOpen(!isOpen);

  const closeSidebar = () => {
    if (window.innerWidth <= 1024) {
      setIsOpen(false);
    }
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
    if (user?.role === 'artist') {
      handleNav('/artistDashboard');
    } else {
      handleNav('/profile');
    }
  };

  // Determine active route
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile trigger */}
      <div
        className={`sidebar-trigger ${isOpen ? 'hidden' : ''}`}
        onClick={toggleOpen}
      >
        <span className="arrow-icon">&#9654;</span>
      </div>

      {/* ═══════════ SIDEBAR — Exact prototype structure ═══════════ */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo — doubled from prototype's 38px to 76px */}
        <div className="sidebar-logo">
          <img
            src={unisLogo}
            alt="UNIS"
            onClick={() => handleNav('/')}
            style={{ cursor: 'pointer' }}
          />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <a className={`nav-item ${isActive('/') ? 'active' : ''}`} onClick={() => handleNav('/')}>
            <House size={20} />
            <span className="nav-label">Home</span>
          </a>
          <a className={`nav-item ${isActive('/voteawards') ? 'active' : ''}`} onClick={() => handleNav('/voteawards')}>
            <Vote size={20} />
            <span className="nav-label">Vote</span>
          </a>
          <a className={`nav-item ${isActive('/findpage') ? 'active' : ''}`} onClick={() => handleNav('/findpage')}>
            <Search size={20} />
            <span className="nav-label">Find</span>
          </a>
          <a className={`nav-item ${isActive('/leaderboards') ? 'active' : ''}`} onClick={() => handleNav('/leaderboards')}>
            <Trophy size={20} />
            <span className="nav-label">Leaderboards</span>
          </a>

          <div className="nav-divider"></div>

          <a className={`nav-item ${isActive('/profile') || isActive('/artistDashboard') ? 'active' : ''}`} onClick={handleProfile}>
            <Settings size={20} />
            <span className="nav-label">Settings</span>
          </a>
          <a className={`nav-item ${isActive('/earnings') ? 'active' : ''}`} onClick={() => handleNav('/earnings')}>
            <DollarSign size={20} />
            <span className="nav-label">Earnings</span>
          </a>
          <a className="nav-item" onClick={handlePlaylists}>
            <Music size={20} />
            <span className="nav-label">Playlists</span>
          </a>

          {/* Admin — conditional */}
          {user && user.adminRole && (
            <>
              <div className="nav-divider"></div>
              <a className={`nav-item ${isActive('/admin') ? 'active' : ''}`} onClick={() => handleNav('/admin')}>
                <Shield size={20} />
                <span className="nav-label">Admin</span>
              </a>
            </>
          )}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={toggleOpen} />
      )}
    </>
  );
};

export default Sidebar;