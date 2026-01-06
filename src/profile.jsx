import React, { useState, useEffect } from 'react';
import { Play, Heart, Edit3, Trash2, User, Music, History } from 'lucide-react';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import VoteHistoryModal from './voteHistoryModal';
import './profile.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const Profile = () => {
  const { user } = useAuth();
  const { playMedia } = React.useContext(PlayerContext);
  const [userProfile, setUserProfile] = useState(null);
  const [supportedArtist, setSupportedArtist] = useState(null);
  const [voteHistory, setVoteHistory] = useState([]);
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false);
  const [showVoteHistory, setShowVoteHistory] = useState(false);

  useEffect(() => {
    if (!user?.userId) return;

    const fetchData = async () => {
      try {
        // 1. My profile
        const profileRes = await apiCall({ url: `/v1/users/profile/${user.userId}` });
        setUserProfile(profileRes.data);

        // 2. My supported artist (if any)
        if (profileRes.data.supportedArtistId) {
          const artistRes = await apiCall({ url: `/v1/users/profile/${profileRes.data.supportedArtistId}` });
          setSupportedArtist(artistRes.data);
        }

        // 3. My vote history
        const voteRes = await apiCall({ url: '/v1/vote/history?limit=50' });
        setVoteHistory(voteRes.data || []);
      } catch (err) {
        console.error('Failed to load profile data', err);
      }
    };

    fetchData();
  }, [user]);

  if (!userProfile) return <div style={{ textAlign: 'center', padding: '4rem', color: 'white' }}>Loading your profile...</div>;

  const photoUrl = userProfile.photoUrl 
    ? `${API_BASE_URL}${userProfile.photoUrl}` 
    : backimage;

  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `${API_BASE_URL}${url}`;
  };

  // Enhanced play function with tracking
  const playDefaultSong = async () => {
    if (!supportedArtist?.defaultSong) {
      console.error('No default song available');
      return;
    }

    const song = supportedArtist.defaultSong;
    const songId = song.songId || song.id;

    // Create media object for player
    const mediaObject = {
      type: 'song',
      id: songId,
      songId: songId,
      url: buildUrl(song.fileUrl),
      title: song.title,
      artist: supportedArtist.username,
      artistName: supportedArtist.username,
      artwork: buildUrl(song.artworkUrl) || buildUrl(supportedArtist.photoUrl) || photoUrl,
      artworkUrl: buildUrl(song.artworkUrl) || buildUrl(supportedArtist.photoUrl) || photoUrl,
    };

    try {
      // Track the play
      await apiCall({ 
        method: 'post', 
        url: `/v1/media/song/${songId}/play?userId=${user.userId}` 
      });
      console.log('Play tracked successfully for song:', songId);
    } catch (err) {
      console.error('Failed to track play:', err);
    }

    // Play the song
    playMedia(mediaObject, [mediaObject]);
  };

  const refreshProfile = () => {
    apiCall({ url: `/v1/users/profile/${user.userId}` })
      .then(res => setUserProfile(res.data));
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="profile-container">

        {/* Header */}
        <div className="profile-header card">
          <img src={photoUrl} alt={userProfile.username} className="profile-image-large" />
          <h1>{userProfile.username}</h1>
          <p>
            {userProfile.bio || 'No bio yet — tell Harlem who you are!'}
          </p>
          <button className="btn btn-primary" onClick={() => setShowEditWizard(true)}>
            <Edit3 size={16} /> Edit Profile
          </button>
        </div>

        {/* Supported Artist - ENHANCED */}
        {supportedArtist && (
          <div className="supported-artist card">
            <h3><Heart size={20} /> I Support</h3>
            <div className="artist-support-card">
              <img 
                src={supportedArtist.photoUrl ? buildUrl(supportedArtist.photoUrl) : backimage} 
                alt={supportedArtist.username}
                className="artist-photo"
              />
              <div className="artist-info">
                <h4>{supportedArtist.username}</h4>
                {supportedArtist.defaultSong ? (
                  <div className="default-song-section">
                    <div className="song-details">
                      <Music size={16} className="song-icon" />
                      <div className="song-text">
                        <p className="song-title">{supportedArtist.defaultSong.title}</p>
                        <p className="song-label">Featured Track</p>
                      </div>
                    </div>
                    <button className="btn-play" onClick={playDefaultSong}>
                      <Play size={20} fill="white" />
                    </button>
                  </div>
                ) : (
                  <p className="no-song">No featured song set</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid - FULL WIDTH */}
        <div className="stats-grid">
           <div className="stat-card">
            <Music size={28} />
            <p>Score</p>
            <h3>{userProfile.score || 'Silver'}</h3>
          </div>
          <div className="stat-card">
            <User size={28} />
            <p>Level</p>
            <h3>{userProfile.level || 'Silver'}</h3>
          </div>
          <div className="stat-card">
            <Heart size={28} />
            <p>Total Votes</p>
            <h3>{voteHistory.length}</h3>
          </div>
        </div>

        {/* Vote History - FULL WIDTH */}
        <div className="vote-history card">
          <div className="vote-history-header">
            <h3><History size={20} /> Vote History</h3>
            <button
              className="btn btn-secondary btn-view-history"
              onClick={() => setShowVoteHistory(true)}
            >
              View All
            </button>
          </div>
          <div className="vote-summary">
            <div className="vote-stat">
              <span className="vote-count">{voteHistory.length}</span>
              <span className="vote-label">Total Votes</span>
            </div>
            <p className="vote-cta">
              {voteHistory.length > 0
                ? 'See your complete voting history'
                : 'No votes yet — go support your favorites!'}
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card danger-zone">
          <div className="danger-content">
            <h3>Danger Zone</h3>
            <p>This cannot be undone.</p>
            <button
              className="btn btn-primary btn-danger"
              onClick={() => setShowDeleteWizard(true)}
            >
              <Trash2 size={16} /> Delete Account
            </button>
          </div>
        </div>

        {/* Wizards */}
        {showEditWizard && (
          <EditProfileWizard
            show={showEditWizard}
            onClose={() => setShowEditWizard(false)}
            userProfile={userProfile}
            onSuccess={refreshProfile}
          />
        )}

        {showDeleteWizard && (
          <DeleteAccountWizard
            show={showDeleteWizard}
            onClose={() => setShowDeleteWizard(false)}
          />
        )}

        <VoteHistoryModal
          show={showVoteHistory}
          onClose={() => setShowVoteHistory(false)}
          votes={voteHistory}
          useDummyData={false}  // SET TO false WHEN DONE TESTING
        />

      </div>
    </Layout>
  );
};

export default Profile;