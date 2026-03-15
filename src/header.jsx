import React from "react";
import "./header.scss";
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleClick = () => navigate('/voteawards');
  const handleEarnings = () => navigate('/earnings');
  const handleHome = () => navigate('/');
  const handleMilestones = () => navigate('/milestones');
  const handleArtist = () => navigate('/artist');
  const handleSong = () => navigate('/song');
  const handleProfile = () => navigate('/profile');
  const handleLogout = async () => { logout(); };

  return (
    <header className="topbar">
      {/* ─── Search ─── */}
      <div className="search-container">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input className="search-input" type="text" placeholder="Search artists, songs, neighborhoods..." />
      </div>

      {/* ─── User area ─── */}
      <div className="user-area">
        {user && <span className="user-name">{user.username}</span>}
        <div className="user-avatar" onClick={handleLogout} title="Logout">
          {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
        </div>
      </div>
    </header>
  );
};

export default Header;