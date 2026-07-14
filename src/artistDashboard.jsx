import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import LyricsWizard from './lyricsWizard';
import {
  Upload,
  Play,
  FileText,
  Vote,
  Heart,
  Users,
  X,
  Download,
  Music,
  Trash2,
  Edit3,
  Trophy,
  MapPin,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  Compass,
  Gauge,
  BarChart3,
  Activity,
  Lock,
  Clock, 
  Link2,
  Share2,
  Palette,
  LayoutGrid,
  ImagePlus
} from 'lucide-react';
import UploadWizard from './uploadWizard';
import ChangeDefaultSongWizard from './changeDefaultSongWizard';
import SongSalesModal from './SongSalesModal'; // ★ sales: per-song revenue modal
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import EditSongWizard from './editSongWizard';
import DeleteSongModal from './deleteSongModal';
import VoteHistoryModal from './voteHistoryModal';
import TerritoryRankSection from './TerritoryRankSection'; // ★ territory rank
import ReferralCodeCard from './ReferralCodeCard';
import ThemePicker from './ThemePicker';
import FanbaseFunnel from './fanbaseFunnle'; // ★ analytics: real fanbase funnel section
import SupporterSection from './SupporterSection'; // ★ item 5: supporters split out
import DemographicsSection from './dempgraphicsSection'; // ★ item 6
import VoteHistorySection from './VoteHistorySection';   // ★
import SupportedArtistPicker from './SupportedArtistPicker'; // ★ H: change-artist picker (same component Profile uses)
import './artistDashboard.scss';
import SongStatsModal from './SongStatsModal'; // ★ D: per-song funnel modal
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
import ArtistPhotosManager from './artistPhotosManager';



// ---------------------------------------------------------------------------
// Small inline loader shown per-section while data is in flight
// ---------------------------------------------------------------------------
const SectionLoader = ({ label = 'Loading...' }) => (
  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--unis-text-muted, #aaa)' }}>
    <div
      className="spinner"
      style={{
        width: 24,
        height: 24,
        border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid var(--unis-primary, #6c63ff)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        margin: '0 auto 8px',
      }}
    />
    <p style={{ margin: 0, fontSize: '0.85rem' }}>{label}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ---------------------------------------------------------------------------
// Inline error shown per-section when a fetch fails
// ---------------------------------------------------------------------------
const SectionError = ({ message = 'Failed to load.', onRetry }) => (
  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--unis-danger, #ff6b6b)' }}>
    <p style={{ margin: '0 0 8px' }}>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn btn-secondary btn-small" type="button">
        Retry
      </button>
    )}
  </div>
);

