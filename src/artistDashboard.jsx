import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Upload,
  Play,
  FileText,
  Vote,
  Heart,
  Music,
  Trash2,
  Edit3,
  Trophy,
  DollarSign,
  ShieldCheck,
  BarChart3,
  Clock,
  Download,
  SlidersHorizontal,
  ExternalLink,
  Video,
} from 'lucide-react';
import LyricsWizard from './lyricsWizard';
import UploadWizard from './uploadWizard';
import ChangeDefaultSongWizard from './changeDefaultSongWizard';
import SongSalesModal from './SongSalesModal';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import EditSongWizard from './editSongWizard';
import DeleteSongModal from './deleteSongModal';
import TerritoryRankSection from './TerritoryRankSection';
import ReferralCodeCard from './ReferralCodeCard';
import ThemePicker from './ThemePicker';
import FanbaseFunnel from './fanbaseFunnle';
import SupporterSection from './SupporterSection';
import DemographicsSection from './dempgraphicsSection';
import VoteHistorySection from './VoteHistorySection';
import SupportedArtistPicker from './SupportedArtistPicker';
import SongStatsModal from './SongStatsModal';
import ArtistHomeTab from './ArtistHomeTab';
import buildSetupSteps from './utils/artistSetupSteps';
import PhoneVerificationModal from './phoneVerificationModal';
import './artistDashboard.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import { jsPDF } from 'jspdf';
import ChangePasswordWizard from './changePasswordWizard';
import RevenueSection from './revenueSection';
import VerificationGate from './verificationGate';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
import ArtistPhotosManager from './artistPhotosManager';

