import React, { Suspense } from 'react';
import lazyWithRetry from './utils/lazyWithRetry';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { PlayerProvider } from './context/playercontext';
import { RewardProvider } from './context/RewardContext';
import Player from './player';
import Sidebar from './sidebar';
import Feed from './feed';
import SongNotification from './songNotification';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './AdminRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import WinnersNotification from './winnersNotification';
import useActivityTracker from './hooks/useActivityTracker';
import PlayChoiceModal from './PlayChoiceModal';
import RewardScoreSync from './RewardScoreSync';
import ThemeDocumentSync from "./ThemeDocumentSync";
import { resolveGate } from './prelaunch/prelaunchConfig';

// Theme
import './theme.scss';
import './unis-design-tokens.scss';
import './visual-fixes.scss';   

// ─── Pages load on demand ──────────────────────────────────────────────────
// Every page below is its own file in the build and downloads the first time
// someone opens it (lazyWithRetry = React.lazy + one reload after a deploy).
// Before, the whole app (admin pages, PDF export, charts, the help center,
// legal text) came down with the first page: 2.6 MB of JavaScript, 800 KB
// compressed, about three quarters of it unused on the feed. The feed, the
// player, the sidebar and the notifications stay in the main file because
// almost every visit needs them right away.
const ArtistPage = lazyWithRetry(() => import('./artistpage'));
const SongPage = lazyWithRetry(() => import('./songPage'));
const PlaylistPage = lazyWithRetry(() => import('./playlistPage'));
const VideoPage = lazyWithRetry(() => import('./videoPage'));
const VoteAwards = lazyWithRetry(() => import('./voteawards'));
const Profile = lazyWithRetry(() => import('./profile'));
const MilestonesPage = lazyWithRetry(() => import('./milestonesPage'));
const Leaderboards = lazyWithRetry(() => import('./leaderboardsPage'));
const ChartsPage = lazyWithRetry(() => import('./chartsPage'));
const Earnings = lazyWithRetry(() => import('./earnings'));
const FindPage = lazyWithRetry(() => import('./findpage'));
const PrivacyPolicy = lazyWithRetry(() => import('./privacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('./termsOfService'));
const CookiePolicy = lazyWithRetry(() => import('./cookiePolicy'));
const ReportInfringement = lazyWithRetry(() => import('./reportInfringement'));
const ArtistDashboard = lazyWithRetry(() => import('./artistDashboard'));
const JurisdictionPage = lazyWithRetry(() => import('./jurisdictionPage'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const WaitlistPage = lazyWithRetry(() => import('./WaitlistPage'));
const WinnersTimelinePage = lazyWithRetry(() => import('./winnersTimelinePage'));
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail'));
const DiscoverPage = lazyWithRetry(() => import('./DiscoverPage'));
const BrowseTagPage = lazyWithRetry(() => import('./BrowseTagPage'));
const ListenerPage = lazyWithRetry(() => import('./ListenerPage'));
const MessagesPage = lazyWithRetry(() => import('./MessagePage'));
const HelpPage = lazyWithRetry(() => import('./HelpPage'));
const ComingSoon = lazyWithRetry(() => import('./prelaunch/ComingSoon'));
const JoinPage = lazyWithRetry(() => import('./JoinPage'));
const TeamLanding = lazyWithRetry(() => import('./TeamLanding'));
const TeamJoin = lazyWithRetry(() => import('./TeamJoin'));
const TeamHome = lazyWithRetry(() => import('./TeamHome'));
const AwardPage = lazyWithRetry(() => import('./AwardPage'));
const PlusPage = lazyWithRetry(() => import('./PlusPage'));
const SponsorPage = lazyWithRetry(() => import('./SponsorPage'));
const SponsorLanding = lazyWithRetry(() => import('./SponsorLanding'));
const WaitlistLanding = lazyWithRetry(() => import('./WaitlistLanding'));

// Admin pages
const AdminPlaylistPage = lazyWithRetry(() => import('./admin/AdminPlaylistPage'));
const AdminDashboard = lazyWithRetry(() => import('./admin/AdminDashboard'));
const ModerationQueue = lazyWithRetry(() => import('./admin/ModerationQueue'));
const DmcaClaimDetail = lazyWithRetry(() => import('./admin/DmcaClaimDetail'));
const UserManagement = lazyWithRetry(() => import('./admin/UserManagement'));
const UserDetail = lazyWithRetry(() => import('./admin/UserDetail'));
const AnalyticsPage = lazyWithRetry(() => import('./admin/AnalyticsPage'));
const AuditLog = lazyWithRetry(() => import('./admin/AuditLog'));
const RoleManagement = lazyWithRetry(() => import('./admin/RoleManagement'));
const MetricsPage = lazyWithRetry(() => import('./admin/metrics/MetricsPage'));
const CodesAdmin = lazyWithRetry(() => import('./admin/CodesAdmin'));
const TeamAdmin = lazyWithRetry(() => import('./admin/TeamAdmin'));
const AnnouncementsAdmin = lazyWithRetry(() => import('./admin/AnnouncementsAdmin'));
const RankingsAdmin = lazyWithRetry(() => import('./admin/RankingsAdmin'));
const CommunityShareAdmin = lazyWithRetry(() => import('./admin/CommunityShareAdmin'));
const SponsorsAdmin = lazyWithRetry(() => import('./admin/SponsorsAdmin'));

/**
 * AuthRequiredRoute — hard gate for pages that genuinely need a logged-in user.
 * If the user is a guest, redirects to /login.
 * Used for: profile, earnings, artistDashboard, voteawards
 */
const AuthRequiredRoute = () => {
  const { user, authLoaded } = useAuth();
  if (!authLoaded) return null;
  if (!user) return <Navigate to="/login" />;
  return <Outlet />;
};

// What the page area shows while a page's code downloads for the first time.
// React Router 7 keeps the current page on screen during in-app navigation
// until the next one is ready, so this mostly appears when someone opens a
// shared link straight to a page. The height keeps the player and the
// notifications from jumping while it loads.
const PageFallback = () => (
  <div className="route-loading" aria-busy="true" style={{ minHeight: '100vh' }} />
);

const SearchRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={`/discover${search}`} replace />;
};

const AppLayout = () => {
  const { pathname } = useLocation();
  const { user, authLoaded } = useAuth();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname.startsWith('/reset-password');

  useActivityTracker();

  // ★ PRE-LAUNCH GATE (see src/prelaunch/prelaunchConfig.js). When the gate is
  //   off this is always 'app' and everything below renders exactly as before.
  const gate = resolveGate({ pathname, user, authLoaded });
  if (gate === 'wait') return null;                         // no flash while auth resolves
  if (gate === 'enter') return <Navigate to="/" replace />; // admin already signed in
  if (gate === 'comingSoon') {
    return (
      <Suspense fallback={null}>
        <ComingSoon />
      </Suspense>
    );
  }
  if (gate === 'backstage') {
    return (
      <div className="app-wrapper">
        <Suspense fallback={null}>
          <Login />
        </Suspense>
      </div>
    );
  }
  // 'open' = signup-support pages (verify email, reset password, legal, report,
  // help, waitlist, sponsor) rendered on their own: no sidebar, player or
  // notifications. The two pitch pages (/sponsor for shop owners, /waitlist
  // for people outside Harlem) and the booking form are always standalone.
  const isSponsorPage = pathname === '/sponsor' || pathname.startsWith('/sponsor/');
  const isWaitlistPitch = pathname === '/waitlist' || pathname === '/waitlist/';
  // The street team pages and /join links stand alone too.
  const isTeamPage = pathname === '/team' || pathname.startsWith('/team/');
  const isJoinLink = pathname === '/join' || pathname.startsWith('/join/');
  const chromeless = gate === 'open' || isSponsorPage || isWaitlistPitch || isTeamPage || isJoinLink;

  return (
    <div className="app-wrapper">
      {/* Resets scroll on navigation. Must be inside <Router> to read location,
          and outside <Routes> so it survives route changes. */}
      <ScrollToTop />
      {!isAuthPage && !chromeless && <Sidebar />}

      <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public routes — no auth needed at all */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />  
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cookie" element={<CookiePolicy />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/report" element={<ReportInfringement />} />
        <Route path="/waitlist" element={<WaitlistLanding />} />
        <Route path="/waitlist/join" element={<WaitlistPage />} />
        <Route path="/sponsor" element={<SponsorLanding />} />
        <Route path="/sponsor/book" element={<SponsorPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/team" element={<TeamLanding />} />
        <Route path="/team/join" element={<TeamJoin />} />
        <Route path="/team/me" element={<TeamHome />} />

        {/* Browsable routes — guests can view these freely */}
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Feed />} />
          <Route path="/artist/:artistId" element={<ArtistPage />} />
          <Route path="/song/:songId" element={<SongPage />} />
          <Route path="/playlist/:playlistId" element={<PlaylistPage />} />
          <Route path="/video/:videoId" element={<VideoPage />} />
          <Route path="/jurisdiction/:jurisdiction" element={<JurisdictionPage />} />
          <Route path="/milestones" element={<MilestonesPage />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/findpage" element={<FindPage />} />
          <Route path="/discover" element={<DiscoverPage />} />        
          <Route path="/browse/:kind/:slug" element={<BrowseTagPage />} />
          <Route path="/user/:userId" element={<ListenerPage />} />    
          <Route path="/award/:awardId" element={<AwardPage />} />
          <Route path="/search" element={<SearchRedirect />} />        
          <Route path="/voteawards" element={<VoteAwards />} />   
          <Route path="/jurisdiction/:jurisdiction/winners" element={<WinnersTimelinePage />} />
        </Route>

        {/* Protected routes — must be logged in */}
        <Route element={<AuthRequiredRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/artistDashboard" element={<ArtistDashboard />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/plus" element={<PlusPage />} />
        </Route>

        {/* Admin routes — all tiers */}
        <Route element={<AdminRoute requiredLevel="moderator" />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/moderation" element={<ModerationQueue />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/playlists" element={<AdminPlaylistPage />} />
        </Route>

        {/* Admin routes — admin + super admin */}
        <Route element={<AdminRoute requiredLevel="admin" />}>
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/users/:userId" element={<UserDetail />} />
          <Route path="/admin/moderation/dmca/:claimId" element={<DmcaClaimDetail />} />
          <Route path="/admin/metrics" element={<MetricsPage />} />
          <Route path="/admin/rankings" element={<RankingsAdmin />} />
          <Route path="/admin/community-share" element={<CommunityShareAdmin />} />
          <Route path="/admin/sponsors" element={<SponsorsAdmin />} />
          <Route path="/admin/codes" element={<CodesAdmin />} />
          <Route path="/admin/team" element={<TeamAdmin />} />
          <Route path="/admin/announcements" element={<AnnouncementsAdmin />} />
        </Route>

        {/* Admin routes — super admin only */}
        <Route element={<AdminRoute requiredLevel="super_admin" />}>
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/admin/roles" element={<RoleManagement />} />
        </Route>
      </Routes>
      </Suspense>

      {/* Only show notifications for logged-in users */}
     {!isAuthPage && !chromeless && user && <WinnersNotification />}
     {!isAuthPage && !chromeless && <SongNotification />}

      {!isAuthPage && !chromeless && <Player />}
      {!isAuthPage && !chromeless && <PlayChoiceModal />}
    </div>
  );
};

const App = () => {
  return (
  <RewardProvider>
    <AuthProvider>
      <ThemeDocumentSync />
      <RewardScoreSync />
      <PlayerProvider>
        <Router>
          <AppLayout />
        </Router>
      </PlayerProvider>
    </AuthProvider>
  </RewardProvider>
  );
};

export default App;