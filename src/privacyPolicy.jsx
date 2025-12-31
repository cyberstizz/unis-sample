import React from 'react';
import Layout from './layout';
import './privacyPolicy.scss';
import backimage from './assets/randomrapper.jpeg';

const PrivacyPolicy = () => {
  return (
    <Layout backgroundImage={backimage}>
      <div className="privacy-policy-container">
        <div className="privacy-policy-content">
          
          <header className="policy-header">
            <h1>Unis Privacy Policy</h1>
            <div className="policy-meta">
              <p><strong>Effective Date:</strong> November 30, 2025</p>
              <p><strong>Last Updated:</strong> November 30, 2025</p>
            </div>
          </header>

          <section className="policy-intro">
            <p>
              At Unis (operated by Unis Inc., a New York corporation with offices at 123 Harlem Ave, New York, NY 10026) 
              ("Unis," "we," "us," or "our"), we are committed to protecting your privacy. This Privacy Policy explains 
              how we collect, use, disclose, and safeguard your information when you visit our website, use our mobile app, 
              or interact with our services (collectively, the "Services"). By using the Services, you consent to these practices.
            </p>
            <p>
              Unis is a music-focused user-generated content platform where users upload, discover, vote on, and celebrate 
              local music in jurisdiction-based communities (e.g., Harlem neighborhoods). We prioritize transparency, especially 
              for features like personalized feeds, voting/leaderboards, and awards.
            </p>
            <p>
              If you have questions, contact us at <a href="mailto:privacy@unis.com">privacy@unis.com</a> or{' '}
              <a href="mailto:support@unis.com">support@unis.com</a>.
            </p>
          </section>

          <section className="policy-section">
            <h2>1. Information We Collect</h2>
            <p>We collect information to provide, improve, and personalize the Services. Categories include:</p>
            
            <h3>Personal Information</h3>
            <ul>
              <li>
                <strong>Account Data:</strong> When you sign up or log in (e.g., via email/password or OAuth), we collect 
                your email, username, password (hashed), and zip code (to assign jurisdiction, e.g., Downtown Harlem for 10026).
              </li>
              <li>
                <strong>Profile Data:</strong> User-submitted details like full name, bio, photo, genre preferences, and 
                role (listener/artist).
              </li>
              <li>
                <strong>Upload Data:</strong> For artists, metadata on songs/videos (title, description, duration, artwork) 
                and files (stored securely via Cloudflare R2).
              </li>
              <li>
                <strong>Behavioral Data:</strong> Plays (tracks listened), votes (on nominees), interactions (e.g., feed scrolls, 
                leaderboard views)—tied to your userId for personalization.
              </li>
            </ul>

            <h3>Non-Personal Information</h3>
            <ul>
              <li>
                <strong>Device/Usage Data:</strong> IP address, browser type, device ID, OS, screen resolution, and timestamps 
                (via cookies/localStorage for session/auth).
              </li>
              <li>
                <strong>Analytics Data:</strong> Aggregated insights (e.g., popular jurisdictions via Google Analytics or 
                Supabase logs)—no individual tracking.
              </li>
            </ul>

            <h3>How We Collect It</h3>
            <ul>
              <li><strong>Directly from You:</strong> Forms (signup, uploads, votes).</li>
              <li>
                <strong>Automatically:</strong> Cookies (essential: auth; analytics: optional opt-out), logs (server interactions).
              </li>
              <li>
                <strong>From Third Parties:</strong> OAuth providers (e.g., Google: email verification); zip lookup services 
                (for jurisdiction assignment).
              </li>
            </ul>
            
            <p className="note">
              We do not collect sensitive data (e.g., health, race) unless voluntarily provided in bios (and even then, we 
              advise against it).
            </p>
          </section>

          <section className="policy-section">
            <h2>2. How We Use Your Information</h2>
            <p>We use data to:</p>
            <ul>
              <li>
                <strong>Provide Services:</strong> Assign jurisdiction (zip-based), personalize feeds (trending/new based on 
                jur/genre), process votes/awards.
              </li>
              <li>
                <strong>Improve/Engage:</strong> Analyze plays/votes for recommendations; send notifications (e.g., "You won 
                Artist of the Day!").
              </li>
              <li>
                <strong>Secure/Comply:</strong> Detect fraud (e.g., dupe votes), enforce rules (13+ age, Harlem zips), respond 
                to legal requests.
              </li>
              <li>
                <strong>Marketing:</strong> Email newsletters (opt-in only); no targeted ads at launch (future: anonymized for partners).
              </li>
            </ul>
            <p className="note">No automated decisions with legal impact (e.g., no credit scoring).</p>
          </section>

          <section className="policy-section">
            <h2>3. How We Share Your Information</h2>
            <p>We do not sell your data. Sharing is limited to:</p>
            <ul>
              <li>
                <strong>Service Providers:</strong> Hosts (Render/Netlify/Supabase/Cloudflare) for storage/compute; analytics 
                (Google: aggregated only).
              </li>
              <li>
                <strong>Affiliates/Partners:</strong> For features (e.g., OAuth); future ads/loans (anonymized, consent-based).
              </li>
              <li>
                <strong>Legal:</strong> Subpoenas, court orders; to protect rights (e.g., IP infringement reports).
              </li>
              <li>
                <strong>Business Transfer:</strong> In merger/acquisition (notify you).
              </li>
            </ul>
            <p className="note">
              User Content (uploads): Publicly viewable in feeds/leaderboards; we host but you control (delete anytime).
            </p>
          </section>

          <section className="policy-section">
            <h2>4. Cookies & Tracking</h2>
            <ul>
              <li><strong>Essential:</strong> Auth/session (localStorage/token)—cannot disable.</li>
              <li><strong>Analytics:</strong> Google Analytics (opt-out via browser settings).</li>
              <li><strong>Do Not Track:</strong> We honor signals where possible.</li>
            </ul>
            <p>Manage via browser settings; clear localStorage logs you out.</p>
          </section>

          <section className="policy-section">
            <h2>5. Data Retention & Your Rights</h2>
            
            <h3>Retention</h3>
            <ul>
              <li>Accounts: Indefinite (delete on request)</li>
              <li>Uploads/votes: 30 days post-deletion (backup)</li>
              <li>Logs: 90 days</li>
            </ul>

            <h3>Your Rights (CCPA/GDPR-inspired)</h3>
            <ul>
              <li>
                <strong>Access:</strong> Request data export (<a href="mailto:privacy@unis.com">privacy@unis.com</a>).
              </li>
              <li>
                <strong>Delete:</strong> Right to be forgotten (removes profile/uploads; votes anonymized).
              </li>
              <li>
                <strong>Correct/Opt-Out:</strong> Update profile; unsubscribe emails.
              </li>
              <li>
                <strong>California Residents:</strong> Sale opt-out (we don't sell); non-discrimination.
              </li>
            </ul>
            <p>Verify via email; respond within 45 days. Appeals: <a href="mailto:support@unis.com">support@unis.com</a>.</p>
          </section>

          <section className="policy-section">
            <h2>6. Children's Privacy</h2>
            <p>
              Services for 13+ (COPPA). No knowing collection from under 13; report suspected at{' '}
              <a href="mailto:support@unis.com">support@unis.com</a>. Parents: Contact to delete child data.
            </p>
          </section>

          <section className="policy-section">
            <h2>7. International Transfers</h2>
            <p>
              US-based (NY servers); EU/CA users: Standard Contractual Clauses for transfers.
            </p>
          </section>

          <section className="policy-section">
            <h2>8. Security</h2>
            <p>
              We use HTTPS, hashed passwords, RLS (Supabase), and encryption (at-rest for media). No system is 100% 
              secure—report vulnerabilities to <a href="mailto:support@unis.com">support@unis.com</a>.
            </p>
          </section>

          <section className="policy-section">
            <h2>9. Changes to This Policy</h2>
            <p>
              Updates posted here; material changes emailed (30 days notice). Continued use = acceptance.
            </p>
          </section>

          <section className="policy-section">
            <h2>10. Contact Us</h2>
            <p>
              <strong>Email:</strong> <a href="mailto:privacy@unis.com">privacy@unis.com</a><br />
              <strong>Address:</strong> Unis Inc., 123 Harlem Ave, New York, NY 10026<br />
              <strong>Support:</strong> <a href="mailto:support@unis.com">support@unis.com</a>
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

export default PrivacyPolicy;