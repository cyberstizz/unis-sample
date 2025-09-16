// src/components/VoteAwards.js
import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.svg'; // Adjust path
import './VoteAwards.scss';
import Header from './header';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';

const VoteAwards = () => {
  const [searchQuery, setSearchQuery] = useState(''); // New: Search bar state
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [selectedGenre, setSelectedGenre] = useState('rap-hiphop');
  const [selectedType, setSelectedType] = useState('artist');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('harlem-wide');
  const [isHistoricMode, setIsHistoricMode] = useState(false); // New: Toggle for historic
  const [historicDate, setHistoricDate] = useState(''); // New: Date for historic

  // Placeholder nominees/leaderboard (filter by searchQuery in logic; API fetch later)
  const nominees = [
    { id: 1, name: 'Artist 1', votes: 45, projection: '83 votes from 20th last week' },
    { id: 2, name: 'Artist 2', votes: 32, projection: '12 votes from 15th last week' },
    // Add more... (filter: nominees.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase())))
  ];

  const intervals = ['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual'];
  const jurisdictions = [
    { value: 'uptown-harlem', label: 'Uptown Harlem' },
    { value: 'downtown-harlem', label: 'Downtown Harlem' },
    { value: 'harlem-wide', label: 'Harlem-wide' },
  ];

  const handleVote = (id) => {
    // TODO: API call to vote
    console.log(`Voted for ${id} in ${selectedInterval}, ${selectedJurisdiction}`);
    alert('Vote cast!'); // New: Simple feedback
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // TODO: Filter nominees or fetch with query
    console.log('Searching:', searchQuery);
  };

  return (
       <Layout backgroundImage={backimage}> {/* random image for MVP */}
      <div className='voteAwardsContainer'>
      {/* New: Search Bar */}
      <form className="search-form" onSubmit={handleSearch}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search artists or songs to vote..."
          className="search-bar"
        />
        <button type="submit" className="search-button">Go</button>
      </form>

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
        <select value={selectedJurisdiction} onChange={(e) => setSelectedJurisdiction(e.target.value)} className="filter-select">
          {jurisdictions.map((jur) => (
            <option key={jur.value} value={jur.value}>{jur.label}</option>
          ))}
        </select>
      
      </div>

      <section className="nominees">
        <h2>{selectedInterval.charAt(0).toUpperCase() + selectedInterval.slice(1)} {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} of {selectedGenre.toUpperCase()} in {jurisdictions.find(j => j.value === selectedJurisdiction)?.label}</h2>
        <ul className="nominee-list">
          {nominees.map((nominee) => (
            <li key={nominee.id} className="nominee-item">
              <div className="nominee-info">
                <h3>{nominee.name}</h3>
                <p>Votes: {nominee.votes}</p>
                <p className="projection">{nominee.projection}</p>
              </div>
              <button onClick={() => handleVote(nominee.id)} className="listen-button">Listen</button>
              <button onClick={() => handleVote(nominee.id)} className="vote-button">Vote</button>
            </li>
          ))}
          {nominees.length === 0 && <p>No nominees available for this interval.</p>}
        </ul>
      </section>

    
    </div>
    </Layout>
  );
};

export default VoteAwards;