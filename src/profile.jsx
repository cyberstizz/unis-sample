import React, { useState, useEffect, useCallback } from 'react';
import { Play, Heart, Edit3, Trash2, Share2, ArrowRight, History } from 'lucide-react';
import Layout from './layout';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import VoteHistoryModal from './voteHistoryModal';
import ChangePasswordWizard from './changePasswordWizard';
import ReferralCodeCard from './ReferralCodeCard';
import ThemePicker from './ThemePicker';
import AccountSettings from './AccountSettings';
import './profile.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Small inline loader shown per-section while data is in flight
// ---------------------------------------------------------------------------
const SectionLoader = ({ label = 'Loading...' }) => (
  <div className="section-loader">
    <div className="section-loader-spinner" />
    <p>{label}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Inline error shown per-section when a fetch fails
// ---------------------------------------------------------------------------
const SectionError = ({ message = 'Failed to load.', onRetry }) => (
  <div className="section-error">
    <p>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="section-error-retry">
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
  //
  // NOTE: We no longer pass `backgroundImage` to <Layout>. The new global
  // gradient background (defined in unis-theme.scss) is the background for
  // every page. If your <Layout> currently REQUIRES backgroundImage, update
  // it to make that prop optional and skip rendering the image when omitted.
  // -----------------------------------------------------------------------
  if (!user) return <div className="profile-fullscreen-msg">Please log in.</div>;

  if (coreLoading) {
    return (
      <Layout>
        <div className="profile-container profile-container--center">
          <SectionLoader label="Loading your profile..." />
        </div>
      </Layout>
    );
  }

  if (coreError) {
    return (
      <Layout>
        <div className="profile-container profile-container--center">
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

  const photoUrl = userProfile.photoUrl ? buildUrl(userProfile.photoUrl) : null;

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

  const handleShareProfile = () => {
    const shareUrl = `${window.location.origin}/profile/${userProfile.username}`;
    if (navigator.share) {
      navigator.share({
        title: `${userProfile.username} on UNIS`,
        url: shareUrl,
      }).catch(err => console.log('Share cancelled or failed:', err));
    } else {
      navigator.clipboard?.writeText(shareUrl);
    }
  };

  // -----------------------------------------------------------------------
  // Derived display values for the featured card
  // -----------------------------------------------------------------------
  const featuredArt = supportedArtist
    ? (buildUrl(supportedArtist.defaultSong?.artworkUrl) ||
       buildUrl(supportedArtist.photoUrl))
    : null;

  const featuredTitle = supportedArtist?.defaultSong?.title || supportedArtist?.username;
  const hasPlayableSong = Boolean(supportedArtist?.defaultSong);
  const userInitial = (userProfile.username || '?').charAt(0).toUpperCase();

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Layout>
      <div className="profile-container">

        {/* ============== HERO ============== */}
        <section className="profile-hero">
          <div className="profile-hero__left">
            <div className="profile-hero__eyebrow">
              Member · {userProfile.level || 'Silver'} Tier
            </div>

            <div className="profile-hero__identity">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={userProfile.username}
                  className="profile-hero__avatar"
                />
              ) : (
                <div className="profile-hero__avatar profile-hero__avatar--placeholder">
                  {userInitial}
                </div>
              )}
              <div className="profile-hero__identity-text">
                <h1 className="profile-hero__display">{userProfile.username}</h1>
                <p className="profile-hero__tagline">
                  {userProfile.bio || 'No bio yet — tell Harlem who you are!'}
                </p>
              </div>
            </div>

            <div className="profile-hero__stats">
              <div className="profile-hero__stat">
                <div className="profile-hero__stat-label">Score</div>
                <div className="profile-hero__stat-value">{userProfile.score || 0}</div>
              </div>
              <div className="profile-hero__stat">
                <div className="profile-hero__stat-label">Tier</div>
                <div className="profile-hero__stat-value profile-hero__stat-value--tier">
                  {userProfile.level || 'Silver'}
                </div>
              </div>
              <div className="profile-hero__stat">
                <div className="profile-hero__stat-label">Total Votes</div>
                <div className="profile-hero__stat-value">
                  {votesLoading ? '—' : voteHistory.length}
                </div>
              </div>
            </div>

            <div className="profile-hero__cta">
              <button
                className="profile-btn profile-btn--primary"
                onClick={() => setShowEditWizard(true)}
              >
                <Edit3 size={14} /> Edit Profile
              </button>
            </div>
          </div>

          {supportedArtist && featuredArt ? (
            <div
              className="profile-hero__featured"
              style={{ backgroundImage: `url(${featuredArt})` }}
            >
              <div className="profile-hero__featured-overlay" />
              <div className="profile-hero__featured-content">
                <span className="profile-hero__featured-tag">
                  <Heart size={11} fill="currentColor" /> I Support
                </span>
                <h2 className="profile-hero__featured-title">{featuredTitle}</h2>
                <div className="profile-hero__featured-sub">
                  {hasPlayableSong
                    ? `by ${supportedArtist.username}`
                    : 'No featured track yet'}
                </div>
                {hasPlayableSong && (
                  <button
                    className="profile-hero__featured-cta"
                    onClick={playDefaultSong}
                  >
                    <Play size={12} fill="currentColor" />
                    Listen to your pick
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="profile-hero__featured profile-hero__featured--empty">
              <div className="profile-hero__featured-content">
                <span className="profile-hero__featured-tag">
                  <Heart size={11} /> I Support
                </span>
                <h2 className="profile-hero__featured-title">No artist yet</h2>
                <div className="profile-hero__featured-sub">
                  Find an artist whose voice you want to amplify.
                </div>
                <a href="/find" className="profile-hero__featured-cta">
                  Discover artists <ArrowRight size={12} />
                </a>
              </div>
            </div>
          )}
        </section>

        {/* ============== VOTE HISTORY ============== */}
        <section className="profile-section">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Your Activity</div>
              <h2 className="profile-section__title">
                Vote <em>history</em>
              </h2>
            </div>
            {!votesLoading && !votesError && voteHistory.length > 0 && (
              <button
                onClick={() => setShowVoteHistory(true)}
                className="profile-section__link"
              >
                View all <ArrowRight size={12} />
              </button>
            )}
          </div>

          <div className="profile-vote-card">
            {votesLoading ? (
              <SectionLoader label="Loading vote history..." />
            ) : votesError ? (
              <SectionError message={votesError} onRetry={fetchVotes} />
            ) : (
              <div className="profile-vote-summary">
                <div className="profile-vote-summary__number">
                  {voteHistory.length}
                </div>
                <div className="profile-vote-summary__text">
                  <div className="profile-vote-summary__label">Total Votes Cast</div>
                  <p className="profile-vote-summary__cta">
                    {voteHistory.length > 0
                      ? 'Every vote shapes the leaderboard. See your full influence.'
                      : 'No votes yet — go support your favorites!'}
                  </p>
                </div>
                {voteHistory.length > 0 && (
                  <button
                    onClick={() => setShowVoteHistory(true)}
                    className="profile-btn profile-btn--ghost"
                  >
                    <History size={14} /> View History
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ============== REFERRAL ============== */}
        <section className="profile-section">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Grow the network</div>
              <h2 className="profile-section__title">
                Refer <em>&amp; earn</em>
              </h2>
            </div>
          </div>
          <ReferralCodeCard userId={user?.userId} isArtist={false} />
        </section>

        {/* ============== PREFERENCES (theme picker) ============== */}
        <section className="profile-section">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Personalization</div>
              <h2 className="profile-section__title">
                Color <em>theme</em>
              </h2>
            </div>
          </div>
          <ThemePicker userId={user?.userId} />
        </section>

        {/* ============== ACCOUNT (toggles) ============== */}
        <section className="profile-section">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Account</div>
              <h2 className="profile-section__title">
                Notifications <em>&amp; privacy</em>
              </h2>
            </div>
          </div>
          <AccountSettings userId={user?.userId} userProfile={userProfile} />
        </section>

        {/* ============== DANGER ZONE ============== */}
        <div className="profile-danger">
          <div className="profile-danger__text">
            <strong>Danger zone</strong>
            Change your password or permanently delete your account. Deletion cannot be undone.
          </div>
          <div className="profile-danger__actions">
            <button
              onClick={() => setShowChangePassword(true)}
              className="profile-btn profile-btn--ghost"
            >
              Change Password
            </button>
            <button
              onClick={() => setShowDeleteWizard(true)}
              className="profile-btn profile-btn--danger"
            >
              <Trash2 size={14} /> Delete Account
            </button>
          </div>
        </div>

        {/* ============== WIZARDS (unchanged) ============== */}
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