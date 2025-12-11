import React, { useState } from 'react';
import './sidebar.scss';
import { useNavigate } from 'react-router-dom';
import { Vote, Search, Trophy, Settings, DollarSign, House, Music } from 'lucide-react';

const Sidebar = ({ onProfileClick }) => { 
  const [isOpen, setIsOpen] = useState(false); 

  const toggleOpen = () => setIsOpen(!isOpen);

  const navigate = useNavigate();

  const handleHome = () => navigate('/');

  const handleClick = () => navigate('/voteawards'); 

  const handleEarnings = () => navigate('/earnings'); 

  const handleMilestones = () => navigate('/milestones'); 

  const handleMap = () => navigate('/find');

  const handleLeaderboards = () => navigate('/leaderboards'); 

  const handleFindPage = () => navigate('/findpage');

  const handleArtist = () => navigate('/artist'); 

  const handleSong = () => navigate('/song'); 

  const handleProfile = () => navigate('/profile'); 

  return (
    <>
      {/* Mobile Trigger */}
      <div className="sidebar-trigger" onClick={toggleOpen}>
        <span className="arrow-icon">&#9654;</span>
      </div>

      {/* Sidebar Content */}
      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <ul>
          <li onClick={handleHome}>
            <span className="sidebar-icon"><House size={24} /></span>
            <span className="sidebar-text">Home</span>
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
          <li onClick={handleClick}>
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