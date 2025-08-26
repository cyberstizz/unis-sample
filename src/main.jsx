import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Feed from './feed.jsx'
import Onboarding from './onboarding.jsx'
import ExploreFind from './explorefind.jsx'
import VoteAwards from './voteawards.jsx'
import ArtistPage from './artistpage.jsx'
import SongPage from './songPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SongPage />
  </StrictMode>,
)
