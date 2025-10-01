// src/App.jsx (or main entry)
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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


const App = () => {
  const handleProfileClick = () => {
    window.location.href = '/profile'; // Simple navigation; use useNavigate if in a child component
  };

  return (
    <PlayerProvider>
      <Router>
        <div className="app-wrapper"> {/* New wrapper for sidebar positioning */}
          <Sidebar onProfileClick={handleProfileClick} /> {/* Global sidebar */}
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/explore" element={<ExploreFind />} />
            <Route path="/artist" element={<ArtistPage />} />
            <Route path="/song" element={<SongPage />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/voteawards" element={<VoteAwards />} />
            <Route path="/profile" element={<JurisdictionPage />} />
            <Route path="/milestones" element={<MilestonesPage />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/find" element={<MapDemo />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/findpage" element={<FindPage />} />
            <Route path="/artistDashboard" element={<ArtistDashboard />} />
            <Route path="/jurisdictionPage" element={<JurisdictionPage />} />
          </Routes>
          <SongNotification />
        </div>
        <Player />
      </Router>
    </PlayerProvider>
  );
};

export default App;