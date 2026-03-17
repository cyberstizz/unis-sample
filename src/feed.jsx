import React, { useState, useContext, useEffect } from 'react';
import { PlayerContext } from './context/playercontext'; 
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import Layout from './layout';
import ArtistCard from './artistCard';
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
  const { user } = useAuth();
  const navigate = useNavigate();

  const [animate, setAnimate] = useState(false);
  const [trendingToday, setTrendingToday] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [newMedia, setNewMedia] = useState([]);
  const [awards, setAwards] = useState([]);
  const [popularArtists, setPopularArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Read directly from AuthContext — no JWT decode, no profile re-fetch
  const userId = user?.userId;
  const jurisdictionId = user?.jurisdiction?.jurisdictionId || '00000000-0000-0000-0000-000000000002';

  const buildUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const cleaned = url.trim();
    if (!cleaned) return '';

    // Fix private R2 URLs → rewrite to public CDN
    if (cleaned.includes('r2.cloudflarestorage.com')) {
      const uploadsIndex = cleaned.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        const path = cleaned.slice(uploadsIndex); // "/uploads/filename.mp3"
        return `https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev${path}`;
      }
    }

    // Already a full public URL
    if (cleaned.startsWith('http')) return cleaned;

    // Relative path → prepend API base
    return `${API_BASE_URL}${cleaned}`;
  };

  const formatDuration = (ms) => {
    if (!ms) return '';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = String(totalSec % 60).padStart(2, '0');
    return `${min}:${sec}`;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  };

  // Single useEffect — fires all 6 API calls in parallel on mount
  // No waterfall, no profile re-fetch, no JWT decode
  useEffect(() => {
    setAnimate(true);

    if (!userId || !jurisdictionId) return;

    const fetchMediaData = async () => {
      setLoading(true);
      setError('');
      try {
        const [trendingTodayRes, topRatedRes, newRes, songAwardsRes, artistAwardsRes, popularRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/media/trending/today?jurisdictionId=${jurisdictionId}&limit=10` }),
          apiCall({ method: 'get', url: `/v1/media/trending?jurisdictionId=${jurisdictionId}&limit=5` }),
          apiCall({ method: 'get', url: `/v1/media/new?jurisdictionId=${jurisdictionId}&limit=5` }),
          apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=song&jurisdictionId=${jurisdictionId}` }),
          apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=artist&jurisdictionId=${jurisdictionId}` }),
          apiCall({ method: 'get', url: `/v1/users/artist/top?jurisdictionId=${jurisdictionId}&limit=5` })
        ]);

        const normalizeMedia = (items) => (items || []).map(item => ({
          id: item.songId || item.videoId,
          title: item.title,
          artist: item.artist?.username || 'Unknown',
          artistData: item.artist || { userId: 'unknown', username: 'Unknown' },
          artworkUrl: buildUrl(item.artworkUrl),
          mediaUrl: buildUrl(item.fileUrl),
          url: buildUrl(item.fileUrl),
          artwork: buildUrl(item.artworkUrl),
          type: item.songId ? 'song' : 'video',
          score: item.score || 0,
          artistId: item.artist?.userId || 'unknown',
          duration: item.duration || null,
          createdAt: item.createdAt || null,
          explicit: item.explicit || false,
          playsToday: item.playsToday || 0,
          playCount: item.playCount || 0
        }));

        setTrendingToday(normalizeMedia(trendingTodayRes.data || []));
        setTopRated(normalizeMedia(topRatedRes.data || []));
        setNewMedia(normalizeMedia(newRes.data || []));
        
        const combinedAwards = [...(songAwardsRes.data || []), ...(artistAwardsRes.data || [])].slice(0, 5);
        setAwards(combinedAwards);

        const normalizedArtists = (popularRes.data || []).map(artist => {
          const photoProperty = artist.photoUrl 
            || artist.imageUrl 
            || artist.profilePhotoUrl 
            || artist.avatarUrl 
            || artist.pictureUrl
            || artist.photo
            || artist.profilePhoto
            || artist.avatar
            || artist.picture;
          
          return {
            ...artist,
            photoUrl: photoProperty ? buildUrl(photoProperty) : null
          };
        });

        setPopularArtists(normalizedArtists);
      } catch (err) {
        console.error('Media load error:', err);
        setError('Feed unavailable—showing demo content.');
      } finally {
        setLoading(false);
      }
    };

    fetchMediaData();
  }, [userId, jurisdictionId]);

  const handleSongNav = (mediaId, type = 'song') => navigate(`/${type}/${mediaId}`);
  const handleArtistNav = (artistId) => navigate(`/artist/${artistId}`);

  const handlePlayMedia = async (e, media) => {
    e.stopPropagation();
    
    let playMediaObj = media;
    if (media.type === 'artist') {
      try {
        const defaultRes = await apiCall({ method: 'get', url: `/v1/users/${media.artistData.userId}/default-song` });
        playMediaObj = {
          type: 'song',
          id: defaultRes.data.songId,
          url: buildUrl(defaultRes.data.fileUrl) || song1,
          title: defaultRes.data.title || 'Default Track',
          artist: media.artistData?.username || media.artist,
          artwork: buildUrl(defaultRes.data.artworkUrl) || media.artworkUrl, // ← was media.imageUrl
        };
      } catch (err) {
        console.error('Default song fetch error:', err);
        playMediaObj = { 
          type: 'song', 
          id: 'default-fallback', 
          url: song1, 
          title: 'Default Track', 
          artist: media.artistData?.username || media.artist,
          artwork: media.artworkUrl // ← was media.imageUrl
        };
      }
    }

    try {
      const endpoint = playMediaObj.type === 'song' 
        ? `/v1/media/song/${playMediaObj.id}/play?userId=${userId}`
        : `/v1/media/video/${playMediaObj.id}/play?userId=${userId}`;
      await apiCall({ method: 'post', url: endpoint });
    } catch (err) {
      console.error('Failed to track play:', err);
    }
    
    const playlist = [playMediaObj, ...newMedia.slice(0, 2).filter(m => m.id !== playMediaObj.id)];
    playMedia(playMediaObj, playlist);
  };


  // Dummies (keep for fallback)
  const getDummyTrending = () => [
    { id: 'dummy1', title: 'Tony Fadd - Paranoid', artistData: { userId: '1', username: 'Tony Fadd' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 100, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), duration: 180000, explicit: false, playsToday: 45 },
    { id: 'dummy2', title: 'SD Boomin - Waited All Night', artistData: { userId: '2', username: 'SD Boomin' }, artworkUrl: songArtTwo, mediaUrl: song2, type: 'song', score: 80, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), duration: 210000, explicit: true, playsToday: 32 },
    { id: 'dummy3', title: 'Bad Video', artistData: { userId: '3', username: 'some guy' }, artworkUrl: songArtThree, mediaUrl: video1, type: 'video', score: 60, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), duration: 120000, explicit: false, playsToday: 18 },
    { id: 'dummy4', title: 'Song 4', artistData: { userId: '4', username: 'Artist 4' }, artworkUrl: songArtFour, mediaUrl: song1, type: 'song', score: 50, createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), duration: 195000, explicit: true, playsToday: 12 },
    { id: 'dummy5', title: 'Song 5', artistData: { userId: '5', username: 'Artist 5' }, artworkUrl: songArtFive, mediaUrl: song2, type: 'song', score: 40, createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), duration: 240000, explicit: false, playsToday: 8 }
  ].slice(0, 10);

  const getDummyNew = () => [
    { id: 'dummy6', title: 'The Outside', artistData: { userId: '6', username: 'Artist Six' }, artworkUrl: songArtSix, mediaUrl: song1, type: 'song', score: 30, createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), duration: 155000, explicit: false },
    { id: 'dummy7', title: 'Original Man', artistData: { userId: '7', username: 'Artist Seven' }, artworkUrl: songArtNine, mediaUrl: song2, type: 'song', score: 25, createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), duration: 205000, explicit: true },
    { id: 'dummy8', title: 'flavorfall', artistData: { userId: '8', username: 'Artist Eight' }, artworkUrl: songArtTen, mediaUrl: song1, type: 'song', score: 20, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), duration: 175000, explicit: false },
    { id: 'dummy9', title: 'Golden Son', artistData: { userId: '9', username: 'Artist Nine' }, artworkUrl: songArtEleven, mediaUrl: song2, type: 'song', score: 15, createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), duration: 188000, explicit: false },
    { id: 'dummy10', title: 'New Track', artistData: { userId: '10', username: 'Artist Ten' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 10, createdAt: new Date().toISOString(), duration: 220000, explicit: true }
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

  const trendingTodayList = trendingToday.length ? trendingToday.slice(0, 10) : getDummyTrending();
  const topRatedList = topRated.length ? topRated.slice(0, 5) : getDummyTrending();
  const newMediaList = newMedia.length ? newMedia.slice(0, 5) : getDummyNew();
  const awardsList = awards.length ? awards.slice(0, 5) : getDummyAwards();
  const artistsList = popularArtists.length ? popularArtists.slice(0, 5) : getDummyArtists();

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
          {/* Trending Today Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>Trending Today</h2>
            <div className="carousel-items">
              {trendingTodayList.map((item) => (
                <div key={item.id} className="item-wrapper">
                  <div 
                    className="item" 
                    style={{ 
                      backgroundImage: `url(${item.artworkUrl ? encodeURI(item.artworkUrl) : item.artwork ? encodeURI(item.artwork) : randomRapper})`, 
                      backgroundSize: 'cover',
                      position: 'relative'
                    }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                      <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                    
                    {item.duration && (
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {formatDuration(item.duration)}
                      </div>
                    )}
                    
                    {item.explicit && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(255, 0, 0, 0.85)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        E
                      </div>
                    )}
                  </div>
                  
                  <div className="item-title" onClick={() => handleSongNav(item.id, item.type)}>
                    {item.title}
                  </div>
                  
                  <span 
                    className="item-artist" 
                    onClick={() => handleArtistNav(item.artistData?.userId || item.artist?.userId || 'unknown')}
                    style={{ cursor: 'pointer', display: 'block', fontSize: '0.85rem', color: '#aaa' }}
                  >
                    {item.artistData?.username || item.artist || 'Unknown'}
                  </span>
                  
                  <div className="time_ago" style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                    {formatTimeAgo(item.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* New Releases Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>New Releases</h2>
            <div className="carousel-items">
              {newMediaList.map((item) => (
                <div key={item.id} className="item-wrapper">
                  <div 
                    className="item" 
                    style={{ 
                      backgroundImage: `url(${item.artworkUrl ? encodeURI(item.artworkUrl) : item.artwork ? encodeURI(item.artwork) : randomRapper})`, 
                      backgroundSize: 'cover',
                      position: 'relative'
                    }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                    
                    {item.duration && (
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {formatDuration(item.duration)}
                      </div>
                    )}
                    
                    {item.explicit && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(255, 0, 0, 0.85)',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        E
                      </div>
                    )}
                  </div>
                  
                  <div className="item-title" onClick={() => handleSongNav(item.id, item.type)}>
                    {item.title}
                  </div>
                  
                  <span 
                    className="item-artist" 
                    onClick={() => handleArtistNav(item.artistData?.userId || item.artist?.userId || 'unknown')}
                    style={{ cursor: 'pointer', display: 'block', fontSize: '0.85rem', color: '#aaa' }}
                  >
                    {item.artistData?.username || item.artist || 'Unknown'}
                  </span>
                  
                  <div className="time_ago" style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                    {formatTimeAgo(item.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Popular Artists */}
          <section className={`feed-section artist-cards ${animate ? "animate" : ""}`}>
            <h2>Popular Artists</h2>
            <div className="artist-cards-grid">
              {(() => {
                const artistMap = new Map();
                const allMedia = [...trendingToday, ...topRated, ...newMedia];
                
                allMedia.forEach(media => {
                  if (media.artistData && !artistMap.has(media.artistData.userId)) {
                    artistMap.set(media.artistData.userId, {
                      userId: media.artistData.userId,
                      username: media.artistData.username,
                      photoUrl: encodeURI(media.artistData.photoUrl),
                      jurisdictionId: media.artistData.jurisdiction?.jurisdictionId,
                      jurisdictionName: getJurisdictionDisplayName(
                        media.artistData.jurisdiction?.jurisdictionId || jurisdictionId
                      ),
                      score: media.artistData.score || 0
                    });
                  }
                });
                
                const artists = Array.from(artistMap.values())
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5);
                
                return artists.map((artist, i) => (
                  <ArtistCard
                    key={artist.userId}
                    artist={artist}
                    index={i}
                    onPress={() => handleArtistNav(artist.userId)}
                    onViewPress={() => handleArtistNav(artist.userId)}
                  />
                ));
              })()}
            </div>
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default Feed;