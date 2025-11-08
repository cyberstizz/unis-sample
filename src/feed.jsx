// Feed.jsx
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
import './feed.scss';

const Feed = () => {
  const { playMedia } = useContext(PlayerContext);
  const [animate, setAnimate] = useState(false);
  const [userId, setUserId] = useState(null);
  const [jurisdictionId, setJurisdictionId] = useState('00000000-0000-0000-0000-000000000002');  // Default; update from profile
  const [trendingMedia, setTrendingMedia] = useState([]);  // {songId/videoId, title, artist: {userId, username}, artworkUrl, fileUrl, type: 'song'|'video', score}
  const [newMedia, setNewMedia] = useState([]);
  const [awards, setAwards] = useState([]);  // {id, name, winner: {id, username}}
  const [popularArtists, setPopularArtists] = useState([]);  // {userId, username, photoUrl?, score}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setAnimate(true);
    fetchFeedData();
  }, []);

  const fetchFeedData = async () => {
  setLoading(true);
  setError('');
  try {
    // 1. Get userId from token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    const uid = payload.userId;
    setUserId(uid);

    // 2. Fetch user profile with userId
    const profileRes = await apiCall({ method: 'get', url: `/v1/users/profile/${uid}` });
    const { jurisdiction } = profileRes.data;
    setJurisdictionId(jurisdiction.jurisdictionId);

    // 3. Parallel fetches
    const [trendingRes, newRes, songAwardsRes, artistAwardsRes, popularRes] = await Promise.all([
      apiCall({ method: 'get', url: `/v1/media/trending?jurisdictionId=${jurisdiction.jurisdictionId}&limit=5` }),
      apiCall({ method: 'get', url: `/v1/media/new?jurisdictionId=${jurisdiction.jurisdictionId}&limit=5` }),
      apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=song&jurisdictionId=${jurisdiction.jurisdictionId}` }),
      apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=artist&jurisdictionId=${jurisdiction.jurisdictionId}` }),
      apiCall({ method: 'get', url: `/v1/users/artist/top?jurisdictionId=${jurisdiction.jurisdictionId}&limit=5` })
    ]);

  //normalize the data
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const normalizeMedia = (items) => items.map(item => {
  const normalized = {
    id: item.songId || item.videoId,
    title: item.title,
    artist: { userId: item.artist.userId, username: item.artist.username },
    artworkUrl: item.artworkUrl ? `${API_BASE_URL}${item.artworkUrl}` : null,
    mediaUrl: item.fileUrl ? `${API_BASE_URL}${item.fileUrl}` : null,
    type: item.songId ? 'song' : 'video',
    score: item.score || 0
  };
  console.log('Normalized item:', normalized);
  return normalized;
});

    setTrendingMedia(normalizeMedia(trendingRes.data || []));
    setNewMedia(normalizeMedia(newRes.data || []));
    
    // Combine song and artist awards, first five
    const combinedAwards = [...(songAwardsRes.data || []), ...(artistAwardsRes.data || [])].slice(0, 5);
    setAwards(combinedAwards);
    
    setPopularArtists(popularRes.data || []);
  } catch (err) {
    console.error('Feed load error:', err);
    console.error('Error response:', err.response?.data);
    console.error('Error status:', err.response?.status);
    setError('Feed unavailable—showing demo content.');
  } finally {
    setLoading(false);
  }
};

  const navigate = useNavigate();

  // Nav handlers (uniform by ID)
  const handleSongNav = (mediaId, type = 'song') => navigate(`/${type}/${mediaId}`);
  const handleArtistNav = (artistId) => navigate(`/artist/${artistId}`);

  // Play handler (immediate, uses data—no refetch)
  const handlePlayMedia = (e, media) => {
    e.stopPropagation();
    const playlist = [media, ...newMedia.slice(0, 2).filter(m => m.id !== media.id)];  // Dynamic, dedup
    playMedia(media, playlist);  // {type, url: mediaUrl, title, artist, artwork: artworkUrl}
  };

  // Dummies (env fallback or error—limit to 5)
  const getDummyTrending = () => [
    { id: 'dummy1', title: 'Tony Fadd - Paranoid', artist: { userId: '1', username: 'Tony Fadd' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 100 },
    { id: 'dummy2', title: 'SD Boomin - Waited All Night', artist: { userId: '2', username: 'SD Boomin' }, artworkUrl: songArtTwo, mediaUrl: song2, type: 'song', score: 80 },
    { id: 'dummy3', title: 'Bad Video', artist: { userId: '3', username: 'some guy' }, artworkUrl: songArtThree, mediaUrl: video1, type: 'video', score: 60 },
    { id: 'dummy4', title: 'Song 4', artist: { userId: '4', username: 'Artist 4' }, artworkUrl: songArtFour, mediaUrl: song1, type: 'song', score: 50 },
    { id: 'dummy5', title: 'Song 5', artist: { userId: '5', username: 'Artist 5' }, artworkUrl: songArtFive, mediaUrl: song2, type: 'song', score: 40 }
  ].slice(0, 5);
  const getDummyNew = () => [
    { id: 'dummy6', title: 'The Outside', artist: { userId: '6', username: 'Artist Six' }, artworkUrl: songArtSix, mediaUrl: song1, type: 'song', score: 30 },
    { id: 'dummy7', title: 'Original Man', artist: { userId: '7', username: 'Artist Seven' }, artworkUrl: songArtNine, mediaUrl: song2, type: 'song', score: 25 },
    { id: 'dummy8', title: 'flavorfall', artist: { userId: '8', username: 'Artist Eight' }, artworkUrl: songArtTen, mediaUrl: song1, type: 'song', score: 20 },
    { id: 'dummy9', title: 'Golden Son', artist: { userId: '9', username: 'Artist Nine' }, artworkUrl: songArtEleven, mediaUrl: song2, type: 'song', score: 15 },
    { id: 'dummy10', title: 'New Track', artist: { userId: '10', username: 'Artist Ten' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 10 }
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

  // Data with fallbacks (limit 5)
  const trending = trendingMedia.length ? trendingMedia.slice(0, 5) : getDummyTrending();
  const newMediaList = newMedia.length ? newMedia.slice(0, 5) : getDummyNew();
  const awardsList = awards.length ? awards.slice(0, 5) : getDummyAwards();
  const artistsList = popularArtists.length ? popularArtists.slice(0, 5) : getDummyArtists();

  if (loading) return <div className="loading-feed" style={{ textAlign: 'center', padding: '50px' }}>Loading your feed...</div>;

  return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-content-wrapper">
        {error && <div className="feed-error" style={{ color: 'orange', padding: '10px', textAlign: 'center' }}>{error}</div>}
        <main className="feed">
          {/* Trending Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>Trending in {jurisdictionId === '00000000-0000-0000-0000-000000000002' ? 'Uptown Harlem' : 'Your Area'}</h2>
            <div className="carousel-items">
              {trending.map((item) => (
                <div key={item.id} className="item-wrapper">
                  <div 
                    className="item" 
                    style={{ backgroundImage: `url(${item.artworkUrl || '/default-art.jpg'})` }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                  </div>
                  <div className="item-title">{item.title} by {item.artist.username}</div>
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
                    style={{ backgroundImage: `url(${item.artworkUrl || '/default-art.jpg'})` }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                  </div>
                  <div className="item-title">{item.title} by {item.artist.username}</div>
                </div>
              ))}
            </div>
          </section>

          {/* REMOVED: My Home section */}

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

          {/* REMOVED: From Artists You Follow section */}
        </main>
      </div>
    </Layout>
  );
};

export default Feed;