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

// Register the service worker (public/sw.js). This used to be an inline
// <script> in index.html; it lives here now so the site's
// Content-Security-Policy can forbid inline scripts entirely (that is what
// stops injected code from running).
// It checks for a new version once an hour, and when someone comes back to the
// tab after ten minutes or more away. (It used to check every minute, a request
// per open tab per minute, for a file that changes only when we deploy.)
if ('serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {
        if (import.meta.env.DEV) console.log('Unis SW registered:', reg.scope);
        let lastCheck = Date.now();
        const checkForUpdate = () => {
          lastCheck = Date.now();
          reg.update().catch(() => {}); // offline: try again next time
        };
        setInterval(checkForUpdate, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && Date.now() - lastCheck > 10 * 60 * 1000) {
            checkForUpdate();
          }
        });
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
