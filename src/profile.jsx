import React, { useState, useEffect, useCallback } from 'react';
import { Play, Heart, Edit3, Trash2, User, Music, History } from 'lucide-react';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import VoteHistoryModal from './voteHistoryModal';
import ChangePasswordWizard from './changePasswordWizard';
import ReferralCodeCard from './ReferralCodeCard';
import ThemePicker from './ThemePicker';
import './profile.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Small inline loader shown per-section while data is in flight
// ---------------------------------------------------------------------------
const SectionLoader = ({ label = 'Loading...' }) => (
  <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
    <div className="spinner" style={{
      width: 24, height: 24, border: '3px solid rgba(255,255,255,0.1)',
      borderTop: '3px solid var(--unis-primary, #6c63ff)', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', margin: '0 auto 8px'
    }} />
    <p style={{ margin: 0, fontSize: '0.85rem' }}>{label}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ---------------------------------------------------------------------------
// Inline error shown per-section when a fetch fails
// ---------------------------------------------------------------------------
const SectionError = ({ message = 'Failed to load.', onRetry }) => (
  <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
    <p style={{ margin: '0 0 8px' }}>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn btn-secondary btn-small">
        Retry
      </button>
    )}
  </div>
);

const Profile = () => {
  const { user } = useAuth();
  const { playMedia } = React.useContext(PlayerContext);

  // ---- Core data (profile — must load before page renders) ---------------
  const [userProfile, setUserProfile] = useState(null);
  const [supportedArtist, setSupportedArtist] = useState(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [coreError, setCoreError] = useState(null);

  // ---- Secondary data (votes — can load independently) -------------------
  const [voteHistory, setVoteHistory] = useState([]);
  const [votesLoading, setVotesLoading] = useState(true);
  const [votesError, setVotesError] = useState(null);

  // ---- UI state ----------------------------------------------------------
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false);
  const [showVoteHistory, setShowVoteHistory] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch helpers
  // -----------------------------------------------------------------------
  const fetchCore = useCallback(async (userId) => {
    setCoreLoading(true);
    setCoreError(null);
    try {
      const profileRes = await apiCall({ url: `/v1/users/profile/${userId}`, useCache: false });
      const profile = profileRes.data;
      setUserProfile(profile);

      // Supported artist depends on profile, but we don't block on it —
      // fire-and-forget so the page can render immediately.
      if (profile.supportedArtistId) {
        apiCall({ url: `/v1/users/profile/${profile.supportedArtistId}`, useCache: false })
          .then(artistRes => setSupportedArtist(artistRes.data))
          .catch(err => console.error('Failed to fetch supported artist:', err));
      }
    } catch (err) {
      console.error('Core profile fetch failed:', err);
      setCoreError('Failed to load your profile. Please try again.');
    } finally {
      setCoreLoading(false);
    }
  }, []);

  const fetchVotes = useCallback(async () => {
    setVotesLoading(true);
    setVotesError(null);
    try {
      const res = await apiCall({ url: '/v1/vote/history?limit=50', useCache: false });
      setVoteHistory(res.data || []);
    } catch (err) {
      console.error('Vote history fetch failed:', err);
      setVotesError('Could not load vote history.');
    } finally {
      setVotesLoading(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Main effect: profile and votes fetch in parallel (no waterfall)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user?.userId) return;

    fetchCore(user.userId);
    fetchVotes();
  }, [user, fetchCore, fetchVotes]);

  // -----------------------------------------------------------------------
  // Early returns
  // -----------------------------------------------------------------------
  if (!user) return <div style={{ textAlign: 'center', padding: '4rem', color: 'white' }}>Please log in.</div>;

  if (coreLoading) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="profile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <SectionLoader label="Loading your profile..." />
        </div>
      </Layout>
    );
  }

  if (coreError) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="profile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <SectionError message={coreError} onRetry={() => fetchCore(user.userId)} />
        </div>
      </Layout>
    );
  }

  // Core data loaded — safe to derive display values
  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `${API_BASE_URL}${url}`;
  };

  const photoUrl = userProfile.photoUrl
    ? buildUrl(userProfile.photoUrl)
    : backimage;

  const playDefaultSong = async () => {
    if (!supportedArtist?.defaultSong) {
      console.error('No default song available');
      return;
    }

    const song = supportedArtist.defaultSong;
    const songId = song.songId || song.id;

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
      await apiCall({
        method: 'post',
        url: `/v1/media/song/${songId}/play?userId=${user.userId}`
      });
    } catch (err) {
      console.error('Failed to track play:', err);
    }

    playMedia(mediaObject, [mediaObject]);
  };

  const refreshProfile = () => {
    apiCall({ url: `/v1/users/profile/${user.userId}`, useCache: false })
      .then(res => setUserProfile(res.data));
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
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

        {/* Supported Artist */}
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

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <Music size={28} />
            <p>Score</p>
            <h3>{userProfile.score || 0}</h3>
          </div>
          <div className="stat-card">
            <User size={28} />
            <p>Level</p>
            <h3>{userProfile.level || 'Silver'}</h3>
          </div>
          <div className="stat-card">
            <Heart size={28} />
            <p>Total Votes</p>
            <h3>{votesLoading ? '...' : voteHistory.length}</h3>
          </div>
        </div>

        {/* Vote History */}
        <div className="vote-history card">
          <div className="vote-history-header">
            <h3><History size={20} /> Vote History</h3>
            {!votesLoading && !votesError && (
              <button
                className="btn btn-secondary btn-view-history"
                onClick={() => setShowVoteHistory(true)}
              >
                View All
              </button>
            )}
          </div>
          {votesLoading ? (
            <SectionLoader label="Loading vote history..." />
          ) : votesError ? (
            <SectionError message={votesError} onRetry={fetchVotes} />
          ) : (
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
          )}
        </div>

        {/* Referral Code — listener */}
        <ReferralCodeCard userId={user?.userId} isArtist={false} />

        {/* Theme Picker */}
        <ThemePicker userId={user?.userId} />

        {/* Danger Zone */}
        <div className="card danger-zone" style={{ marginTop: '1.5rem' }}>
          <div className="danger-content">
            <h3>Danger Zone</h3>
            <p>This cannot be undone.</p>
            <button onClick={() => setShowChangePassword(true)}
              style={{
                padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer',
                marginRight: '12px'
              }}>
              Change Password
            </button>
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
          useDummyData={false}
        />

        <ChangePasswordWizard
          show={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />

      </div>
    </Layout>
  );
};

export default Profile;