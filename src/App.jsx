// src/App.js (or main entry)
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/playercontext'
import Player from './player'; 
import Feed from './feed'; 
import ExploreFind from './explorefind'; 
import ArtistPage from './artistpage';
import SongPage from './songPage';
import Onboarding from './onboarding';
import VoteAwards from './Voteawards';



const App = () => {
  return (
    <PlayerProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/explore" element={<ExploreFind />} />
          <Route path="/artist" element={<ArtistPage />} />
          <Route path="/song" element={<SongPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/voteawards" element={<VoteAwards />} />
        </Routes>
        <Player />
      </Router>
    </PlayerProvider>
  );
};

export default App;