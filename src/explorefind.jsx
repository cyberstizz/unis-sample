// src/components/ExploreFind.js
import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.svg'; // Adjust path
import './explorefind.scss';
import Header from './header';

const ExploreFind = () => {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [jurisdiction, setJurisdiction] = useState(''); // Default to user's from signup
  const [type, setType] = useState('artist'); // 'artist' or 'song'

  // Placeholder results (replace with API fetch)
  const results = [
    { id: 1, name: 'Artist 1', genre: 'Rap/Hip-Hop', jurisdiction: 'Uptown Harlem', votes: 45, thumbnail: 'placeholder.jpg' },
    { id: 2, name: 'Song A', genre: 'Rock', jurisdiction: 'Downtown Harlem', votes: 32, thumbnail: 'placeholder.jpg' },
    // Add more...
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    // TODO: Fetch from /api/search with params
    console.log('Searching:', { query, genre, jurisdiction, type });
  };

  return (
    <React.Fragment>
      <Header />
    <div className="explore-container">
      <header className="header">
        <img src={unisLogo} alt="UNIS Logo" className="logo" />
        <h1>Explore & Find</h1>
      </header>

      <form className="search-form" onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists or songs..."
          className="search-bar"
        />
        <div className="filters">
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
            <option value="">All Genres</option>
            <option value="rap-hiphop">Rap/Hip-Hop</option>
            <option value="rock">Rock</option>
            <option value="pop">Pop</option>
          </select>
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="filter-select">
            <option value="">All Harlem</option>
            <option value="uptown">Uptown Harlem</option>
            <option value="downtown">Downtown Harlem</option>
            <option value="harlem-wide">Harlem</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="filter-select">
            <option value="artist">Artists</option>
            <option value="song">Songs</option>
          </select>
        </div>
        <button type="submit" className="search-button">Search</button>
      </form>

      <section className="results">
        <h2>Results</h2>
        <div className="results-grid">
          {results.map((item) => (
            <div key={item.id} className="result-item">
              <img src={item.thumbnail} alt={item.name} className="thumbnail" />
              <div className="info">
                <h3>{item.name}</h3>
                <p>Genre: {item.genre}</p>
                <p>Jurisdiction: {item.jurisdiction}</p>
                <p>Votes: {item.votes}</p>
                <button className="vote-button">Vote</button>
              </div>
            </div>
          ))}
          {results.length === 0 && <p>No results found. Try different filters!</p>}
        </div>
      </section>
    </div>
    </React.Fragment>
  );
};

export default ExploreFind;