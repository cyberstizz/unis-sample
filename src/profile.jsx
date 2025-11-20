import React, { useState, useEffect } from 'react';
import { Play, Heart, Edit3, Trash2, User } from 'lucide-react';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
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

  const playDefaultSong = () => {
    if (!supportedArtist?.defaultSong) return;

    playMedia({
      type: 'song',
      url: `${API_BASE_URL}${supportedArtist.defaultSong.fileUrl}`,
      title: supportedArtist.defaultSong.title,
      artist: supportedArtist.username,
      artwork: supportedArtist.defaultSong.artworkUrl 
        ? `${API_BASE_URL}${supportedArtist.defaultSong.artworkUrl}` 
        : photoUrl,
    }, []);
  };

  const refreshProfile = () => {
    apiCall({ url: `/v1/users/profile/${user.userId}` })
      .then(res => setUserProfile(res.data));
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="profile-container">

        {/* Header */}
        <div className="profile-header card" style={{ textAlign: 'center', padding: '2rem' }}>
          <img src={photoUrl} alt={userProfile.username} className="profile-image-large" />
          <h1>{userProfile.username}</h1>
          <p style={{ fontSize: '1.1rem', color: '#aaa', margin: '0.5rem 0' }}>
            {userProfile.bio || 'No bio yet — tell Harlem who you are!'}
          </p>
          <button className="btn btn-primary" onClick={() => setShowEditWizard(true)}>
            <Edit3 size={16} /> Edit Profile
          </button>
        </div>

        {/* Supported Artist */}
        {supportedArtist && (
          <div className="supported-artist card">
            <h3><Heart size={20} style={{ verticalAlign: '-4px' }} /> I Support</h3>
            <div className="artist-support-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img 
                src={supportedArtist.photoUrl ? `${API_BASE_URL}${supportedArtist.photoUrl}` : backimage} 
                alt={supportedArtist.username}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem' }}>{supportedArtist.username}</h4>
                {supportedArtist.defaultSong && (
                  <button className="btn btn-secondary" onClick={playDefaultSong}>
                    <Play size={16} /> Play Featured Song
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vote History */}
        <div className="vote-history card">
          <h3>Vote History ({voteHistory.length})</h3>
          {voteHistory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {voteHistory.map(vote => (
                <div key={vote.voteId} style={{
                  padding: '0.8rem',
                  background: '#ffffff12',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>{vote.targetType === 'artist' ? 'Artist' : 'Song'}</strong> • {vote.genre?.name || 'Unknown'} • {vote.interval?.name || 'Daily'}
                  </div>
                  <small style={{ color: '#aaa' }}>
                    {new Date(vote.voteDate).toLocaleDateString()}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p>No votes yet — go support your favorites!</p>
          )}
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ margin: '2rem 0' }}>
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

        {/* Danger Zone */}
        <div className="card" style={{ border: '2px solid #dc3545', marginTop: '3rem' }}>
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ color: '#dc3545' }}>Danger Zone</h3>
            <p style={{ color: '#ccc', marginBottom: '1rem' }}>
              This cannot be undone.
            </p>
            <button
              style={{ background: '#dc3545', border: 'none' }}
              className="btn btn-primary"
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

      </div>
    </Layout>
  );
};

export default Profile;