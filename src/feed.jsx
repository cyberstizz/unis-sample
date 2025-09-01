// src/components/Feed.js
import React, { useState, useContext } from 'react'; // Add useContext here if not
import unisLogo from './assets/unisLogo.png'; // Adjust path as needed
import { PlayerContext } from './context/playercontext'; // Ensure case matches file (e.g., PlayerContext.js)
import { useNavigate } from 'react-router-dom';
import song1 from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import song2 from './assets/sdboomin_waitedallnight.mp3';
import video1 from './assets/badVideo.mp4'
import art1 from './assets/unisLogo1.jpg'; 
import art2 from './assets/theQuiet.jpg'; // Assuming JPG for artwork
import './feed.scss';

const Feed = () => {
  const { playMedia } = useContext(PlayerContext); // Move here: Top-level hook call
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navigate = useNavigate();

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

  return (
    <div className="feed-container">
      {/* Header */}
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

      {/* Side Menu Trigger (Sticky) */}
      <div className="side-menu-trigger" onClick={toggleMenu}>
        <span className="arrow-icon">&#9654;</span> {/* Right arrow; rotates on open */}
      </div>

      {/* Side Menu Overlay */}
      {isMenuOpen && (
        <div className="side-menu-overlay" onClick={toggleMenu}>
          <div className="side-menu" onClick={(e) => e.stopPropagation()}>
            <ul>
              <li>Vote</li>
              <li>Find</li>
              <li>Leaderboards</li>
              <li onClick={handleProfile}>Settings</li>
              <li>Earnings</li>
            </ul>
          </div>
        </div>
      )}

      {/* Feed Content */}
      <main className="feed">
        {/* Trending Carousel */}
        <section className="feed-section carousel">
          <h2>Trending</h2>
          <div className="carousel-items">
            {/* Updated items with onClick */}
            <div 
              className="item" 
              onClick={() => {
                playMedia( // Use the variable here
                  { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: art1 },
                  [ // Sample playlist
                    { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: art1 },
                    { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: art2 },
                  ]
                );
              }}
            >
              Song 1: Tony Fadd - Paranoid
            </div>
            <div 
              className="item" 
              onClick={() => {
                playMedia(
                  { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: art2 },
                  [ // Another playlist
                    { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: art2 },
                    { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: art1 },
                  ]
                );
              }}
            >
              Song 2: SD Boomin - Waited All Night
            </div>
            <div className="item" 
              onClick={() => {
                playMedia(
                  { type: 'video', url: video1, title: 'badVideo', artist: 'some guy', artwork: art2 },
                  [ // Another playlist
                    { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: art2 },
                    { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: art1 },
                  ]
                );
              }}
            >bad Video</div> {/* Add similar for others */}
            <div className="item">Song 4</div>
          </div>
        </section>

        {/* New Carousel */}
        <section className="feed-section carousel">
          <h2>New</h2>
          <div className="carousel-items">
            <div className="item" onClick={handleSong}>New Song A</div>
            <div className="item">New Song B</div>
            <div className="item">New Song C</div>
            <div className="item">New Song D</div>
          </div>
        </section>

        {/* My Home List */}
        <section className="feed-section list">
          <h2>My Home</h2>
          <ol>
            <li>Award 1</li>
            <li>Award 2</li>
            <li>Award 3</li>
            <li>Award 4</li>
            <li>Award 5</li>
          </ol>
        </section>

        {/* Popular List */}
        <section className="feed-section list">
          <h2>Popular</h2>
          <ol>
            <li>Artist 1</li>
            <li>Artist 2</li>
            <li>Artist 3</li>
            <li>Artist 4</li>
            <li>Artist 5</li>
          </ol>
        </section>

        {/* Posts Section */}
        <section className="feed-section posts">
          <h2>Posts</h2>
          <div className="post">Follower Post 1</div>
          <div className="post">Follower Post 2</div>
          <div className="post">Follower Post 3</div>
        </section>
      </main>

      {/* Bottom Player - REMOVE this; it's now in App.js */}
    </div>
  );
};

export default Feed;