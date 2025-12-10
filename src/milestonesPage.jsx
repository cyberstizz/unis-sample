import React, { useState } from 'react';
import { apiCall } from './components/axiosInstance';
import './milestonesPage.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import { GENRE_IDS, JURISDICTION_IDS } from './utils/idMappings';

const MilestonesPage = () => {
  const [location, setLocation] = useState('downtown-harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song');
  const [selectedDate, setSelectedDate] = useState('');
  const [interval, setInterval] = useState('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [userId, setUserId] = useState(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Helper to format the location name
  const formatLocation = (loc) => {
    return loc.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ').toUpperCase();
  };

  // Helper to format the genre name
  const formatGenre = (g) => {
    if (g === 'rap') return 'RAP';
    return g.toUpperCase();
  };

  // Helper to format the category
  const formatCategory = (cat) => {
    return cat.toUpperCase();
  };

  // Helper to get interval text
  const getIntervalText = (int) => {
    const intervalMap = {
      'daily': 'OF THE DAY',
      'weekly': 'OF THE WEEK',
      'monthly': 'OF THE MONTH',
      'quarterly': 'OF THE QUARTER',
      'midterm': 'OF THE MIDTERM',
      'annual': 'OF THE YEAR'
    };
    return intervalMap[int] || 'OF THE DAY';
  };

  // Helper to format the date with day of week
  const formatDateWithDay = (dateString) => {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNum = date.getDate();
    const year = date.getFullYear();
    
    return `${dayName}, ${monthName} ${dayNum}, ${year}`;
  };

  // Generate the caption
  const generateCaption = () => {
    if (!selectedDate || results.length === 0) return '';
    
    const locationText = formatLocation(location);
    const genreText = formatGenre(genre);
    const categoryText = formatCategory(category);
    const intervalText = getIntervalText(interval);
    const dateText = formatDateWithDay(selectedDate);

    
    return <div>{locationText} {genreText} {categoryText} {intervalText}   
              <div style={{color: "black"}}>{dateText}</div>   
              </div>
  };

    // Navigation handlers
  const handleArtistView = (id) => {
    console.log('Navigating to artist page with ID:', id);
    navigate(`/artist/${id}`);
  };

  const handleSongView = (id) => {
    console.log('Navigating to song page with ID:', id);
    navigate(`/song/${id}`);
  };

  const handleView = async () => {
    if (!selectedDate) {
      setError('Select a date.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const jurId = JURISDICTION_IDS[location];
      const genreId = GENRE_IDS[genre];
      const type = category;
      const date = selectedDate;

      if (!jurId) {
        throw new Error('Invalid location—check idMappings.');
      }

      console.log('Params:', { location, jurId, genre, genreId, type, date });

      const response = await apiCall({
        method: 'get',
        url: `/v1/awards/past?type=${type}&startDate=${date}&endDate=${date}&jurisdictionId=${jurId}&genreId=${genreId}`,
      });

      const rawResults = response.data;
      const normalized = rawResults.map((award, i) => ({
        rank: i + 1,
        title: award.targetType === 'artist' ? award.user?.username : award.song?.title || 'Unknown',
        artist: award.targetType === 'artist' ? award.user?.username : award.song?.artist?.username || 'Unknown',
        jurisdiction: award.jurisdiction?.name || location,
        votes: award.votesCount || 0,
        artwork: (award.targetType === 'artist' ? award.user?.photoUrl : award.song?.artworkUrl) ? `${API_BASE_URL}${award.targetType === 'artist' ? award.user.photoUrl : award.song.artworkUrl}` : songArtFour,
        caption: award.caption || `${award.artist} on their win: "This means everything!"`,
      }));

      setResults(normalized);
    } catch (err) {
      console.error('Milestones fetch error:', err);
      setError('Failed to load—using dummies.');
      setResults([
        { rank: 1, title: "Orange cup", artist: 'Aks da Bully', jurisdiction: 'Downtown Harlem', votes: 1500, artwork: songArtFour, caption: 'This win means everything to me. Harlem stand up!' },
        { rank: 2, title: 'City Lights', artist: 'Artist B', jurisdiction: 'Downtown Harlem', votes: 1200, artwork: rapperTwo, caption: 'Grateful for the support!' },
        { rank: 3, title: 'Midnight Hustle', artist: 'Artist C', jurisdiction: 'Downtown Harlem', votes: 1150, artwork: rapperThree, caption: 'Honored to be here.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split('T')[0];

  const winner = results[0];
  const caption = generateCaption();

  return (
    <Layout backgroundImage={backimage}>
      <div className="milestones-page-container">
        <header className="header" id="milestonesHeader">
          <h1>Milestones</h1>
        </header>

        <main className="content-wrapper">
          <section className="filter-card">
            <div className="filter-controls">
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="filter-select">
                <option value="downtown-harlem">Downtown Harlem</option>
                <option value="uptown-harlem">Uptown Harlem</option>
                <option value="harlem">Harlem</option>
              </select>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
                <option value="rap">Rap</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
                <option value="artist">Artist</option>
                <option value="song">Song</option>
              </select>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} className="filter-select">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="midterm">Midterm</option>
                <option value="annual">Annual</option>
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="filter-select"
                max={maxDate}
              />
              <button onClick={handleView} className="view-button" disabled={isLoading}>
                {isLoading ? 'Loading…' : 'View'}
              </button>
            </div>
          </section>

          {caption && (
            <section className="milestone-caption">
              <h2>{caption}</h2>
            </section>
          )}

          {winner && (
            <section className="winner-highlight">
              <div className="winner-title">{winner.title}</div>
              <div className="winner-artist">{winner.artist}</div>
              <div className="winner-jurisdiction">{winner.jurisdiction}</div>
              <img src={winner.artwork} alt={`${winner.title} artwork`} className="winner-artwork" />
            </section>
          )}

          <section className="results-section">
            {isLoading ? (
              <div className="loading-message">Loading milestones…</div>
            ) : error ? (
              <div className="error-message">{error}</div>
            ) : (
              <ul className="results-list">
                {results.slice(1).map((item) => (
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
            )}
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default MilestonesPage;