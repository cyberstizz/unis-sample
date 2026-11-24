import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Play, Edit3, Trash2, ArrowRight, Clock, Heart, ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import Layout from './layout';
import UnisLoader from './components/UnisLoader';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { PlayerContext } from './context/playercontext';
import buildUrl from './utils/buildUrl';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import ChangePasswordWizard from './changePasswordWizard';
import ReferralCodeCard from './ReferralCodeCard';
import SocialLinksSection from './SocialLinksSection';
import ThemePicker from './ThemePicker';
import AccountSettings from './AccountSettings';
import VoteHistorySection from './VoteHistorySection';
import SupportedArtistPicker from './SupportedArtistPicker';
import VerificationGate from './verificationGate';
import ReleaseAlertSettings from './ReleaseAlertSettings';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
import { RELEASE_TYPE_LABEL } from './utils/releases';
import { ALERTS_CHANGED, alertPath, alertWhen, fetchAlertSummary } from './utils/releaseAlerts';
import './profile.scss';
import './dashShell.scss';

// ---------------------------------------------------------------------------
// Inline section UI helpers
// ---------------------------------------------------------------------------
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
// Profile — the listener's page (Nov 2026 look, same frame as the artist
// dashboard: dashShell.scss).
//
//   Home      score · tier · votes, who you support, new music from artists
//             you follow
//   Activity  your votes
//   Earn      refer & earn
//   Profile   edit your profile, your links
//   Settings  (gear) color theme · release alerts · notifications & privacy ·
//             account
//
// The open tab lives in the URL hash (/profile#settings), like the dashboard.
// Core data comes from GET /v1/users/profile-summary/{userId}. Vote history is
// owned by VoteHistorySection (its own /v1/vote/history fetch).
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'activity', label: 'Activity' },
  { id: 'earn', label: 'Earn' },
  { id: 'profile', label: 'Profile' },
];
const PANEL_IDS = [...TABS.map((t) => t.id), 'settings'];
const tabFromHash = (hash) => {
  const id = String(hash || '').replace(/^#/, '');
  return PANEL_IDS.includes(id) ? id : 'home';
};

const ProfileTabs = ({ active, onSelect }) => {
  const refs = useRef({});
  const activeIndex = TABS.findIndex((t) => t.id === active);

  const onKeyDown = (e, index) => {
    let next = null;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    const id = TABS[next].id;
    onSelect(id);
    refs.current[id]?.focus();
  };

  return (
    <div className="ad-tabs" role="tablist" aria-label="Your page">
      {TABS.map((tab, index) => {
        const selected = tab.id === active;
        const focusable = selected || (activeIndex === -1 && index === 0);
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`lp-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`lp-panel-${tab.id}`}
            tabIndex={focusable ? 0 : -1}
            className={`ad-tabs__tab ${selected ? 'is-active' : ''}`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

// New music from artists you follow (the newest three; the rest in Messages).
const FollowingNew = () => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchAlertSummary()
        .then((s) => {
          if (alive) setSummary(s || null);
        })
        .catch((err) => console.error('[Profile] release alerts failed (card hidden):', err?.message || err));
    load();
    window.addEventListener(ALERTS_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(ALERTS_CHANGED, load);
    };
  }, []);

  if (!summary || !summary.inApp) return null;
  const items = summary.preview || [];

  return (
    <section className="ad-panel" aria-labelledby="lp-new-title">
      <div className="ad-panel__head">
        <h2 id="lp-new-title">
          New from artists you <em>follow</em>
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="lp-muted">When an artist you follow drops a song, EP, mixtape or album, it shows up here and in Messages.</p>
      ) : (
        <ul className="lp-new">
          {items.map((it) => {
            const art = buildUrl(it.coverUrl);
            const type = it.kind === 'RELEASE' ? RELEASE_TYPE_LABEL[it.releaseType] || 'Release' : 'Song';
            return (
              <li key={it.alertId}>
                <Link to={alertPath(it)} className="lp-new__row">
                  {art ? <img src={art} alt="" className="lp-new__art" /> : <span className="lp-new__art" aria-hidden="true" />}
                  <span className="lp-new__text">
                    <strong>{it.title}</strong>
                    <span>{type} · {it.artistName} · {alertWhen(it.at).toLowerCase()}</span>
                  </span>
                  {it.unseen && <span className="lp-new__dot" aria-label="New" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link to="/messages?view=releases" className="ad-card__link">
        See all in Messages <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
};

const Profile = () => {
  const { user, authLoaded, isGuest } = useAuth();
  const { requestPlay } = React.useContext(PlayerContext);
  const { triggerGate, gateProps } = useAuthGate();
  const location = useLocation();
  const navigate = useNavigate();

  // When the session dies (expired JWT → 401 → AuthContext clears `user`),
  // open the auth gate instead of stranding the user. Waits for authLoaded so
  // the gate never flashes during the first auth check.
  useEffect(() => {
    if (authLoaded && isGuest) triggerGate('profile');
  }, [authLoaded, isGuest, triggerGate]);

  const activeTab = tabFromHash(location?.hash);
  const goToTab = useCallback(
    (id) => {
      const next = PANEL_IDS.includes(id) ? id : 'home';
      navigate({ hash: next === 'home' ? '' : `#${next}` });
    },
    [navigate]
  );

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showArtistPicker, setShowArtistPicker] = useState(false);
  const [cancellingPending, setCancellingPending] = useState(false);
  const feedback = useFeedback();

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

  const reload = useCallback(() => {
    if (user?.userId) fetchSummary(user.userId);
  }, [user?.userId, fetchSummary]);

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
      feedback.success('Pending change cancelled — you keep your current artist');
      reload();
    } catch (err) {
      const ms = Math.round(performance.now() - startedAt);
      console.error(`[Profile] action=cancel_pending_artist status=fail durationMs=${ms} err=`, err);
      feedback.error(errorMessage(err, "Couldn't cancel the pending change. Try again."));
    } finally {
      setCancellingPending(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="profile-fullscreen-msg">
          Please sign in to view your profile.
        </div>
        <AuthGateSheet {...gateProps} />
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="profile-container profile-container--center">
          <UnisLoader label="Loading your profile..." />
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
  // Derived display values (all URLs through buildUrl)
  // -----------------------------------------------------------------------
  const { profile, supportedArtist, pendingSupportedArtist, voteHistory, referralCode, settings } = summary;

  const photoUrl = buildUrl(profile.photoUrl);
  const userInitial = (profile.username || '?').charAt(0).toUpperCase();
  const level = profile.level || 'Silver';
  const place = profile.jurisdiction?.name || user.jurisdiction?.name || null;

  // The supported ARTIST's photo, falling back to their song's artwork.
  const featuredArt = supportedArtist
    ? (buildUrl(supportedArtist.photoUrl) || buildUrl(supportedArtist.defaultSong?.artworkUrl))
    : null;
  const featuredTitle = supportedArtist?.defaultSong?.title || supportedArtist?.username;
  const hasPlayableSong = Boolean(supportedArtist?.defaultSong);

  const pendingEffective = pendingSupportedArtist?.effectiveDate
    ? new Date(pendingSupportedArtist.effectiveDate).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric',
      })
    : null;

  const playDefaultSong = () => {
    if (!supportedArtist?.defaultSong) {
      console.warn('[Profile] action=play_default status=skip reason=no_song');
      return;
    }
    const song = supportedArtist.defaultSong;
    const songId = song.songId;
    const songUrl = buildUrl(song.fileUrl);
    const artworkResolved = buildUrl(song.artworkUrl) || buildUrl(supportedArtist.photoUrl) || photoUrl;

    // No /play POST here: the Player counts the play (15s / 25% gate).
    requestPlay({
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
    });
  };

  // -----------------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------------
  const renderHome = () => (
    <>
      <div className="ad-tiles lp-stats" aria-label="At a glance">
        <div className="ad-tile">
          <span>Score</span>
          <strong>{profile.score || 0}</strong>
        </div>
        <div className="ad-tile">
          <span>Tier</span>
          <strong>{level}</strong>
        </div>
        <div className="ad-tile">
          <span>Votes</span>
          <strong>{voteHistory?.totalCount ?? 0}</strong>
        </div>
      </div>

      {supportedArtist ? (
        <section className="lp-support" aria-label={`Supporting ${supportedArtist.username}`}>
          {featuredArt && (
            <div className="lp-support__media" style={{ backgroundImage: `url(${featuredArt})` }} aria-hidden="true" />
          )}
          <div className="lp-support__shade" aria-hidden="true" />
          <div className="lp-support__content">
            <span className="lp-support__tag">You support</span>
            <h2 className="lp-support__name">{supportedArtist.username}</h2>
            <div className="lp-support__sub">
              {hasPlayableSong ? `Featured: ${featuredTitle}` : 'No featured track yet'}
            </div>
            <div className="lp-support__actions">
              {hasPlayableSong && (
                <button type="button" className="lp-support__listen" onClick={playDefaultSong}>
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  Listen
                </button>
              )}
              <button type="button" className="lp-support__change" onClick={() => setShowArtistPicker(true)}>
                Change
              </button>
            </div>

            {pendingSupportedArtist && (
              <div className="lp-support__pending" role="status">
                <Clock size={12} aria-hidden="true" />
                <span>
                  Switching to <strong>{pendingSupportedArtist.username}</strong>
                  {pendingEffective ? ` on ${pendingEffective}` : ''}
                </span>
                <button type="button" onClick={cancelPendingArtist} disabled={cancellingPending}>
                  {cancellingPending ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="ad-panel lp-support--empty" aria-labelledby="lp-support-empty">
          <span className="lp-support__tag">You support</span>
          <h2 id="lp-support-empty" className="lp-support__name">No artist yet</h2>
          <p className="lp-muted">Find an artist whose voice you want to amplify.</p>
          <button type="button" className="artist-btn artist-btn--primary" onClick={() => setShowArtistPicker(true)}>
            <Heart size={15} aria-hidden="true" /> Choose an artist
          </button>
        </section>
      )}

      <FollowingNew />
    </>
  );

  const renderActivity = () => (
    <section className="ad-panel" aria-labelledby="lp-votes-title">
      <div className="ad-panel__head">
        <h2 id="lp-votes-title">
          Your <em>votes</em>
        </h2>
      </div>
      <VoteHistorySection userId={user.userId} />
    </section>
  );

  const renderEarn = () => (
    <section className="ad-panel" aria-labelledby="lp-refer-title">
      <div className="ad-panel__head">
        <h2 id="lp-refer-title">
          Refer <em>&amp; earn</em>
        </h2>
      </div>
      <VerificationGate title="Verify your phone to refer & earn">
        <ReferralCodeCard
          referralCode={referralCode}
          username={profile.username}
          isArtist={profile.role === 'artist'}
        />
      </VerificationGate>
    </section>
  );

  const renderProfile = () => (
    <div className="ad-two">
      <section className="ad-panel" aria-labelledby="lp-profile-title">
        <div className="ad-panel__head">
          <h2 id="lp-profile-title">
            Your <em>profile</em>
          </h2>
        </div>
        <div className="lp-me">
          {photoUrl ? <img src={photoUrl} alt="" className="lp-me__avatar" /> : <span className="lp-me__avatar" aria-hidden="true">{userInitial}</span>}
          <p className="lp-me__bio">{profile.bio || 'No bio yet -- tell Harlem who you are!'}</p>
        </div>
        <div className="ad-row">
          <button type="button" className="artist-btn artist-btn--primary" onClick={() => setShowEditWizard(true)}>
            <Edit3 size={15} aria-hidden="true" /> Edit Profile
          </button>
          <Link to={`/user/${user.userId}`} className="artist-btn artist-btn--ghost">
            <ExternalLink size={15} aria-hidden="true" /> View profile
          </Link>
        </div>
      </section>

      <section className="ad-panel" aria-labelledby="lp-links-title">
        <div className="ad-panel__head">
          <h2 id="lp-links-title">
            Your <em>links</em>
          </h2>
        </div>
        <SocialLinksSection userId={user.userId} profile={profile} onUpdated={reload} />
      </section>
    </div>
  );

  const renderSettings = () => (
    <>
      <h2 id="lp-settings-title" className="ad-settings-title">
        Settings
      </h2>

      <section className="ad-panel" aria-labelledby="lp-theme-title">
        <div className="ad-panel__head">
          <h3 id="lp-theme-title">
            Color <em>theme</em>
          </h3>
        </div>
        <ThemePicker userId={user.userId} />
      </section>

      <ReleaseAlertSettings accountEmailsOff={settings?.emailNotifications === false} />

      <section className="ad-panel" aria-labelledby="lp-privacy-title">
        <div className="ad-panel__head">
          <h3 id="lp-privacy-title">
            Notifications <em>&amp; privacy</em>
          </h3>
        </div>
        <AccountSettings userId={user.userId} settings={settings} onUpdated={reload} />
      </section>

      <section className="artist-danger" role="region" aria-labelledby="lp-account-title">
        <div>
          <strong id="lp-account-title">Account</strong>
          <p>Change your password or permanently delete your account. Deletion cannot be undone.</p>
        </div>
        <div className="artist-danger__actions">
          <button type="button" onClick={() => setShowChangePassword(true)} className="artist-btn artist-btn--ghost">
            Change Password
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteWizard(true)}
            className="artist-btn artist-btn--danger"
            aria-label="Delete account permanently"
          >
            <Trash2 size={14} aria-hidden="true" /> Delete Account
          </button>
        </div>
      </section>
    </>
  );

  const renderPanel = () => {
    switch (activeTab) {
      case 'activity':
        return renderActivity();
      case 'earn':
        return renderEarn();
      case 'profile':
        return renderProfile();
      case 'settings':
        return renderSettings();
      case 'home':
      default:
        return renderHome();
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Layout>
      <div className="lp ds">
        <div className="lp__content">
          <header className="ad-head">
            <div className="ad-head__id">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={`${profile.username}'s profile photo`}
                  className="ad-head__avatar"
                  onError={(e) => {
                    console.warn('[Profile] action=load_photo status=fail src=', photoUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="ad-head__avatar ad-head__avatar--placeholder"
                  role="img"
                  aria-label={`${profile.username}'s profile photo placeholder`}
                >
                  {userInitial}
                </div>
              )}
              <div className="ad-head__copy">
                <div className="ad-head__chips">
                  <span className="ad-chip ad-chip--tier">{level} tier</span>
                  {place && <span className="ad-chip">{place}</span>}
                </div>
                <h1 id="profile-display-name">{profile.username}</h1>
              </div>
            </div>
            <div className="ad-head__actions">
              <Link to={`/user/${user.userId}`} className="artist-btn artist-btn--ghost ad-head__view" aria-label="View your profile">
                <ExternalLink size={17} aria-hidden="true" />
                <span className="ad-head__label" aria-hidden="true">Your profile</span>
              </Link>
              <button
                type="button"
                className={`ad-gear ${activeTab === 'settings' ? 'is-active' : ''}`}
                aria-label="Settings"
                aria-pressed={activeTab === 'settings'}
                onClick={() => goToTab(activeTab === 'settings' ? 'home' : 'settings')}
              >
                <SettingsIcon size={19} aria-hidden="true" />
              </button>
            </div>
          </header>

          <ProfileTabs active={activeTab} onSelect={goToTab} />

          <div
            key={activeTab}
            className="ad-tabpanel"
            role="tabpanel"
            id={`lp-panel-${activeTab}`}
            aria-labelledby={activeTab === 'settings' ? 'lp-settings-title' : `lp-tab-${activeTab}`}
          >
            {renderPanel()}
          </div>
        </div>

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

        <ChangePasswordWizard
          show={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />

        <SupportedArtistPicker
          show={showArtistPicker}
          onClose={() => setShowArtistPicker(false)}
          userId={user.userId}
          currentArtistId={supportedArtist?.userId || null}
          userJurisdictionId={user.jurisdiction?.jurisdictionId}
          userJurisdictionName={user.jurisdiction?.name}
          onSuccess={reload}
        />
      </div>
    </Layout>
  );
};

export default Profile;
