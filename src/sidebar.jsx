import React, { useState } from 'react';
import './sidebar.scss';
import { useNavigate } from 'react-router-dom';


const Sidebar = ({ onProfileClick }) => { 
  const [isOpen, setIsOpen] = useState(false); 

  const toggleOpen = () => setIsOpen(!isOpen);


  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/voteawards'); 
  };

   const handleEarnings = () => {
    navigate('/earnings'); 
  };



  const handleMilestones = () => {
    navigate('/milestones'); 
  };

   const handleMap = () => {
    navigate('/find'); 
  };


  const handleLeaderboards = () => {
    navigate('/leaderboards'); 
  };


  const handleFindPage = () => {
    navigate('/findpage'); 
  };

  const handleArtist = () => {
    navigate('/artist'); 
  };

  const handleSong = () => {
    navigate('/song'); 
  };

  const handleProfile = () => {
    navigate('/profile'); 
  };

  return (
    <>
      {/* Mobile Trigger */}
      <div className="sidebar-trigger" onClick={toggleOpen}>
        <span className="arrow-icon">&#9654;</span>
      </div>

      {/* Sidebar Content */}
      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <ul>
          <li onClick={handleClick}>Vote</li> {/* Add navigation if needed */}
          <li onClick={handleFindPage}>Find</li>
          <li onClick={handleLeaderboards}>Leaderboards</li>
          <li onClick={handleProfile}>Settings</li>
          <li onClick={handleEarnings}>Earnings</li>
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