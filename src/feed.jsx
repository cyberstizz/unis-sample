// src/components/Feed.js
import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.svg'; // Adjust path as needed
import Player from './player';
import './Feed.scss';

const Feed = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="feed-container">
      {/* Header */}
      <header className="header">
        <img src={unisLogo} alt="UNIS Logo" className="logo" />
        <input type="text" placeholder="Search artists, songs..." className="search-bar" />
        <div className="options-bar">
          <div className="option-box">Vote</div>
          <div className="option-box">Awards</div>
          <div className="option-box">Popular</div>
          <div className="option-box">Earnings</div>
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
              <li>Settings</li>
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
            {/* Placeholder items */}
            <div className="item">Song 1</div>
            <div className="item">Song 2</div>
            <div className="item">Song 3</div>
            <div className="item">Song 4</div>
          </div>
        </section>

        {/* New Carousel */}
        <section className="feed-section carousel">
          <h2>New</h2>
          <div className="carousel-items">
            <div className="item">New Song A</div>
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

      {/* Bottom Player */}
    </div>
  );
};

export default Feed;
