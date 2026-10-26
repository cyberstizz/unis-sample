import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { PlayerProvider } from './context/playercontext';
import { RewardProvider } from './context/RewardContext';
import Player from './player';
import Sidebar from './sidebar';
import Feed from './feed';
import ArtistPage from './artistpage';
import SongPage from './songPage';
import PlaylistPage from './playlistPage';
import VideoPage from './videoPage';
import VoteAwards from './voteawards';
import Profile from './profile';
import MilestonesPage from './milestonesPage';
import Leaderboards from './leaderboardsPage';
import ChartsPage from './chartsPage';
import Earnings from './earnings';
import FindPage from './findpage';
import PrivacyPolicy from './privacyPolicy';
import TermsOfService from './termsOfService';
import CookiePolicy from './cookiePolicy';
import ReportInfringement from './reportInfringement';
import SongNotification from './songNotification';
import ArtistDashboard from './artistDashboard';
import JurisdictionPage from './jurisdictionPage';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './AdminRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import WinnersNotification from './winnersNotification';
import useActivityTracker from './hooks/useActivityTracker';
import WaitlistPage from './WaitlistPage';
import SearchResultsPage from './pages/SearchResultsPage';
import AdminPlaylistPage from './admin/AdminPlaylistPage';
import PlayChoiceModal from './PlayChoiceModal';
import WinnersTimelinePage from './winnersTimelinePage';
import RewardScoreSync from './RewardScoreSync';
import ThemeDocumentSync from "./ThemeDocumentSync";
import VerifyEmail from './pages/VerifyEmail';   
import DiscoverPage from './DiscoverPage';   
import BrowseTagPage from './BrowseTagPage';
import ListenerPage from './ListenerPage';   
import MessagesPage from './MessagePage';
import HelpPage from './HelpPage';
import ComingSoon from './prelaunch/ComingSoon';
import JoinPage from './JoinPage';
import TeamLanding from './TeamLanding';
import TeamJoin from './TeamJoin';
import TeamHome from './TeamHome';
import AwardPage from './AwardPage';
import { resolveGate } from './prelaunch/prelaunchConfig';

// Theme
import './theme.scss';
import './unis-design-tokens.scss';
import './visual-fixes.scss';   

// Admin pages
import AdminDashboard from './admin/AdminDashboard';
import ModerationQueue from './admin/ModerationQueue';
import DmcaClaimDetail from './admin/DmcaClaimDetail';
import UserManagement from './admin/UserManagement';
import UserDetail from './admin/UserDetail';
import AnalyticsPage from './admin/AnalyticsPage';
import AuditLog from './admin/AuditLog';
import RoleManagement from './admin/RoleManagement';
import MetricsPage from './admin/metrics/MetricsPage';
import CodesAdmin from './admin/CodesAdmin';
import TeamAdmin from './admin/TeamAdmin';
import AnnouncementsAdmin from './admin/AnnouncementsAdmin';
import RankingsAdmin from './admin/RankingsAdmin';
import CommunityShareAdmin from './admin/CommunityShareAdmin';
import SponsorsAdmin from './admin/SponsorsAdmin';
import PlusPage from './PlusPage';
import SponsorPage from './SponsorPage';
import SponsorLanding from './SponsorLanding';
import WaitlistLanding from './WaitlistLanding';

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
  if (gate === 'comingSoon') return <ComingSoon />;
  if (gate === 'backstage') {
    return (
      <div className="app-wrapper">
        <Login />
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