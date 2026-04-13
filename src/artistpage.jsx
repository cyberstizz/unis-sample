import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';
import { Users, Heart, PlayCircle } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';

const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const { playMedia } = useContext(PlayerContext);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Derive userId directly from AuthContext — no token decode needed
  const userId = user?.userId;

  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [bio, setBio] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [defaultSong, setDefaultSong] = useState(null);

  // --- Sticky header scroll detection ---
  const heroRef = useRef(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const handleScroll = useCallback(() => {
    if (!heroRef.current) return;
    const heroBottom = heroRef.current.getBoundingClientRect().bottom;
    // Show sticky header once the hero's bottom edge scrolls above ~60px from viewport top
    setShowStickyHeader(heroBottom < 60);
  }, []);

  useEffect(() => {
    // Find the scrollable container — Layout may wrap content in a scrollable div.
    // We attach to the nearest scrollable ancestor or window.
    const scrollTarget = heroRef.current?.closest('.layout-content') || window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Single effect — fires all requests in parallel on mount.
  // Follow status check is included only when we have both IDs and it's not our own profile.
  useEffect(() => {
    if (!artistId) return;

    const fetchAll = async () => {
      setLoading(true);
      setError('');

      try {
        const isViewingOther = userId && userId !== artistId;

        const [
          artistRes,
          followerCountRes,
          songsRes,
          defaultSongRes,
          followStatusRes,
        ] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/users/profile/${artistId}` }),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/followers/count` }).catch(() => ({ data: { count: 0 } })),
          apiCall({ method: 'get', url: `/v1/media/songs/artist/${artistId}` }).catch(() => ({ data: [] })),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/default-song` }).catch(() => ({ data: null })),
          isViewingOther
            ? apiCall({ method: 'get', url: `/v1/users/${artistId}/is-following` }).catch(() => ({ data: { isFollowing: false } }))
            : Promise.resolve({ data: { isFollowing: false } }),
        ]);

        const artistData = artistRes.data;
        setArtist(artistData);
        setBio(artistData.bio || 'No bio available');
        setFollowerCount(followerCountRes.data.count || 0);
        setSongs(songsRes.data || []);
        setDefaultSong(defaultSongRes.data || null);
        setIsFollowing(followStatusRes.data.isFollowing || false);

      } catch (err) {
        console.error('Failed to load artist:', err);
        setError('Failed to load artist details');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [artistId, userId]);

  const handleFollow = async () => {
    const previousState = isFollowing;
    const previousCount = followerCount;

    setIsFollowing(!previousState);
    setFollowerCount(prev => (!previousState ? prev + 1 : prev - 1));

    try {
      if (!previousState) {
        await apiCall({ method: 'post', url: `/v1/users/${artistId}/follow` });
      } else {
        await apiCall({ method: 'delete', url: `/v1/users/${artistId}/follow` });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setIsFollowing(previousState);
      setFollowerCount(previousCount);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleBioChange = (e) => setBio(e.target.value);

  const handleSaveBio = async () => {
    try {
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${artistId}/bio`,
        data: { bio },
      });
      alert('Bio updated successfully');
    } catch (err) {
      alert('Failed to update bio');
    }
  };

  const handleVoteSuccess = () => setShowVotingWizard(false);

  const handleVote = () => {
    setSelectedNominee({
      id: artistId,
      name: artist.username,
      type: 'artist',
      jurisdiction: artist.jurisdiction,
    });
    setShowVotingWizard(true);
  };

  const handlePlayDefault = async () => {
    if (defaultSong?.fileUrl) {
      const fullUrl = buildUrl(defaultSong.fileUrl);
      playMedia(
        {
          type: 'song',
          url: fullUrl,
          title: defaultSong.title,
          artist: artist.username,
          artwork: buildUrl(defaultSong.artworkUrl) || buildUrl(artist.photoUrl),
        },
        []
      );
      if (defaultSong.songId && userId) {
        try {
          await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` });
        } catch (err) {
          console.error('Failed to track default song play:', err);
        }
      }
    } else {
      alert('No default song available for this artist');
    }
  };

  const handleSongClick = (songId) => navigate(`/song/${songId}`);

  if (loading) return (
    <Layout backgroundImage={theQuiet}>
      <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>Loading...</div>
    </Layout>
  );

  if (error || !artist) return (
    <Layout backgroundImage={theQuiet}>
      <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>Artist not found</div>
    </Layout>
  );

  const artistPhoto = artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet;
  const topSong = songs.length > 0
    ? songs.reduce((prev, current) => (current.score || 0) > (prev.score || 0) ? current : prev, songs[0])
    : null;

  const isCurrentUser = userId === artistId;
  const showActionButtons = !isOwnProfile && !isCurrentUser;

  return (
    <Layout backgroundImage={artistPhoto}>
      {/* ======= STICKY HEADER — appears after scrolling past hero ======= */}
      <div className={`artist-sticky-header ${showStickyHeader ? 'visible' : ''}`}>
        <div className="sticky-inner">
          <div className="sticky-left">
            <img src={artistPhoto} alt={artist.username} className="sticky-avatar" />
            <span className="sticky-name">{artist.username}</span>
          </div>
          {showActionButtons && (
            <div className="sticky-actions">
              <button
                onClick={handleFollow}
                className={`sticky-btn follow ${isFollowing ? 'following' : ''}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button onClick={handlePlayDefault} className="sticky-btn play" disabled={!defaultSong}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                Play
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="artist-page-v2">
        {/* ======= HERO SECTION ======= */}
        <section className="artist-hero" ref={heroRef}>
          {/* Background layers */}
          <div className="hero-backdrop">
            <img src={artistPhoto} alt="" className="hero-bg-img" />
            <div className="hero-gradient-bottom" />
            <div className="hero-gradient-side" />
            <div className="hero-noise" />
          </div>

          {/* Hero content */}
          <div className="hero-content">
            <div className="hero-profile-frame">
              <img src={artistPhoto} alt={artist.username} className="hero-profile-img" />
            </div>

            <h1 className="hero-artist-name">{artist.username}</h1>

            <p
              className="hero-jurisdiction"
              onClick={() => navigate(`/jurisdiction/${artist.jurisdiction.name}`)}
            >
              {artist.jurisdiction?.name || 'Unknown'}
            </p>

            <span className="hero-genre-tag">{artist.genre?.name || 'Unknown Genre'}</span>

            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-value">{followerCount}</span>
                <span className="stat-label">Followers</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">{artist.totalPlays || 0}</span>
                <span className="stat-label">Plays</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">{artist.score || 0}</span>
                <span className="stat-label">Score</span>
              </div>
            </div>

            {showActionButtons && (
              <div className="hero-actions">
                <button
                  onClick={handlePlayDefault}
                  className="action-play"
                  disabled={!defaultSong}
                  aria-label="Play default song"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                </button>
                <button
                  onClick={handleFollow}
                  className={`action-follow ${isFollowing ? 'following' : ''}`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button onClick={handleVote} className="action-vote">Vote</button>
              </div>
            )}
          </div>
        </section>

        {/* ======= CONTENT SECTIONS ======= */}
        <div className="artist-content">

          {/* --- Fans Pick --- */}
          {topSong && (
            <section className="ap-card fans-pick-card animate-in">
              <div className="ap-card-header">
                <h2>Fans Pick</h2>
                <span className="card-badge">Top Track</span>
              </div>
              <div
                className="fans-pick-feature"
                onClick={() => handleSongClick(topSong.songId)}
              >
                <div className="fp-artwork-wrap">
                  <img
                    src={buildUrl(topSong.artworkUrl) || artistPhoto}
                    alt={topSong.title}
                    className="fp-artwork"
                  />
                  <button
                    className="fp-play-overlay"
                    onClick={(e) => {
                      e.stopPropagation();
                      const song = songs.find(s => s.songId === topSong.songId);
                      if (song) playMedia(
                        { type: 'song', url: buildUrl(song.fileUrl), title: song.title, artist: artist.username, artwork: buildUrl(song.artworkUrl) || artistPhoto },
                        []
                      );
                    }}
                    aria-label="Play fans pick"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                  </button>
                </div>
                <div className="fp-info">
                  <h3 className="fp-title">{topSong.title}</h3>
                  <p className="fp-meta">{topSong.plays || 0} plays · {topSong.score || 0} score</p>
                </div>
              </div>
            </section>
          )}

          {/* --- Music / Discography --- */}
          <section className="ap-card music-card animate-in">
            <div className="ap-card-header">
              <h2>Music</h2>
              {songs.length > 5 && (
                <span className="card-show-all">Show all</span>
              )}
            </div>
            <div className="track-list">
              {songs.slice(0, 5).map((song, index) => (
                <div key={song.songId} className="track-row">
                  <span className="track-index">{index + 1}</span>
                  <img
                    src={buildUrl(song.artworkUrl) || artistPhoto}
                    alt={song.title}
                    className="track-artwork"
                  />
                  <div className="track-info">
                    <h4
                      className="track-title"
                      onClick={() => handleSongClick(song.songId)}
                    >
                      {song.title}
                    </h4>
                    <p className="track-plays">{song.plays || 0} plays</p>
                  </div>
                  <button
                    className="track-play-btn"
                    onClick={() => playMedia(
                      { type: 'song', url: buildUrl(song.fileUrl), title: song.title, artist: artist.username, artwork: buildUrl(song.artworkUrl) || artistPhoto },
                      []
                    )}
                    aria-label={`Play ${song.title}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                  </button>
                </div>
              ))}
              {songs.length === 0 && <p className="empty-message">No songs yet</p>}
            </div>
          </section>

          {/* --- Bio --- */}
          <section className="ap-card bio-card animate-in">
            <div className="ap-card-header">
              <h2>About</h2>
            </div>
            {isOwnProfile ? (
              <div className="bio-edit-wrap">
                <textarea value={bio} onChange={handleBioChange} className="bio-edit" placeholder="Tell fans about yourself..." />
                <button onClick={handleSaveBio} className="save-button">Save Bio</button>
              </div>
            ) : (
              <p className="bio-text">{bio}</p>
            )}
          </section>

          {/* --- Social --- */}
          <section className="ap-card social-card animate-in">
            <div className="ap-card-header">
              <h2>Connect</h2>
            </div>
            <div className="social-links">
              {artist.instagramUrl && (
                <a href={artist.instagramUrl} target="_blank" rel="noreferrer" className="social-link">
                  <span className="social-icon">📷</span>
                  <span>Instagram</span>
                </a>
              )}
              {artist.twitterUrl && (
                <a href={artist.twitterUrl} target="_blank" rel="noreferrer" className="social-link">
                  <span className="social-icon">𝕏</span>
                  <span>Twitter</span>
                </a>
              )}
              {artist.tiktokUrl && (
                <a href={artist.tiktokUrl} target="_blank" rel="noreferrer" className="social-link">
                  <span className="social-icon">🎵</span>
                  <span>TikTok</span>
                </a>
              )}
              {!artist.instagramUrl && !artist.twitterUrl && !artist.tiktokUrl && (
                <p className="empty-message">No social links available</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        userId={userId}
        filters={{
          selectedGenre: artist.genre?.name?.toLowerCase().replace('/', '-') || 'unknown',
          selectedType: 'artist',
          selectedInterval: 'daily',
          selectedJurisdiction: artist.jurisdiction?.name?.toLowerCase().replace(' ', '-') || 'unknown',
        }}
      />
    </Layout>
  );
};

export default ArtistPage;