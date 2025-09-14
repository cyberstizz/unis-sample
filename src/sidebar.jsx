import React, { useState } from 'react';
import './Sidebar.scss';

const Sidebar = ({ onProfileClick }) => { // Prop for Settings click handler
  const [isOpen, setIsOpen] = useState(false); // For mobile slide-out

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Trigger */}
      <div className="sidebar-trigger" onClick={toggleOpen}>
        <span className="arrow-icon">&#9654;</span>
      </div>

      {/* Sidebar Content */}
      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <ul>
          <li onClick={() => onProfileClick?.()}>Vote</li> {/* Add navigation if needed */}
          <li>Find</li>
          <li>Leaderboards</li>
          <li onClick={onProfileClick}>Settings</li>
          <li>Earnings</li>
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