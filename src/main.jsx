import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import './index.css'
import App from './App.jsx'
import Feed from './feed.jsx'
import Onboarding from './onboarding.jsx'
import ExploreFind from './explorefind.jsx'
import VoteAwards from './Voteawards.jsx'
import ArtistPage from './artistpage.jsx'
import SongPage from './songPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
