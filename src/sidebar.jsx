import React, { useState, useContext } from 'react';
import './sidebar.scss';
import { useNavigate } from 'react-router-dom';
import { Vote, Search, Trophy, Settings, DollarSign, House, Music } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';

const Sidebar = ({ onProfileClick }) => { 
  const [isOpen, setIsOpen] = useState(false); 
  const { user } = useAuth();
  const { openPlaylistManager } = useContext(PlayerContext);
  const navigate = useNavigate();

  const toggleOpen = () => setIsOpen(!isOpen);
  
  // Close sidebar after navigation (mobile only)
  const closeSidebar = () => {
    if (window.innerWidth <= 1024) {
      setIsOpen(false);
    }
  };

  const handleHome = () => {
    navigate('/');
    closeSidebar();
  };
  
  const handleClick = () => {
    navigate('/voteawards');
    closeSidebar();
  };
  
  const handleEarnings = () => {
    navigate('/earnings');
    closeSidebar();
  };
  
  const handleMilestones = () => {
    navigate('/milestones');
    closeSidebar();
  };
  
  const handleMap = () => {
    navigate('/find');
    closeSidebar();
  };
  
  const handleLeaderboards = () => {
    navigate('/leaderboards');
    closeSidebar();
  };
  
  const handleFindPage = () => {
    navigate('/findpage');
    closeSidebar();
  };
  
  const handleArtist = () => {
    navigate('/artist');
    closeSidebar();
  };
  
  const handleSong = () => {
    navigate('/song');
    closeSidebar();
  };
  
  const handlePlaylists = () => {
    openPlaylistManager();
    closeSidebar();
  }; 

  const handleProfile = () => {
    if (user?.role === 'artist') {
      navigate('/artistDashboard');
    } else {
      navigate('/profile');
    }
    closeSidebar();
  };

  return (
    <>
      {/* Mobile Trigger - hide when sidebar is open */}
      <div 
        className={`sidebar-trigger ${isOpen ? 'hidden' : ''}`} 
        onClick={toggleOpen}
      >
        <span className="arrow-icon">&#9654;</span>
      </div>

      {/* Sidebar Content */}
      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <ul>
          <li onClick={handleHome}>
            <span className="sidebar-icon home-sidebar"><House size={24} /></span>
            <span className="sidebar-text home-sidebar">Home</span>
          </li>
          <li onClick={handleClick}>
            <span className="sidebar-icon"><Vote size={24} /></span>
            <span className="sidebar-text">Vote</span>
          </li>
          <li onClick={handleFindPage}>
            <span className="sidebar-icon"><Search size={24} /></span>
            <span className="sidebar-text">Find</span>
          </li>
          <li onClick={handleLeaderboards}>
            <span className="sidebar-icon"><Trophy size={24} /></span>
            <span className="sidebar-text">Leaderboards</span>
          </li>
          <li onClick={handleProfile}>
            <span className="sidebar-icon"><Settings size={24} /></span>
            <span className="sidebar-text">Settings</span>
          </li>
          <li onClick={handleEarnings}>
            <span className="sidebar-icon"><DollarSign size={24} /></span>
            <span className="sidebar-text">Earnings</span>
          </li>
          <li onClick={handlePlaylists}>
            <span className="sidebar-icon"><Music size={24} /></span>
            <span className="sidebar-text">Playlists</span>
          </li>
        </ul>
      </nav>

      {/* Mobile Overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={toggleOpen} />
      )}
    </>
  );
};

export default Sidebar;