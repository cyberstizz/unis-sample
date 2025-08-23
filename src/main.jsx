import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Feed from './feed.jsx'
import Onboarding from './onboarding.jsx'
import ExploreFind from './explorefind.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ExploreFind />
  </StrictMode>,
)
