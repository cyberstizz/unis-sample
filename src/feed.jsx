import React, { useState, useContext, useEffect, useCallback } from 'react';
import { PlayerContext } from './context/playercontext'; 
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';
import Layout from './layout';
import ArtistCard from './artistCard';
import AuthGateSheet, { useAuthGate, incrementGateSongCount } from './authGateSheet';
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
import LastWonNotification from './LastWonNotification';
import './feed.scss';

// ─── Inline-styled play icon ───
const CardPlayIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    style={{ width: 18, height: 18, display: 'block', marginLeft: 2 }}
  >
    <polygon points="5,3 19,12 5,21" style={{ fill: '#ffffff' }} />
  </svg>
);

// ─── Active jurisdictions (matches backend hardcoded list) ───
const ACTIVE_JURISDICTIONS = [
  { id: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem' },
  { id: '52740de0-e4e9-4c9e-b68e-1e170f6788c4', name: 'Uptown Harlem' },
  { id: '4b09eaa2-03bc-4778-b7c2-db8b42c9e732', name: 'Downtown Harlem' },
];

// Default jurisdiction for guests (Harlem — launch market)
const DEFAULT_JURISDICTION_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';

const Feed = () => {
  const { playMedia } = useContext(PlayerContext);
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const { triggerGate, gateProps } = useAuthGate();

  const [animate, setAnimate] = useState(false);
  const [trendingToday, setTrendingToday] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [newMedia, setNewMedia] = useState([]);
  const [awards, setAwards] = useState([]);
  const [popularArtists, setPopularArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userId = user?.userId;
  const userJurisdictionId = user?.jurisdiction?.jurisdictionId || DEFAULT_JURISDICTION_ID;

  // ─── Jurisdiction selector state ───
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState(userJurisdictionId);

  // Simulated ad impression — only for logged-in users (guest ad revenue goes to Unis)
  useEffect(() => {
    if (!userId) return;
    const trackAdView = async () => {
      try {
        await apiCall({ url: '/v1/earnings/track-view', method: 'post' });
      } catch (err) {
        // Silent
      }
    };
    trackAdView();
  }, [userId]);

  // Update selected jurisdiction when user data loads
  useEffect(() => {
    if (userJurisdictionId) {
      setSelectedJurisdictionId(userJurisdictionId);
    }
  }, [userJurisdictionId]);

  const selectedJurisdictionName = ACTIVE_JURISDICTIONS.find(
    (j) => j.id === selectedJurisdictionId
  )?.name || 'Your Area';

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

  const normalizeMedia = useCallback((items) => (items || []).map(item => ({
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
  })), []);

  // Fetch feed data — fires on mount AND when jurisdiction changes
  // No longer requires userId — guests get feed with default jurisdiction
  useEffect(() => {
    setAnimate(true);
    if (!selectedJurisdictionId) return;

    const fetchMediaData = async () => {
      setLoading(true);
      setError('');
      try {
        const jId = selectedJurisdictionId;

        const [trendingTodayRes, topRatedRes, newRes, songAwardsRes, artistAwardsRes, popularRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/media/trending/today?jurisdictionId=${jId}&limit=10` }),
          apiCall({ method: 'get', url: `/v1/media/trending?jurisdictionId=${jId}&limit=5` }),
          apiCall({ method: 'get', url: `/v1/media/new?jurisdictionId=${jId}&limit=5` }),
          apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=song&jurisdictionId=${jId}` }),
          apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=artist&jurisdictionId=${jId}` }),
          apiCall({ method: 'get', url: `/v1/users/artist/top?jurisdictionId=${jId}&limit=5` })
        ]);

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
  }, [selectedJurisdictionId, normalizeMedia]);

  const handleSongNav = (mediaId, type = 'song') => navigate(`/${type}/${mediaId}`);
  const handleArtistNav = (artistId) => navigate(`/artist/${artistId}`);

  const handlePlayMedia = async (e, media) => {
    e.stopPropagation();
    
    // Track guest listening for the AuthGateSheet nudge
    if (isGuest) {
      incrementGateSongCount();
    }

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
          artwork: buildUrl(defaultRes.data.artworkUrl) || media.artworkUrl,
        };
      } catch (err) {
        console.error('Default song fetch error:', err);
        playMediaObj = { 
          type: 'song', 
          id: 'default-fallback', 
          url: song1, 
          title: 'Default Track', 
          artist: media.artistData?.username || media.artist,
          artwork: media.artworkUrl
        };
      }
    }

    // Track play — backend play endpoint is public, handles missing userId gracefully
    try {
      const baseEndpoint = playMediaObj.type === 'song' 
        ? `/v1/media/song/${playMediaObj.id}/play`
        : `/v1/media/video/${playMediaObj.id}/play`;
      const endpoint = userId ? `${baseEndpoint}?userId=${userId}` : baseEndpoint;
      await apiCall({ method: 'post', url: endpoint });
    } catch (err) {
      console.error('Failed to track play:', err);
    }
    
    const playlist = [playMediaObj, ...newMedia.slice(0, 2).filter(m => m.id !== playMediaObj.id)];
    playMedia(playMediaObj, playlist);
  };

  const handleJurisdictionChange = (e) => {
    setSelectedJurisdictionId(e.target.value);
  };

  // Vote CTA — gates for guests
  const handleVoteClick = (e) => {
    e.stopPropagation();
    if (isGuest) {
      triggerGate('vote');
      return;
    }
    navigate('/voteawards');
  };

  // ─── Ghost jurisdiction dropdown component ───
  const JurisdictionSelect = () => (
    <span className="ghost-select-wrapper">
      <select
        className="ghost-select"
        value={selectedJurisdictionId}
        onChange={handleJurisdictionChange}
      >
        {ACTIVE_JURISDICTIONS.map((j) => (
          <option key={j.id} value={j.id}>{j.name}</option>
        ))}
      </select>
      <span className="ghost-select-label">{selectedJurisdictionName}</span>
      <span className="ghost-select-arrow">&#9662;</span>
    </span>
  );


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

  if (loading) return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-loading">
        <div className="feed-loading-spinner" />
        <span>Loading your feed...</span>
      </div>
    </Layout>
  );

  return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-content-wrapper">
        {error && <div className="feed-error">{error}</div>}
        <main className="feed">

          {/* ═══════ HERO BANNER ═══════ */}
          <div className="hero-banner" onClick={handleVoteClick}>
            <div className="hero-gradient" />
            <div className="hero-particles">
              <div className="hero-particle hero-particle--1" />
              <div className="hero-particle hero-particle--2" />
              <div className="hero-particle hero-particle--3" />
            </div>
            <div className="hero-content">
              <span className="hero-label">Featured in {selectedJurisdictionName}</span>
              <h1 className="hero-title">Vote for This Week's Top Track</h1>
              <p className="hero-subtitle">
                Your vote decides who tops the neighborhood leaderboard. Listen, discover, and support local artists.
              </p>
              <button className="hero-cta" onClick={handleVoteClick}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Vote Now
              </button>
            </div>
          </div>

          {/* ═══════ TRENDING TODAY ═══════ */}
          <section className={`feed-section ${animate ? 'animate' : ''}`}>
            <div className="section-header">
              <h2 className="section-title">
                Trending Today in <JurisdictionSelect />
              </h2>
              <span className="section-see-all" onClick={() => navigate('/findpage')}>Show all</span>
            </div>
            <div className="card-row">
              {trendingTodayList.map((item, index) => (
                <div 
                  key={item.id} 
                  className="song-card"
                  style={{ animationDelay: `${0.05 * (index + 1)}s` }}
                  onClick={() => handleSongNav(item.id, item.type)}
                >
                  <div className="card-artwork">
                    <img 
                      src={item.artworkUrl || item.artwork || randomRapper} 
                      alt={item.title}
                      onError={(e) => { e.target.src = randomRapper; }}
                    />
                    {item.duration && (
                      <span className="card-duration">{formatDuration(item.duration)}</span>
                    )}
                    {item.explicit && (
                      <span className="card-explicit">E</span>
                    )}
                    <button className="card-play" onClick={(e) => handlePlayMedia(e, item)}>
                      <CardPlayIcon />
                    </button>
                  </div>
                  <div className="card-info">
                    <div className="card-title">{item.title}</div>
                    <div 
                      className="card-artist"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArtistNav(item.artistData?.userId || item.artist?.userId || 'unknown');
                      }}
                    >
                      {item.artistData?.username || item.artist || 'Unknown'}
                    </div>
                    {item.createdAt && (
                      <div className="card-meta">{formatTimeAgo(item.createdAt)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════ NEW RELEASES ═══════ */}
          <section className={`feed-section ${animate ? 'animate' : ''}`}>
            <div className="section-header">
              <h2 className="section-title">
                New Releases
              </h2>
              <span className="section-see-all" onClick={() => navigate('/findpage')}>Show all</span>
            </div>
            <div className="card-row">
              {newMediaList.map((item, index) => (
                <div 
                  key={item.id} 
                  className="song-card"
                  style={{ animationDelay: `${0.05 * (index + 1)}s` }}
                  onClick={() => handleSongNav(item.id, item.type)}
                >
                  <div className="card-artwork">
                    <img 
                      src={item.artworkUrl || item.artwork || randomRapper} 
                      alt={item.title}
                      onError={(e) => { e.target.src = randomRapper; }}
                    />
                    {item.duration && (
                      <span className="card-duration">{formatDuration(item.duration)}</span>
                    )}
                    {item.explicit && (
                      <span className="card-explicit">E</span>
                    )}
                    <button className="card-play" onClick={(e) => handlePlayMedia(e, item)}>
                      <CardPlayIcon />
                    </button>
                  </div>
                  <div className="card-info">
                    <div className="card-title">{item.title}</div>
                    <div 
                      className="card-artist"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArtistNav(item.artistData?.userId || item.artist?.userId || 'unknown');
                      }}
                    >
                      {item.artistData?.username || item.artist || 'Unknown'}
                    </div>
                    {item.createdAt && (
                      <div className="card-meta">{formatTimeAgo(item.createdAt)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════ POPULAR ARTISTS ═══════ */}
          <section className={`feed-section artist-cards ${animate ? "animate" : ""}`}>
            <div className="section-header">
              <h2 className="section-title">
                Popular Artists 
              </h2>
            </div>
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
                        media.artistData.jurisdiction?.jurisdictionId || selectedJurisdictionId
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

      {/* Only show LastWonNotification for logged-in users */}
      {!isGuest && <LastWonNotification />}

      {/* Auth gate bottom sheet — triggered when guest taps Vote */}
      <AuthGateSheet {...gateProps} />
    </Layout>
  );
};

export default Feed;