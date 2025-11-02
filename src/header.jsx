import React from "react";
import "./header.scss"; 
import unisLogo from './assets/unisNoBackground.svg';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from './components/axiosInstance'; 

const Header = () => {
  const navigate = useNavigate();

  // Navigation handlers
  const handleClick = () => navigate('/voteawards');
  const handleEarnings = () => navigate('/earnings');
  const handleHome = () => navigate('/');
  const handleMilestones = () => navigate('/milestones');
  const handleArtist = () => navigate('/artist');
  const handleSong = () => navigate('/song');
  const handleProfile = () => navigate('/profile');
  const handleLogout = async () => {
    await logoutUser();
  };

  return (
    <header className="header">
      <div className="header-top">
        {/* Left: Logo */}
        <img onClick={handleHome} src={unisLogo} alt="UNIS Logo" className="logo" />
        
        {/* Center: Search bar */}
        <input type="text" placeholder="Search artists, songs..." className="search-bar" />

        {/* Right: Logout */}
        <div onClick={handleLogout} className="logout-button">Logout</div>
      </div>

      {/* Static options bar underneath */}
      <div className="options-bar">
        <div onClick={handleClick} className="option-box">Vote</div>
        <div onClick={handleMilestones} className="option-box">Awards</div>
        <div onClick={handleArtist} className="option-box">Popular</div>
        <div onClick={handleEarnings} className="option-box">Earnings</div>
      </div>
    </header>
  );
};

export default Header;
