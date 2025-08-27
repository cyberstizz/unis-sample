// src/App.js (or main entry)
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/playercontext'
import Player from './components/Player'; // Import the new Player
import Feed from './components/Feed'; // Your pages
import ExploreFind from './components/ExploreFind'; // Etc.
// Add other imports...

const App = () => {
  return (
    <PlayerProvider>
      <Router>
        <Routes>
          <Route path="/home" element={<Feed />} />
          <Route path="/explore" element={<ExploreFind />} />
          {/* Add other routes */}
        </Routes>
        <Player /> {/* Render globally here—bottom of screen via CSS */}
      </Router>
    </PlayerProvider>
  );
};

export default App;