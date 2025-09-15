// src/App.jsx (or main entry)
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/playercontext';
import Player from './player'; 
import Sidebar from './sidebar'; // New import
import Feed from './feed'; 
import ExploreFind from './explorefind'; 
import ArtistPage from './artistpage';
import SongPage from './songPage';
import Onboarding from './onboarding';
import VoteAwards from './Voteawards';
import Profile from './profile';
import MilestonesPage from './milestonesPage';

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
            <Route path="/profile" element={<Profile />} />
            <Route path="/milestones" element={<MilestonesPage />} />
          </Routes>
        </div>
        <Player />
      </Router>
    </PlayerProvider>
  );
};

export default App;