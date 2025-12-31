import React from 'react';
import Layout from './layout';
import './cookiePolicy.scss';
import backimage from './assets/randomrapper.jpeg';

const CookiePolicy = () => {
  return (
    <Layout backgroundImage={backimage}>
      <div className="cookie-policy-container">
        <div className="cookie-policy-content">
          
          <header className="policy-header">
            <h1>Cookie Policy</h1>
            <div className="policy-meta">
              <p><strong>Effective Date:</strong> November 30, 2025</p>
              <p><strong>Last Updated:</strong> November 30, 2025</p>
            </div>
          </header>

          <section className="policy-intro">
            <p>
              This Cookie Policy explains how Unis Inc. ("Unis," "we," "us," or "our") uses cookies, local storage, 
              and similar tracking technologies on our website and mobile applications (collectively, the "Services"). 
              By using the Services, you consent to the use of these technologies as described in this policy.
            </p>
            <p>
              For more information about how we collect and use your data, please see our{' '}
              <a href="/privacy-policy">Privacy Policy</a>.
            </p>
          </section>

          <section className="policy-section">
            <h2>1. What Are Cookies and Similar Technologies?</h2>
            <p>
              Cookies are small text files stored on your device by your web browser. Similar technologies include:
            </p>
            <ul>
              <li>
                <strong>Local Storage:</strong> Browser-based storage that persists data locally (e.g., authentication tokens, 
                user preferences). Unlike cookies, local storage data is not sent to servers with every request.
              </li>
              <li>
                <strong>Session Storage:</strong> Temporary storage that clears when you close your browser tab.
              </li>
              <li>
                <strong>Web Beacons/Pixels:</strong> Small graphics used by third parties (e.g., analytics providers) to 
                track user behavior.
              </li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>2. How Unis Uses Cookies & Storage</h2>
            
            <h3>Current Technologies We Use</h3>
            
            <div className="cookie-category">
              <h4>Essential Technologies (Cannot Be Disabled)</h4>
              <ul>
                <li>
                  <strong>Authentication Tokens (Local Storage):</strong> We store JSON Web Tokens (JWT) in your browser's 
                  local storage to keep you logged in. These tokens contain your user ID and session information.
                </li>
                <li>
                  <strong>Session Management:</strong> Temporary data to maintain your active session while navigating 
                  the Services.
                </li>
              </ul>
              <p className="note">
                These are necessary for the Services to function. Clearing your local storage will log you out.
              </p>
            </div>

            <div className="cookie-category">
              <h4>Analytics Cookies (Optional)</h4>
              <ul>
                <li>
                  <strong>Google Analytics:</strong> We use Google Analytics to understand how users interact with Unis 
                  (e.g., popular pages, user flows). Google may set cookies to track aggregated, anonymized usage data.
                </li>
              </ul>
              <p className="note">
                You can opt out via browser settings or by using Google's opt-out tool at{' '}
                <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
                  https://tools.google.com/dlpage/gaoptout
                </a>.
              </p>
            </div>

            <div className="cookie-category">
              <h4>Third-Party Cookies</h4>
              <ul>
                <li>
                  <strong>OAuth Providers (Google):</strong> When you sign in with Google, they may set cookies to 
                  manage authentication. Their{' '}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>{' '}
                  applies.
                </li>
                <li>
                  <strong>Content Delivery Networks (Cloudflare):</strong> May use cookies for security and performance.
                </li>
              </ul>
            </div>

            <h3>Future Use (With Your Consent)</h3>
            <p>
              We may introduce additional cookies for features like:
            </p>
            <ul>
              <li>Personalized recommendations based on listening history</li>
              <li>Advertising partnerships (anonymized, opt-in only)</li>
              <li>Advanced security features (fraud detection)</li>
            </ul>
            <p className="note">
              We will notify you and request consent before implementing any new cookie-based features.
            </p>
          </section>

          <section className="policy-section">
            <h2>3. How to Manage Cookies & Storage</h2>
            
            <h3>Browser Settings</h3>
            <p>Most browsers allow you to:</p>
            <ul>
              <li>View and delete cookies</li>
              <li>Block all cookies (may break functionality)</li>
              <li>Set preferences for third-party cookies</li>
            </ul>
            <p>
              Instructions for popular browsers:
            </p>
            <ul>
              <li>
                <strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data
              </li>
              <li>
                <strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data
              </li>
              <li>
                <strong>Safari:</strong> Preferences → Privacy → Manage Website Data
              </li>
              <li>
                <strong>Edge:</strong> Settings → Cookies and site permissions
              </li>
            </ul>

            <h3>Clear Local Storage</h3>
            <p>
              To clear local storage (will log you out):
            </p>
            <ol>
              <li>Open browser Developer Tools (F12 or right-click → Inspect)</li>
              <li>Navigate to Application/Storage tab</li>
              <li>Select Local Storage → unis.com</li>
              <li>Delete stored items or clear all</li>
            </ol>

            <h3>Opt Out of Analytics</h3>
            <p>
              Install Google Analytics opt-out browser extension:{' '}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
                https://tools.google.com/dlpage/gaoptout
              </a>
            </p>
          </section>

          <section className="policy-section">
            <h2>4. Do Not Track</h2>
            <p>
              Some browsers support "Do Not Track" (DNT) signals. We honor DNT signals where technically feasible, 
              but note that some third-party services may not respond to DNT.
            </p>
          </section>

          <section className="policy-section">
            <h2>5. International Users</h2>
            <p>
              <strong>EU/UK Users (GDPR):</strong> You have the right to consent to or refuse non-essential cookies. 
              We use essential storage (authentication) by default; analytics cookies require implied consent through 
              continued use (you can opt out anytime).
            </p>
            <p>
              <strong>California Users (CCPA):</strong> We do not sell personal information collected via cookies. 
              See our <a href="/privacy-policy">Privacy Policy</a> for your rights.
            </p>
          </section>

          <section className="policy-section">
            <h2>6. Data Retention</h2>
            <ul>
              <li><strong>Authentication Tokens:</strong> Valid until you log out or they expire (typically 7-30 days)</li>
              <li><strong>Analytics Cookies:</strong> Retained per Google Analytics defaults (up to 26 months, anonymized)</li>
              <li><strong>Session Storage:</strong> Cleared when you close your browser</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>7. Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy to reflect changes in technology or legal requirements. Updates will be 
              posted here with a revised "Last Updated" date. Material changes will be communicated via email or 
              in-app notification.
            </p>
          </section>

          <section className="policy-section">
            <h2>8. Contact Us</h2>
            <p>
              Questions about our use of cookies or storage technologies? Contact us:
            </p>
            <p>
              <strong>Email:</strong> <a href="mailto:privacy@unis.com">privacy@unis.com</a><br />
              <strong>Support:</strong> <a href="mailto:support@unis.com">support@unis.com</a><br />
              <strong>Address:</strong> Unis Inc., 123 Harlem Ave, New York, NY 10026
            </p>
          </section>

          <footer className="policy-footer">
            <p>© 2025 Unis Inc. All rights reserved.</p>
          </footer>

        </div>
      </div>
    </Layout>
  );
};

export default CookiePolicy;