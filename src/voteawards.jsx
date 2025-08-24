// src/components/VoteAwards.js
import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.jpg'; // Adjust path
import './VoteAwards.scss';

const VoteAwards = () => {
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [selectedGenre, setSelectedGenre] = useState('rap-hiphop'); // Default genre
  const [selectedType, setSelectedType] = useState('artist'); // 'artist' or 'song'
  const [historicDate, setHistoricDate] = useState(''); // For historic filters

  // Placeholder nominees (replace with API fetch based on interval/genre/type)
  const nominees = [
    { id: 1, name: 'Artist 1', votes: 45, projection: '83 votes from 20th last week' },
    { id: 2, name: 'Artist 2', votes: 32, projection: '12 votes from 15th last week' },
    // Add more...
  ];

  const intervals = ['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual'];

  const handleVote = (id) => {
    // TODO: API call to vote
    console.log(`Voted for ${id} in ${selectedInterval}`);
  };

  return (
    <div className="vote-awards-container">
      <header className="header">
        <img src={unisLogo} alt="UNIS Logo" className="logo" />
        <h1>Vote & Awards</h1>
      </header>

      <div className="filters">
        <select value={selectedInterval} onChange={(e) => setSelectedInterval(e.target.value)} className="filter-select">
          {intervals.map((int) => (
            <option key={int} value={int}>{int.charAt(0).toUpperCase() + int.slice(1)}</option>
          ))}
        </select>
        <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select">
          <option value="rap-hiphop">Rap/Hip-Hop</option>
          <option value="rock">Rock</option>
          <option value="pop">Pop</option>
        </select>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select">
          <option value="artist">Artist</option>
          <option value="song">Song</option>
        </select>
        <input
          type="date"
          value={historicDate}
          onChange={(e) => setHistoricDate(e.target.value)}
          placeholder="Historic Date Filter"
          className="historic-filter"
        />
      </div>

      <section className="nominees">
        <h2>{selectedInterval.charAt(0).toUpperCase() + selectedInterval.slice(1)} {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} of {selectedGenre.toUpperCase()}</h2>
        <ul className="nominee-list">
          {nominees.map((nominee) => (
            <li key={nominee.id} className="nominee-item">
              <div className="nominee-info">
                <h3>{nominee.name}</h3>
                <p>Votes: {nominee.votes}</p>
                <p className="projection">{nominee.projection}</p>
              </div>
              <button onClick={() => handleVote(nominee.id)} className="vote-button">Vote</button>
            </li>
          ))}
          {nominees.length === 0 && <p>No nominees available for this interval.</p>}
        </ul>
      </section>
    </div>
  );
};

export default VoteAwards;