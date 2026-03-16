import React, { useState, useContext, useRef, useeffect } from 'react';
import './sidebar.scss';
import { useNavigate } from 'react-router-dom';
import { Vote, Search, Trophy, Settings, DollarSign, House, Music, Shield } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { openPlaylistManager } = useContext(PlayerContext);
  const navigate = useNavigate();

  const toggleOpen = () => setIsOpen(!isOpen);

  const sidebarRef = useRef(null);

  useEffect(() => {
    const updateSidebarWidth = () => {
      const width = sidebarRef.current ? sidebarRef.current.offsetWidth : 0;

      document.documentElement.style.setProperty(
        "--sidebar-width",
        `${width}px`
      );
    };

    updateSidebarWidth();

    window.addEventListener("resize", updateSidebarWidth);

    return () => {
      window.removeEventListener("resize", updateSidebarWidth);
    };
  }, []);

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

  return (
    <>
      <div
        className={`sidebar-trigger ${isOpen ? 'hidden' : ''}`}
        onClick={toggleOpen}
      >
        <span className="arrow-icon">&#9654;</span>
      </div>

      <nav className={`sidebar ${isOpen ? 'open' : ''}`} ref={sidebarRef}>
        <ul>
          <li onClick={() => handleNav('/')}>
            <span className="sidebar-icon home-sidebar"><House size={24} /></span>
            <span className="sidebar-text home-sidebar">Home</span>
          </li>
          <li onClick={() => handleNav('/voteawards')}>
            <span className="sidebar-icon"><Vote size={24} /></span>
            <span className="sidebar-text">Vote</span>
          </li>
          <li onClick={() => handleNav('/findpage')}>
            <span className="sidebar-icon"><Search size={24} /></span>
            <span className="sidebar-text">Find</span>
          </li>
          <li onClick={() => handleNav('/leaderboards')}>
            <span className="sidebar-icon"><Trophy size={24} /></span>
            <span className="sidebar-text">Leaderboards</span>
          </li>
          <li onClick={handleProfile}>
            <span className="sidebar-icon"><Settings size={24} /></span>
            <span className="sidebar-text">Settings</span>
          </li>
          <li onClick={() => handleNav('/earnings')}>
            <span className="sidebar-icon"><DollarSign size={24} /></span>
            <span className="sidebar-text">Earnings</span>
          </li>
          <li onClick={handlePlaylists}>
            <span className="sidebar-icon"><Music size={24} /></span>
            <span className="sidebar-text">Playlists</span>
          </li>

          {/* Admin section — only visible to admin role holders */}
          {user && user.adminRole && (
            <>
              <li className="sidebar-divider"></li>
              <li onClick={() => handleNav('/admin')}>
                <span className="sidebar-icon"><Shield size={24} /></span>
                <span className="sidebar-text">Admin</span>
              </li>
            </>
          )}
        </ul>
      </nav>

      {isOpen && (
        <div className="sidebar-overlay" onClick={toggleOpen} />
      )}
    </>
  );
};

export default Sidebar;