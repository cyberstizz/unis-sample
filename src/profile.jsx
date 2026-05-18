import React, { useState, useEffect, useCallback } from 'react';
import { Play, Edit3, Trash2, ArrowRight, History } from 'lucide-react';
import Layout from './layout';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import buildUrl from './utils/buildUrl';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import VoteHistoryModal from './voteHistoryModal';
import ChangePasswordWizard from './changePasswordWizard';
import ReferralCodeCard from './ReferralCodeCard';
import ThemePicker from './ThemePicker';
import AccountSettings from './AccountSettings';
import './profile.scss';

// ---------------------------------------------------------------------------
// Inline section UI helpers
// ---------------------------------------------------------------------------
const SectionLoader = ({ label = 'Loading...' }) => (
  <div className="section-loader" role="status" aria-live="polite">
    <div className="section-loader-spinner" aria-hidden="true" />
    <p>{label}</p>
  </div>
);

const SectionError = ({ message = 'Failed to load.', onRetry }) => (
  <div className="section-error" role="alert">
    <p>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="section-error-retry" type="button">
        Retry
      </button>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Profile — single fetch, single error boundary, single source of truth.
//
// All data for this page comes from GET /v1/users/profile-summary/{userId}.
// Children (ReferralCodeCard, ThemePicker, AccountSettings) receive their
// data as props. They own their *write* paths but not their *read* paths,
// which eliminates the cache drift between components.
//
// URL building uses the shared buildUrl utility, which handles:
//   - Private R2 URLs → rewrites to public CDN
//   - Already-full URLs → safely encoded pass-through
//   - Relative paths → prepended with API base
// ---------------------------------------------------------------------------
const Profile = () => {
  const { user } = useAuth();
  const { requestPlay } = React.useContext(PlayerContext);

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---- UI state ---------------------------------------------------------
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false);
  const [showVoteHistory, setShowVoteHistory] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // -----------------------------------------------------------------------
  // Single consolidated fetch
  // -----------------------------------------------------------------------
  const fetchSummary = useCallback(async (userId) => {
    if (!userId) return;
    const startedAt = performance.now();
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall({
        url: `/v1/users/profile-summary/${userId}`,
      });
      setSummary(res.data);
      const ms = Math.round(performance.now() - startedAt);
      console.log(`[Profile] action=fetch_summary userId=${userId} status=ok durationMs=${ms}`);
    } catch (err) {
      const ms = Math.round(performance.now() - startedAt);
      console.error(`[Profile] action=fetch_summary userId=${userId} status=fail durationMs=${ms} err=`, err);
      setError('Failed to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.userId) fetchSummary(user.userId);
  }, [user?.userId, fetchSummary]);

  // After a profile mutation, children call this to refresh the summary.
  const reload = useCallback(() => {
    if (user?.userId) fetchSummary(user.userId);
  }, [user?.userId, fetchSummary]);

  // -----------------------------------------------------------------------
  // Early returns
  // -----------------------------------------------------------------------
  if (!user) return <div className="profile-fullscreen-msg">Please log in.</div>;

  if (loading) {
    return (
      <Layout>
        <div className="profile-container profile-container--center">
          <SectionLoader label="Loading your profile..." />
        </div>
      </Layout>
    );
  }

  if (error || !summary) {
    return (
      <Layout>
        <div className="profile-container profile-container--center">
          <SectionError
            message={error || 'No profile data.'}
            onRetry={() => fetchSummary(user.userId)}
          />
        </div>
      </Layout>
    );
  }

  // -----------------------------------------------------------------------
  // Derived display values — all URL building goes through the shared
  // buildUrl utility for proper R2/CDN handling
  // -----------------------------------------------------------------------
  const { profile, supportedArtist, voteHistory, referralCode, settings } = summary;

  const photoUrl = buildUrl(profile.photoUrl);
  const userInitial = (profile.username || '?').charAt(0).toUpperCase();

  const featuredArt = supportedArtist
    ? (buildUrl(supportedArtist.defaultSong?.artworkUrl) ||
       buildUrl(supportedArtist.photoUrl))
    : null;

  const featuredTitle = supportedArtist?.defaultSong?.title || supportedArtist?.username;
  const hasPlayableSong = Boolean(supportedArtist?.defaultSong);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const playDefaultSong = async () => {
    if (!supportedArtist?.defaultSong) {
      console.warn('[Profile] action=play_default status=skip reason=no_song');
      return;
    }
    const song = supportedArtist.defaultSong;
    const songId = song.songId;
    const songUrl = buildUrl(song.fileUrl);
    const artworkResolved = buildUrl(song.artworkUrl) || buildUrl(supportedArtist.photoUrl) || photoUrl;

    const mediaObject = {
      type: 'song',
      id: songId,
      songId,
      url: songUrl,
      fileUrl: songUrl,
      title: song.title,
      artist: supportedArtist.username,
      artistName: supportedArtist.username,
      artistId: supportedArtist.userId,
      artwork: artworkResolved,
      artworkUrl: artworkResolved,
    };

    try {
      await apiCall({
        method: 'post',
        url: `/v1/media/song/${songId}/play?userId=${user.userId}`
      });
    } catch (err) {
      console.error('[Profile] action=track_play status=fail err=', err);
    }

    requestPlay(mediaObject);
  };

  const handleShareProfile = () => {
    const shareUrl = `${window.location.origin}/profile/${profile.username}`;
    if (navigator.share) {
      navigator.share({
        title: `${profile.username} on UNIS`,
        url: shareUrl,
      }).catch(err => console.log('[Profile] share cancelled or failed:', err));
    } else {
      navigator.clipboard?.writeText(shareUrl);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Layout>
      <div className="profile-container">

        {/* ============== HERO ============== */}
        <section className="profile-hero" aria-labelledby="profile-display-name">
          <div className="profile-hero__left">
            <div className="profile-hero__eyebrow">
              Member · {profile.level || 'Silver'} Tier
            </div>

            <div className="profile-hero__identity">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={`${profile.username}'s profile photo`}
                  className="profile-hero__avatar"
                  onError={(e) => {
                    console.warn('[Profile] action=load_photo status=fail src=', photoUrl);
                    // Hide broken image so the layout doesn't show a broken-image icon
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="profile-hero__avatar profile-hero__avatar--placeholder"
                  role="img"
                  aria-label={`${profile.username}'s profile photo placeholder`}
                >
                  {userInitial}
                </div>
              )}
              <div className="profile-hero__identity-text">
                <h1 id="profile-display-name" className="profile-hero__display">
                  {profile.username}
                </h1>
                <p className="profile-hero__tagline">
                  {profile.bio || 'No bio yet — tell Harlem who you are!'}
                </p>
              </div>
            </div>

            <div className="profile-hero__stats">
              <div className="profile-hero__stat">
                <div className="profile-hero__stat-label">Score</div>
                <div className="profile-hero__stat-value">{profile.score || 0}</div>
              </div>
              <div className="profile-hero__stat">
                <div className="profile-hero__stat-label">Tier</div>
                <div className="profile-hero__stat-value profile-hero__stat-value--tier">
                  {profile.level || 'Silver'}
                </div>
              </div>
              <div className="profile-hero__stat">
                <div className="profile-hero__stat-label">Total Votes</div>
                <div className="profile-hero__stat-value">
                  {voteHistory?.totalCount ?? 0}
                </div>
              </div>
            </div>

            <div className="profile-hero__cta">
              <button
                type="button"
                className="profile-btn profile-btn--primary"
                onClick={() => setShowEditWizard(true)}
              >
                <Edit3 size={14} aria-hidden="true" /> Edit Profile
              </button>
             
            </div>
          </div>

          {supportedArtist && featuredArt ? (
            <div
              className="profile-hero__featured"
              style={{ backgroundImage: `url(${featuredArt})` }}
              role="img"
              aria-label={`Featured: ${featuredTitle} by ${supportedArtist.username}`}
            >
              <div className="profile-hero__featured-overlay" aria-hidden="true" />
              <div className="profile-hero__featured-content">
                <span className="profile-hero__featured-tag">
                  Featured track
                </span>
                <h2 className="profile-hero__featured-title">{featuredTitle}</h2>
                <div className="profile-hero__featured-sub">
                  {hasPlayableSong
                    ? `by ${supportedArtist.username}`
                    : 'No featured track yet'}
                </div>
                {hasPlayableSong && (
                  <button
                    type="button"
                    className="profile-hero__featured-cta"
                    onClick={playDefaultSong}
                  >
                    <Play size={12} fill="currentColor" aria-hidden="true" />
                    Listen to your pick
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="profile-hero__featured profile-hero__featured--empty">
              <div className="profile-hero__featured-content">
                <span className="profile-hero__featured-tag">
                  Featured track
                </span>
                <h2 className="profile-hero__featured-title">No artist yet</h2>
                <div className="profile-hero__featured-sub">
                  Find an artist whose voice you want to amplify.
                </div>
                <a href="/find" className="profile-hero__featured-cta">
                  Discover artists <ArrowRight size={12} aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
        </section>

        {/* ============== VOTE HISTORY ============== */}
        <section className="profile-section" aria-labelledby="vote-history-heading">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Your Activity</div>
              <h2 id="vote-history-heading" className="profile-section__title">
                Vote <em>history</em>
              </h2>
            </div>
            {voteHistory?.totalCount > 0 && (
              <button
                type="button"
                onClick={() => setShowVoteHistory(true)}
                className="profile-section__link"
              >
                View all <ArrowRight size={12} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="profile-vote-card">
            <div className="profile-vote-summary">
              <div className="profile-vote-summary__number">
                {voteHistory?.totalCount ?? 0}
              </div>
              <div className="profile-vote-summary__text">
                <div className="profile-vote-summary__label">Total Votes Cast</div>
                <p className="profile-vote-summary__cta">
                  {(voteHistory?.totalCount ?? 0) > 0
                    ? 'Every vote shapes the leaderboard. See your full influence.'
                    : 'No votes yet — go support your favorites!'}
                </p>
              </div>
              {(voteHistory?.totalCount ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setShowVoteHistory(true)}
                  className="profile-btn profile-btn--ghost"
                >
                  <History size={14} aria-hidden="true" /> View History
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ============== REFERRAL ============== */}
        <section className="profile-section" aria-labelledby="referral-heading">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Grow the network</div>
              <h2 id="referral-heading" className="profile-section__title">
                Refer <em>&amp; earn</em>
              </h2>
            </div>
          </div>
          <ReferralCodeCard
            referralCode={referralCode}
            username={profile.username}
            isArtist={profile.role === 'artist'}
          />
        </section>

        {/* ============== PREFERENCES ============== */}
        <section className="profile-section" aria-labelledby="theme-heading">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Personalization</div>
              <h2 id="theme-heading" className="profile-section__title">
                Color <em>theme</em>
              </h2>
            </div>
          </div>
          {/*
            ThemePicker keeps its existing useAuth()-based state.
            No prop changes needed — theme lives in AuthContext, not in
            the profile summary, so it was never part of the fetch waterfall.
          */}
          <ThemePicker userId={user.userId} />
        </section>

        {/* ============== ACCOUNT (toggles) ============== */}
        <section className="profile-section" aria-labelledby="account-heading">
          <div className="profile-section__head">
            <div>
              <div className="profile-section__eyebrow">Account</div>
              <h2 id="account-heading" className="profile-section__title">
                Notifications <em>&amp; privacy</em>
              </h2>
            </div>
          </div>
          <AccountSettings
            userId={user.userId}
            settings={settings}
            onUpdated={reload}
          />
        </section>

        {/* ============== DANGER ZONE ============== */}
        <div className="profile-danger" role="region" aria-labelledby="danger-heading">
          <div className="profile-danger__text">
            <strong id="danger-heading">Danger zone</strong>
            Change your password or permanently delete your account. Deletion cannot be undone.
          </div>
          <div className="profile-danger__actions">
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="profile-btn profile-btn--ghost"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteWizard(true)}
              className="profile-btn profile-btn--danger"
              aria-label="Delete account permanently"
            >
              <Trash2 size={14} aria-hidden="true" /> Delete Account
            </button>
          </div>
        </div>

        {/* ============== WIZARDS ============== */}
        {showEditWizard && (
          <EditProfileWizard
            show={showEditWizard}
            onClose={() => setShowEditWizard(false)}
            userProfile={profile}
            onSuccess={reload}
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
          votes={voteHistory?.recent || []}
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