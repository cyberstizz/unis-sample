import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { captureSignupCampaign } from './utils/signupCampaign';
import { captureReferral } from './utils/referralLink';

// Remember a campaign code (?c=...) and a referral code (?ref=...) from the
// link this visit arrived on.
captureSignupCampaign();
captureReferral();

// Register the service worker (public/sw.js) and check for a new version every
// minute. This used to be an inline <script> in index.html; it lives here now
// so the site's Content-Security-Policy can forbid inline scripts entirely
// (that is what stops injected code from running).
if ('serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {
        console.log('Unis SW registered:', reg.scope);
        setInterval(() => {
          reg.update();
        }, 60 * 1000);
      },
      (err) => {
        console.warn('Unis SW registration failed:', err);
      }
    );
  };
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker);
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