// =============================================================================
// ArtistDashboard
//
// ★ Oct 2026 redesign (approved mockup "Unis artist dashboard redesign"):
//   one long scroll of 15 sections → six tabs plus Settings.
//
//     Home      setup progress · this week · where you stand · featured song ·
//               share balance · supporters            (ArtistHomeTab.jsx)
//     Music     songs (stats, sales, edit, lyrics, delete) · videos
//     Fans      fan funnel · supporters · demographics
//     Races     score / votes / wins / level · territory rank · trophy case
//     Earnings  phone check · revenue · refer & earn
//     Profile   your page · links (one Save) · photos · agreement
//     Settings  (gear) color theme · who you support · vote history · account
//
//   The open tab lives in the URL hash (/artistDashboard#earnings), so any page
//   can link straight to a tab and Back returns to the previous tab.
//
//   Fixes that came with it: the every-visit "Thank You!" pop-up is gone; the
//   dead "Fanbase" jump button went with the jump grid; "Verify" opens phone
//   verification instead of scrolling to Refer & earn; followers are shown;
//   the top numbers are this week vs last week; listener/account items moved
//   to Settings; links save once with a toast instead of an alert per field.
// =============================================================================

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'music', label: 'Music' },
  { id: 'fans', label: 'Fans' },
  { id: 'races', label: 'Races' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'profile', label: 'Profile' },
];
const PANEL_IDS = [...TABS.map((t) => t.id), 'settings'];
const tabFromHash = (hash) => {
  const id = String(hash || '').replace(/^#/, '');
  return PANEL_IDS.includes(id) ? id : 'home';
};

const TOAST_MS = 3200;

const LINK_FIELDS = [
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/yourname', type: 'url' },
  { key: 'tiktokUrl', label: 'TikTok', placeholder: 'https://tiktok.com/@yourname', type: 'url' },
  { key: 'twitterUrl', label: 'X (Twitter)', placeholder: 'https://x.com/yourname', type: 'url' },
  { key: 'youtubeUrl', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel', type: 'url' },
  { key: 'contactEmail', label: 'Contact email', placeholder: 'you@example.com', type: 'email' },
];

// ---------------------------------------------------------------------------
// Small inline loader / error shown per section while data is in flight
// ---------------------------------------------------------------------------
const SectionLoader = ({ label = 'Loading...' }) => (
  <div className="ad-loader" role="status">
    <span className="ad-card__spinner" aria-hidden="true" />
    <p>{label}</p>
  </div>
);

const SectionError = ({ message = 'Failed to load.', onRetry }) => (
  <div className="ad-loader ad-loader--error">
    <p>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="artist-btn artist-btn--ghost artist-btn--small" type="button">
        Retry
      </button>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Tab bar — ARIA tabs with arrow-key, Home and End support.
// ---------------------------------------------------------------------------
const DashboardTabs = ({ active, onSelect }) => {
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
    <div className="ad-tabs" role="tablist" aria-label="Dashboard sections">
      {TABS.map((tab, index) => {
        const selected = tab.id === active;
        // Settings has no tab of its own, so keep Home reachable by Tab key then.
        const focusable = selected || (activeIndex === -1 && index === 0);
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`ad-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`ad-panel-${tab.id}`}
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

// ---------------------------------------------------------------------------
// Videos on the Music tab — the artist's own uploads.
// GET /v1/media/videos/artist/{artistId}
// ---------------------------------------------------------------------------
const ArtistVideos = ({ artistId, onUpload, refreshKey }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!artistId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiCall({ url: `/v1/media/videos/artist/${artistId}`, method: 'get', useCache: false })
      .then((res) => {
        if (!cancelled) setVideos(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Artist videos fetch failed:', err);
        if (!cancelled) setError('Could not load your videos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  useEffect(() => load(), [load, refreshKey]);

  return (
    <section className="ad-panel" aria-labelledby="ad-videos-title">
      <div className="ad-panel__head">
        <h2 id="ad-videos-title">
          Videos {!loading && !error && <span className="ad-count">{videos.length}</span>}
        </h2>
      </div>
      {loading ? (
        <SectionLoader label="Loading your videos..." />
      ) : error ? (
        <SectionError message={error} onRetry={load} />
      ) : videos.length === 0 ? (
        <div className="artist-empty-state">
          <Video size={34} aria-hidden="true" />
          <h3>No videos yet</h3>
          <p>Upload a performance, a cover or a music video. Fans can watch and comment on it from your page.</p>
          <button type="button" className="artist-btn artist-btn--primary" onClick={onUpload}>
            <Upload size={14} aria-hidden="true" /> Upload a video
          </button>
        </div>
      ) : (
        <ul className="ad-videos">
          {videos.map((v) => {
            const id = v.videoId || v.id;
            const art = buildUrl(v.artworkUrl);
            return (
              <li key={id} className="ad-video">
                <Link to={`/video/${id}`} className="ad-video__thumb" aria-label={`Watch ${v.title}`}>
                  {art ? <img src={art} alt="" /> : <span className="ad-video__placeholder" aria-hidden="true" />}
                  <span className="ad-video__play" aria-hidden="true">
                    <Play size={16} fill="currentColor" />
                  </span>
                </Link>
                <div className="ad-video__meta">
                  <strong>{v.title}</strong>
                  <span>
                    {Number(v.playCount || 0).toLocaleString()} plays · {Number(v.likes || 0).toLocaleString()} likes
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const ArtistDashboard = () => {
  const { user, loading: authLoading, authLoaded, isGuest, refreshUser } = useAuth();
  const { triggerGate, gateProps } = useAuthGate();
  const location = useLocation();
  const navigate = useNavigate();

  // ★ ROOT-CAUSE FIX (stale-session bug): open the auth gate when the session
  //   has died (expired JWT → 401 → AuthContext clears `user`), instead of
  //   leaving the artist on a bare "Please log in to view dashboard." string.
  useEffect(() => {
    if (authLoaded && isGuest) triggerGate('profile');
  }, [authLoaded, isGuest, triggerGate]);
  const { requestPlay } = useContext(PlayerContext);

  // ---- Tabs (kept in the URL hash) ----------------------------------------
  const activeTab = tabFromHash(location.hash);
  const goToTab = useCallback(
    (id) => {
      navigate({ hash: id === 'home' ? '' : `#${id}` });
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          /* jsdom and old browsers */
        }
      }
    },
    [navigate]
  );

  // ---- Toast (replaces alert()) -------------------------------------------
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message, tone = 'info') => {
    setToast({ message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // ---- Core data ---------------------------------------------------------
  const [userProfile, setUserProfile] = useState(null);
  const [songs, setSongs] = useState([]);
  const [defaultSong, setDefaultSong] = useState(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [coreError, setCoreError] = useState(null);

  // ---- Stats -------------------------------------------------------------
  const [supporters, setSupporters] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [referralCode, setReferralCode] = useState(null);
  const [supportedArtist, setSupportedArtist] = useState(null);
  const [pendingSupportedArtist, setPendingSupportedArtist] = useState(null);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [statsSong, setStatsSong] = useState(null);
  const [salesSong, setSalesSong] = useState(null);

  // ---- Awards ------------------------------------------------------------
  const [awards, setAwards] = useState([]);
  const [awardsPage, setAwardsPage] = useState(0);
  const [hasMoreAwards, setHasMoreAwards] = useState(true);
  const [awardsLoading, setAwardsLoading] = useState(true);
  const [awardsError, setAwardsError] = useState(null);
  const [loadingMoreAwards, setLoadingMoreAwards] = useState(false);
  const [awardTab, setAwardTab] = useState('artist');
  const [songAwards, setSongAwards] = useState([]);
  const [songAwardsPage, setSongAwardsPage] = useState(0);
  const [hasMoreSongAwards, setHasMoreSongAwards] = useState(true);
  const [songAwardsLoading, setSongAwardsLoading] = useState(true);
  const [songAwardsError, setSongAwardsError] = useState(null);
  const [loadingMoreSongAwards, setLoadingMoreSongAwards] = useState(false);

  // ---- UI state ----------------------------------------------------------
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDefaultSongWizard, setShowDefaultSongWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [songToDelete, setSongToDelete] = useState(null);
  const [showLyricsWizard, setShowLyricsWizard] = useState(false);
  const [lyricsSong, setLyricsSong] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showArtistPicker, setShowArtistPicker] = useState(false);
  const [cancellingPending, setCancellingPending] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [videosRefreshKey, setVideosRefreshKey] = useState(0);

  // ---- Links form (Profile tab) -----------------------------------------
  const [links, setLinks] = useState(() => Object.fromEntries(LINK_FIELDS.map((f) => [f.key, ''])));
  const [savingLinks, setSavingLinks] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch helpers
  // -----------------------------------------------------------------------
  const fetchCore = useCallback(async (userId) => {
    setCoreLoading(true);
    setCoreError(null);

    try {
      const [summaryRes, songsRes, defaultSongRes] = await Promise.all([
        apiCall({ url: `/v1/users/profile-summary/${userId}`, method: 'get', useCache: false }),
        apiCall({ url: `/v1/media/songs/artist/${userId}`, method: 'get', useCache: false }),
        apiCall({ url: `/v1/users/${userId}/default-song`, method: 'get', useCache: false }).catch(() => ({ data: null })),
      ]);

      const summary = summaryRes.data;
      const profile = summary?.profile;

      if (!profile) {
        throw new Error('Profile summary did not include a profile payload.');
      }

      setUserProfile(profile);
      setReferralCode(summary?.referralCode || null);
      setSupportedArtist(summary?.supportedArtist || null);
      setPendingSupportedArtist(summary?.pendingSupportedArtist || null);
      setSongs(songsRes.data || []);
      setDefaultSong(defaultSongRes.data);

      setTotalPlays(profile.totalPlays || 0);
      setTotalVotes(profile.totalVotes || summary?.voteHistory?.totalCount || 0);
    } catch (err) {
      console.error('Core data fetch failed:', err);
      setCoreError('Failed to load your dashboard. Please try again.');
    } finally {
      setCoreLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (userId) => {
    try {
      const [supportersRes, followersRes, totalPlaysRes, totalVotesRes, earningsRes, stripeRes, payoutsRes] =
        await Promise.all([
          apiCall({ url: `/v1/users/${userId}/supporters/count`, method: 'get', useCache: false }).catch(() => ({ data: { count: 0 } })),
          apiCall({ url: `/v1/users/${userId}/followers/count`, method: 'get', useCache: false }).catch(() => ({ data: { count: 0 } })),
          apiCall({ url: `/v1/users/${userId}/total-plays`, method: 'get', useCache: false }).catch(() => ({ data: { totalPlays: 0 } })),
          apiCall({ url: `/v1/users/${userId}/total-votes`, method: 'get', useCache: false }).catch(() => ({ data: { totalVotes: 0 } })),
          apiCall({ url: '/v1/earnings/my-summary', method: 'get', useCache: false }).catch(() => ({ data: null })),
          apiCall({ url: '/v1/stripe/status', method: 'get', useCache: false }).catch(() => ({ data: null })),
          apiCall({ url: '/v1/stripe/payouts', method: 'get', useCache: false }).catch(() => ({ data: [] })),
        ]);

      setSupporters(supportersRes.data?.count || 0);
      setFollowers(followersRes.data?.count || 0);
      setTotalPlays(totalPlaysRes.data?.totalPlays || 0);
      setTotalVotes(totalVotesRes.data?.totalVotes || 0);

      if (earningsRes.data) setEarningsSummary(earningsRes.data);
      if (stripeRes.data) setStripeStatus(stripeRes.data);
      if (payoutsRes.data) setPayoutHistory(payoutsRes.data);
    } catch (err) {
      console.error('Stats fetch failed:', err);
    }
  }, []);

  const fetchAwards = useCallback(async (userId) => {
    setAwardsLoading(true);
    setAwardsError(null);
    try {
      const res = await apiCall({ url: `/v1/awards/artist/${userId}?limit=10&offset=0`, method: 'get', useCache: false });
      const data = res.data || [];
      setAwards(data);
      setAwardsPage(0);
      setHasMoreAwards(data.length === 10);
    } catch (err) {
      console.error('Awards fetch failed:', err);
      setAwardsError('Could not load awards.');
      setAwards([]);
    } finally {
      setAwardsLoading(false);
    }
  }, []);

  const fetchSongAwards = useCallback(async (userId) => {
    setSongAwardsLoading(true);
    setSongAwardsError(null);
    try {
      const res = await apiCall({ url: `/v1/awards/artist/${userId}/songs?limit=10&offset=0`, method: 'get', useCache: false });
      const data = res.data || [];
      setSongAwards(data);
      setSongAwardsPage(0);
      setHasMoreSongAwards(data.length === 10);
    } catch (err) {
      console.error('Song awards fetch failed:', err);
      setSongAwardsError('Could not load song awards.');
      setSongAwards([]);
    } finally {
      setSongAwardsLoading(false);
    }
  }, []);

  const loadMoreSongAwards = async () => {
    setLoadingMoreSongAwards(true);
    try {
      const nextPage = songAwardsPage + 1;
      const res = await apiCall({
        url: `/v1/awards/artist/${user.userId}/songs?limit=10&offset=${nextPage * 10}`,
        method: 'get',
        useCache: false,
      });
      const newAwards = res.data || [];
      setSongAwards((prev) => [...prev, ...newAwards]);
      setSongAwardsPage(nextPage);
      setHasMoreSongAwards(newAwards.length === 10);
    } catch (err) {
      console.error('Failed to load more song awards:', err);
    } finally {
      setLoadingMoreSongAwards(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user?.userId) return;
    const userId = user.userId;
    fetchCore(userId);
    fetchStats(userId);
    fetchAwards(userId);
    fetchSongAwards(userId);
  }, [user?.userId, authLoading, fetchCore, fetchStats, fetchAwards, fetchSongAwards]);

  // Keep the links form in step with the saved profile.
  useEffect(() => {
    if (!userProfile) return;
    setLinks(Object.fromEntries(LINK_FIELDS.map((f) => [f.key, userProfile[f.key] || ''])));
  }, [userProfile]);

  // -----------------------------------------------------------------------
  // Early returns
  // -----------------------------------------------------------------------
  if (authLoading) return <div>Loading...</div>;
  if (!user) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="artist-dashboard ad-center">Please sign in to view your dashboard.</div>
        <AuthGateSheet {...gateProps} />
      </Layout>
    );
  }

  if (coreLoading) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="artist-dashboard ad-center">
          <SectionLoader label="Loading your dashboard..." />
        </div>
      </Layout>
    );
  }

  if (coreError) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="artist-dashboard ad-center">
          <SectionError message={coreError} onRetry={() => fetchCore(user.userId)} />
        </div>
      </Layout>
    );
  }

  // -----------------------------------------------------------------------
  // Derived display values
  // -----------------------------------------------------------------------
  const displayName = userProfile.username || 'Artist';
  const displayPhoto = buildUrl(userProfile.photoUrl) || backimage;
  const hasOwnPhoto = Boolean(userProfile.photoUrl);
  const displayBio = userProfile.bio || 'No bio yet. Add one from Edit profile.';
  const artistInitial = displayName.charAt(0).toUpperCase();
  const levelLabel = userProfile.level || 'Silver';
  const isArtistRole = userProfile?.role === 'artist';

  const artistJurisdiction = userProfile.jurisdiction?.name || userProfile.jurisdictionName || null;
  const artistGenre = userProfile.genre?.name || userProfile.genreName || null;
  const placeLine = [artistJurisdiction, artistGenre].filter(Boolean).join(' · ');

  const featuredArtwork = buildUrl(defaultSong?.artworkUrl) || displayPhoto || backimage;
  const recentAward = awards?.[0] || null;
  const recentSongAward = songAwards?.[0] || null;

  const isStripeReady = Boolean(stripeStatus?.onboardingComplete && stripeStatus?.payoutsEnabled);
  const referralCount = Number(earningsSummary?.referralCount || 0);

  const pendingEffective = pendingSupportedArtist?.effectiveDate
    ? new Date(pendingSupportedArtist.effectiveDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;

  const formatAwardDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getAwardTitle = (interval, type = 'artist') => {
    const name = (interval?.name || '').toLowerCase();
    const subject = type === 'song' ? 'Song' : 'Artist';
    if (name === 'daily' || name.includes('day')) return `${subject} of the Day`;
    if (name === 'weekly' || name.includes('week')) return `${subject} of the Week`;
    if (name === 'monthly' || name.includes('month')) return `${subject} of the Month`;
    if (name.includes('quarter')) return `${subject} of the Quarter`;
    if (name.includes('midterm') || name.includes('semi')) return `${subject} of the Midterm`;
    if (name.includes('year') || name.includes('annual')) return `${subject} of the Year`;
    return interval?.name ? `${interval.name} ${subject} Award` : `${subject} Award`;
  };

  const intervalBadge = (interval) => {
    const name = (interval?.name || '').toLowerCase();
    if (name.includes('daily')) return 'Day';
    if (name.includes('day')) return 'Day';
    if (name.includes('week')) return 'Week';
    if (name.includes('month')) return 'Month';
    if (name.includes('quarter')) return 'Quarter';
    if (name.includes('midterm') || name.includes('semi')) return 'Midterm';
    if (name.includes('year') || name.includes('annual')) return 'Year';
    return interval?.name || 'Award';
  };

  const formatIsrc = (isrc) => {
    if (!isrc || isrc.length !== 12) return isrc || '';
    return `${isrc.slice(0, 2)}-${isrc.slice(2, 5)}-${isrc.slice(5, 7)}-${isrc.slice(7)}`;
  };

  const latestWin = recentAward
    ? [getAwardTitle(recentAward.interval, 'artist'), recentAward.jurisdiction?.name].filter(Boolean).join(', ') +
      (recentAward.awardDate ? ` · ${formatAwardDate(recentAward.awardDate)}` : '')
    : null;

  const setupSteps = buildSetupSteps({
    userProfile,
    user,
    songs,
    defaultSong,
    isStripeReady,
    referralCount,
    isArtistRole,
  });

  const winsCount = awards.length + songAwards.length;
  const winsMore = hasMoreAwards || hasMoreSongAwards;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const refetchDefaultSong = () => {
    apiCall({ url: `/v1/users/${user.userId}/default-song`, method: 'get', useCache: false })
      .then((res) => setDefaultSong(res.data))
      .catch(() => setDefaultSong(null));
  };

  const refetchSongs = () =>
    apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get', useCache: false }).then((res) =>
      setSongs(res.data || [])
    );

  // ★ play-flow: no own /play POST. The Player counts the play once the
  //   listener crosses the 15s/25% threshold; we only tag the source.
  const playSupportedArtistSong = () => {
    if (!supportedArtist?.defaultSong) {
      showToast('This artist has not set a featured song yet.');
      return;
    }
    const song = supportedArtist.defaultSong;
    const songId = song.songId || song.id;
    const songUrl = buildUrl(song.fileUrl);
    const artworkUrl = buildUrl(song.artworkUrl) || buildUrl(supportedArtist.photoUrl);
    if (!songUrl) return;
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
      artwork: artworkUrl,
      artworkUrl,
      source: 'dashboard-support',
    });
  };

  const playDefaultSong = () => {
    if (!defaultSong) {
      setShowDefaultSongWizard(true);
      return;
    }
    const songId = defaultSong.songId || defaultSong.id;
    const songUrl = buildUrl(defaultSong.fileUrl);
    const artworkUrl = buildUrl(defaultSong.artworkUrl) || displayPhoto;
    if (!songUrl) {
      showToast('This featured song is missing its audio file.', 'error');
      return;
    }
    requestPlay({
      type: 'song',
      id: songId,
      songId,
      url: songUrl,
      fileUrl: songUrl,
      title: defaultSong.title,
      artist: displayName,
      artistName: displayName,
      artistId: user.userId,
      artwork: artworkUrl,
      artworkUrl,
      source: 'dashboard',
    });
  };

