import React, { useState } from 'react';
import { apiCall } from './components/axiosInstance';
import './leaderboardsPage.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';

const LeaderboardsPage = () => {
  const [location, setLocation] = useState('downtown-harlem');
  const [genre, setGenre] = useState('rap-hiphop');
  const [category, setCategory] = useState('artist');
  const [interval, setInterval] = useState('daily');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const handleView = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jurId = JURISDICTION_IDS[location];
      const genreId = GENRE_IDS[genre];
      const intervalId = INTERVAL_IDS[interval];
      const type = category;

      console.log('Params:', { jurId, genreId, intervalId, type });  // Debug

      const response = await apiCall({
        method: 'get',
        url: `/v1/vote/leaderboards?jurisdictionId=${jurId}&genreId=${genreId}&targetType=${type}&intervalId=${intervalId}&limit=50`,  // Fixed: /vote prefix
      });

      const rawResults = response.data;
      const normalized = rawResults.map((item, i) => ({
        rank: item.rank || i + 1,
        title: item.name,
        artist: item.artist || 'Unknown',
        votes: item.votes || 0,
        artwork: item.artwork ? `${API_BASE_URL}${item.artwork}` : rapperOne,
      }));

      // Fallback if <5
      if (normalized.length < 5) {
        const fallbackResponse = await apiCall({
          method: 'get',
          url: `/v1/vote/leaderboards?jurisdictionId=${jurId}&genreId=${genreId}&targetType=${type}&intervalId=${intervalId}&limit=5&playsOnly=true`,  // Fixed prefix
        });
        const fallback = fallbackResponse.data.map((item, i) => ({
          rank: normalized.length + i + 1,
          title: item.name,
          artist: item.artist || 'Unknown',
          votes: item.votes || 0,
          artwork: item.artwork ? `${API_BASE_URL}${item.artwork}` : rapperOne,
        }));
        normalized.push(...fallback);
      }

      setResults(normalized);
    } catch (err) {
      console.error('Leaderboards fetch error:', err);
      setError('Failed to load—using dummies.');
      setResults([
        { rank: 1, title: 'Current Hit', artist: 'Artist K', votes: 800, artwork: rapperOne },
        { rank: 2, title: 'Rising Star', artist: 'Artist L', votes: 750, artwork: rapperTwo },
        { rank: 3, title: 'Beat Drop', artist: 'Artist M', votes: 700, artwork: rapperThree },
        { rank: 4, title: 'Flow Master', artist: 'Artist N', votes: 650, artwork: rapperFree },
        { rank: 5, title: 'Rhyme Time', artist: 'Artist O', votes: 600, artwork: rapperTwo },
      ]);
    } finally {
      setIsLoading(false);
    }
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
                <option value="downtown-harlem">Downtown Harlem</option>
                <option value="uptown-harlem">Uptown Harlem</option>
                <option value="harlem-wide">Harlem-wide</option>
              </select>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
                <option value="rap-hiphop">Rap/Hip-Hop</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
                <option value="artist">Artist</option>
                <option value="song">Song</option>
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
            ) : error ? (
              <div className="error-message">{error}</div>
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