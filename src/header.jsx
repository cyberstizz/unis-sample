import React from "react";
import "./feed.scss"; 
import unisLogo from './assets/unisNoBackground.svg'; // Adjust path as needed
import { useNavigate } from 'react-router-dom';

const Header = () => {

  const handleClick = () => {
    navigate('/voteawards'); // Navigate to the '/about' path
  };


  const handleMilestones = () => {
    navigate('/milestones'); // Navigate to the '/about' path
  };

  const handleArtist = () => {
    navigate('/artist'); // Navigate to the '/about' path
  };

  const handleSong = () => {
    navigate('/song'); // Navigate to the '/about' path
  };

  const handleProfile = () => {
    navigate('/profile'); 
  };

    const navigate = useNavigate();
  


  return (
   <header className="header">
     <div className="header-top">
       <img src={unisLogo} alt="UNIS Logo" className="logo" />
       <input type="text" placeholder="Search artists, songs..." className="search-bar" />
     </div>
     <div className="options-bar">
       <div onClick={handleClick} className="option-box">Vote</div>
       <div onClick={handleMilestones} className="option-box">Awards</div>
       <div onClick={handleArtist} className="option-box">Popular</div>
       <div onClick={handleClick} className="option-box">Earnings</div>
     </div>
   </header>
  );
};

export default Header;