// ★ item 2a: launch-ready ownership & revenue-share agreement
  const downloadOwnershipContract = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const contentW = pageW - margin * 2;
    const bottom = pageH - 64;
    const lineH = 14;
    let y = margin;
    let pageNum = 1;

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const watermark = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(120);
      doc.setTextColor(242, 243, 245);
      doc.text('UNIS', pageW / 2, pageH / 2 + 40, { align: 'center', angle: 32 });
    };

    const footer = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Unis Music Corporation · Artist Ownership & Revenue Share Agreement', margin, pageH - 36);
      doc.text(`Page ${pageNum}`, pageW - margin, pageH - 36, { align: 'right' });
    };

    const addPageBreak = () => {
      footer();
      doc.addPage();
      pageNum += 1;
      watermark();
      y = margin;
    };

    const need = (h) => {
      if (y + h > bottom) addPageBreak();
    };

    const h2 = (txt) => {
      need(lineH * 2.4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(17, 17, 17);
      doc.text(txt, margin, y);
      y += lineH + 3;
    };

    const p = (txt) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(45, 45, 45);
      const lines = doc.splitTextToSize(txt, contentW);
      lines.forEach((ln) => {
        need(lineH);
        doc.text(ln, margin, y);
        y += lineH;
      });
      y += 6;
    };

    watermark();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(12, 12, 12);
    doc.text('ARTIST OWNERSHIP &', pageW / 2, y + 6, { align: 'center' });
    doc.text('REVENUE SHARE AGREEMENT', pageW / 2, y + 30, { align: 'center' });
    y += 56;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Effective Date: ${today}`, pageW / 2, y, { align: 'center' });
    y += 28;

    p(`This Artist Ownership & Revenue Share Agreement (the "Agreement") is entered into as of the Effective Date above, by and between Unis Music Corporation, a New York corporation and wholly-owned subsidiary of Lamb Services, Inc. ("Unis," "we," or "us"), and ${displayName} ("Artist," "you"), an independent music creator. Unis and Artist are each a "Party" and together the "Parties."`);

    h2('1. Definitions');
    p('"Platform" means the Unis hyperlocal music discovery, voting, and sales service, including its websites, mobile applications, and related services. "Content" means the audio recordings, artwork, lyrics, metadata, and other materials you upload. "Master Recording" means a sound recording you own or control. "Net Revenue" means amounts actually received by Unis attributable to your Content, less payment-processor fees, refunds, chargebacks, and applicable taxes.');

    h2('2. Ownership of Your Content');
    p('You retain all right, title, and interest in and to your Content, including all Master Recordings and underlying compositions you own or control. Nothing in this Agreement transfers ownership of your Content to Unis. Unis claims no ownership of your music.');

    h2('3. License Grant');
    p('You grant Unis a non-exclusive, worldwide, royalty-bearing, revocable license to host, store, reproduce, stream, publicly perform, display, promote, and (where you enable sales or downloads) distribute your Content on and through the Platform for the purpose of operating its discovery, voting, and sales features. This license exists only while your Content remains on the Platform and terminates as described in Section 8.');

    h2('4. Revenue Share Schedule');
    p('Subject to the payment terms below, Unis will pay you the following share of Net Revenue attributable to your Content in each revenue stream:');

    // ★ item 2a + item 11 FLAG: confirm these percentages against the published
    // terms at artists.unismusic.com AND the reconciled EarningsService before
    // this document is distributed to any artist.
    const rows = [
      ['Direct song sales & downloads', '90% to Artist*'],
      ['Unis Plus subscriptions, by plays', '60% to Artist'],
      ['Audio ads on your songs (coming soon)', '60% to Artist'],
      ['Community Share from your supporters', '15% to Artist'],
    ];
    // * The sales/support fee is PlatformFees on the backend (utils/platformFee.js here).
    const rowH = 18;
    need(rowH * rows.length + 10);
    rows.forEach((r, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(247, 248, 250);
        doc.rect(margin, y - 12, contentW, rowH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(40);
      doc.text(r[0], margin + 8, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20);
      doc.text(r[1], pageW - margin - 8, y, { align: 'right' });
      y += rowH;
    });
    y += 10;
    p('* On song sales and direct support, Unis\'s fee is 10% of the amount paid or, if higher, its card-processing cost for that payment plus $0.01, so on payments under about $4.35 you receive the amount less that cost and one cent. The minimum song price is $0.94, and buyers pay the listed price with no added fees.');
    p('Revenue-stream definitions and the methodology for allocating pooled revenue (such as Unis Plus and the Community Share) are described in the then-current published terms at artists.unismusic.com, which are incorporated by reference. Where this Schedule and the published terms conflict, the published terms control.');

    h2('5. Referral Program');
    p('Each month Unis shares its income with members through the Community Share, divided by counted listening, as described in the Terms of Service. Where you refer new members using your referral code, you receive part of their monthly share: 10% for first-tier (direct) referrals, 5% for second-tier referrals, and 2% for third-tier referrals. If fans name you as the artist they support, you receive 15% of each supporter\'s monthly share. No one is paid for viewing or clicking ads. Rates may be adjusted prospectively on notice.');

    h2('6. Payments and Payouts');
    p('Unis processes artist payouts through Stripe. You are responsible for completing Stripe onboarding and providing accurate payout information. Song sales and direct support are credited to your Stripe account when they are paid. Community Share earnings can be withdrawn to your Stripe account once your balance reaches the minimum payout threshold (currently $50.00). Stripe pays your bank once a month, on or about the 1st, and Unis covers Stripe\'s payout fees. Unis files IRS Form 1099 information returns through Stripe where the law requires them. You are solely responsible for all taxes on amounts you receive. Unis may withhold or offset amounts subject to refund, chargeback, or fraud review.');

    h2('7. Your Representations and Warranties');
    p("You represent and warrant that: (a) you own or control all rights necessary to grant the license in Section 3; (b) your Content does not infringe any third party's copyright, trademark, publicity, privacy, or other rights; (c) you have paid or will pay any co-writers, producers, featured performers, or rights holders any share of the revenue you receive that is due to them; and (d) your Content complies with the Platform's content standards and applicable law.");

    h2('8. Term and Termination');
    p('This Agreement begins on the Effective Date and continues until terminated. You may remove your Content or close your account at any time, which terminates the Section 3 license on a going-forward basis (subject to cached copies and completed transactions). Unis may suspend or remove Content that violates this Agreement, the content standards, or law, including in response to a valid DMCA notice. Provisions that by their nature should survive termination — including ownership, payment for amounts already earned, warranties, and limitation of liability — survive.');

    h2('9. Copyright and DMCA');
    p('Unis operates a notice-and-takedown process under the Digital Millennium Copyright Act. If Unis receives a valid infringement notice concerning your Content, Unis may remove or disable access to that Content. You may submit a counter-notice where permitted by law. Repeat infringers may be terminated.');

    h2('10. Limitation of Liability');
    p("To the maximum extent permitted by law, Unis will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits or revenues, arising out of or relating to this Agreement. Unis's total aggregate liability arising out of this Agreement will not exceed the greater of the amounts paid or payable to you in the twelve months preceding the claim, or $100.");

    h2('11. Independent Relationship');
    p('The Parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture, employment, or agency relationship, and neither Party may bind the other.');

    h2('12. Governing Law and Disputes');
    p('This Agreement is governed by the laws of the State of New York, without regard to its conflict-of-laws rules. The state and federal courts located in New York County, New York will have jurisdiction over disputes not otherwise subject to an agreed dispute-resolution process.');

    h2('13. Entire Agreement; Changes');
    p('This Agreement, together with the published terms incorporated by reference, is the entire agreement between the Parties regarding its subject matter. Unis may update the published terms prospectively; your continued use of the Platform after an update constitutes acceptance. No modification by you is effective unless agreed in writing by Unis.');

    need(140);
    y += 6;
    h2('Acknowledgement & Signatures');
    p('By downloading, retaining, or continuing to use the Platform to distribute your Content, you acknowledge that you have read, understood, and agree to this Agreement.');

    y += 24;
    const sigY = y + 24;
    doc.setDrawColor(120);
    doc.line(margin, sigY, margin + 220, sigY);
    doc.line(pageW - margin - 220, sigY, pageW - margin, sigY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(70);
    doc.text(`${displayName} (Artist)`, margin, sigY + 14);
    doc.text('Unis Music Corporation', pageW - margin - 220, sigY + 14);
    doc.text(`Date: ${today}`, margin, sigY + 30);
    doc.text('By: Authorized Officer', pageW - margin - 220, sigY + 30);

    footer();
    doc.save(`Unis_Artist_Agreement_${displayName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleUploadSuccess = () => {
    setShowUploadWizard(false);
    refetchSongs();
    setVideosRefreshKey((k) => k + 1);
  };

  const handleProfileUpdate = () => {
    apiCall({ url: `/v1/users/profile-summary/${user.userId}`, method: 'get', useCache: false })
      .then((res) => {
        const summary = res.data;
        setUserProfile(summary.profile);
        setReferralCode(summary.referralCode || null);
        setSupportedArtist(summary.supportedArtist || null);
        setPendingSupportedArtist(summary.pendingSupportedArtist || null);
      })
      .catch((err) => console.error('Failed to refresh profile summary:', err));
  };

  const cancelPendingArtist = async () => {
    if (!user?.userId) return;
    setCancellingPending(true);
    try {
      await apiCall({ method: 'delete', url: `/v1/users/${user.userId}/supported-artist/pending` });
      handleProfileUpdate();
    } catch (err) {
      console.error('Failed to cancel pending supported-artist change:', err);
      showToast('Could not cancel the pending change. Please try again.', 'error');
    } finally {
      setCancellingPending(false);
    }
  };

  // ★ one Save for every link (was a PUT and an alert() per field on blur).
  //   The backend only accepts http(s) links, so a bare "instagram.com/me"
  //   gets https:// added here instead of bouncing back as an error.
  const normalizeLink = (field, raw) => {
    const value = (raw || '').trim();
    if (!value || field.type !== 'url' || /^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
  };
  const linksDirty = LINK_FIELDS.some((f) => (links[f.key] || '') !== (userProfile[f.key] || ''));
  const handleSaveLinks = async (e) => {
    e?.preventDefault?.();
    if (savingLinks) return;
    setSavingLinks(true);
    try {
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${user.userId}`,
        data: Object.fromEntries(LINK_FIELDS.map((f) => [f.key, normalizeLink(f, links[f.key])])),
      });
      handleProfileUpdate();
      showToast('Links saved.', 'success');
    } catch (err) {
      console.error('Failed to save links:', err);
      showToast(err?.response?.data?.error || 'Could not save your links. Please try again.', 'error');
    } finally {
      setSavingLinks(false);
    }
  };

  const copyReferralCode = () => {
    if (!referralCode) {
      showToast('Your code is not ready yet.');
      return;
    }
    if (!navigator.clipboard?.writeText) {
      showToast(`Your code: ${referralCode}`);
      return;
    }
    navigator.clipboard
      .writeText(referralCode)
      .then(() => showToast('Code copied. Share it with your people.', 'success'))
      .catch(() => showToast(`Your code: ${referralCode}`));
  };

  const handleSetupAction = (key) => {
    switch (key) {
      case 'profile':
        setShowEditProfile(true);
        break;
      case 'featured':
        setShowDefaultSongWizard(true);
        break;
      case 'second-song':
        setShowUploadWizard(true);
        break;
      case 'links':
        goToTab('profile');
        break;
      case 'phone':
        setShowPhoneVerify(true);
        break;
      case 'payouts':
        goToTab('earnings');
        break;
      case 'share':
        copyReferralCode();
        break;
      default:
        break;
    }
  };

  const handlePhoneVerified = async () => {
    setShowPhoneVerify(false);
    try {
      await refreshUser?.();
    } catch {
      /* non-fatal: the next profile load reflects it */
    }
    showToast('Phone verified.', 'success');
  };

  const handleDeleteSongClick = (song) => {
    if (songs.length <= 1) {
      showToast('You need at least one song. Upload another before deleting this one.');
      return;
    }
    if (defaultSong?.songId === song.songId) {
      showToast('This is your featured song. Choose a different featured song first.');
      setShowDefaultSongWizard(true);
      return;
    }
    setSongToDelete(song);
  };

  const handleConfirmDelete = async () => {
    if (!songToDelete) return;
    setDeletingSongId(songToDelete.songId);
    try {
      await apiCall({ method: 'delete', url: `/v1/media/song/${songToDelete.songId}` });
      await refetchSongs();
      setSongToDelete(null);
      showToast('Song deleted.', 'success');
    } catch (err) {
      console.error('Failed to delete song:', err);
      showToast('Could not delete the song. Please try again.', 'error');
    } finally {
      setDeletingSongId(null);
    }
  };

  const loadMoreAwards = async () => {
    setLoadingMoreAwards(true);
    try {
      const nextPage = awardsPage + 1;
      const res = await apiCall({
        url: `/v1/awards/artist/${user.userId}?limit=10&offset=${nextPage * 10}`,
        method: 'get',
        useCache: false,
      });
      const newAwards = res.data || [];
      setAwards((prev) => [...prev, ...newAwards]);
      setAwardsPage(nextPage);
      setHasMoreAwards(newAwards.length === 10);
    } catch (err) {
      console.error('Failed to load more awards:', err);
    } finally {
      setLoadingMoreAwards(false);
    }
  };

  // -----------------------------------------------------------------------
  // Tab panels
  // -----------------------------------------------------------------------
  const renderMusic = () => (
    <>
      <section className="ad-panel" aria-labelledby="ad-songs-title">
        <div className="ad-panel__head">
          <h2 id="ad-songs-title">
            Songs <span className="ad-count">{songs.length}</span>
          </h2>
          <button type="button" className="artist-btn artist-btn--primary artist-btn--small" onClick={() => setShowUploadWizard(true)}>
            <Upload size={14} aria-hidden="true" /> Upload a song or video
          </button>
        </div>

        <div className="artist-catalog">
          {songs.length > 0 ? (
            songs.map((song, index) => {
              const songArtwork = buildUrl(song.artworkUrl) || displayPhoto || backimage;
              const isFeatured = defaultSong?.songId === song.songId;
              return (
                <article
                  key={song.songId || song.id || index}
                  className={`artist-song-card ${isFeatured ? 'artist-song-card--featured' : ''}`}
                >
                  <div className="artist-song-card__ambient" style={{ backgroundImage: `url(${songArtwork})` }} aria-hidden="true" />
                  <img src={songArtwork} alt={`${song.title} artwork`} className="artist-song-card__art" />

                  <div className="artist-song-card__body">
                    <div className="artist-song-card__title-row">
                      <div>
                        <h3>{song.title}</h3>
                        <p>{isFeatured ? 'Featured song' : 'Song'}</p>
                      </div>
                      {isFeatured && <span className="artist-song-card__badge">Featured</span>}
                    </div>

                    <div className="artist-song-card__stats">
                      <span>
                        <Play size={12} aria-hidden="true" /> {song.playCount || song.plays || 0} plays
                      </span>
                      <span>
                        <Vote size={12} aria-hidden="true" /> {song.votes || song.voteCount || 0} votes
                      </span>
                      {song.isrc && (
                        <span>
                          <ShieldCheck size={12} aria-hidden="true" /> ISRC {formatIsrc(song.isrc)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="artist-song-card__actions">
                    <button type="button" onClick={() => setStatsSong(song)} aria-label={`View stats for ${song.title}`}>
                      <BarChart3 size={16} />
                    </button>
                    <button type="button" onClick={() => setSalesSong(song)} aria-label={`View sales for ${song.title}`}>
                      <DollarSign size={16} />
                    </button>
                    <button type="button" onClick={() => setEditingSong(song)} aria-label={`Edit ${song.title}`}>
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLyricsSong(song);
                        setShowLyricsWizard(true);
                      }}
                      aria-label={`Edit lyrics for ${song.title}`}
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSongClick(song)}
                      disabled={deletingSongId === song.songId}
                      aria-label={`Delete ${song.title}`}
                    >
                      {deletingSongId === song.songId ? '...' : <Trash2 size={16} />}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="artist-empty-state">
              <Music size={34} aria-hidden="true" />
              <h3>No songs yet</h3>
              <p>Upload your first song and start building your local signal.</p>
              <button type="button" className="artist-btn artist-btn--primary" onClick={() => setShowUploadWizard(true)}>
                <Upload size={14} aria-hidden="true" /> Upload first song
              </button>
            </div>
          )}
        </div>
      </section>

      <ArtistVideos artistId={user.userId} onUpload={() => setShowUploadWizard(true)} refreshKey={videosRefreshKey} />
    </>
  );

  const renderFans = () => (
    <>
      <FanbaseFunnel artistId={user.userId} artistPhoto={displayPhoto} artistName={displayName} ambientImage={featuredArtwork} />
      <SupporterSection artistId={user.userId} />
      <DemographicsSection artistId={user.userId} />
    </>
  );

  const renderAwardsList = (type) => {
    const isSong = type === 'song';
    const list = isSong ? songAwards : awards;
    const loading = isSong ? songAwardsLoading : awardsLoading;
    const error = isSong ? songAwardsError : awardsError;
    const hasMore = isSong ? hasMoreSongAwards : hasMoreAwards;
    const loadingMore = isSong ? loadingMoreSongAwards : loadingMoreAwards;
    const recent = isSong ? recentSongAward : recentAward;
    const onRetry = () => (isSong ? fetchSongAwards(user.userId) : fetchAwards(user.userId));
    const onMore = isSong ? loadMoreSongAwards : loadMoreAwards;

    if (loading) return <SectionLoader label={isSong ? 'Loading song awards...' : 'Loading awards...'} />;
    if (error) return <SectionError message={error} onRetry={onRetry} />;
    if (list.length === 0) {
      return (
        <div className="artist-empty-state">
          {isSong ? <Music size={34} aria-hidden="true" /> : <Trophy size={34} aria-hidden="true" />}
          <h3>{isSong ? 'No song awards yet' : 'No artist awards yet'}</h3>
          <p>
            {isSong
              ? 'When one of your songs wins Song of the Day, Week or Month, it shows up here.'
              : 'Keep collecting plays, likes and votes to earn your first local win.'}
          </p>
        </div>
      );
    }

    const artFor = (award) =>
      isSong ? buildUrl(award?.song?.artworkUrl) || featuredArtwork || displayPhoto : displayPhoto;

    return (
      <>
        <div className="artist-awards-card__featured">
          <div className="artist-awards-card__ambient" style={{ backgroundImage: `url(${artFor(recent)})` }} aria-hidden="true" />
          <div className="artist-awards-card__artwork">
            <img
              src={artFor(recent)}
              alt={isSong ? recent?.song?.title || 'Song award' : `${displayName} artist award`}
              onError={(e) => {
                e.currentTarget.src = displayPhoto;
              }}
            />
            <div className="artist-awards-card__interval-badge">{intervalBadge(recent?.interval)}</div>
          </div>
          <div className="artist-awards-card__info">
            <span>{isSong ? 'Latest song win' : 'Latest win'}</span>
            <h3>{getAwardTitle(recent?.interval, type)}</h3>
            <p>
              {isSong && recent?.song?.title && `"${recent.song.title}" · `}
              {recent?.jurisdiction?.name || 'Location'}
              {!isSong && recent?.genre?.name && ` · ${recent.genre.name}`}
              {recent?.awardDate && <span className="artist-award-date"> · {formatAwardDate(recent.awardDate)}</span>}
            </p>
          </div>
        </div>

        <div className="artist-awards-summary">
          <Trophy size={14} aria-hidden="true" />
          <span>
            {list.length}
            {hasMore ? '+' : ''} {isSong ? 'song ' : ''}
            {list.length === 1 ? 'win' : 'wins'} earned
          </span>
        </div>

        <div className="artist-awards-scroll">
          <div className="artist-awards-list">
            {list.map((award, index) => (
              <div key={award.awardId || index} className="artist-award-row">
                <div className="artist-award-row__ambient" style={{ backgroundImage: `url(${artFor(award)})` }} aria-hidden="true" />
                <img
                  src={artFor(award)}
                  alt={isSong ? award.song?.title || getAwardTitle(award.interval, 'song') : getAwardTitle(award.interval, 'artist')}
                  className="artist-award-row__img"
                  onError={(e) => {
                    e.currentTarget.src = displayPhoto;
                  }}
                />
                <div>
                  <strong>{getAwardTitle(award.interval, type)}</strong>
                  <p>
                    {isSong && award.song?.title && `"${award.song.title}" · `}
                    {award.jurisdiction?.name || 'Location'}
                    {award.genre?.name && ` · ${award.genre.name}`}
                  </p>
                </div>
                <small>{formatAwardDate(award.awardDate)}</small>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              className="artist-btn artist-btn--ghost artist-btn--small artist-awards-more"
              onClick={onMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      </>
    );
  };

  const renderRaces = () => (
    <>
      <div className="ad-tiles" aria-label="Your standing at a glance">
        <div className="ad-tile">
          <span>Score</span>
          <strong>{(userProfile.score || 0).toLocaleString()}</strong>
        </div>
        <div className="ad-tile">
          <span>Votes received</span>
          <strong>{totalVotes.toLocaleString()}</strong>
        </div>
        <div className="ad-tile">
          <span>Wins</span>
          <strong>
            {awardsLoading || songAwardsLoading ? '—' : `${winsCount}${winsMore ? '+' : ''}`}
          </strong>
        </div>
        <div className="ad-tile">
          <span>Level</span>
          <strong>{levelLabel}</strong>
        </div>
      </div>

      <section className="ad-panel" aria-labelledby="ad-rank-title">
        <div className="ad-panel__head">
          <h2 id="ad-rank-title">
            Your rank in every <em>place</em>
          </h2>
        </div>
        <TerritoryRankSection artistId={user.userId} />
      </section>

      <section className="ad-panel artist-trophy-section" aria-labelledby="ad-trophy-title">
        <div className="ad-panel__head">
          <h2 id="ad-trophy-title">
            Trophy <em>case</em>
          </h2>
          <div className="artist-awards-toggle" role="group" aria-label="Award type">
            <button
              type="button"
              aria-pressed={awardTab === 'artist'}
              className={`artist-awards-toggle__btn ${awardTab === 'artist' ? 'artist-awards-toggle__btn--active' : ''}`}
              onClick={() => setAwardTab('artist')}
            >
              Artist
            </button>
            <button
              type="button"
              aria-pressed={awardTab === 'song'}
              className={`artist-awards-toggle__btn ${awardTab === 'song' ? 'artist-awards-toggle__btn--active' : ''}`}
              onClick={() => setAwardTab('song')}
            >
              Songs
            </button>
          </div>
        </div>
        {renderAwardsList(awardTab)}
      </section>
    </>
  );

  const renderEarnings = () => (
    <>
      {!user.phoneVerified && (
        <div className="ad-warn ad-warn--banner">
          <span>Your phone isn&apos;t verified, so your monthly share can&apos;t reach you yet.</span>
          <button type="button" onClick={() => setShowPhoneVerify(true)}>
            Verify now
          </button>
        </div>
      )}

      {isArtistRole && (
        <RevenueSection
          artistId={user.userId}
          artistPhoto={displayPhoto}
          earningsSummary={earningsSummary}
          stripeStatus={stripeStatus}
          payoutHistory={payoutHistory}
          isStripeReady={isStripeReady}
          onPayoutSuccess={() => fetchStats(user.userId)}
        />
      )}

      <section className="ad-panel" aria-labelledby="ad-refer-title">
        <div className="ad-panel__head">
          <h2 id="ad-refer-title">
            Bring your <em>people</em>
          </h2>
        </div>
        <VerificationGate title="Verify your phone to refer & earn">
          <ReferralCodeCard referralCode={referralCode} username={displayName} isArtist />
        </VerificationGate>
      </section>
    </>
  );

  const renderProfile = () => (
    <>
      <div className="ad-two">
        <section className="ad-panel" aria-labelledby="ad-page-title">
          <div className="ad-panel__head">
            <h2 id="ad-page-title">
              Your <em>page</em>
            </h2>
          </div>
          <div className="ad-page">
            {hasOwnPhoto ? (
              <img
                src={displayPhoto}
                alt={`${displayName}'s artist profile`}
                className="ad-page__avatar"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="ad-page__avatar ad-page__avatar--placeholder" aria-hidden="true">
                {artistInitial}
              </span>
            )}
            <div className="ad-page__copy">
              <strong>{displayName}</strong>
              <p className="ad-page__bio">{displayBio}</p>
            </div>
          </div>
          <div className="ad-row">
            <button type="button" className="artist-btn artist-btn--primary" onClick={() => setShowEditProfile(true)}>
              <Edit3 size={14} aria-hidden="true" /> Edit profile
            </button>
            <Link to={`/artist/${user.userId}`} className="artist-btn artist-btn--ghost">
              <ExternalLink size={14} aria-hidden="true" /> View my page
            </Link>
          </div>
          <div className="ad-featured-line">
            <div>
              <span>Featured song</span>
              <strong>{defaultSong?.title || 'Not set'}</strong>
            </div>
            <button type="button" className="artist-btn artist-btn--ghost artist-btn--small" onClick={() => setShowDefaultSongWizard(true)}>
              {defaultSong ? 'Change' : 'Choose'}
            </button>
          </div>
        </section>

        <section className="ad-panel" aria-labelledby="ad-links-title">
          <div className="ad-panel__head">
            <h2 id="ad-links-title">
              Your <em>links</em>
            </h2>
          </div>
          <form className="social-links-edit" onSubmit={handleSaveLinks} noValidate>
            {LINK_FIELDS.map((field) => (
              <div className="social-link-item" key={field.key}>
                <label htmlFor={`social-${field.key}`}>{field.label}</label>
                <input
                  type={field.type}
                  id={`social-${field.key}`}
                  placeholder={field.placeholder}
                  value={links[field.key] || ''}
                  onChange={(e) => setLinks((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="social-input"
                  autoComplete="off"
                />
              </div>
            ))}
            <div className="ad-row">
              <button type="submit" className="artist-btn artist-btn--primary" disabled={savingLinks || !linksDirty}>
                {savingLinks ? 'Saving...' : 'Save links'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="ad-panel" aria-labelledby="ad-photos-title">
        <div className="ad-panel__head">
          <h2 id="ad-photos-title">
            Artist <em>photos</em>
          </h2>
        </div>
        <ArtistPhotosManager artistId={user.userId} />
      </section>

      <section className="ad-panel ad-agreement" aria-labelledby="ad-agreement-title">
        <div>
          <h2 id="ad-agreement-title">
            Your <em>agreement</em>
          </h2>
          <p>You own your music. Download your ownership and revenue share agreement, in your name, any time.</p>
        </div>
        <button type="button" className="artist-btn artist-btn--ghost" onClick={downloadOwnershipContract}>
          <Download size={15} aria-hidden="true" /> Download agreement
        </button>
      </section>
    </>
  );

  const renderSettings = () => (
    <>
      <h2 id="ad-settings-title" className="ad-settings-title">
        Settings
      </h2>

      <section className="ad-panel" aria-labelledby="ad-theme-title">
        <div className="ad-panel__head">
          <h3 id="ad-theme-title">
            Color <em>theme</em>
          </h3>
        </div>
        <ThemePicker userId={user?.userId} />
      </section>

      <section className="ad-panel artist-support-section" aria-labelledby="ad-support-title">
        <div className="ad-panel__head">
          <h3 id="ad-support-title">
            You <em>support</em>
          </h3>
        </div>
        {supportedArtist ? (
          <div className="artist-support-feature">
            <div
              className="artist-support-feature__media"
              style={{
                backgroundImage: `url(${
                  buildUrl(supportedArtist.photoUrl) || buildUrl(supportedArtist.defaultSong?.artworkUrl) || backimage
                })`,
              }}
            />
            <div className="artist-support-feature__overlay" />
            <div className="artist-support-feature__content">
              <span className="artist-support-feature__tag">You support</span>
              <h3>{supportedArtist.username}</h3>
              <p>
                {supportedArtist.defaultSong ? `Featured song: ${supportedArtist.defaultSong.title}` : 'No featured song yet'}
              </p>
              <div className="artist-support-feature__actions">
                {supportedArtist.defaultSong && (
                  <button type="button" className="artist-support-feature__play" onClick={playSupportedArtistSong}>
                    <Play size={13} fill="currentColor" aria-hidden="true" /> Listen
                  </button>
                )}
                <button type="button" className="artist-support-feature__change" onClick={() => setShowArtistPicker(true)}>
                  Change
                </button>
              </div>

              {pendingSupportedArtist && (
                <div className="artist-support-feature__pending" role="status">
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
          </div>
        ) : (
          <div className="artist-empty-state">
            <Heart size={34} aria-hidden="true" />
            <h3>No supported artist yet</h3>
            <p>Every Unis member backs one artist. Choose the artist whose voice you want to amplify. You can change it later.</p>
            <button type="button" className="artist-btn artist-btn--primary" onClick={() => setShowArtistPicker(true)}>
              <Heart size={14} aria-hidden="true" /> Choose an artist
            </button>
          </div>
        )}
      </section>

      <section className="ad-panel" aria-labelledby="ad-votes-title">
        <div className="ad-panel__head">
          <h3 id="ad-votes-title">
            Your <em>votes</em>
          </h3>
        </div>
        <VoteHistorySection userId={user?.userId} />
      </section>

      <section className="artist-danger" aria-labelledby="ad-account-title">
        <div>
          <strong id="ad-account-title">Account</strong>
          <p>Change your password or permanently delete your account. Deletion cannot be undone.</p>
        </div>
        <div className="artist-danger__actions">
          <button type="button" className="artist-btn artist-btn--ghost" onClick={() => setShowChangePassword(true)}>
            Change Password
          </button>
          <button type="button" className="artist-btn artist-btn--danger" onClick={() => setShowDeleteWizard(true)}>
            <Trash2 size={14} aria-hidden="true" /> Delete Account
          </button>
        </div>
      </section>
    </>
  );

  const renderPanel = () => {
    switch (activeTab) {
      case 'music':
        return renderMusic();
      case 'fans':
        return renderFans();
      case 'races':
        return renderRaces();
      case 'earnings':
        return renderEarnings();
      case 'profile':
        return renderProfile();
      case 'settings':
        return renderSettings();
      case 'home':
      default:
        return (
          <ArtistHomeTab
            artistId={user.userId}
            setupSteps={setupSteps}
            onSetupAction={handleSetupAction}
            totals={{ plays: totalPlays, followers, supporters }}
            defaultSong={defaultSong}
            featuredArtwork={featuredArtwork}
            onPlayFeatured={playDefaultSong}
            onChooseFeatured={() => setShowDefaultSongWizard(true)}
            latestWin={latestWin}
            earningsSummary={earningsSummary}
            phoneVerified={Boolean(user.phoneVerified)}
            onVerifyPhone={() => setShowPhoneVerify(true)}
            supportersCount={supporters}
            onGoTab={goToTab}
          />
        );
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Layout backgroundImage={backimage}>
      <div className="artist-dashboard">
        <div className="dashboard-content">
          <header className="ad-head">
            <div className="ad-head__id">
              {hasOwnPhoto ? (
                <img
                  src={displayPhoto}
                  alt=""
                  className="ad-head__avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="ad-head__avatar ad-head__avatar--placeholder" aria-hidden="true">
                  {artistInitial}
                </span>
              )}
              <div className="ad-head__copy">
                <div className="ad-head__chips">
                  <span className="ad-chip ad-chip--tier">{levelLabel} tier</span>
                  {placeLine && <span className="ad-chip">{placeLine}</span>}
                </div>
                <h1 id="artist-dashboard-title">{displayName}</h1>
              </div>
            </div>
            <div className="ad-head__actions">
              <button type="button" className="artist-btn artist-btn--primary" onClick={() => setShowUploadWizard(true)}>
                <Upload size={15} aria-hidden="true" /> Upload
              </button>
              <Link to={`/artist/${user.userId}`} className="artist-btn artist-btn--ghost">
                View my page
              </Link>
              <button
                type="button"
                className={`ad-gear ${activeTab === 'settings' ? 'is-active' : ''}`}
                aria-label="Settings"
                aria-pressed={activeTab === 'settings'}
                onClick={() => goToTab(activeTab === 'settings' ? 'home' : 'settings')}
              >
                <SlidersHorizontal size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          <DashboardTabs active={activeTab} onSelect={goToTab} />

          <div
            key={activeTab}
            className="ad-tabpanel"
            role="tabpanel"
            id={`ad-panel-${activeTab}`}
            aria-labelledby={activeTab === 'settings' ? 'ad-settings-title' : `ad-tab-${activeTab}`}
          >
            {renderPanel()}
          </div>
        </div>

        <div className={`ad-toast ${toast ? 'is-visible' : ''} ${toast ? `is-${toast.tone}` : ''}`} role="status" aria-live="polite">
          {toast?.message}
        </div>

        {/* Wizards and modals */}
        {showUploadWizard && (
          <UploadWizard
            show={showUploadWizard}
            onClose={() => setShowUploadWizard(false)}
            onUploadSuccess={handleUploadSuccess}
            userProfile={userProfile}
          />
        )}

        {showEditProfile && (
          <EditProfileWizard
            show={showEditProfile}
            onClose={() => setShowEditProfile(false)}
            userProfile={userProfile}
            mode="profile"
            onSuccess={handleProfileUpdate}
          />
        )}

        {showDefaultSongWizard && (
          <ChangeDefaultSongWizard
            show={showDefaultSongWizard}
            onClose={() => setShowDefaultSongWizard(false)}
            songs={songs}
            currentDefaultSongId={defaultSong?.songId}
            onSuccess={() => refetchDefaultSong()}
          />
        )}

        {showDeleteWizard && <DeleteAccountWizard show={showDeleteWizard} onClose={() => setShowDeleteWizard(false)} />}

        {editingSong && (
          <EditSongWizard
            show={!!editingSong}
            onClose={() => setEditingSong(null)}
            song={editingSong}
            onSuccess={() => refetchSongs()}
          />
        )}

        {showLyricsWizard && (
          <LyricsWizard
            show={showLyricsWizard}
            onClose={() => {
              setShowLyricsWizard(false);
              setLyricsSong(null);
            }}
            song={lyricsSong}
            onSuccess={() => refetchSongs()}
          />
        )}

        <DeleteSongModal
          show={!!songToDelete}
          songTitle={songToDelete?.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setSongToDelete(null)}
          isDeleting={!!deletingSongId}
        />

        <SupportedArtistPicker
          show={showArtistPicker}
          onClose={() => setShowArtistPicker(false)}
          userId={user.userId}
          currentArtistId={supportedArtist?.userId || null}
          userJurisdictionId={userProfile?.jurisdiction?.jurisdictionId}
          userJurisdictionName={userProfile?.jurisdiction?.name}
          onSuccess={() => {
            setShowArtistPicker(false);
            handleProfileUpdate();
          }}
        />

        <SongStatsModal show={!!statsSong} onClose={() => setStatsSong(null)} artistId={user.userId} song={statsSong} />

        <SongSalesModal show={!!salesSong} onClose={() => setSalesSong(null)} artistId={user.userId} song={salesSong} />

        <PhoneVerificationModal show={showPhoneVerify} onClose={() => setShowPhoneVerify(false)} onVerified={handlePhoneVerified} />

        <ChangePasswordWizard show={showChangePassword} onClose={() => setShowChangePassword(false)} />
      </div>
    </Layout>
  );
};

export default ArtistDashboard;
