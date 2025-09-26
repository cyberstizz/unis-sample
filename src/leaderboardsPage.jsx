import React, { useState } from 'react';
import './leaderboardsPage.scss';
import Layout from './layout'; 
import backimage from './assets/randomrapper.jpeg';
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';


const LeaderboardsPage = () => {
  const [location, setLocation] = useState('downtown_harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song_of_the_month');
  const [interval, setInterval] = useState('daily');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock current data (key: 'location-genre-category-interval')
  const mockLeaderboardData = {
    'downtown_harlem-rap-song_of_the_month-daily': [
      { rank: 1, title: 'Current Hit', artist: 'Artist K', votes: 800, artwork: rapperOne },
      { rank: 2, title: 'Rising Star', artist: 'Artist L', votes: 750, artwork: rapperTwo },
      { rank: 3, title: 'Beat Drop', artist: 'Artist M', votes: 700, artwork: rapperThree },
      { rank: 4, title: 'Flow Master', artist: 'Artist N', votes: 650, artwork: rapperFree },
      { rank: 5, title: 'Rhyme Time', artist: 'Artist O', votes: 600, artwork: rapperTwo },
    ],
    
  };

  const handleView = () => {
    setIsLoading(true);
    const key = `${location}-${genre}-${category}-${interval}`;
    const mockData = mockLeaderboardData[key] || [];

    setTimeout(() => {
      setResults(mockData);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="leaderboards-page-container">
        <header className="header" id="leaderboardsheader">
          <h1 id="leaderboardsheader">Leaderboards</h1>
        </header>

        <main className="content-wrapper">
          <section className="filter-card">
            <div className="filter-controls">
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="filter-select">
                <option value="downtown_harlem">Downtown Harlem</option>
                <option value="uptown_harlem">Uptown Harlem</option>
                <option value="harlem_wide">Harlem-wide</option>
              </select>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
                <option value="rap">Rap/Hip-Hop</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
                <option value="artist_of_the_interval">Artist</option>
                <option value="song_of_the_interval">Song</option>
              </select>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} className="filter-select">
                <option value="daily">Today</option>
                <option value="weekly">Week</option>
                <option value="monthly">Month</option>
                <option value="quarterly">Quarter</option>
                <option value="midterm">Midterm</option>
                <option value="annual">Annual</option>
              </select>
              <button onClick={handleView} className="view-button" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'View Current'}
              </button>
            </div>
          </section>

          <section className="results-section">
            {isLoading ? (
              <div className="loading-message">Loading leaderboards...</div>
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
              <div className="no-results-message">Select criteria and click 'View Current' to see ongoing leaderboards.</div>
            )}
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default LeaderboardsPage;