import React, { useState, useEffect, useContext } from 'react'; 
import { useNavigate } from 'react-router-dom'; 
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './leaderboardsPage.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import sampleSong from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';

const LeaderboardsPage = () => {
  const navigate = useNavigate(); 
  const { playMedia } = useContext(PlayerContext); 
  const [location, setLocation] = useState('downtown-harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('artist');
  const [interval, setInterval] = useState('daily');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';


  useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUserId(payload.userId);
            console.log('User ID extracted from token:', payload.userId); // Debug log
          } catch (err) {
            console.error('Failed to get userId from token:', err);
          }
        }
      }, []);


  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };
 const handlePlay = async (media) => {
      console.log('handlePlay called with:', media);
      
      let trackingId = null;
      let trackingType = null;

      // If it's a song with fileUrl, play it directly
      if (media.fileUrl) {
        const fullUrl = buildUrl(media.fileUrl);
        console.log('Playing song directly:', media.title, fullUrl);
        
        playMedia(
          { 
            type: 'song', 
            url: fullUrl, 
            title: media.title || media.name, 
            artist: media.artist || media.name, 
            artwork: buildUrl(media.artwork)
          },
          []
        );
        
        // Track this play
        trackingId = media.id || media.songId;
        trackingType = 'song';
      }
      // If it's an artist, fetch and play default song
      else if (media.type === 'artist' && media.id) {
        console.log('Fetching default song for artist:', media.name, media.id);
        try {
          const response = await apiCall({
            method: 'get',
            url: `/v1/users/${media.id}/default-song`,
          });
          const defaultSong = response.data;
          console.log('Default song response:', defaultSong);
          
          if (defaultSong && defaultSong.fileUrl) {
            const fullUrl = buildUrl(defaultSong.fileUrl);
            console.log('Playing default song:', defaultSong.title, fullUrl);
            
            playMedia(
              { 
                type: 'default-song', 
                url: fullUrl, 
                title: defaultSong.title, 
                artist: media.name, 
                artwork: buildUrl(defaultSong.artworkUrl) || media.artwork 
              },
              []
            );
            
            // Track this play
            trackingId = defaultSong.songId;
            trackingType = 'song';
          } else {
            console.warn('No default song found for artist');
            return; // Exit without tracking
          }
        } catch (err) {
          console.error('Default song fetch failed:', err);
          return; // Exit without tracking
        }
      }
      // Fallback to sample
      else {
        console.warn('Falling back to sample song');
        playMedia(
          { 
            type: 'song', 
            url: sampleSong, 
            title: media.title || media.name, 
            artist: media.artist || media.name, 
            artwork: media.artwork 
          },
          []
        );
        return; // Don't track sample plays
      }

      // Track the play
      if (trackingId && trackingType && userId) {
        try {
          const endpoint = trackingType === 'song' 
            ? `/v1/media/song/${trackingId}/play?userId=${userId}`
            : `/v1/media/video/${trackingId}/play?userId=${userId}`;
          
          await apiCall({ method: 'post', url: endpoint });
          console.log('Play tracked successfully for:', trackingId);
        } catch (err) {
          console.error('Failed to track play:', err);
        }
      } else {
        console.warn('Could not track play - missing data:', { trackingId, trackingType, userId });
      }
    };

  const handleViewCurrent = async () => { 
    setIsLoading(true);
    setError(null);
    setResults([]);
    
    try {
      const jurId = JURISDICTION_IDS[location];
      const genreId = GENRE_IDS[genre];
      const intervalId = INTERVAL_IDS[interval];
      const type = category;

      console.log('Fetching leaderboards with params:', {
        jurisdictionId: jurId,
        genreId,
        targetType: type,
        intervalId
      });

      const response = await apiCall({
        method: 'get',
        url: `/v1/vote/leaderboards?jurisdictionId=${jurId}&genreId=${genreId}&targetType=${type}&intervalId=${intervalId}&limit=50`,
      });

      const rawResults = response.data;
      console.log('Raw leaderboard results:', rawResults);

      if (!rawResults || rawResults.length === 0) {
        setError('No results found for this combination. Try different filters.');
        return;
      }

      // FIXED: Proper ID extraction from backend response
      const normalized = rawResults.map((item, i) => {
        // DEBUG: Log to verify targetId exists
        console.log(`Item ${i}:`, item);
        
        if (type === 'artist') {
          return {
            id: item.targetId,  // ✅ Use targetId from backend
            type: 'artist',
            rank: item.rank || (i + 1),
            name: item.name || 'Unknown Artist',
            title: item.name || 'Unknown Artist',
            artist: item.name || 'Unknown Artist',
            votes: item.votes || 0,
            artwork: item.artwork ? buildUrl(item.artwork) : backimage,
            fileUrl: null,
          };
        } else {
          return {
            id: item.targetId,  // ✅ Use targetId from backend
            type: 'song',
            rank: item.rank || (i + 1),
            title: item.name || 'Unknown Song',
            artist: item.artist || 'Unknown',
            votes: item.votes || 0,
            fileUrl: item.fileUrl ? buildUrl(item.fileUrl) : null,
            artwork: item.artwork ? buildUrl(item.artwork) : backimage,
          };
        }
      });

      console.log('Normalized results:', normalized);
      setResults(normalized);
    } catch (err) {
      console.error('Leaderboards fetch error:', err);
      console.error('Error response:', err.response?.data);
      setError(`Failed to load leaderboards: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <Layout backgroundImage={backimage}>
      <div className="leaderboards-page-container">
        <main className="content-wrapper">
          <section className="filter-card">
            <div className="filter-controls">
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="filter-select">
                <option value="downtown-harlem">Downtown Harlem</option>
                <option value="uptown-harlem">Uptown Harlem</option>
                <option value="harlem-wide">Harlem-wide</option>
              </select>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
                <option value="rap-">Rap</option>
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
              <button onClick={handleViewCurrent} className="view-button" disabled={isLoading}>
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
                  <li key={`${item.type}-${item.id}-${item.rank}`} className="result-item">
                    <div className="rank">#{item.rank}</div>
                    <img 
                      src={item.artwork} 
                      alt={item.title}
                      className="item-artwork"
                      onError={(e) => {
                        console.error('Image failed to load:', item.artwork);
                        e.target.src = backimage;
                      }}
                    />
                    <div className="item-info">
                      <div className="item-title">{item.title}</div>
                      <div className="item-artist">{item.jurisdictionId}</div>
                    </div>
                    <div className="item-votes">
                    </div>
                    
                    <div className="result-actions">
                      {/* FIXED: Pass entire item object to handlePlay */}
                      <button 
                        onClick={() => handlePlay(item)}
                        className="listen-button"
                      >
                        Listen
                      </button>
                      
                      {/* FIXED: Pass correct ID to navigation handlers */}
                      {item.type === 'artist' ? (
                        <button 
                          onClick={() => handleArtistView(item.id)}
                          className="view-item-button"
                        >
                          View
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleSongView(item.id)}
                          className="view-item-button"
                        >
                          View Song
                        </button>
                      )}
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