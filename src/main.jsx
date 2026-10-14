import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { captureSignupCampaign } from './utils/signupCampaign';

// Remember a campaign code (?c=...) from the link this visit arrived on.
captureSignupCampaign();


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
