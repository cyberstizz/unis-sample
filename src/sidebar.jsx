import React, { useState, useContext, useRef, useEffect } from 'react';
import './sidebar.scss';
import { useNavigate } from 'react-router-dom';
import { Vote, Search, Trophy, Settings, DollarSign, House, Music, Shield, Compass, MessageCircle } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isGuest } = useAuth();
  const { triggerGate, gateProps } = useAuthGate();
  const { openPlaylistManager } = useContext(PlayerContext);
  const navigate = useNavigate();

  const toggleOpen = () => setIsOpen(!isOpen);

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

  useEffect(() => {
      const updateSidebarWidth = () => {
        const isMobile = window.innerWidth <= 1024;
        const width = isMobile ? 0 : (sidebarRef.current ? sidebarRef.current.offsetWidth : 0);

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

    // Listen for hamburger toggle from header
   useEffect(() => {
      const handleToggle = () => setIsOpen((prev) => !prev);
      window.addEventListener('unis:toggle-sidebar', handleToggle);
      return () => window.removeEventListener('unis:toggle-sidebar', handleToggle);
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
          <li onClick={() => handleNav('/discover')}>
            <span className="sidebar-icon"><Compass size={24} /></span>
            <span className="sidebar-text">Discover</span>
          </li>
          <li onClick={() => handleNav('/leaderboards')}>
            <span className="sidebar-icon"><Trophy size={24} /></span>
            <span className="sidebar-text">Leaderboards</span>
          </li>
          <li onClick={() => {
              if (isGuest) { triggerGate('profile'); return; }
              handleNav('/messages');
          }}>
            <span className="sidebar-icon">
              <MessageCircle size={24} />
              {unreadCount > 0 && (
                <span className="sidebar-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </span>
            <span className="sidebar-text">Messages</span>
          </li>
          <li onClick={ () => {
              if (isGuest) { triggerGate('profile'); return; }
              handleProfile()
          }}>
            <span className="sidebar-icon"><Settings size={24} /></span>
            <span className="sidebar-text">Settings</span>
          </li>
          <li onClick={() => {
              if (isGuest) { triggerGate('earnings'); return; }
               handleNav('/earnings')
          }}>
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
      <AuthGateSheet {...gateProps} />
    </>
  );
};

export default Sidebar;