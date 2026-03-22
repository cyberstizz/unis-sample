import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Heart, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './jurisdictionPage.scss';
import Layout from './layout';
import prominentArtistBg from './assets/songartworkfour.jpeg';
import albumArt from './assets/songartworktwo.jpeg';
import { buildUrl } from './utils/buildUrl';

// Inline play icon — same guaranteed-visibility approach as Player/Feed
const PlayIcon = ({ size = 14 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ width: size, height: size, display: 'block', fill: '#FFFFFF', flexShrink: 0 }}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const JurisdictionPage = ({ jurisdiction = 'Harlem' }) => {
  const { jurisdiction: jurNameFromParams } = useParams();
  const jurName = jurNameFromParams || jurisdiction;
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [anthemScrollIndex, setAnthemScrollIndex] = useState(0);

  // Get userId from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
      } catch (err) {
        console.error('Failed to get userId from token:', err);
      }
    }
  }, []);

  // Fetch jurisdiction data — identical logic to original
  useEffect(() => {
    const fetchData = async () => {
      if (!jurName) {
        setError('No jurisdiction specified.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        const jurResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/byName/${encodeURIComponent(jurName)}`,
        });
        const firstResult = jurResponse.data?.[0];
        if (!firstResult) throw new Error('Jurisdiction not found');
        const jurId = firstResult.jurisdictionId;
        const jurDetails = firstResult;
        if (!jurId) throw new Error('Jurisdiction not found');

        const topsResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurId}/tops`,
        });
        const rawData = { ...topsResponse.data, jurisdiction: jurDetails };

        const topArtist = rawData.topArtist || (rawData.topArtists || [])[0];
        const topSong = rawData.topSong || (rawData.topSongs || [])[0];

        const normalized = {
          description: rawData.jurisdiction.bio || `The heartbeat of ${jurName}. Where local artists define the sound of the streets.`,

          artistOfMonth: topArtist ? {
            id: topArtist.userId,
            name: topArtist.username,
            image: buildUrl(topArtist.photoUrl) || prominentArtistBg,
            bio: topArtist.bio || 'Rising star in the community.',
            supporters: topArtist.score || 0,
            plays: topArtist.score || 0,
          } : null,

          songOfWeek: topSong ? {
            id: topSong.songId,
            title: topSong.title,
            artist: topSong.artist?.username || 'Unknown',
            artistId: topSong.artist?.userId,
            plays: topSong.plays || topSong.score || 0,
            likes: topSong.likes || 0,
            image: buildUrl(topSong.artworkUrl) || albumArt,
            fileUrl: buildUrl(topSong.fileUrl),
          } : null,

          topArtists: (rawData.topArtists || []).map((artist, i) => ({
            id: artist.userId,
            rank: i + 1,
            name: artist.username,
            genre: artist.genre?.name || '',
            supporters: artist.score || 0,
            plays: artist.score || 0,
            thumbnail: buildUrl(artist.photoUrl) || prominentArtistBg,
          })),

          topSongs: (rawData.topSongs || []).map((song, i) => ({
            id: song.songId,
            rank: i + 1,
            title: song.title,
            artist: song.artist?.username || 'Unknown',
            artistId: song.artist?.userId,
            plays: song.plays || song.score || 0,
            likes: song.likes || 0,
            thumbnail: buildUrl(song.artworkUrl) || prominentArtistBg,
            fileUrl: buildUrl(song.fileUrl),
          })),
        };

        setData(normalized);
      } catch (err) {
        console.error('Jurisdiction fetch error:', err);
        setError(`Failed to load data for ${jurName}.`);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jurName]);

  // ═══════════════════════════════════════
  // PLAY HANDLERS — identical to original
  // ═══════════════════════════════════════

  const handlePlayTopArtist = async () => {
    if (!data?.artistOfMonth) return;
    try {
      const response = await apiCall({ method: 'get', url: `/v1/users/${data.artistOfMonth.id}/default-song` });
      const defaultSong = response.data;
      if (defaultSong?.fileUrl) {
        playMedia(
          { type: 'song', url: buildUrl(defaultSong.fileUrl), title: defaultSong.title, artist: data.artistOfMonth.name, artwork: buildUrl(defaultSong.artworkUrl) || data.artistOfMonth.image },
          []
        );
        if (defaultSong.songId && userId) {
          await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` }).catch(() => {});
        }
      } else {
        alert('No default song available for this artist');
      }
    } catch { alert("Could not load artist's song"); }
  };

  const handlePlayTopSong = async () => {
    if (!data?.songOfWeek?.fileUrl) { alert('Song not available'); return; }
    playMedia(
      { type: 'song', url: data.songOfWeek.fileUrl, title: data.songOfWeek.title, artist: data.songOfWeek.artist, artwork: data.songOfWeek.image },
      []
    );
    if (data.songOfWeek.id && userId) {
      await apiCall({ method: 'post', url: `/v1/media/song/${data.songOfWeek.id}/play?userId=${userId}` }).catch(() => {});
    }
  };

  const handlePlayArtist = async (artist) => {
    try {
      const response = await apiCall({ method: 'get', url: `/v1/users/${artist.id}/default-song` });
      const defaultSong = response.data;
      if (defaultSong?.fileUrl) {
        playMedia(
          { type: 'song', url: buildUrl(defaultSong.fileUrl), title: defaultSong.title, artist: artist.name, artwork: buildUrl(defaultSong.artworkUrl) || artist.thumbnail },
          []
        );
        if (defaultSong.songId && userId) {
          await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` }).catch(() => {});
        }
      } else {
        alert(`${artist.name} has no default song`);
      }
    } catch { alert("Could not load artist's song"); }
  };

  const handlePlaySong = async (song) => {
    if (!song.fileUrl) { alert('Song not available'); return; }
    playMedia(
      { type: 'song', url: song.fileUrl, title: song.title, artist: song.artist, artwork: song.thumbnail },
      []
    );
    if (song.id && userId) {
      await apiCall({ method: 'post', url: `/v1/media/song/${song.id}/play?userId=${userId}` }).catch(() => {});
    }
  };

  const handleViewArtist = (artistId) => navigate(`/artist/${artistId}`);
  const handleViewSong = (songId) => navigate(`/song/${songId}`);

  // Anthem carousel navigation
  const anthemNext = () => {
    if (data?.topSongs) {
      setAnthemScrollIndex(prev => Math.min(prev + 1, Math.max(0, data.topSongs.length - 3)));
    }
  };
  const anthemPrev = () => setAnthemScrollIndex(prev => Math.max(0, prev - 1));

  // ═══════════════════════════════════════
  // RENDER — Loading & Error
  // ═══════════════════════════════════════

  if (loading) {
    return (
      <Layout backgroundImage={prominentArtistBg}>
        <div className="jp-loading">Loading {jurName}...</div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout backgroundImage={prominentArtistBg}>
        <div className="jp-error">{error || `No data available for ${jurName}`}</div>
      </Layout>
    );
  }

  // Split jurisdiction name for styling (e.g., "Downtown" + "Harlem")
  const nameParts = jurName.split(' ');
  const firstWord = nameParts.slice(0, -1).join(' ') || '';
  const lastWord = nameParts[nameParts.length - 1] || jurName;

  return (
    <Layout backgroundImage={data.artistOfMonth?.image || prominentArtistBg}>
      <div className="jp">

        {/* ═══════ HERO ═══════ */}
        <header className="jp-hero">
          <span className="jp-hero-label">Current Jurisdiction</span>
          <h1 className="jp-hero-name">
            {firstWord && <span className="jp-name-first">{firstWord}</span>}
            <span className="jp-name-accent">{lastWord}</span>
          </h1>
          <p className="jp-hero-desc">{data.description}</p>

          <div className="jp-hero-stats">
            {/* <div className="jp-stat-card">
              <span className="jp-stat-label">Top Artists</span>
              <span className="jp-stat-value">{data.topArtists.length}</span>
            </div>
            <div className="jp-stat-card">
              <span className="jp-stat-label">Top Songs</span>
              <span className="jp-stat-value">{data.topSongs.length}</span>
            </div> */}
          </div>
        </header>

        {/* ═══════ SEARCH BAR ═══════ */}
        <div className="jp-search">
          <svg viewBox="0 0 24 24" width="16" height="16" style={{ width: 16, height: 16, display: 'block', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <span className="jp-search-text">Search artists...</span>
        </div>

        {/* ═══════ TWO-COLUMN: Top Artists + Local Anthems ═══════ */}
        <div className="jp-main-grid">

          {/* LEFT: Top Artists List */}
          <section className="jp-artists-section">
            <div className="jp-section-header">
              <h2 className="jp-section-title">
                <span className="jp-title-italic">Top {data.topArtists.length}</span>{' '}
                <span className="jp-title-caps">Artists</span>
              </h2>
              <span className="jp-view-all" onClick={() => navigate('/findpage')}>View All</span>
            </div>

            <div className="jp-artist-list">
              {data.topArtists.length > 0 ? (
                data.topArtists.map((artist) => (
                  <div
                    key={artist.id}
                    className="jp-artist-row"
                    onClick={() => handleViewArtist(artist.id)}
                  >
                    <div className="jp-ambient-bg" style={{ backgroundImage: `url(${artist.thumbnail})` }} />
                    <span className="jp-artist-rank">
                      {String(artist.rank).padStart(2, '0')}
                    </span>
                    <img
                      src={artist.thumbnail}
                      alt={artist.name}
                      className="jp-artist-photo"
                    />
                    <div className="jp-artist-info">
                      <span className="jp-artist-name">{artist.name}</span>
                      {artist.genre && (
                        <span className="jp-artist-genre">{artist.genre}</span>
                      )}
                    </div>
                    <button
                      className="jp-artist-play"
                      onClick={(e) => { e.stopPropagation(); handlePlayArtist(artist); }}
                      title="Play"
                    >
                      <PlayIcon size={12} />
                    </button>
                    <ChevronRight size={16} className="jp-artist-arrow" />
                  </div>
                ))
              ) : (
                <p className="jp-empty">No artists yet in {jurName}</p>
              )}
            </div>
          </section>

          {/* RIGHT: Local Anthems (Top Songs as cards) */}
          <section className="jp-anthems-section">
            <div className="jp-section-header">
              <h2 className="jp-section-title">
                <span className="jp-title-italic">Local</span>{' '}
                <span className="jp-title-caps">Anthems</span>
              </h2>
              <div className="jp-anthem-nav">
                <button onClick={anthemPrev} disabled={anthemScrollIndex === 0}>
                  <ChevronLeft size={18} />
                </button>
                <button onClick={anthemNext} disabled={!data.topSongs.length || anthemScrollIndex >= data.topSongs.length - 3}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Featured #1 Song — large card */}
            {data.songOfWeek && (
              <div
                className="jp-anthem-hero"
                style={{ backgroundImage: `url(${data.songOfWeek.image})` }}
                onClick={() => handleViewSong(data.songOfWeek.id)}
              >
                <div className="jp-anthem-hero-overlay">
                  <span className="jp-anthem-badge">#1 This Week</span>
                  <h3 className="jp-anthem-hero-title">{data.songOfWeek.title}</h3>
                  <p className="jp-anthem-hero-artist">
                    {data.songOfWeek.artist}
                  </p>
                  <div className="jp-anthem-hero-actions">
                    <button
                      className="jp-listen-btn"
                      onClick={(e) => { e.stopPropagation(); handlePlayTopSong(); }}
                    >
                      <PlayIcon size={14} /> Listen Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Remaining songs — smaller row cards */}
            <div className="jp-anthem-list">
              {data.topSongs.slice(1).map((song) => (
                <div
                  key={song.id}
                  className="jp-anthem-row"
                  onClick={() => handleViewSong(song.id)}
                >
                  <div className="jp-ambient-bg" style={{ backgroundImage: `url(${song.thumbnail})` }} />
                  <img src={song.thumbnail} alt={song.title} className="jp-anthem-thumb" />
                  <div className="jp-anthem-info">
                    <span className="jp-anthem-rank">#{song.rank}</span>
                    <span className="jp-anthem-title">{song.title}</span>
                    <span className="jp-anthem-artist">{song.artist}</span>
                    <span className="jp-anthem-stat">
                      <Eye size={11} /> {song.plays.toLocaleString()}
                    </span>
                  </div>
                  <button
                    className="jp-anthem-play"
                    onClick={(e) => { e.stopPropagation(); handlePlaySong(song); }}
                  >
                    <PlayIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ═══════ EDITORIAL SECTION ═══════ */}
        <section className="jp-editorial">
          <h2 className="jp-editorial-title">
            <span className="jp-title-italic">Discover the</span><br />
            <span className="jp-title-italic">Rhythm of </span>
            <span className="jp-editorial-accent">Your</span><br />
            <span className="jp-title-italic">Streets</span>
          </h2>
          <p className="jp-editorial-body">
            UNIS Jurisdictions use localized streaming data to show you exactly
            what's trending in your neighborhood. No global algorithms, just the
            heartbeat of {jurName}.
          </p>
          <div className="jp-editorial-stats">
            <div className="jp-editorial-stat">
              <span className="jp-editorial-stat-label">Local Artists</span>
              <span className="jp-editorial-stat-value">{data.topArtists.length}</span>
            </div>
            <div className="jp-editorial-stat">
              <span className="jp-editorial-stat-label">Local Songs</span>
              <span className="jp-editorial-stat-value">{data.topSongs.length}</span>
            </div>
          </div>
        </section>

        {error && <div className="jp-error-banner">{error}</div>}
      </div>
    </Layout>
  );
};

export default JurisdictionPage;