import React, { useState, useEffect, useContext } from 'react';
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
      <div className="artist-page-container">
        <header className="artist-header">
          <div className="artist-info">
            <div className="artist-top">
              <img src={artistPhoto} alt={artist.username} className="artist-profile-image" />
              <p className="artist-name">{artist.username}</p>
              <p
                className="artist-jurisdiction"
                onClick={() => navigate(`/jurisdiction/${artist.jurisdiction.name}`)}
                style={{ cursor: 'pointer' }}
              >
                {artist.jurisdiction?.name || 'Unknown'}
              </p>
            </div>

            <p className="artist-genre">{artist.genre?.name || 'Unknown Genre'}</p>

            <div className="artist-stats">
              <span><Users size={16} /> {followerCount} Followers</span>
              <span><PlayCircle size={16} /> {artist.totalPlays || 0} Plays</span>
              <span><Heart size={16} /> {artist.score || 0} Score</span>
            </div>

            {showActionButtons && (
              <div className="follow-actions">
                <button
                  onClick={handleFollow}
                  className={`follow-button ${isFollowing ? 'following' : ''}`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button onClick={handleVote} className="vote-button">Vote</button>
                <button
                  onClick={handlePlayDefault}
                  className="play-button"
                  disabled={!defaultSong}
                >
                  Play
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="content-wrapper">
          {topSong && (
            <section className="fans-pick-section card">
              <div className="section-header"><h2>Fans Pick</h2></div>
              <div className="fans-pick-item">
                <img
                  src={buildUrl(topSong.artworkUrl) || artistPhoto}
                  alt={topSong.title}
                  className="song-artwork"
                />
                <div className="item-info"><h4>{topSong.title}</h4></div>
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => {
                    const song = songs.find(s => s.songId === topSong.songId);
                    if (song) playMedia(
                      { type: 'song', url: buildUrl(song.fileUrl), title: song.title, artist: artist.username, artwork: buildUrl(song.artworkUrl) || artistPhoto },
                      []
                    );
                  }}
                >
                  Play
                </button>
              </div>
            </section>
          )}

          <section className="music-section card">
            <div className="section-header"><h2>Music</h2></div>
            <div className="songs-list">
              {songs.slice(0, 5).map((song) => (
                <div key={song.songId} className="song-item">
                  <img
                    src={buildUrl(song.artworkUrl) || artistPhoto}
                    alt={song.title}
                    className="song-artwork"
                  />
                  <div className="item-info">
                    <h4 onClick={() => handleSongClick(song.songId)} style={{ cursor: 'pointer' }}>
                      {song.title}
                    </h4>
                  </div>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => playMedia(
                      { type: 'song', url: buildUrl(song.fileUrl), title: song.title, artist: artist.username, artwork: buildUrl(song.artworkUrl) || artistPhoto },
                      []
                    )}
                  >
                    Play
                  </button>
                </div>
              ))}
              {songs.length === 0 && <p className="empty-message">No songs yet</p>}
            </div>
          </section>

          <section className="bio-section card">
            <div className="section-header"><h2>Bio</h2></div>
            {isOwnProfile ? (
              <>
                <textarea value={bio} onChange={handleBioChange} className="bio-edit" />
                <button onClick={handleSaveBio} className="save-button">Save Bio</button>
              </>
            ) : (
              <p className="bio-text">{bio}</p>
            )}
          </section>

          <section className="social-section card">
            <div className="section-header"><h2>Social Media</h2></div>
            <div className="social-links">
              <a href={artist.instagramUrl || '#'} target="_blank" rel="noreferrer" className="social-link">📷 Instagram</a>
              <a href={artist.twitterUrl || '#'} target="_blank" rel="noreferrer" className="social-link">𝕏 Twitter</a>
              <a href={artist.tiktokUrl || '#'} target="_blank" rel="noreferrer" className="social-link">🎵 TikTok</a>
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