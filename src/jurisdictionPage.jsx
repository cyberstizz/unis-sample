import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    style={{
      width: size,
      height: size,
      display: 'block',
      fill: '#FFFFFF',
      flexShrink: 0,
    }}
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
          description:
            rawData.jurisdiction.bio ||
            `The heartbeat of ${jurName}. Where local artists define the sound of the streets.`,

          artistOfMonth: topArtist
            ? {
                id: topArtist.userId,
                name: topArtist.username,
                image: buildUrl(topArtist.photoUrl) || prominentArtistBg,
                bio: topArtist.bio || 'Rising star in the community.',
                supporters: topArtist.score || 0,
                plays: topArtist.score || 0,
              }
            : null,

          songOfWeek: topSong
            ? {
                id: topSong.songId,
                title: topSong.title,
                artist: topSong.artist?.username || 'Unknown',
                artistId: topSong.artist?.userId,
                plays: topSong.plays || topSong.score || 0,
                likes: topSong.likes || 0,
                image: buildUrl(topSong.artworkUrl) || albumArt,
                fileUrl: buildUrl(topSong.fileUrl),
              }
            : null,

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
      const response = await apiCall({
        method: 'get',
        url: `/v1/users/${data.artistOfMonth.id}/default-song`,
      });

      const defaultSong = response.data;

      if (defaultSong?.fileUrl) {
        playMedia(
          {
            type: 'song',
            url: buildUrl(defaultSong.fileUrl),
            title: defaultSong.title,
            artist: data.artistOfMonth.name,
            artwork: buildUrl(defaultSong.artworkUrl) || data.artistOfMonth.image,
          },
          []
        );

        if (defaultSong.songId && userId) {
          await apiCall({
            method: 'post',
            url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}`,
          }).catch(() => {});
        }
      } else {
        alert('No default song available for this artist');
      }
    } catch {
      alert("Could not load artist's song");
    }
  };

  const handlePlayTopSong = async () => {
    if (!data?.songOfWeek?.fileUrl) {
      alert('Song not available');
      return;
    }

    playMedia(
      {
        type: 'song',
        url: data.songOfWeek.fileUrl,
        title: data.songOfWeek.title,
        artist: data.songOfWeek.artist,
        artwork: data.songOfWeek.image,
      },
      []
    );

    if (data.songOfWeek.id && userId) {
      await apiCall({
        method: 'post',
        url: `/v1/media/song/${data.songOfWeek.id}/play?userId=${userId}`,
      }).catch(() => {});
    }
  };

  const handlePlayArtist = async (artist) => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/users/${artist.id}/default-song`,
      });

      const defaultSong = response.data;

      if (defaultSong?.fileUrl) {
        playMedia(
          {
            type: 'song',
            url: buildUrl(defaultSong.fileUrl),
            title: defaultSong.title,
            artist: artist.name,
            artwork: buildUrl(defaultSong.artworkUrl) || artist.thumbnail,
          },
          []
        );

        if (defaultSong.songId && userId) {
          await apiCall({
            method: 'post',
            url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}`,
          }).catch(() => {});
        }
      } else {
        alert(`${artist.name} has no default song`);
      }
    } catch {
      alert("Could not load artist's song");
    }
  };

  const handlePlaySong = async (song) => {
    if (!song.fileUrl) {
      alert('Song not available');
      return;
    }

    playMedia(
      {
        type: 'song',
        url: song.fileUrl,
        title: song.title,
        artist: song.artist,
        artwork: song.thumbnail,
      },
      []
    );

    if (song.id && userId) {
      await apiCall({
        method: 'post',
        url: `/v1/media/song/${song.id}/play?userId=${userId}`,
      }).catch(() => {});
    }
  };

  const handleViewArtist = (artistId) => navigate(`/artist/${artistId}`);
  const handleViewSong = (songId) => navigate(`/song/${songId}`);

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

  return (
    <Layout backgroundImage={data.artistOfMonth?.image || prominentArtistBg}>
      <div className="jp jp-v4">
        {/* ═══════ DASHBOARD HERO ═══════ */}
        <section className="jp-dashboard-hero">
          <div className="jp-hero-content">
            <div className="jp-pills">
              <span>Harlem</span>
              <span>Neighborhood Tier</span>
              <span className="is-active">Live Charts</span>
              <span>Invite-Only</span>
            </div>

            <h1 className="jp-dashboard-title">{jurName}</h1>

            <p className="jp-dashboard-subtitle">{data.description}</p>

            <div className="jp-dashboard-stats">
              <div className="jp-dashboard-stat">
                <span>Top Artist</span>
                <strong>{data.artistOfMonth?.name || 'No artist yet'}</strong>
              </div>

              <div className="jp-dashboard-stat">
                <span>Top Track</span>
                <strong>{data.songOfWeek?.title || 'No track yet'}</strong>
              </div>

              <div className="jp-dashboard-stat">
                <span>Active Poll</span>
                <strong className="jp-live-text">Live</strong>
              </div>

              <div className="jp-dashboard-stat">
                <span>Total Artists</span>
                <strong>{data.topArtists.length}</strong>
              </div>
            </div>

            <div className="jp-hero-actions">
              <button
                type="button"
                className="jp-primary-action"
                onClick={() => navigate('/voteawards')}
              >
                Vote Now
              </button>

              <button
                type="button"
                className="jp-secondary-action"
                onClick={() => navigate('/findpage')}
              >
                Explore Tracks
              </button>
            </div>
          </div>

          {data.songOfWeek && (
            <article
              className="jp-featured-release"
              onClick={() => handleViewSong(data.songOfWeek.id)}
            >
              <img
                src={data.songOfWeek.image}
                alt={data.songOfWeek.title}
                className="jp-featured-art"
              />

              <div className="jp-featured-overlay">
                <span className="jp-featured-kicker">Featured Release</span>
                <h2>{data.songOfWeek.title}</h2>
                <p>{data.songOfWeek.artist}</p>

                <button
                  type="button"
                  className="jp-featured-listen"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayTopSong();
                  }}
                >
                  <PlayIcon size={13} />
                  Listen Now
                </button>
              </div>
            </article>
          )}
        </section>

        {/* ═══════ TRENDING TRACKS ═══════ */}
        <section className="jp-section jp-trending-strip">
          <div className="jp-section-heading">
            <div>
              <span className="jp-section-eyebrow">Now Moving</span>
              <h2>Trending in {jurName}</h2>
            </div>

            <button
              type="button"
              className="jp-text-action"
              onClick={() => navigate('/findpage')}
            >
              Show all
            </button>
          </div>

          <div className="jp-track-row">
            {data.topSongs.length > 0 ? (
              data.topSongs.slice(0, 6).map((song) => (
                <article
                  key={song.id}
                  className="jp-track-card"
                  onClick={() => handleViewSong(song.id)}
                >
                  <div className="jp-track-art-wrap">
                    <img src={song.thumbnail} alt={song.title} />
                    <span className="jp-rank-badge">#{song.rank}</span>

                    <button
                      type="button"
                      className="jp-floating-play"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySong(song);
                      }}
                    >
                      <PlayIcon size={14} />
                    </button>
                  </div>

                  <h3>{song.title}</h3>
                  <p>{song.artist}</p>
                </article>
              ))
            ) : (
              <p className="jp-empty">No songs yet in {jurName}</p>
            )}
          </div>
        </section>

        {/* ═══════ LEADERBOARDS ═══════ */}
        <section className="jp-section jp-leaderboard-grid">
          <div className="jp-board-card">
            <div className="jp-section-heading compact">
              <div>
                <span className="jp-section-eyebrow">Jurisdiction Rank</span>
                <h2>Top Artists</h2>
              </div>
            </div>

            <div className="jp-ranked-list">
              {data.topArtists.length > 0 ? (
                data.topArtists.map((artist) => (
                  <div
                    key={artist.id}
                    className="jp-ranked-row"
                    onClick={() => handleViewArtist(artist.id)}
                  >
                    <span className="jp-ranked-number">
                      {String(artist.rank).padStart(2, '0')}
                    </span>

                    <img src={artist.thumbnail} alt={artist.name} />

                    <div className="jp-ranked-main">
                      <strong>{artist.name}</strong>
                      <span>{artist.genre || 'Local artist'}</span>
                    </div>

                    <div className="jp-ranked-score">
                      <strong>{artist.plays.toLocaleString()}</strong>
                      <span>pts</span>
                    </div>

                    <button
                      type="button"
                      className="jp-row-play"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayArtist(artist);
                      }}
                    >
                      <PlayIcon size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="jp-empty">No artists yet in {jurName}</p>
              )}
            </div>
          </div>

          <div className="jp-board-card">
            <div className="jp-section-heading compact">
              <div>
                <span className="jp-section-eyebrow">Local Sound</span>
                <h2>Top Tracks</h2>
              </div>
            </div>

            <div className="jp-ranked-list">
              {data.topSongs.length > 0 ? (
                data.topSongs.map((song) => (
                  <div
                    key={song.id}
                    className="jp-ranked-row"
                    onClick={() => handleViewSong(song.id)}
                  >
                    <span className="jp-ranked-number">
                      {String(song.rank).padStart(2, '0')}
                    </span>

                    <img src={song.thumbnail} alt={song.title} />

                    <div className="jp-ranked-main">
                      <strong>{song.title}</strong>
                      <span>{song.artist}</span>
                    </div>

                    <div className="jp-ranked-score">
                      <strong>{song.plays.toLocaleString()}</strong>
                      <span>plays</span>
                    </div>

                    <button
                      type="button"
                      className="jp-row-play"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySong(song);
                      }}
                    >
                      <PlayIcon size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="jp-empty">No tracks yet in {jurName}</p>
              )}
            </div>
          </div>
        </section>

        {/* ═══════ LOCAL ANTHEM FEATURE ═══════ */}
        {data.songOfWeek && (
          <section className="jp-section jp-anthem-feature">
            <div className="jp-anthem-copy">
              <span className="jp-section-eyebrow">Local Anthem</span>
              <h2>The track currently representing {jurName}</h2>
              <p>
                This is the leading song in the jurisdiction right now, powered
                by local activity and community attention.
              </p>

              <button
                type="button"
                className="jp-primary-action"
                onClick={handlePlayTopSong}
              >
                <PlayIcon size={14} />
                Listen Now
              </button>
            </div>

            <div
              className="jp-anthem-art"
              onClick={() => handleViewSong(data.songOfWeek.id)}
            >
              <img src={data.songOfWeek.image} alt={data.songOfWeek.title} />

              <div>
                <span>#1 This Week</span>
                <strong>{data.songOfWeek.title}</strong>
                <p>{data.songOfWeek.artist}</p>
              </div>
            </div>
          </section>
        )}

        {/* ═══════ ABOUT JURISDICTION ═══════ */}
        <section className="jp-section jp-about-card">
          <div>
            <span className="jp-section-eyebrow">About this jurisdiction</span>
            <h2>{jurName} Local Music Hub</h2>
            <p>
              UNIS jurisdictions organize music by place, giving listeners a way
              to discover the artists and songs gaining support in a specific
              neighborhood instead of relying only on global algorithms.
            </p>
          </div>

          <div className="jp-about-actions">
            <button
              type="button"
              className="jp-secondary-action"
              onClick={() => navigate('/voteawards')}
            >
              Vote Now
            </button>

            <button
              type="button"
              className="jp-secondary-action"
              onClick={() => navigate('/findpage')}
            >
              Discover More
            </button>
          </div>
        </section>

        {error && <div className="jp-error-banner">{error}</div>}
      </div>
    </Layout>
  );
};

export default JurisdictionPage;