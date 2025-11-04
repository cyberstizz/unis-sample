import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { PlayerProvider } from './context/playercontext';
import Player from './player'; 
import Sidebar from './sidebar'; 
import Feed from './feed'; 
import ExploreFind from './explorefind'; 
import ArtistPage from './artistpage';
import SongPage from './songPage';
import Onboarding from './onboarding';
import VoteAwards from './voteawards';
import Profile from './profile';
import MilestonesPage from './milestonesPage';
import Leaderboards from './leaderboardsPage';
import MapDemo from './mapDemo';
import Earnings from './earnings';
import FindPage from './findpage';
import SongNotification from './songNotification';
import ArtistDashboard from './artistDashboard';
import JurisdictionPage from './jurisdictionPage';
import Login from './pages/Login';
import Register from './pages/Register';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';  

// New: Wrapper component for layout (useLocation inside Router)
const AppLayout = () => {
  const { pathname } = useLocation();  // Now inside Router
  const isLogin = pathname === '/login';
  const handleProfileClick = () => {
    window.location.href = '/profile'; 
  };

  return (
    <div className="app-wrapper"> {/* New wrapper for sidebar positioning */}
      {!isLogin && <Sidebar onProfileClick={handleProfileClick} />} 
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Feed />} />
          <Route path="/explore" element={<ExploreFind />} />
          <Route path="/artist" element={<ArtistPage />} />
          <Route path="/song" element={<SongPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/voteawards" element={<VoteAwards />} />
          <Route path="/profile" element={<ArtistDashboard />} />
          <Route path="/milestones" element={<MilestonesPage />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/find" element={<MapDemo />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/findpage" element={<FindPage />} />
          <Route path="/artistDashboard" element={<ArtistDashboard />} />
          <Route path="/jurisdictionPage" element={<JurisdictionPage />} />
        </Route>
      </Routes>
      <SongNotification />
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <PlayerProvider>
        <Router>
          <AppLayout />  {/* New: Wrap Routes + Sidebar logic */}
        </Router>
        <Player />
      </PlayerProvider>
    </AuthProvider>
  );
};

export default App;