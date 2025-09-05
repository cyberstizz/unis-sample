import React, { useState } from 'react';
import './milestonesPage.scss';

const MilestonesPage = () => {
  const [location, setLocation] = useState('downtown_harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song_of_the_month');
  const [time, setTime] = useState('september_2025');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Placeholder data to simulate an API response
  const mockMilestoneData = {
    'downtown_harlem-rap-song_of_the_month-september_2025': [
      { rank: 1, title: 'Winner\'s Anthem', artist: 'Artist A', votes: 1500, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=A' },
      { rank: 2, title: 'City Lights', artist: 'Artist B', votes: 1200, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=B' },
      { rank: 3, title: 'Midnight Hustle', artist: 'Artist C', votes: 1150, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=C' },
      { rank: 4, title: 'Rooftop Vibes', artist: 'Artist D', votes: 980, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=D' },
      { rank: 5, title: 'Concrete Dreams', artist: 'Artist E', votes: 850, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=E' },
    ],
    'uptown_harlem-rnb-album_of_the_year-september_2025': [
      { rank: 1, title: 'The Quiet EP', artist: 'Artist F', votes: 2500, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=F' },
      { rank: 2, title: 'Golden Hour', artist: 'Artist G', votes: 2100, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=G' },
    ],
    // Add more mock data for different combinations as needed
  };

  const handleView = () => {
    setIsLoading(true);
    const key = `${location}-${genre}-${category}-${time}`;
    const mockData = mockMilestoneData[key] || [];

    // Simulate an API call delay
    setTimeout(() => {
      setResults(mockData);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <>
      <style>
        {`
          .milestones-page-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            background: #000000;
            color: #A9A9A9;
            padding: 20px 0;
            overflow-y: auto;
            font-family: sans-serif;
          }

          .header {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 30px;
          }

          .logo {
            height: 80px;
          }

          h1 {
            color: #C0C0C0;
            font-size: 32px;
            font-weight: bold;
            margin: 10px 0 0;
          }

          .content-wrapper {
            width: 100%;
            max-width: 900px;
            padding: 0 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .filter-card {
            background: #1a1a1a;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
          }

          .filter-controls {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
          }

          .filter-select {
            background: #000000;
            border: 1px solid rgba(192, 192, 192, 0.3);
            color: #FFFFFF;
            padding: 10px 15px;
            border-radius: 50px;
            font-size: 14px;
            cursor: pointer;
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path fill="%23C0C0C0" d="M6 9l-4-4h8z"/></svg>');
            background-repeat: no-repeat;
            background-position: right 10px center;
          }

          .view-button {
            padding: 12px 30px;
            background: transparent;
            border: 1px solid #C0C0C0;
            color: #C0C0C0;
            border-radius: 50px;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.2s, color 0.2s;
          }

          .view-button:hover:not(:disabled) {
            background: #FFFFFF;
            color: #000000;
          }

          .view-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .results-section {
            .no-results-message, .loading-message {
              text-align: center;
              font-style: italic;
              padding: 50px;
              color: #A9A9A9;
            }
          }

          .results-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 15px;
          }

          .result-item {
            background: #1a1a1a;
            border-radius: 12px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            transition: transform 0.2s, box-shadow 0.2s;
          }

          .result-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
          }

          .rank {
            font-size: 28px;
            font-weight: bold;
            color: #FFFFFF;
          }

          .item-artwork {
            width: 60px;
            height: 60px;
            border-radius: 8px;
          }

          .item-info {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
          }

          .item-title {
            font-size: 18px;
            font-weight: bold;
            color: #C0C0C0;
          }

          .item-artist {
            font-size: 14px;
            color: #A9A9A9;
          }

          .item-votes {
            font-size: 14px;
            color: #C0C0C0;
            font-weight: bold;
            white-space: nowrap;
          }

          @media (max-width: 600px) {
            .filter-controls {
              flex-direction: column;
              align-items: center;
            }
            .filter-select, .view-button {
              width: 100%;
              text-align: center;
            }
            .result-item {
              flex-direction: column;
              text-align: center;
            }
            .item-info {
              text-align: center;
            }
            .item-artwork {
              width: 80px;
              height: 80px;
            }
          }
        `}
      </style>

      <div className="milestones-page-container">
        <header className="header">
          <img src="https://placehold.co/80x80/000000/C0C0C0?text=UNIS" alt="UNIS Logo" className="logo" />
          <h1>Milestones</h1>
        </header>

        <main className="content-wrapper">
          <section className="filter-card">
            <div className="filter-controls">
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="filter-select">
                <option value="downtown_harlem">Downtown Harlem</option>
                <option value="uptown_harlem">Uptown Harlem</option>
              </select>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
                <option value="rap">Rap</option>
                <option value="rnb">R&B</option>
              </select>
              <select value="category" onChange={(e) => setCategory(e.target.value)} className="filter-select">
                <option value="song_of_the_month">Song of the Month</option>
                <option value="album_of_the_year">Album of the Year</option>
              </select>
              <select value={time} onChange={(e) => setTime(e.target.value)} className="filter-select">
                <option value="september_2025">September 2025</option>
                <option value="august_2025">August 2025</option>
                <option value="july_2025">July 2025</option>
              </select>
              <button onClick={handleView} className="view-button" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'View'}
              </button>
            </div>
          </section>

          <section className="results-section">
            {isLoading ? (
              <div className="loading-message">Loading milestones...</div>
            ) : results.length > 0 ? (
              <ul className="results-list">
                {results.map((item) => (
                  <li key={item.rank} className="result-item">
                    <div className="rank">#{item.rank}</div>
                    <img src={item.artwork} alt={`${item.title} artwork`} className="item-artwork" />
                    <div className="item-info">
                      <div className="item-title">{item.title}</div>
                      <div className="item-artist">{item.artist}</div>
                    </div>
                    <div className="item-votes">
                      <span>{item.votes} Votes</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-results-message">Select your criteria and click 'View' to see the winners.</div>
            )}
          </section>
        </main>
      </div>
    </>
  );
};

export default MilestonesPage;
