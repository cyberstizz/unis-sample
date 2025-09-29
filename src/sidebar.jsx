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
          <li onClick={handleClick}><span className="sidebar-icon">🗳️</span> Vote</li> {/* Placeholder icon */}
          <li onClick={handleFindPage}><span className="sidebar-icon">🔍</span> Find</li>
          <li onClick={handleLeaderboards} className='sidebar-icon-leaderboards'><span className="sidebar-icon">🏆</span> <span style={{fontSize: '20px'}}> Leaderboards</span></li>
          <li onClick={handleProfile}><span className="sidebar-icon">⚙️</span> Settings</li>
          <li onClick={handleEarnings}><span className="sidebar-icon">💰</span> Earnings</li>
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