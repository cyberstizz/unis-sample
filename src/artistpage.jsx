import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';

const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const { playMedia } = useContext(PlayerContext);
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Sticky header scroll detection
  const heroRef = useRef(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const handleScroll = useCallback(() => {
    if (!heroRef.current) return;
    const heroBottom = heroRef.current.getBoundingClientRect().bottom;
    setShowStickyHeader(heroBottom < 60);
  }, []);

  useEffect(() => {
    const scrollTarget = heroRef.current?.closest('.layout-content') || window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

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
      await apiCall({ method: 'put', url: `/v1/users/profile/${artistId}/bio`, data: { bio } });
      alert('Bio updated successfully');
    } catch (err) { alert('Failed to update bio'); }
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
        { type: 'song', url: fullUrl, title: defaultSong.title, artist: artist.username, artwork: buildUrl(defaultSong.artworkUrl) || buildUrl(artist.photoUrl) },
        []
      );
      if (defaultSong.songId && userId) {
        try {
          await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` });
        } catch (err) { console.error('Failed to track default song play:', err); }
      }
    } else {
      alert('No default song available for this artist');
    }
  };

  const handleSongClick = (songId) => navigate(`/song/${songId}`);

  if (loading) return (
    <Layout backgroundImage={theQuiet}>
      <div className="ap2-loading">Loading...</div>
    </Layout>
  );

  if (error || !artist) return (
    <Layout backgroundImage={theQuiet}>
      <div className="ap2-error">Artist not found</div>
    </Layout>
  );

  const artistPhoto = artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet;
  const topSong = songs.length > 0
    ? songs.reduce((prev, current) => (current.score || 0) > (prev.score || 0) ? current : prev, songs[0])
    : null;
  const topSongArtwork = topSong ? (buildUrl(topSong.artworkUrl) || artistPhoto) : artistPhoto;

  const isCurrentUser = userId === artistId;
  const showActionButtons = !isOwnProfile && !isCurrentUser;

  const fmt = (n) => (n || 0).toLocaleString();

  return (
    <Layout backgroundImage={artistPhoto}>
      {/* ===== STICKY HEADER ===== */}
      <div className={`ap2-sticky ${showStickyHeader ? 'ap2-sticky--visible' : ''}`}>
        <div className="ap2-sticky__inner">
          <div className="ap2-sticky__left">
            <img src={artistPhoto} alt={artist.username} className="ap2-sticky__avatar" />
            <span className="ap2-sticky__name">{artist.username}</span>
          </div>
          {showActionButtons && (
            <div className="ap2-sticky__actions">
              <button
                onClick={handleFollow}
                className={`ap2-sticky__btn ${isFollowing ? 'ap2-sticky__btn--following' : ''}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button onClick={handlePlayDefault} className="ap2-sticky__btn ap2-sticky__btn--play" disabled={!defaultSong}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                Play
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ap2-page">
        {/* ===== HERO — Full-bleed artist portrait ===== */}
        <section className="ap2-hero" ref={heroRef}>
          <div className="ap2-hero__backdrop">
            <img src={artistPhoto} alt="" className="ap2-hero__img" />
            <div className="ap2-hero__scrim" />
            <div className="ap2-hero__vignette" />
          </div>

          <div className="ap2-hero__content">
            <span
              className="ap2-hero__jurisdiction"
              onClick={() => navigate(`/jurisdiction/${artist.jurisdiction?.name}`)}
            >
              {artist.jurisdiction?.name || 'Unknown'}
            </span>

            <h1 className="ap2-hero__name">{artist.username}</h1>

            <div className="ap2-hero__meta">
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(artist.totalPlays)}</span>
                <span className="ap2-hero__stat-label">Plays</span>
              </div>
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(followerCount)}</span>
                <span className="ap2-hero__stat-label">Followers</span>
              </div>
            </div>

            {showActionButtons && (
              <div className="ap2-hero__actions">
                <button onClick={handlePlayDefault} className="ap2-hero__btn-play" disabled={!defaultSong}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                  Play Discography
                </button>
                <button onClick={handleFollow} className={`ap2-hero__btn-follow ${isFollowing ? 'ap2-hero__btn-follow--active' : ''}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button onClick={handleVote} className="ap2-hero__btn-vote">Vote</button>
              </div>
            )}
          </div>
        </section>

        {/* ===== CARD BODY — Ambient background from artwork ===== */}
        <div className="ap2-body">
          <div className="ap2-body__ambient">
            <img src={topSongArtwork} alt="" className="ap2-body__ambient-img" />
            <div className="ap2-body__ambient-overlay" />
          </div>

          <div className="ap2-body__content">
            {/* Row 1: Featured Song + Connect */}
            <div className="ap2-grid ap2-grid--featured">
              {topSong && (
                <div className="ap2-card ap2-featured">
                  <div className="ap2-featured__layout">
                    <div className="ap2-featured__artwork-wrap" onClick={() => handleSongClick(topSong.songId)}>
                      <img src={topSongArtwork} alt={topSong.title} className="ap2-featured__artwork" />
                      <button
                        className="ap2-featured__play-overlay"
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
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                      </button>
                    </div>
                    <div className="ap2-featured__info">
                      <span className="ap2-featured__badge">Fans Pick</span>
                      <h3 className="ap2-featured__title" onClick={() => handleSongClick(topSong.songId)}>
                        {topSong.title}
                      </h3>
                      <p className="ap2-featured__desc">
                        {fmt(topSong.plays)} plays · {fmt(topSong.score)} score
                      </p>
                      <div className="ap2-featured__genre">{artist.genre?.name || 'Unknown Genre'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="ap2-card ap2-connect">
                <h3 className="ap2-connect__title">Connect</h3>
                <div className="ap2-connect__links">
                  {artist.instagramUrl && (
                    <a href={artist.instagramUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                      <span className="ap2-connect__icon">📷</span>
                      <span className="ap2-connect__label">Instagram</span>
                      <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                    </a>
                  )}
                  {artist.twitterUrl && (
                    <a href={artist.twitterUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                      <span className="ap2-connect__icon">𝕏</span>
                      <span className="ap2-connect__label">Twitter</span>
                      <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                    </a>
                  )}
                  {artist.tiktokUrl && (
                    <a href={artist.tiktokUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                      <span className="ap2-connect__icon">🎵</span>
                      <span className="ap2-connect__label">TikTok</span>
                      <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                    </a>
                  )}
                  {!artist.instagramUrl && !artist.twitterUrl && !artist.tiktokUrl && (
                    <p className="ap2-empty">No social links yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Popular Songs + About */}
            <div className="ap2-grid ap2-grid--lower">
              <div className="ap2-card ap2-popular">
                <div className="ap2-popular__header">
                  <h3>Popular</h3>
                  {songs.length > 5 && <span className="ap2-popular__seeall">See all</span>}
                </div>
                <div className="ap2-popular__list">
                  {songs.slice(0, 5).map((song, idx) => (
                    <div key={song.songId} className="ap2-track">
                      <span className="ap2-track__num">{idx + 1}</span>
                      <img src={buildUrl(song.artworkUrl) || artistPhoto} alt={song.title} className="ap2-track__art" />
                      <div className="ap2-track__info">
                        <span className="ap2-track__title" onClick={() => handleSongClick(song.songId)}>
                          {song.title}
                        </span>
                        <span className="ap2-track__plays">{fmt(song.plays)} plays</span>
                      </div>
                      <button
                        className="ap2-track__play"
                        onClick={() => playMedia(
                          { type: 'song', url: buildUrl(song.fileUrl), title: song.title, artist: artist.username, artwork: buildUrl(song.artworkUrl) || artistPhoto },
                          []
                        )}
                        aria-label={`Play ${song.title}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                      </button>
                    </div>
                  ))}
                  {songs.length === 0 && <p className="ap2-empty">No songs yet</p>}
                </div>
              </div>

              <div className="ap2-card ap2-about">
                <h3 className="ap2-about__heading">About</h3>
                <div className="ap2-about__photo-wrap">
                  <img src={artistPhoto} alt="" className="ap2-about__photo" />
                  <div className="ap2-about__photo-fade" />
                  {!isOwnProfile && (
                    <p className="ap2-about__bio-overlay">{bio}</p>
                  )}
                </div>
                {isOwnProfile && (
                  <div className="ap2-about__edit">
                    <textarea value={bio} onChange={handleBioChange} className="ap2-about__textarea" placeholder="Tell fans about yourself..." />
                    <button onClick={handleSaveBio} className="ap2-about__save">Save Bio</button>
                  </div>
                )}
                <div className="ap2-about__badges">
                  <div className="ap2-about__badge">
                    <span className="ap2-about__badge-value">{fmt(artist.score)}</span>
                    <span className="ap2-about__badge-label">Score</span>
                  </div>
                  <div className="ap2-about__badge">
                    <span className="ap2-about__badge-value">{fmt(followerCount)}</span>
                    <span className="ap2-about__badge-label">Followers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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