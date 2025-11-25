import React, { useState, useContext, useEffect } from 'react';
import { PlayerContext } from './context/playercontext'; 
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import Layout from './layout';
import randomRapper from './assets/randomrapper.jpeg';
import song1 from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import song2 from './assets/sdboomin_waitedallnight.mp3';
import video1 from './assets/badVideo.mp4';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import songArtFive from './assets/songartfive.jpg';
import songArtSix from './assets/songarteight.png';
import songArtNine from './assets/albumartnine.jpg';
import songArtTen from './assets/albumartten.jpeg';
import songArtEleven from './assets/rapperphotoOne.jpg';
import { JURISDICTION_NAMES } from './utils/idMappings';
import './feed.scss';

const Feed = () => {
  const { playMedia } = useContext(PlayerContext);
  const [animate, setAnimate] = useState(false);
  const [userId, setUserId] = useState(null);
  const [jurisdictionId, setJurisdictionId] = useState(null);  // Start null, no fallback yet
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [trendingMedia, setTrendingMedia] = useState([]);
  const [newMedia, setNewMedia] = useState([]);
  const [awards, setAwards] = useState([]);
  const [popularArtists, setPopularArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Helper to build URLs (absolute as-is, relative prepend base)
  const buildUrl = (url) => {
    if (!url) return null;  // No fallback here—handle in render
    return url.startsWith('http://') || url.startsWith('https://') 
      ? url  // Absolute (R2/prod)—use as-is
      : `${API_BASE_URL}${url}`;  // Relative (local)—prepend base
  };

  const formatDuration = (ms) => {
    if (!ms) return '';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = String(totalSec % 60).padStart(2, '0');
    return `${min}:${sec}`;
  };

  useEffect(() => {
    setAnimate(true);
    fetchProfile();
  }, []);

  // Step 1: Fetch profile and set jurisdiction (blocks until done)
  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      // Get userId from token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      const uid = payload.userId;
      setUserId(uid);

      // Fetch user profile
      const profileRes = await apiCall({ method: 'get', url: `/v1/users/profile/${uid}` });
      const { jurisdiction } = profileRes.data;
      const jurId = jurisdiction?.jurisdictionId;
      setJurisdictionId(jurId || '00000000-0000-0000-0000-000000000002');  // Safe fallback
      setProfileLoaded(true);
    } catch (err) {
      console.error('Profile load error:', err);
      setError('Profile unavailable—using default feed.');
      setJurisdictionId('00000000-0000-0000-0000-000000000002');  // Fallback
      setProfileLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Fetch media once profile/jurisdiction is ready
  useEffect(() => {
    if (!profileLoaded || !userId || !jurisdictionId) return;
    fetchMediaData();
  }, [userId, jurisdictionId, profileLoaded]);

  const fetchMediaData = async () => {
    setLoading(true);
    setError('');
    try {
      // Parallel fetches with correct jurisdictionId
      const [trendingRes, newRes, songAwardsRes, artistAwardsRes, popularRes] = await Promise.all([
        apiCall({ method: 'get', url: `/v1/media/trending?jurisdictionId=${jurisdictionId}&limit=5` }),
        apiCall({ method: 'get', url: `/v1/media/new?jurisdictionId=${jurisdictionId}&limit=5` }),
        apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=song&jurisdictionId=${jurisdictionId}` }),
        apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=artist&jurisdictionId=${jurisdictionId}` }),
        apiCall({ method: 'get', url: `/v1/users/artist/top?jurisdictionId=${jurisdictionId}&limit=5` })
      ]);

      // Normalize the data (null-safe)
      const normalizeMedia = (items) => (items || []).map(item => {
        const normalized = {
          id: item.songId || item.videoId,
          title: item.title,
          artist: item.artist?.username || 'Unknown',  // Safe
          artistData: item.artist || { userId: 'unknown', username: 'Unknown' },  // Safe object
          artworkUrl: buildUrl(item.artworkUrl),  // ← Use helper
          mediaUrl: buildUrl(item.fileUrl),  // ← Use helper
          url: buildUrl(item.fileUrl),  // ← Use helper
          artwork: buildUrl(item.artworkUrl),  // ← Use helper
          type: item.songId ? 'song' : 'video',
          score: item.score || 0,
          artistId: item.artist?.userId || 'unknown',
          duration: item.duration || null
        };
        console.log('Normalized item:', normalized);
        return normalized;
      });

      setTrendingMedia(normalizeMedia(trendingRes.data || []));
      setNewMedia(normalizeMedia(newRes.data || []));
      
      // Combine song and artist awards, first five
      const combinedAwards = [...(songAwardsRes.data || []), ...(artistAwardsRes.data || [])].slice(0, 5);
      setAwards(combinedAwards);

      // Normalize artists (for photoUrl)
      const normalizedArtists = (popularRes.data || []).map(artist => ({
        ...artist,
        photoUrl: buildUrl(artist.photoUrl)  // ← Use helper
      }));
      setPopularArtists(normalizedArtists);
    } catch (err) {
      console.error('Media load error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setError('Feed unavailable—showing demo content.');
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  const handleSongNav = (mediaId, type = 'song') => navigate(`/${type}/${mediaId}`);
  const handleArtistNav = (artistId) => navigate(`/artist/${artistId}`);

  // Play handler (immediate, uses data—no refetch)
  const handlePlayMedia = async (e, media) => {
    e.stopPropagation();
    
    let playMediaObj = media;
    if (media.type === 'artist') {
      // Fetch default song
      try {
        const defaultRes = await apiCall({ method: 'get', url: `/v1/users/${media.artistData.userId}/default-song` });
        playMediaObj = {
          type: 'song',
          id: defaultRes.data.songId,  // Add ID for tracking
          url: buildUrl(defaultRes.data.fileUrl) || song1,  // ← Use helper
          title: defaultRes.data.title || 'Default Track',
          artist: media.name,
          artwork: buildUrl(defaultRes.data.artworkUrl) || media.imageUrl,  // ← Use helper
        };
      } catch (err) {
        console.error('Default song fetch error:', err);
        playMediaObj = { type: 'song', id: 'default-fallback', url: song1, title: 'Default Track', artist: media.name, artwork: media.imageUrl };
      }
    }

    // Track play
    try {
      const endpoint = playMediaObj.type === 'song' 
        ? `/v1/media/song/${playMediaObj.id}/play?userId=${userId}`
        : `/v1/media/video/${playMediaObj.id}/play?userId=${userId}`;
      await apiCall({ method: 'post', url: endpoint });
      console.log('Play tracked successfully');
    } catch (err) {
      console.error('Failed to track play:', err);
    }
    
    // Play
    const playlist = [playMediaObj, ...newMedia.slice(0, 2).filter(m => m.id !== playMediaObj.id)];
    playMedia(playMediaObj, playlist);
  };

  // Dummies (env fallback or error—limit to 5); align with normalized structure
  const getDummyTrending = () => [
    { id: 'dummy1', title: 'Tony Fadd - Paranoid', artistData: { userId: '1', username: 'Tony Fadd' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 100 },
    { id: 'dummy2', title: 'SD Boomin - Waited All Night', artistData: { userId: '2', username: 'SD Boomin' }, artworkUrl: songArtTwo, mediaUrl: song2, type: 'song', score: 80 },
    { id: 'dummy3', title: 'Bad Video', artistData: { userId: '3', username: 'some guy' }, artworkUrl: songArtThree, mediaUrl: video1, type: 'video', score: 60 },
    { id: 'dummy4', title: 'Song 4', artistData: { userId: '4', username: 'Artist 4' }, artworkUrl: songArtFour, mediaUrl: song1, type: 'song', score: 50 },
    { id: 'dummy5', title: 'Song 5', artistData: { userId: '5', username: 'Artist 5' }, artworkUrl: songArtFive, mediaUrl: song2, type: 'song', score: 40 }
  ].slice(0, 5);
  const getDummyNew = () => [
    { id: 'dummy6', title: 'The Outside', artistData: { userId: '6', username: 'Artist Six' }, artworkUrl: songArtSix, mediaUrl: song1, type: 'song', score: 30 },
    { id: 'dummy7', title: 'Original Man', artistData: { userId: '7', username: 'Artist Seven' }, artworkUrl: songArtNine, mediaUrl: song2, type: 'song', score: 25 },
    { id: 'dummy8', title: 'flavorfall', artistData: { userId: '8', username: 'Artist Eight' }, artworkUrl: songArtTen, mediaUrl: song1, type: 'song', score: 20 },
    { id: 'dummy9', title: 'Golden Son', artistData: { userId: '9', username: 'Artist Nine' }, artworkUrl: songArtEleven, mediaUrl: song2, type: 'song', score: 15 },
    { id: 'dummy10', title: 'New Track', artistData: { userId: '10', username: 'Artist Ten' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 10 }
  ].slice(0, 5);
  const getDummyAwards = () => [
    { id: 'a1', name: 'Best Rap Song', winner: { id: 'w1', username: 'Tony Fadd' } },
    { id: 'a2', name: 'Top Video', winner: { id: 'w2', username: 'SD Boomin' } },
    { id: 'a3', name: 'Rising Artist', winner: { id: 'w3', username: 'Artist Three' } },
    { id: 'a4', name: 'Fan Favorite', winner: { id: 'w4', username: 'Artist Four' } },
    { id: 'a5', name: 'Breakthrough Track', winner: { id: 'w5', username: 'Artist Five' } }
  ].slice(0, 5);
  const getDummyArtists = () => [
    { userId: 'art1', username: 'Tony Fadd', photoUrl: songArtOne, score: 100 },
    { userId: 'art2', username: 'SD Boomin', photoUrl: songArtTwo, score: 80 },
    { userId: 'art3', username: 'Artist Three', photoUrl: songArtThree, score: 60 },
    { userId: 'art4', username: 'Artist Four', photoUrl: songArtFour, score: 50 },
    { userId: 'art5', username: 'Artist Five', photoUrl: songArtFive, score: 40 }
  ].slice(0, 5);

  // Data with fallbacks (limit 5); dedupe new if real data
  const trending = trendingMedia.length ? trendingMedia.slice(0, 5) : getDummyTrending();
  
  const newMediaList = newMedia.length 
  ? newMedia.slice(0, 5)  // No filter—full slice
  : getDummyNew();


  const awardsList = awards.length ? awards.slice(0, 5) : getDummyAwards();
  const artistsList = popularArtists.length ? popularArtists.slice(0, 5) : getDummyArtists();

  // Dynamic jurisdiction name (e.g., 'downtown-harlem' → 'Downtown Harlem')
  const getJurisdictionDisplayName = (id) => {
    const key = JURISDICTION_NAMES[id];
    if (!key) return 'Your Area';
    return key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) return <div className="loading-feed" style={{ textAlign: 'center', padding: '50px' }}>Loading your feed...</div>;

  return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-content-wrapper">
        {error && <div className="feed-error" style={{ color: 'orange', padding: '10px', textAlign: 'center' }}>{error}</div>}
        <main className="feed">
          {/* Trending Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>Trending in {getJurisdictionDisplayName(jurisdictionId)}</h2>
            <div className="carousel-items">
              {trending.map((item) => (
                <div key={item.id} className="item-wrapper">
                  <div 
                    className="item" 
                    style={{ backgroundImage: `url(${item.artworkUrl || item.artwork || randomRapper})`, backgroundSize: 'cover' }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                  </div>
                  <div className="item-title" onClick={() => handleSongNav(item.id, item.type)}>
                    {item.title}
                  </div>
                  <span 
                    className="item-artist" 
                    onClick={() => handleArtistNav(item.artistData?.userId || item.artist?.userId || 'unknown')}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.artistData?.username || item.artist || 'Unknown'}
                  </span>
                  <div className="item-duration">
                    {formatDuration(item.duration)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* New Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>New Releases</h2>
            <div className="carousel-items">
              {newMediaList.map((item) => (
                <div key={item.id} className="item-wrapper">
                  <div 
                    className="item" 
                    style={{ backgroundImage: `url(${item.artworkUrl || item.artwork || randomRapper})`, backgroundSize: 'cover' }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                  </div>
                  <div className="item-title" onClick={() => handleSongNav(item.id, item.type)}>
                    {item.title}
                  </div>
                  <span 
                    className="item-artist" 
                    onClick={() => handleArtistNav(item.artistData?.userId || item.artist?.userId || 'unknown')}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.artistData?.username || item.artist || 'Unknown'}
                  </span>
                  <div className="item-duration">
                    {formatDuration(item.duration)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Popular (Artists) */}
          <section className={`feed-section list ${animate ? "animate" : ""}`}>
            <h2>Popular Artists</h2>
            <ol>
              {artistsList.map((artist) => (
                <li key={artist.userId} onClick={() => handleArtistNav(artist.userId)} style={{ cursor: 'pointer' }}>
                  {artist.username}
                  {artist.photoUrl && <img src={artist.photoUrl} alt={artist.username} style={{ width: '24px', height: '24px', borderRadius: '50%', marginLeft: '8px' }} />}
                  <small style={{ color: '#666' }}> (Score: {artist.score})</small>
                </li>
              ))}
            </ol>
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default Feed;