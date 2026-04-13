import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { PlayerProvider } from './context/playercontext';
import Player from './player';
import Sidebar from './sidebar';
import Feed from './feed';
import ArtistPage from './artistpage';
import SongPage from './songPage';
import VoteAwards from './voteawards';
import Profile from './profile';
import MilestonesPage from './milestonesPage';
import Leaderboards from './leaderboardsPage';
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

// Theme
import './theme.scss';

// Admin pages
import AdminDashboard from './admin/AdminDashboard';
import ModerationQueue from './admin/ModerationQueue';
import DmcaClaimDetail from './admin/DmcaClaimDetail';
import UserManagement from './admin/UserManagement';
import UserDetail from './admin/UserDetail';
import AnalyticsPage from './admin/AnalyticsPage';
import AuditLog from './admin/AuditLog';
import RoleManagement from './admin/RoleManagement';

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

const AppLayout = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname.startsWith('/reset-password');

  useActivityTracker();

  return (
    <div className="app-wrapper">
      {!isAuthPage && <Sidebar />}

      <Routes>
        {/* Public routes — no auth needed at all */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cookie" element={<CookiePolicy />} />
        <Route path="/report" element={<ReportInfringement />} />
        <Route path="/waitlist" element={<WaitlistPage />} />

        {/* Browsable routes — guests can view these freely */}
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Feed />} />
          <Route path="/artist/:artistId" element={<ArtistPage />} />
          <Route path="/song/:songId" element={<SongPage />} />
          <Route path="/jurisdiction/:jurisdiction" element={<JurisdictionPage />} />
          <Route path="/milestones" element={<MilestonesPage />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/findpage" element={<FindPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
        </Route>

        {/* Protected routes — must be logged in */}
        <Route element={<AuthRequiredRoute />}>
          <Route path="/voteawards" element={<VoteAwards />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/artistDashboard" element={<ArtistDashboard />} />
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
        </Route>

        {/* Admin routes — super admin only */}
        <Route element={<AdminRoute requiredLevel="super_admin" />}>
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/admin/roles" element={<RoleManagement />} />
        </Route>
      </Routes>

      {/* Only show notifications for logged-in users */}
     {!isAuthPage && user && <WinnersNotification />}
     {!isAuthPage && <SongNotification />}

      {!isAuthPage && <Player />}
      {!isAuthPage && <PlayChoiceModal />}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <PlayerProvider>
        <Router>
          <AppLayout />
        </Router>
      </PlayerProvider>
    </AuthProvider>
  );
};

export default App;