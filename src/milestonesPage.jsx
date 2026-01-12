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
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';

const MilestonesPage = () => {
  const [location, setLocation] = useState('downtown-harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song');
  const [selectedDate, setSelectedDate] = useState('');
  const [interval, setInterval] = useState('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
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

  // =========================================================================
  // NEW: Calculate date range based on selected interval
  // =========================================================================
  const getDateRangeForInterval = (selectedDate, intervalType) => {
    const endDate = new Date(selectedDate);
    let startDate = new Date(selectedDate);
    
    switch (intervalType) {
      case 'daily':
        // Same day
        break;
      case 'weekly':
        // Go back to Monday of that week
        const dayOfWeek = startDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToMonday);
        break;
      case 'monthly':
        // First day of month
        startDate.setDate(1);
        break;
      case 'quarterly':
        // First day of quarter
        const month = startDate.getMonth();
        const quarterStartMonth = Math.floor(month / 3) * 3;
        startDate.setMonth(quarterStartMonth);
        startDate.setDate(1);
        break;
      case 'midterm':
        // First day of half-year (Jan 1 or Jul 1)
        const midtermMonth = startDate.getMonth();
        if (midtermMonth >= 6) {
          startDate.setMonth(6);
        } else {
          startDate.setMonth(0);
        }
        startDate.setDate(1);
        break;
      case 'annual':
        // First day of year
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
      default:
        break;
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  // Generate the caption
  const generateCaption = () => {
    if (!selectedDate || results.length === 0) return '';
    
    const locationText = formatLocation(location);
    const genreText = formatGenre(genre);
    const categoryText = formatCategory(category);
    const intervalText = getIntervalText(interval);
    const dateText = formatDateWithDay(selectedDate);

    return (
      <div>
        {locationText} {genreText}<br /> 
        <span className='dramaticEffect'>{categoryText} {intervalText}</span> 
        <div style={{color: "black"}}>{dateText}</div>   
      </div>
    );
  };

  // Navigation handlers
  const handleArtistView = (id) => {
    console.log('Navigating to artist page with ID:', id);
    // navigate(`/artist/${id}`);
  };

  const handleSongView = (id) => {
    console.log('Navigating to song page with ID:', id);
    // navigate(`/song/${id}`);
  };

  const handleView = async () => {
    if (!selectedDate) {
      setError('Select a date.');
      return;
    }
    setIsLoading(true);
    setError(null);
    
    try {
      // Get IDs from mappings
      const jurId = JURISDICTION_IDS[location];
      const genreId = GENRE_IDS[genre];
      const intervalId = INTERVAL_IDS[interval];  // NEW: Get interval ID
      const type = category;

      // Validate mappings
      if (!jurId) {
        throw new Error(`Invalid location "${location}" - check idMappings.js`);
      }
      if (!genreId) {
        throw new Error(`Invalid genre "${genre}" - check idMappings.js`);
      }
      if (!intervalId) {
        throw new Error(`Invalid interval "${interval}" - check idMappings.js`);
      }

      // Calculate date range based on interval
      const { startDate, endDate } = getDateRangeForInterval(selectedDate, interval);

      console.log('Milestones API params:', { 
        location, jurId, 
        genre, genreId, 
        interval, intervalId,
        type, 
        startDate, endDate 
      });

      // =========================================================================
      // UPDATED API CALL: Now includes intervalId parameter
      // =========================================================================
      const response = await apiCall({
        method: 'get',
        url: `/v1/awards/past?type=${type}&startDate=${startDate}&endDate=${endDate}&jurisdictionId=${jurId}&genreId=${genreId}&intervalId=${intervalId}`,
      });

      const rawResults = response.data;
      
      console.log('API response:', rawResults);

      // Handle empty results
      if (!rawResults || rawResults.length === 0) {
        setError('No awards found for this date and filters. Try a different date or check if votes were cast.');
        setResults([]);
        return;
      }

      // Normalize results for display
      const normalized = rawResults.map((award, i) => {
        // Determine name and image based on target type
        let title, artist, artwork;
        
        if (award.targetType === 'artist') {
          title = award.user?.username || 'Unknown Artist';
          artist = award.user?.username || 'Unknown Artist';
          artwork = award.user?.photoUrl 
            ? `${API_BASE_URL}${award.user.photoUrl}` 
            : rapperOne;
        } else {
          title = award.song?.title || 'Unknown Song';
          artist = award.song?.artist?.username || 'Unknown Artist';
          artwork = award.song?.artworkUrl 
            ? `${API_BASE_URL}${award.song.artworkUrl}` 
            : songArtFour;
        }

        return {
          rank: i + 1,
          id: award.targetId,
          targetType: award.targetType,
          title,
          artist,
          jurisdiction: award.jurisdiction?.name || location,
          votes: award.votesCount || 0,
          artwork,
          // NEW: Include tiebreaker info
          determinationMethod: award.determinationMethod,
          tiedCandidatesCount: award.tiedCandidatesCount || 0,
          caption: award.caption || generateWinnerCaption(award),
        };
      });

      setResults(normalized);
      
    } catch (err) {
      console.error('Milestones fetch error:', err);
      setError(err.message || 'Failed to load milestones. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a caption based on how the winner was determined
  const generateWinnerCaption = (award) => {
    if (!award.determinationMethod || award.determinationMethod === 'VOTES') {
      return 'Winner by popular vote!';
    } else if (award.determinationMethod === 'SCORE') {
      return `Won in ${award.tiedCandidatesCount}-way tiebreaker by highest score!`;
    } else if (award.determinationMethod === 'SENIORITY') {
      return `Won in ${award.tiedCandidatesCount}-way tiebreaker as longest-standing artist!`;
    } else if (award.determinationMethod === 'FALLBACK') {
      return 'Top performer - no votes cast this period';
    }
    return 'Winner!';
  };

  // Get yesterday's date as max selectable date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split('T')[0];

  const winner = results[0];
  const caption = generateCaption();

  // Helper to get determination badge
  const getDeterminationBadge = (method, tiedCount) => {
    if (!method || method === 'VOTES') return null;
    if (method === 'FALLBACK') return <span className="badge fallback">No votes</span>;
    return <span className="badge tiebreaker">{tiedCount}-way tie</span>;
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="milestones-page-container">
        <main className="content-wrapper">
          <section className="filter-card">
            <div className="filter-controls">
              {/* Location dropdown - FIXED: 'harlem' instead of 'harlem-wide' */}
              <select 
                value={location} 
                onChange={(e) => setLocation(e.target.value)} 
                className="filter-select"
              >
                <option value="downtown-harlem">Downtown Harlem</option>
                <option value="uptown-harlem">Uptown Harlem</option>
                <option value="harlem">Harlem (All)</option>
              </select>

              {/* Genre dropdown */}
              <select 
                value={genre} 
                onChange={(e) => setGenre(e.target.value)} 
                className="filter-select"
              >
                <option value="rap">Rap</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>

              {/* Category dropdown */}
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                className="filter-select"
              >
                <option value="artist">Artist</option>
                <option value="song">Song</option>
              </select>

              {/* Interval dropdown - All 6 intervals */}
              <select 
                value={interval} 
                onChange={(e) => setInterval(e.target.value)} 
                className="filter-select"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="midterm">Midterm</option>
                <option value="annual">Annual</option>
              </select>

              {/* Date picker */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="filter-select"
                max={maxDate}
              />

              {/* View button */}
              <button 
                onClick={handleView} 
                className="view-button" 
                disabled={isLoading}
              >
                {isLoading ? 'Loading…' : 'View'}
              </button>
            </div>
          </section>

          {/* Caption section */}
          {caption && (
            <section className="milestone-caption">
              <h2>{caption}</h2>
            </section>
          )}

          {/* Winner highlight section */}
          {winner && (
            <section className="winner-highlight">
              <div className="winner-title">{winner.title}</div>
              <div className="winner-artist">{winner.artist}</div>
              <div className="winner-jurisdiction">{winner.jurisdiction}</div>
              <div className="winner-votes">{winner.votes} votes</div>
              {getDeterminationBadge(winner.determinationMethod, winner.tiedCandidatesCount)}
              <img 
                src={winner.artwork} 
                alt={`${winner.title} artwork`} 
                className="winner-artwork" 
              />
              {winner.caption && (
                <div className="winner-caption">"{winner.caption}"</div>
              )}
            </section>
          )}

          {/* Results list section */}
          <section className="results-section">
            {isLoading ? (
              <div className="loading-message">Loading milestones…</div>
            ) : error ? (
              <div className="error-message">{error}</div>
            ) : results.length === 0 ? (
              <div className="empty-message">
                Select a date and click "View" to see past award winners.
              </div>
            ) : (
              <ul className="results-list">
                {results.slice(1).map((item) => (
                  <li key={item.rank} className="result-item">
                    <div className="rank">#{item.rank}</div>
                    <img 
                      src={item.artwork} 
                      alt={`${item.title} artwork`} 
                      className="item-artwork" 
                    />
                    <div className="item-info">
                      <div className="item-title">{item.title}</div>
                      <div className="item-artist">{item.artist}</div>
                    </div>
                    <div className="item-votes">
                      <span>{item.votes} Votes</span>
                      {getDeterminationBadge(item.determinationMethod, item.tiedCandidatesCount)}
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