const ArtistCollapsibleSection = ({
    id,
    eyebrow,
    title,
    children,
    defaultOpen = true,
    className = '',
    onRegister,
    ambientImage,          // ★ blurred profile-image backdrop (funnel-style)
  }) => {
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
      if (id && onRegister) onRegister(id, () => setOpen(true));
    }, [id, onRegister]);

    return (
      <section id={id} className={`artist-collapsible ${className} ${open ? 'is-open' : ''}`}>
        {/* ★ ambient: blurred artist image behind the whole section */}
        {ambientImage && (
          <div
            className="artist-collapsible__ambient"
            style={{ backgroundImage: `url(${ambientImage})` }}
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          className="artist-collapsible__trigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={id ? `${id}-panel` : undefined}
        >
          <div>
            {eyebrow && <span className="artist-section__eyebrow">{eyebrow}</span>}
            <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
          </div>

          <span className="artist-collapsible__chevron" aria-hidden="true">
            <ChevronDown size={20} />
          </span>
        </button>

        {open && (
          <div
            className="artist-collapsible__body"
            id={id ? `${id}-panel` : undefined}
            role="region"
            aria-labelledby={id ? `${id}-title` : undefined}
          >
            {children}
          </div>
        )}
      </section>
    );
  };

const ArtistDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { requestPlay } = useContext(PlayerContext);

  // ★ item 3: quick-nav — collapsibles register an opener; nav opens then scrolls
  const sectionOpeners = useRef({});
  const registerSection = useCallback((sectionId, opener) => {
    sectionOpeners.current[sectionId] = opener;
  }, []);
  const goToSection = useCallback((sectionId) => {
    sectionOpeners.current[sectionId]?.();
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // ---- Core data ---------------------------------------------------------
  const [userProfile, setUserProfile] = useState(null);
  const [songs, setSongs] = useState([]);
  const [defaultSong, setDefaultSong] = useState(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [coreError, setCoreError] = useState(null);

  // ---- Secondary data ----------------------------------------------------
  const [supporters, setSupporters] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [referralCode, setReferralCode] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [supportedArtist, setSupportedArtist] = useState(null);
  const [pendingSupportedArtist, setPendingSupportedArtist] = useState(null); // ★ H: queued change display
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [voteHistory, setVoteHistory] = useState([]);
  const [votesLoading, setVotesLoading] = useState(true);
  const [votesError, setVotesError] = useState(null);
  const [statsSong, setStatsSong] = useState(null); 
  const [salesSong, setSalesSong] = useState(null); // ★ sales: song whose sales modal is open

  const [awards, setAwards] = useState([]);
  const [awardsPage, setAwardsPage] = useState(0);
  const [hasMoreAwards, setHasMoreAwards] = useState(true);
  const [awardsLoading, setAwardsLoading] = useState(true);
  const [awardsError, setAwardsError] = useState(null);


  // ---- Song awards (trophy toggle) ----------------------------------------
  const [awardTab, setAwardTab] = useState('artist');
  const [songAwards, setSongAwards] = useState([]);
  const [songAwardsPage, setSongAwardsPage] = useState(0);
  const [hasMoreSongAwards, setHasMoreSongAwards] = useState(true);
  const [songAwardsLoading, setSongAwardsLoading] = useState(true);
  const [songAwardsError, setSongAwardsError] = useState(null);
  const [loadingMoreSongAwards, setLoadingMoreSongAwards] = useState(false);

  // ---- UI state ----------------------------------------------------------
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
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
  const [showVoteHistory, setShowVoteHistory] = useState(false);
  const [editingLyricsSong, setEditingLyricsSong] = useState(null);
  const [currentLyrics, setCurrentLyrics] = useState('');
  const [loadingMoreAwards, setLoadingMoreAwards] = useState(false);
  const [showArtistPicker, setShowArtistPicker] = useState(false); // ★ H
  const [cancellingPending, setCancellingPending] = useState(false); // ★ H

  // -----------------------------------------------------------------------
  // Fetch helpers
  // -----------------------------------------------------------------------
  const fetchCore = useCallback(async (userId) => {
    setCoreLoading(true);
    setCoreError(null);

    try {
      const [summaryRes, songsRes, defaultSongRes] = await Promise.all([
        apiCall({
          url: `/v1/users/profile-summary/${userId}`,
          method: 'get',
          useCache: false,
        }),
        apiCall({
          url: `/v1/media/songs/artist/${userId}`,
          method: 'get',
          useCache: false,
        }),
        apiCall({
          url: `/v1/users/${userId}/default-song`,
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: null })),
      ]);

      const summary = summaryRes.data;
      const profile = summary?.profile;

      if (!profile) {
        throw new Error('Profile summary did not include a profile payload.');
      }

      setUserProfile(profile);
      setReferralCode(summary?.referralCode || null);
      setSupportedArtist(summary?.supportedArtist || null);
      setPendingSupportedArtist(summary?.pendingSupportedArtist || null); // ★ H: summary already returns this for Profile
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
    setStatsLoading(true);
    setStatsError(null);

    try {
      const [
        supportersRes,
        followersRes,
        totalPlaysRes,
        totalVotesRes,
        earningsRes,
        stripeRes,
        payoutsRes,
      ] = await Promise.all([
        apiCall({
          url: `/v1/users/${userId}/supporters/count`,
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: { count: 0 } })),

        apiCall({
          url: `/v1/users/${userId}/followers/count`,
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: { count: 0 } })),

        apiCall({
          url: `/v1/users/${userId}/total-plays`,
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: { totalPlays: 0 } })),

        apiCall({
          url: `/v1/users/${userId}/total-votes`,
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: { totalVotes: 0 } })),

        apiCall({
          url: '/v1/earnings/my-summary',
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: null })),

        apiCall({
          url: '/v1/stripe/status',
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: null })),

        apiCall({
          url: '/v1/stripe/payouts',
          method: 'get',
          useCache: false,
        }).catch(() => ({ data: [] })),
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
      setStatsError('Could not load stats.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchVotes = useCallback(async () => {
    setVotesLoading(true);
    setVotesError(null);

    try {
      const res = await apiCall({
        url: '/v1/vote/history?limit=50',
        method: 'get',
        useCache: false,
      });
      setVoteHistory(res.data || []);
    } catch (err) {
      console.error('Vote history fetch failed:', err);
      setVotesError('Could not load vote history.');
    } finally {
      setVotesLoading(false);
    }
  }, []);

  const fetchAwards = useCallback(async (userId) => {
    setAwardsLoading(true);
    setAwardsError(null);

    try {
      const res = await apiCall({
        url: `/v1/awards/artist/${userId}?limit=10&offset=0`,
        method: 'get',
        useCache: false,
      });

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
    const res = await apiCall({
      url: `/v1/awards/artist/${userId}/songs?limit=10&offset=0`,
      method: 'get',
      useCache: false,
    });
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
    fetchVotes();
    fetchAwards(userId);
    fetchSongAwards(userId); 
  }, [user?.userId, authLoading, fetchCore, fetchStats, fetchVotes, fetchAwards, fetchSongAwards]);

  // -----------------------------------------------------------------------
  // Early returns
  // -----------------------------------------------------------------------
  if (authLoading) return <div>Loading...</div>;
  if (!user) return <div>Please log in to view dashboard.</div>;

  if (coreLoading) {
    return (
      <Layout backgroundImage={backimage}>
        <div
          className="artist-dashboard"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
          }}
        >
          <SectionLoader label="Loading your dashboard..." />
        </div>
      </Layout>
    );
  }

  if (coreError) {
    return (
      <Layout backgroundImage={backimage}>
        <div
          className="artist-dashboard"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
          }}
        >
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
  const displayBio = userProfile.bio || 'No bio yet. Click Edit to add one.';

  const artistInitial = displayName.charAt(0).toUpperCase();
  const levelLabel = userProfile.level || 'Silver';

  const artistJurisdiction =
    userProfile.jurisdiction?.name ||
    userProfile.jurisdictionName ||
    'Home jurisdiction';

  const artistGenre =
    userProfile.genre?.name ||
    userProfile.genreName ||
    'Artist genre';

  const featuredArtwork =
    buildUrl(defaultSong?.artworkUrl) ||
    displayPhoto ||
    backimage;

  const recentAward = awards?.[0] || null;

  const recentSongAward = songAwards?.[0] || null;

  const currentBalanceDollars = Number.parseFloat(
    earningsSummary?.currentBalance || 0
  );

  const isStripeReady = Boolean(
    stripeStatus?.onboardingComplete && stripeStatus?.payoutsEnabled
  );

  // ★ H: pending-change effective date (mirrors Profile.jsx)
  const pendingEffective = pendingSupportedArtist?.effectiveDate
    ? new Date(pendingSupportedArtist.effectiveDate).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
      })
    : null;

  const nextMoves = [
    user && !user.phoneVerified && {
      title: 'Verify your phone number',
      text: 'Unlocks voting, commenting, and referral earnings — and keeps Unis spam-free.',
      action: 'Verify phone',
      onClick: () => {
        const section = document.querySelector('#nav-referral');
        section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    },
    !userProfile.bio && {
      title: 'Add your artist story',
      text: 'A short bio helps listeners understand why they should support you.',
      action: 'Edit profile',
      onClick: () => setShowEditProfile(true),
    },
    !defaultSong && {
      title: 'Set your featured song',
      text: 'Your featured song is the first track people see when they visit your artist presence.',
      action: 'Set featured',
      onClick: () => setShowDefaultSongWizard(true),
    },
    songs.length < 2 && {
      title: 'Build your catalog',
      text: 'A second track gives listeners more to explore and gives you more chances to win.',
      action: 'Upload song',
      onClick: () => setShowUploadWizard(true),
    },
    !userProfile.instagramUrl && !userProfile.tiktokUrl && !userProfile.twitterUrl && {
      title: 'Connect your socials',
      text: 'Let supporters continue following you beyond Unis.',
      action: 'Add links',
      onClick: () => {
        const section = document.querySelector('#nav-social');
        section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    },
    userProfile?.role === 'artist' && !isStripeReady && {
      title: 'Prepare your payouts',
      text: 'Connect payout access before your revenue is ready to cash out.',
      action: 'Review revenue',
      onClick: () => {
        const section = document.querySelector('.artist-revenue-card');
        section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    },
  ].filter(Boolean);

  // ★ item 3: quick-nav targets (revenue only shows for artists)
  const navItems = [
    { id: 'nav-momentum', label: 'Fanbase', icon: Gauge },
    { id: 'nav-fanbase', label: 'Audience', icon: BarChart3 },
    { id: 'nav-supporters', label: 'Supporters', icon: Users },
    { id: 'nav-demographics', label: 'Demographics', icon: Compass }, 
    { id: 'nav-territory', label: 'Territory', icon: MapPin },
    { id: 'nav-catalog', label: 'Catalog', icon: Music },
    { id: 'nav-trophy', label: 'Trophies', icon: Trophy },
    { id: 'nav-photos', label: 'Photos', icon: ImagePlus },
    ...(userProfile?.role === 'artist'
      ? [{ id: 'nav-revenue', label: 'Revenue', icon: DollarSign }]
      : []),
    { id: 'nav-growth', label: 'Growth', icon: Sparkles },
    { id: 'nav-social', label: 'Socials', icon: Link2 },
    { id: 'nav-support', label: 'You Support', icon: Heart },
    { id: 'nav-referral', label: 'Refer', icon: Share2 },
    { id: 'nav-theme', label: 'Theme', icon: Palette },
  ];

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const refetchDefaultSong = () => {
    apiCall({
      url: `/v1/users/${user.userId}/default-song`,
      method: 'get',
      useCache: false,
    })
      .then((res) => setDefaultSong(res.data))
      .catch(() => setDefaultSong(null));
  };

  // ★ play-flow: no longer fires its own /play POST. The Player component
  // counts the play once the listener crosses the 15s/25% threshold. We only
  // tag the media with a source so analytics can attribute discovery.
  const playSupportedArtistSong = async () => {
    if (!supportedArtist?.defaultSong) {
      alert('This artist has not set a featured song yet.');
      return;
    }

    const song = supportedArtist.defaultSong;
    const songId = song.songId || song.id;
    const songUrl = buildUrl(song.fileUrl);
    const artworkUrl = buildUrl(song.artworkUrl) || buildUrl(supportedArtist.photoUrl);

    if (!songUrl) return;

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
      artwork: artworkUrl,
      artworkUrl,
      source: 'dashboard-support', // ★ play-flow: discovery source tag
    };

    requestPlay(mediaObject);
  };

  // ★ play-flow: same change — let the Player count the play, just tag source.
  const playDefaultSong = async () => {
    if (!defaultSong) {
      setShowDefaultSongWizard(true);
      return;
    }

    const songId = defaultSong.songId || defaultSong.id;
    const songUrl = buildUrl(defaultSong.fileUrl);
    const artworkUrl = buildUrl(defaultSong.artworkUrl) || displayPhoto;

    if (!songUrl) {
      alert('This featured song is missing its audio file.');
      return;
    }

    const mediaObject = {
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
      source: 'dashboard', // ★ play-flow: discovery source tag
    };

    requestPlay(mediaObject);
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
      ['Direct song sales & downloads', '85% to Artist'],
      ['Paid subscription streaming pool', '50% to Artist'],
      ['Audio advertising revenue', '60% to Artist'],
      ['Supporter contributions', '15% to Artist'],
    ];
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
    p('Revenue-stream definitions and the methodology for allocating pooled revenue (such as the subscription streaming pool) are described in the then-current published terms at artists.unismusic.com, which are incorporated by reference. Where this Schedule and the published terms conflict, the published terms control.');

    h2('5. Referral Program');
    p('Where you refer new members using your referral code, you may earn referral income on qualifying Net Revenue generated by your referrals: 10% on first-tier (direct) referrals, 5% on second-tier referrals, and 2% on third-tier referrals, in each case as further described in the published referral terms. Referral tiers and rates may be adjusted prospectively on notice.');

    h2('6. Payments and Payouts');
    p('Unis processes artist payouts through Stripe. You are responsible for completing Stripe onboarding and providing accurate payout information. Payouts are made periodically once your available balance meets the minimum payout threshold (currently $50.00). You are solely responsible for all taxes on amounts you receive. Unis may withhold or offset amounts subject to refund, chargeback, or fraud review.');

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

    apiCall({
      url: `/v1/media/songs/artist/${user.userId}`,
      method: 'get',
      useCache: false,
    }).then((res) => setSongs(res.data || []));
  };

  const handleProfileUpdate = () => {
    apiCall({
      url: `/v1/users/profile-summary/${user.userId}`,
      method: 'get',
      useCache: false,
    })
      .then((res) => {
        const summary = res.data;
        setUserProfile(summary.profile);
        setReferralCode(summary.referralCode || null);
        setSupportedArtist(summary.supportedArtist || null);
        setPendingSupportedArtist(summary.pendingSupportedArtist || null); // ★ H: keep pending in sync after a change
      })
      .catch((err) => console.error('Failed to refresh profile summary:', err));
  };

  // ★ H: cancel a queued supported-artist change (mirrors Profile.jsx).
  const cancelPendingArtist = async () => {
    if (!user?.userId) return;
    setCancellingPending(true);
    try {
      await apiCall({
        method: 'delete',
        url: `/v1/users/${user.userId}/supported-artist/pending`,
      });
      handleProfileUpdate();
    } catch (err) {
      console.error('Failed to cancel pending supported-artist change:', err);
      alert('Failed to cancel the pending change. Please try again.');
    } finally {
      setCancellingPending(false);
    }
  };


  const SOCIAL_FIELDS = {
  instagram: 'instagramUrl',
  twitter: 'twitterUrl',
  tiktok: 'tiktokUrl',
  youtube: 'youtubeUrl',
  contactEmail: 'contactEmail',
};


  const handleSocialMediaUpdate = async (platform, value) => {
    try {
      const field = SOCIAL_FIELDS[platform] || `${platform}Url`;
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${user.userId}`,
        data: { [field]: value },
      });
      handleProfileUpdate();
      alert(`${platform} link updated successfully!`);
    } catch (err) {
      console.error('Failed to update social media:', err);
      alert('Failed to update link');
    }
  };

  const handleDeleteSongClick = (song) => {
    if (songs.length <= 1) {
      alert('You must have at least one song. Upload another song before deleting this one.');
      return;
    }

    if (defaultSong?.songId === song.songId) {
      alert('This is your featured song. Please change your featured song before deleting it.');
      setShowDefaultSongWizard(true);
      return;
    }

    setSongToDelete(song);
  };

  const handleConfirmDelete = async () => {
    if (!songToDelete) return;

    setDeletingSongId(songToDelete.songId);

    try {
      await apiCall({
        method: 'delete',
        url: `/v1/media/song/${songToDelete.songId}`,
      });

      const res = await apiCall({
        url: `/v1/media/songs/artist/${user.userId}`,
        method: 'get',
        useCache: false,
      });

      setSongs(res.data || []);
      setSongToDelete(null);
    } catch (err) {
      console.error('Failed to delete song:', err);
      alert('Failed to delete song. Please try again.');
    } finally {
      setDeletingSongId(null);
    }
  };

  const handleSaveLyrics = async () => {
    if (!editingLyricsSong) return;

    try {
      await apiCall({
        method: 'put',
        url: `/v1/media/song/${editingLyricsSong.songId}`,
        data: { lyrics: currentLyrics },
      });

      setSongs((prev) =>
        prev.map((s) =>
          s.songId === editingLyricsSong.songId
            ? { ...s, lyrics: currentLyrics }
            : s
        )
      );

      setEditingLyricsSong(null);
    } catch (err) {
      console.error('Failed to save lyrics:', err);
      alert('Failed to save lyrics. Please try again.');
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

  const formatAwardDate = (dateString) => {
    if (!dateString) return '';

    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAwardTitle = (interval, type = 'artist') => {
    const name = (interval?.name || '').toLowerCase();
    const subject = type === 'song' ? 'Song' : 'Artist';
    if (name === 'daily'   || name.includes('day'))    return `${subject} of the Day`;
    if (name === 'weekly'  || name.includes('week'))   return `${subject} of the Week`;
    if (name === 'monthly' || name.includes('month'))  return `${subject} of the Month`;
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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Layout backgroundImage={backimage}>
      <div className="artist-dashboard">
        {showWelcomePopup && (
          <div className="welcome-popup-overlay">
            <div className="welcome-popup">
              <button
                onClick={() => setShowWelcomePopup(false)}
                className="close-button"
                type="button"
              >
                <X size={24} />
              </button>

              <div className="popup-content">
                <div className="icon-circle">
                  <Heart size={40} fill="white" />
                </div>
                <h2>Thank You!</h2>
                <p>Your contribution to the UNIS community makes us stronger. Keep creating!</p>
              </div>

              <button
                onClick={() => setShowWelcomePopup(false)}
                className="welcome-button"
                type="button"
              >
                You're Welcome
              </button>
            </div>
          </div>
        )}

        <div className="dashboard-content">
          <section className="artist-hero" aria-labelledby="artist-dashboard-title">
            <div className="artist-hero__left">
              <div className="artist-hero__eyebrow">
                Artist · {levelLabel} Tier
              </div>

              <div className="artist-hero__identity">
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt={`${displayName}'s artist profile`}
                    className="artist-hero__avatar"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="artist-hero__avatar artist-hero__avatar--placeholder">
                    {artistInitial}
                  </div>
                )}

                <div className="artist-hero__copy">
                  <h1 id="artist-dashboard-title">{displayName}</h1>
                  <p>{displayBio}</p>
                </div>
              </div>

              <div className="artist-hero__stats">
                <div className="artist-hero__stat">
                  <span>Score</span>
                  <strong>{(userProfile.score || 0).toLocaleString()}</strong>
                </div>
                <div className="artist-hero__stat">
                  <span>Supporters</span>
                  <strong>{supporters.toLocaleString()}</strong>
                </div>
                <div className="artist-hero__stat">
                  <span>Plays</span>
                  <strong>{totalPlays.toLocaleString()}</strong>
                </div>
                <div className="artist-hero__stat">
                  <span>Votes</span>
                  <strong>{totalVotes.toLocaleString()}</strong>
                </div>
              </div>

              <div className="artist-hero__actions">
                <button
                  type="button"
                  className="artist-btn artist-btn--primary"
                  onClick={() => setShowUploadWizard(true)}
                >
                  <Upload size={15} /> Upload Song
                </button>

                <button
                  type="button"
                  className="artist-btn artist-btn--ghost"
                  onClick={() => setShowEditProfile(true)}
                >
                  <Edit3 size={15} /> Edit Profile
                </button>

                <button
                  type="button"
                  className="artist-btn artist-btn--ghost"
                  onClick={downloadOwnershipContract}
                >
                  <Download size={15} /> Agreement
                </button>
              </div>
            </div>

            <div
              className="artist-featured"
              style={{ backgroundImage: `url(${featuredArtwork})` }}
            >
              <div className="artist-featured__overlay" />
              <div className="artist-featured__content">
                <span className="artist-featured__tag">Featured song</span>
                <h2>{defaultSong?.title || 'No featured song set'}</h2>
                <p>
                  {defaultSong
                    ? `${defaultSong.playCount || 0} plays · Lead with your strongest record.`
                    : 'Choose the track that should represent you first.'}
                </p>

                <div className="artist-featured__actions">
                  <button
                    type="button"
                    className="artist-featured__play"
                    onClick={playDefaultSong}
                  >
                    <Play size={13} fill="currentColor" /> {defaultSong ? 'Play' : 'Choose'}
                  </button>

                  <button
                    type="button"
                    className="artist-featured__change"
                    onClick={() => setShowDefaultSongWizard(true)}
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          </section>


          {/* ★ item 3: quick-nav shortcut bar */}
          <nav className="artist-quicknav" aria-label="Jump to a section">
            <span className="artist-quicknav__label">
              <LayoutGrid size={13} /> Jump to
            </span>
            <div className="artist-quicknav__grid">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="artist-quicknav__btn"
                  onClick={() => goToSection(id)}
                >
                  <span className="artist-quicknav__icon"><Icon size={16} /></span>
                  <span className="artist-quicknav__text">{label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* ★ analytics: real fanbase funnel replaces the old placeholder
              "Artist intelligence" collapsible. Self-fetching, handles zero
              states gracefully (pre-launch shows an intentional empty state). */}
          <div id="nav-fanbase" className="artist-funnel-anchor">
          <FanbaseFunnel
            artistId={user?.userId}
            artistPhoto={displayPhoto}
            artistName={displayName}
            ambientImage={featuredArtwork}
          />
          </div>          

           {/* ★ Supporters section */}
          <div id="nav-supporters">
            <SupporterSection artistId={user?.userId} />
          </div>


          {/* ★ item 6: demographics */}
          <div id="nav-demographics">
            <DemographicsSection artistId={user?.userId} />
          </div>

          {/* ★ collapsible: Territory signal (collapsed by default) */}
          <ArtistCollapsibleSection
              id="nav-territory"
              onRegister={registerSection}
              eyebrow="Local advantage"
              title={<>Territory <em>signal</em></>}
              defaultOpen={false}
              ambientImage={displayPhoto}
          >
            <TerritoryRankSection artistId={user?.userId} />
          </ArtistCollapsibleSection>

          {/* ★ collapsible: Catalog (collapsed by default) */}
          <ArtistCollapsibleSection
            id="nav-catalog"
            onRegister={registerSection}
            eyebrow="Catalog command"
            title={<>Songs </>}
            defaultOpen={false}
            ambientImage={displayPhoto}     
          >
            <div className="artist-catalog-actions">
              <button
                type="button"
                className="artist-btn artist-btn--primary artist-btn--small"
                onClick={() => setShowUploadWizard(true)}
              >
                <Upload size={14} /> Upload
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
                    <div
                      className="artist-song-card__ambient"
                      style={{ backgroundImage: `url(${songArtwork})` }}
                      aria-hidden="true"
                    />
                      <img
                        src={songArtwork}
                        alt={`${song.title} artwork`}
                        className="artist-song-card__art"
                      />

                      <div className="artist-song-card__body">
                        <div className="artist-song-card__title-row">
                          <div>
                            <h3>{song.title}</h3>
                            <p>{isFeatured ? 'Featured track' : 'Catalog track'}</p>
                          </div>

                          {isFeatured && (
                            <span className="artist-song-card__badge">Featured</span>
                          )}
                        </div>

                        <div className="artist-song-card__stats">
                          <span>
                            <Play size={12} /> {song.playCount || song.plays || 0} plays
                          </span>
                          <span>
                            <Vote size={12} /> {song.votes || song.voteCount || 0} votes
                          </span>
                          {song.isrc && ( // ★ item 8: no-ISRC badge removed; absence is simply unlabeled
                            <span>
                              <ShieldCheck size={12} /> ISRC {formatIsrc(song.isrc)}
                            </span>
                          )}
                        </div>
                      </div>

<div className="artist-song-card__actions">
                        {/* ★ D: per-song stats */}
                        <button
                          type="button"
                          onClick={() => setStatsSong(song)}
                          aria-label={`View stats for ${song.title}`}
                        >
                          <BarChart3 size={16} />
                        </button>

                        {/* ★ sales: per-song revenue */}
                        <button
                          type="button"
                          onClick={() => setSalesSong(song)}
                          aria-label={`View sales for ${song.title}`}
                        >
                          <DollarSign size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingSong(song)}
                          aria-label={`Edit ${song.title}`}
                        >
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
                  <Music size={34} />
                  <h3>No songs yet</h3>
                  <p>Upload your first track and start building your local signal.</p>
                  <button
                    type="button"
                    className="artist-btn artist-btn--primary"
                    onClick={() => setShowUploadWizard(true)}
                  >
                <Upload size={14} /> Upload first song
                  </button>
                </div>
              )}
            </div>
          </ArtistCollapsibleSection>

          <ArtistCollapsibleSection
            id="nav-photos"
            onRegister={registerSection}
            eyebrow="Gallery"
            title={<>Artist <em>photos</em></>}
            defaultOpen={false}
            ambientImage={displayPhoto}
          >
            <ArtistPhotosManager artistId={user?.userId} />
          </ArtistCollapsibleSection>

          {/* ★ F: trophy case is now collapsible + height-capped so a heavy
              award-winner no longer pushes the whole page down. The featured
              win + a count summary stay visible; the full list scrolls inside
              a fixed-height box and "Load more" lives inside that box. */}
          <ArtistCollapsibleSection
            id="nav-trophy"
            onRegister={registerSection}
            eyebrow="Recognition"
            title={<>Trophy <em>case</em></>}
            className="artist-trophy-section"
            defaultOpen={false}
          >
            {/* ★ Artist | Songs toggle */}
            <div className="artist-awards-toggle">
              <button
                type="button"
                className={`artist-awards-toggle__btn ${awardTab === 'artist' ? 'artist-awards-toggle__btn--active' : ''}`}
                onClick={() => setAwardTab('artist')}
              >
                Artist
              </button>
              <button
                type="button"
                className={`artist-awards-toggle__btn ${awardTab === 'song' ? 'artist-awards-toggle__btn--active' : ''}`}
                onClick={() => setAwardTab('song')}
              >
                Songs
              </button>
            </div>

            {/* ====================== ARTIST AWARDS ====================== */}
            {awardTab === 'artist' && (
              awardsLoading ? (
                <SectionLoader label="Loading awards..." />
              ) : awardsError ? (
                <SectionError message={awardsError} onRetry={() => fetchAwards(user.userId)} />
              ) : awards.length > 0 ? (
                <>
                  <div className="artist-awards-card__featured">
                    <div
                      className="artist-awards-card__ambient"
                      style={{
                        backgroundImage: `url(${displayPhoto})`,
                      }}
                      aria-hidden="true"
                    />
                    <div className="artist-awards-card__artwork">
                      <img
                        src={displayPhoto}
                        alt={`${displayName} artist award`}
                        onError={(e) => { e.currentTarget.src = displayPhoto; }}
                      />
                      <div className="artist-awards-card__interval-badge">
                        {intervalBadge(recentAward?.interval)}
                      </div>
                    </div>
                    <div className="artist-awards-card__info">
                      <span>Latest win</span>
                      <h3>{getAwardTitle(recentAward?.interval, 'artist')}</h3>
                      <p>
                        {recentAward?.jurisdiction?.name || 'Location'}
                        {recentAward?.genre?.name && ` · ${recentAward.genre.name}`}
                        {recentAward?.awardDate && ( // ★ item 10: date in theme color
                          <span className="artist-award-date"> · {formatAwardDate(recentAward.awardDate)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="artist-awards-summary">
                    <Trophy size={14} />
                    <span>
                      {awards.length}{hasMoreAwards ? '+' : ''} {awards.length === 1 ? 'win' : 'wins'} earned
                    </span>
                  </div>

                  <div className="artist-awards-scroll">
                    <div className="artist-awards-list">
                      {awards.map((award, index) => (
                        <div key={index} className="artist-award-row">
                          <div
                            className="artist-award-row__ambient"
                            style={{ backgroundImage: `url(${displayPhoto})` }}
                            aria-hidden="true"
                          />
                          <img
                            src={displayPhoto}
                            alt={getAwardTitle(award.interval, 'artist')}
                            className="artist-award-row__img"
                            onError={(e) => { e.currentTarget.src = displayPhoto; }}
                          />
                          <div>
                            <strong>{getAwardTitle(award.interval, 'artist')}</strong>
                            <p>
                              {award.jurisdiction?.name || 'Location'}
                              {award.genre?.name && ` · ${award.genre.name}`}
                            </p>
                          </div>
                          <small>{formatAwardDate(award.awardDate)}</small>
                        </div>
                      ))}
                    </div>
                    {hasMoreAwards && (
                      <button
                        type="button"
                        className="artist-btn artist-btn--ghost artist-btn--small artist-awards-more"
                        onClick={loadMoreAwards}
                        disabled={loadingMoreAwards}
                      >
                        {loadingMoreAwards ? 'Loading...' : 'Load more awards'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="artist-empty-state">
                  <Trophy size={34} />
                  <h3>No artist awards yet</h3>
                  <p>Keep collecting votes, plays, likes, and score to earn your first local win.</p>
                </div>
              )
            )}

            {/* ====================== SONG AWARDS ====================== */}
            {awardTab === 'song' && (
              songAwardsLoading ? (
                <SectionLoader label="Loading song awards..." />
              ) : songAwardsError ? (
                <SectionError message={songAwardsError} onRetry={() => fetchSongAwards(user.userId)} />
              ) : songAwards.length > 0 ? (
                <>
                  {(() => {
                    const recentSong = recentSongAward;
                    const artSrc = buildUrl(recentSong?.song?.artworkUrl) || featuredArtwork || displayPhoto;
                    return (
                      <div className="artist-awards-card__featured">
                        <div
                          className="artist-awards-card__ambient"
                          style={{ backgroundImage: `url(${artSrc})` }}
                          aria-hidden="true"
                        />
                        <div className="artist-awards-card__artwork">
                          <img
                            src={artSrc}
                            alt={recentSong?.song?.title || 'Song award'}
                            onError={(e) => { e.currentTarget.src = displayPhoto; }}
                          />
                          <div className="artist-awards-card__interval-badge">
                            {intervalBadge(recentSong?.interval)}
                          </div>
                        </div>
                        <div className="artist-awards-card__info">
                          <span>Latest song win</span>
                          <h3>{getAwardTitle(recentSong?.interval, 'song')}</h3>
                          <p>
                            {recentSong?.song?.title && `"${recentSong.song.title}"`}
                            {recentSong?.jurisdiction?.name && ` · ${recentSong.jurisdiction.name}`}
                            {recentSong?.awardDate && ( // ★ item 10: date in theme color
                              <span className="artist-award-date"> · {formatAwardDate(recentSong.awardDate)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="artist-awards-summary">
                    <Trophy size={14} />
                    <span>
                      {songAwards.length}{hasMoreSongAwards ? '+' : ''} song {songAwards.length === 1 ? 'win' : 'wins'} earned
                    </span>
                  </div>

                  <div className="artist-awards-scroll">
                    <div className="artist-awards-list">
                      {songAwards.map((award, index) => {
                        const artSrc = buildUrl(award.song?.artworkUrl) || featuredArtwork || displayPhoto;
                        return (
                          <div key={index} className="artist-award-row">
                            <div
                              className="artist-award-row__ambient"
                              style={{ backgroundImage: `url(${artSrc})` }}
                              aria-hidden="true"
                            />
                            <img
                              src={artSrc}
                              alt={award.song?.title || getAwardTitle(award.interval, 'song')}
                              className="artist-award-row__img"
                              onError={(e) => { e.currentTarget.src = displayPhoto; }}
                            />
                            <div>
                              <strong>{getAwardTitle(award.interval, 'song')}</strong>
                              <p>
                                {award.song?.title && `"${award.song.title}"`}
                                {award.jurisdiction?.name && ` · ${award.jurisdiction.name}`}
                                {award.genre?.name && ` · ${award.genre.name}`}
                              </p>
                            </div>
                            <small>{formatAwardDate(award.awardDate)}</small>
                          </div>
                        );
                      })}
                    </div>
                    {hasMoreSongAwards && (
                      <button
                        type="button"
                        className="artist-btn artist-btn--ghost artist-btn--small artist-awards-more"
                        onClick={loadMoreSongAwards}
                        disabled={loadingMoreSongAwards}
                      >
                        {loadingMoreSongAwards ? 'Loading...' : 'Load more'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="artist-empty-state">
                  <Music size={34} />
                  <h3>No song awards yet</h3>
                  <p>When one of your tracks wins Song of the Day, Week, or Month it'll appear here.</p>
                </div>
              )
            )}
          </ArtistCollapsibleSection>

          <ArtistCollapsibleSection
            id="nav-votes"
            onRegister={registerSection}
            eyebrow="Your activity"
            title={<>Vote <em>history</em></>}
            ambientImage={displayPhoto}
            defaultOpen={false}
          >
            <VoteHistorySection userId={user?.userId} />
          </ArtistCollapsibleSection>

        {userProfile?.role === 'artist' && (
          <RevenueSection
            artistId={user?.userId}
            artistPhoto={displayPhoto}
            earningsSummary={earningsSummary}
            stripeStatus={stripeStatus}
            payoutHistory={payoutHistory}
            isStripeReady={isStripeReady}
            onPayoutSuccess={() => fetchStats(user.userId)}
          />
        )}
      {/* ★ collapsible: Growth checklist (collapsed by default) */}
          <ArtistCollapsibleSection
            id="nav-growth"
            onRegister={registerSection}
            eyebrow="Next move"
            title={<>Growth <em>checklist</em></>}
            defaultOpen={false}
          >
            <div className="artist-next-grid">
              {nextMoves.length > 0 ? (
                nextMoves.map((move, index) => (
                  <button
                    key={index}
                    type="button"
                    className="artist-next-card"
                    onClick={move.onClick}
                  >
                    <div>
                      <strong>{move.title}</strong>
                      <p>{move.text}</p>
                    </div>
                    <span>
                      {move.action} <ArrowRight size={13} />
                    </span>
                  </button>
                ))
              ) : (
                <div className="artist-next-card artist-next-card--complete">
                  <div>
                    <strong>Your launch basics are complete</strong>
                    <p>Keep driving listeners to vote, support, and share your music.</p>
                  </div>
                  <span>
                    Keep building <ArrowRight size={13} />
                  </span>
</div>
              )}
            </div>
          </ArtistCollapsibleSection>

          {/* ★ collapsible: Social links (collapsed by default) */}
          <ArtistCollapsibleSection
            id="nav-social" 
            onRegister={registerSection}
            eyebrow="Artist presence"
            title={<>Social <em>links</em></>}
            defaultOpen={false}
          >

            <div className="social-links-edit">
              <div className="social-link-item">
                <label htmlFor="social-instagram">Instagram</label>
                <input
                  type="text"
                  id="social-instagram"
                  placeholder="https://instagram.com/yourprofile"
                  defaultValue={userProfile.instagramUrl || ''}
                  onBlur={(e) => handleSocialMediaUpdate('instagram', e.target.value)}
                  className="social-input"
                />
              </div>

              <div className="social-link-item">
                <label htmlFor="social-twitter">Twitter / X</label>
                <input
                  type="text"
                  id="social-twitter"
                  placeholder="https://twitter.com/yourprofile"
                  defaultValue={userProfile.twitterUrl || ''}
                  onBlur={(e) => handleSocialMediaUpdate('twitter', e.target.value)}
                  className="social-input"
                />
              </div>

              <div className="social-link-item">
                <label htmlFor="social-tiktok">TikTok</label>
                <input
                  type="text"
                  id="social-tiktok"
                  placeholder="https://tiktok.com/@yourprofile"
                  defaultValue={userProfile.tiktokUrl || ''}
                  onBlur={(e) => handleSocialMediaUpdate('tiktok', e.target.value)}
                  className="social-input"
                />
              </div>


              <div className="social-link-item">
                <label htmlFor="social-youtube">YouTube</label>
                <input
                  type="text"
                  id="social-youtube"
                  placeholder="https://youtube.com/@yourchannel"
                  defaultValue={userProfile.youtubeUrl || ''}
                  onBlur={(e) => handleSocialMediaUpdate('youtube', e.target.value)}
                  className="social-input"
                />
              </div>

              <div className="social-link-item">
                  <label htmlFor="social-contact">Contact email</label>
                  <input
                    type="email"
                    id="social-contact"
                    placeholder="you@example.com"
                    defaultValue={userProfile.contactEmail || ''}
                    onBlur={(e) => handleSocialMediaUpdate('contactEmail', e.target.value)}
                    className="social-input"
                  />
              </div>
            </div>
          </ArtistCollapsibleSection>
          {/* ★ H: full supported-artist section (ported from Profile.jsx).
              Always rendered — legacy artists with a null supported artist get
              a graceful "choose an artist" state instead of the section
              disappearing. Wrapped in the global collapsible per the design rule. */}
          <ArtistCollapsibleSection
            id="nav-support" 
            onRegister={registerSection}
            eyebrow="Community"
            title={<>You <em>support</em></>}
            className="artist-support-section"
            defaultOpen={false}
          >
            {supportedArtist ? (
              <div className="artist-support-feature">
                <div
                  className="artist-support-feature__media"
                  style={{
                    backgroundImage: `url(${
                      buildUrl(supportedArtist.photoUrl) ||
                      buildUrl(supportedArtist.defaultSong?.artworkUrl) ||
                      backimage
                    })`,
                  }}
                />
                <div className="artist-support-feature__overlay" />
                <div className="artist-support-feature__content">
                  <span className="artist-support-feature__tag">You support</span>
                  <h3>{supportedArtist.username}</h3>
                  <p>
                    {supportedArtist.defaultSong
                      ? `Featured track: ${supportedArtist.defaultSong.title}`
                      : 'No featured track yet'}
                  </p>

                  <div className="artist-support-feature__actions">
                    {supportedArtist.defaultSong && (
                      <button
                        type="button"
                        className="artist-support-feature__play"
                        onClick={playSupportedArtistSong}
                      >
                        <Play size={13} fill="currentColor" /> Listen
                      </button>
                    )}
                    <button
                      type="button"
                      className="artist-support-feature__change"
                      onClick={() => setShowArtistPicker(true)}
                    >
                      Change
                    </button>
                  </div>

                  {pendingSupportedArtist && (
                    <div className="artist-support-feature__pending" role="status">
                      <Clock size={12} />
                      <span>
                        Switching to <strong>{pendingSupportedArtist.username}</strong>
                        {pendingEffective ? ` on ${pendingEffective}` : ''}
                      </span>
                      <button
                        type="button"
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
              <div className="artist-empty-state">
                <Heart size={34} />
                <h3>No supported artist yet</h3>
                <p>
                  Every Unis member backs one artist. Choose the artist whose voice
                  you want to amplify — you can change it later.
                </p>
                <button
                  type="button"
                  className="artist-btn artist-btn--primary"
                  onClick={() => setShowArtistPicker(true)}
                >
                  <Heart size={14} /> Choose an artist
                </button>
              </div>
            )}
          </ArtistCollapsibleSection>

          {/* ★ collapsible: Referral (collapsed by default) */}
          <ArtistCollapsibleSection
            id="nav-referral" 
            onRegister={registerSection}
            eyebrow="Network"
            title={<>Refer <em>&amp; earn</em></>}
            defaultOpen={false}
          >
            <VerificationGate title="Verify your phone to refer & earn">
            <ReferralCodeCard
              referralCode={referralCode}
              username={displayName}
              isArtist={true}
            />
            </VerificationGate>

          </ArtistCollapsibleSection>

          {/* ★ collapsible: Theme (collapsed by default) */}
          <ArtistCollapsibleSection
            id="nav-theme" 
            onRegister={registerSection}
            eyebrow="Personalization"
            title={<>Color <em>theme</em></>}
            defaultOpen={false}
          >
            <ThemePicker userId={user?.userId} />
          </ArtistCollapsibleSection>

          <section className="artist-danger">
            <div>
              <strong>Danger zone</strong>
              <p>
                Change your password or permanently delete your account. Deletion cannot be undone.
              </p>
            </div>

            <div className="artist-danger__actions">
              <button
                type="button"
                className="artist-btn artist-btn--ghost"
                onClick={() => setShowChangePassword(true)}
              >
                Change Password
              </button>

              <button
                type="button"
                className="artist-btn artist-btn--danger"
                onClick={() => setShowDeleteWizard(true)}
              >
                <Trash2 size={14} /> Delete Account
              </button>
            </div>
          </section>
        </div>

        {/* Wizards */}
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

        {showDeleteWizard && (
          <DeleteAccountWizard
            show={showDeleteWizard}
            onClose={() => setShowDeleteWizard(false)}
          />
        )}

        {editingSong && (
          <EditSongWizard
            show={!!editingSong}
            onClose={() => setEditingSong(null)}
            song={editingSong}
            onSuccess={() => {
              apiCall({
                url: `/v1/media/songs/artist/${user.userId}`,
                method: 'get',
                useCache: false,
              }).then((res) => setSongs(res.data || []));
            }}
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
            onSuccess={() => {
              apiCall({
                url: `/v1/media/songs/artist/${user.userId}`,
                method: 'get',
                useCache: false,
              }).then((res) => setSongs(res.data || []));
            }}
          />
        )}

        <VoteHistoryModal
          show={showVoteHistory}
          onClose={() => setShowVoteHistory(false)}
          votes={voteHistory}
          useDummyData={false}
        />

        <DeleteSongModal
          show={!!songToDelete}
          songTitle={songToDelete?.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setSongToDelete(null)}
          isDeleting={!!deletingSongId}
        />

        {/* ★ H: supported-artist picker (same component Profile uses). */}
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

        <SongStatsModal
          show={!!statsSong}
          onClose={() => setStatsSong(null)}
          artistId={user.userId}
          song={statsSong}
        />

        {/* ★ sales: per-song revenue modal */}
        <SongSalesModal
          show={!!salesSong}
          onClose={() => setSalesSong(null)}
          artistId={user.userId}
          song={salesSong}
        />

        {editingLyricsSong && (
          <div className="modal-overlay" onClick={() => setEditingLyricsSong(null)}>
            <div className="modal-content lyrics-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Lyrics — {editingLyricsSong.title}</h3>
                <button
                  className="close-button"
                  onClick={() => setEditingLyricsSong(null)}
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="modal-body">
                <textarea
                  className="lyrics-textarea"
                  value={currentLyrics}
                  onChange={(e) => setCurrentLyrics(e.target.value)}
                  rows={20}
                  placeholder="Enter lyrics here..."
                />
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleSaveLyrics} type="button">
                  Save Lyrics
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingLyricsSong(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <ChangePasswordWizard
          show={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
      </div>
    </Layout>
  );
};

export default ArtistDashboard;