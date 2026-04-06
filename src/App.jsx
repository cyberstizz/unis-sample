import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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
import { AuthProvider } from './context/AuthContext';
import WinnersNotification from './winnersNotification';
import useActivityTracker from './hooks/useActivityTracker';
import WaitlistPage from './WaitlistPage';
import SearchResultsPage from './pages/SearchResultsPage';



// Theme — must be imported globally so CSS custom properties are available everywhere
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

const AppLayout = () => {
  const { pathname } = useLocation();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname.startsWith('/reset-password');

  useActivityTracker();

  return (
    <div className="app-wrapper">
      {!isAuthPage && <Sidebar />}

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cookie" element={<CookiePolicy />} />
        <Route path="/report" element={<ReportInfringement />} />
        <Route path="/waitlist" element={<WaitlistPage />} />



        {/* Authenticated routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Feed />} />
          <Route path="/artist/:artistId" element={<ArtistPage />} />
          <Route path="/song/:songId" element={<SongPage />} />
          <Route path="/voteawards" element={<VoteAwards />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/milestones" element={<MilestonesPage />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/findpage" element={<FindPage />} />
          <Route path="/artistDashboard" element={<ArtistDashboard />} />
          <Route path="/jurisdiction/:jurisdiction" element={<JurisdictionPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
        </Route>

        {/* Admin routes — all tiers */}
        <Route element={<AdminRoute requiredLevel="moderator" />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/moderation" element={<ModerationQueue />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
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

      {!isAuthPage && (
        <>
          <WinnersNotification />
          <SongNotification />
        </>
      )}

      {!isAuthPage && <Player />}
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