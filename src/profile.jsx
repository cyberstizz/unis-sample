import React, { useState, useEffect, useCallback } from 'react';
import { Play, Edit3, Trash2, ArrowRight, History, Clock } from 'lucide-react';
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
import SocialLinksSection from './SocialLinksSection';
import ThemePicker from './ThemePicker';
import AccountSettings from './AccountSettings';
import CollapsibleSection from './CollapsibleSection';
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
// Profile -- single fetch, single error boundary, single source of truth.
//
// All data for this page comes from GET /v1/users/profile-summary/{userId}.
// Children (ReferralCodeCard, SocialLinksSection, ThemePicker, AccountSettings)
// receive their data as props. They own their *write* paths but not their
// *read* paths, which eliminates cache drift between components.
//
// URL building uses the shared buildUrl utility, which handles:
//   - Private R2 URLs -> rewrites to public CDN
//   - Already-full URLs -> safely encoded pass-through
//   - Relative paths -> prepended with API base
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

  // ---- Pending supported-artist cancel state ----------------------------
  const [cancellingPending, setCancellingPending] = useState(false);

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

  // Cancel a queued supported-artist change.
  const cancelPendingArtist = async () => {
    if (!user?.userId) return;
    setCancellingPending(true);
    const startedAt = performance.now();
    try {
      await apiCall({
        method: 'delete',
        url: `/v1/users/${user.userId}/supported-artist/pending`,
      });
      const ms = Math.round(performance.now() - startedAt);
      console.log(`[Profile] action=cancel_pending_artist status=ok durationMs=${ms}`);
      reload();
    } catch (err) {
      const ms = Math.round(performance.now() - startedAt);
      console.error(`[Profile] action=cancel_pending_artist status=fail durationMs=${ms} err=`, err);
      alert('Failed to cancel the pending change. Please try again.');
    } finally {
      setCancellingPending(false);
    }
  };

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
  // Derived display values -- all URL building goes through the shared
  // buildUrl utility for proper R2/CDN handling
  // -----------------------------------------------------------------------
  const { profile, supportedArtist, pendingSupportedArtist, voteHistory, referralCode, settings } = summary;

  const photoUrl = buildUrl(profile.photoUrl);
  const userInitial = (profile.username || '?').charAt(0).toUpperCase();

  // Show the ARTIST for clarity: prefer the artist's own photo, fall back to
  // the default song's artwork only if the artist has no photo. The default
  // song still PLAYS unchanged -- this only affects the hero image.
  const featuredArt = supportedArtist
  ? (buildUrl(supportedArtist.photoUrl) || buildUrl(supportedArtist.defaultSong?.artworkUrl))
  : null;

  const featuredTitle = supportedArtist?.defaultSong?.title || supportedArtist?.username;
  const hasPlayableSong = Boolean(supportedArtist?.defaultSong);

  // Pending-change display
  const pendingEffective = pendingSupportedArtist?.effectiveDate
    ? new Date(pendingSupportedArtist.effectiveDate).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric',
      })
    : null;

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

    // requestPlay: empty queue -> plays immediately,
    //              non-empty   -> opens PlayChoiceModal (preserves queue)
    requestPlay(mediaObject);
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
                  {profile.bio || 'No bio yet -- tell Harlem who you are!'}
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
              aria-label={`Supporting ${supportedArtist.username}`}
            >
              <div className="profile-hero__featured-overlay" aria-hidden="true" />
              <div className="profile-hero__featured-content">
                <span className="profile-hero__featured-tag">
                  You support
                </span>
                <h2 className="profile-hero__featured-title">{supportedArtist.username}</h2>
                <div className="profile-hero__featured-sub">
                  {hasPlayableSong
                    ? `Featured track: ${featuredTitle}`
                    : 'No featured track yet'}
                </div>
                {hasPlayableSong && (
                  <button
                    type="button"
                    className="profile-hero__featured-cta"
                    onClick={playDefaultSong}
                  >
                    <Play size={12} fill="currentColor" aria-hidden="true" />
                    Listen to their pick
                  </button>
                )}

                {pendingSupportedArtist && (
                  <div className="profile-hero__pending" role="status">
                    <Clock size={12} aria-hidden="true" />
                    <span>
                      Switching to <strong>{pendingSupportedArtist.username}</strong>
                      {pendingEffective ? ` on ${pendingEffective}` : ''}
                    </span>
                    <button
                      type="button"
                      className="profile-hero__pending-cancel"
                      onClick={cancelPendingArtist}
                      disabled={cancellingPending}
                    >
                      {cancellingPending ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="profile-hero__featured profile-hero__featured--empty">
              <div className="profile-hero__featured-content">
                <span className="profile-hero__featured-tag">
                  You support
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
        <CollapsibleSection
          id="vote-history"
          eyebrow="Your Activity"
          title={<>Vote <em>history</em></>}
        >
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
                    : 'No votes yet -- go support your favorites!'}
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
        </CollapsibleSection>

        {/* ============== REFERRAL ============== */}
        <CollapsibleSection
          id="referral"
          eyebrow="Grow the network"
          title={<>Refer <em>&amp; earn</em></>}
        >
          <ReferralCodeCard
            referralCode={referralCode}
            username={profile.username}
            isArtist={profile.role === 'artist'}
          />
        </CollapsibleSection>

        {/* ============== SOCIAL LINKS ============== */}
        <CollapsibleSection
          id="social-links"
          eyebrow="Find me online"
          title={<>Social <em>links</em></>}
        >
          <SocialLinksSection
            userId={user.userId}
            profile={profile}
            onUpdated={reload}
          />
        </CollapsibleSection>

        {/* ============== PREFERENCES ============== */}
        <CollapsibleSection
          id="theme"
          eyebrow="Personalization"
          title={<>Color <em>theme</em></>}
        >
          {/*
            ThemePicker keeps its existing useAuth()-based state.
            No prop changes needed -- theme lives in AuthContext, not in
            the profile summary, so it was never part of the fetch waterfall.
          */}
          <ThemePicker userId={user.userId} />
        </CollapsibleSection>

        {/* ============== ACCOUNT (toggles) ============== */}
        <CollapsibleSection
          id="account"
          eyebrow="Account"
          title={<>Notifications <em>&amp; privacy</em></>}
        >
          <AccountSettings
            userId={user.userId}
            settings={settings}
            onUpdated={reload}
          />
        </CollapsibleSection>

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