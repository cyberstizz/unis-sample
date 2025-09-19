import React, { useState } from 'react';
import './MilestonesPage.scss';
import Layout from './layout'; // Assume your Layout component
import backimage from './assets/randomrapper.jpeg';

const MilestonesPage = () => {
  const [location, setLocation] = useState('downtown_harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song_of_the_month');
  const [selectedDate, setSelectedDate] = useState(''); // e.g., '2025-09-15' for specific day
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data (expand as needed; key: 'location-genre-category-YYYY-MM-DD')
  const mockMilestoneData = {
    'downtown_harlem-rap-song_of_the_month-2025-09-15': [
      { rank: 1, title: 'Winner\'s Anthem', artist: 'Artist A', votes: 1500, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=A' },
      { rank: 2, title: 'City Lights', artist: 'Artist B', votes: 1200, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=B' },
      { rank: 3, title: 'Midnight Hustle', artist: 'Artist C', votes: 1150, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=C' },
      { rank: 4, title: 'Rooftop Vibes', artist: 'Artist D', votes: 980, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=D' },
      { rank: 5, title: 'Concrete Dreams', artist: 'Artist E', votes: 850, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=E' },
    ],
    'uptown_harlem-rnb-album_of_the_year-2025-08-20': [
      { rank: 1, title: 'The Quiet EP', artist: 'Artist F', votes: 2500, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=F' },
      { rank: 2, title: 'Golden Hour', artist: 'Artist G', votes: 2100, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=G' },
      { rank: 3, title: 'Soul Sessions', artist: 'Artist H', votes: 1800, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=H' },
      { rank: 4, title: 'Midnight Blues', artist: 'Artist I', votes: 1600, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=I' },
      { rank: 5, title: 'Harmony Heights', artist: 'Artist J', votes: 1400, artwork: 'https://placehold.co/100x100/1a1a1a/ffffff?text=J' },
    ],
    // Add more for different combinations
  };

  const handleView = () => {
    if (!selectedDate) return; // Require date

    setIsLoading(true);
    const key = `${location}-${genre}-${category}-${selectedDate}`;
    const mockData = mockMilestoneData[key] || [];

    // Simulate API delay
    setTimeout(() => {
      setResults(mockData);
      setIsLoading(false);
    }, 1000);
  };

  // Get yesterday for max (past only)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

  return (
    <Layout backgroundImage={backimage}>
      <div className="milestones-page-container">
        <header className="header" id='milestonesHeader'>
          <h1>Milestones</h1>
        </header>

        <main className="content-wrapper">
          <section className="filter-card">
            <div className="filter-controls">
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="filter-select">
                <option value="downtown_harlem">Downtown Harlem</option>
                <option value="uptown_harlem">Uptown Harlem</option>
                <option value="harlem_wide">Harlem</option>
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
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="filter-select"
                max={maxDate} // Past dates only (up to yesterday)
              />
              <button onClick={handleView} className="view-button" disabled={isLoading || !selectedDate}>
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
              <div className="no-results-message">Select criteria and click 'View' to see past winners. No data for this selection.</div>
            )}
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default MilestonesPage;