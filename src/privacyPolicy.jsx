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
              <p><strong>Effective Date:</strong> March 31, 2026</p>
              <p><strong>Last Updated:</strong> March 31, 2026</p>
            </div>
          </header>

          <section className="policy-intro">
            <p>
              At Unis (operated by EasyCode LLC, a New York limited liability company located at 53 Lincoln Avenue, 
              Brooklyn, NY 11208) (&ldquo;Unis,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), 
              we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you visit our website, use our mobile app, or interact with our 
              services (collectively, the &ldquo;Services&rdquo;). By using the Services, you consent to these practices.
            </p>
            <p>
              Unis is a music-focused user-generated content platform where users upload, discover, vote on, and 
              celebrate local music in jurisdiction-based communities (e.g., Harlem neighborhoods). We prioritize 
              transparency, especially for features like personalized feeds, voting/leaderboards, awards, and 
              revenue sharing.
            </p>
            <p>
              If you have questions, contact us at{' '}
              <a href="mailto:privacy@unis.com">privacy@unis.com</a> or{' '}
              <a href="mailto:support@unis.com">support@unis.com</a>.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 1: INFORMATION WE COLLECT          */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>1. Information We Collect</h2>
            <p>We collect information to provide, improve, and personalize the Services. Categories include:</p>
            
            <h3>Personal Information</h3>
            <ul>
              <li>
                <strong>Account Data:</strong> When you sign up or log in (e.g., via email/password or OAuth), we 
                collect your email, username, password (hashed), and zip code (to assign jurisdiction, e.g., Downtown 
                Harlem for 10026).
              </li>
              <li>
                <strong>Profile Data:</strong> User-submitted details like full name, bio, photo, genre preferences, 
                and role (listener/artist).
              </li>
              <li>
                <strong>Upload Data:</strong> For artists, metadata on songs/videos (title, description, duration, 
                artwork) and files (stored securely via Cloudflare R2).
              </li>
              <li>
                <strong>Behavioral Data:</strong> Plays (tracks listened), votes (on nominees), interactions (e.g., 
                feed scrolls, leaderboard views)&mdash;tied to your userId for personalization.
              </li>
              <li>
                <strong>Financial Data:</strong> If you participate in our revenue sharing, supporter, or referral 
                programs, we collect information necessary to process payments, including your Stripe Connect account 
                ID, payout history, earnings balance, and tax documentation (e.g., W-9 or W-8BEN). Your bank account 
                details, social security number, and identity verification documents are collected and stored directly 
                by our payment processor, Stripe, Inc.&mdash;Unis does not store this sensitive financial information 
                on our servers.
              </li>
              <li>
                <strong>Referral Data:</strong> If you participate in our referral program, we track your unique 
                referral code, who you referred (and who they referred, up to three levels), and the ad revenue 
                attributable to your referral chain. This data is used solely for revenue attribution and program 
                administration.
              </li>
            </ul>

            <h3>Non-Personal Information</h3>
            <ul>
              <li>
                <strong>Device/Usage Data:</strong> IP address, browser type, device ID, OS, screen resolution, and 
                timestamps (via localStorage for session/auth).
              </li>
              <li>
                <strong>Analytics Data:</strong> Aggregated insights (e.g., popular jurisdictions via Google Analytics 
                or Supabase logs)&mdash;no individual tracking.
              </li>
            </ul>

            <h3>How We Collect It</h3>
            <ul>
              <li><strong>Directly from You:</strong> Forms (signup, uploads, votes, Stripe onboarding).</li>
              <li>
                <strong>Automatically:</strong> localStorage tokens (essential for authentication), server logs 
                (interactions), and optional analytics (opt-out available).
              </li>
              <li>
                <strong>From Third Parties:</strong> OAuth providers (e.g., Google: email verification); zip lookup 
                services (for jurisdiction assignment); Stripe (payment status and payout confirmations).
              </li>
            </ul>
            
            <p className="note">
              We do not collect sensitive data (e.g., health, race) unless voluntarily provided in bios (and even 
              then, we advise against it).
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 2: HOW WE USE YOUR INFORMATION     */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>2. How We Use Your Information</h2>
            <p>We use data to:</p>
            <ul>
              <li>
                <strong>Provide Services:</strong> Assign jurisdiction (zip-based), personalize feeds (trending/new 
                based on jurisdiction/genre), process votes/awards.
              </li>
              <li>
                <strong>Process Payments:</strong> Calculate earnings from artist revenue sharing, supporter ad revenue, 
                and referral income; attribute ad revenue across referral chains; issue payouts via Stripe Connect; 
                generate tax forms (1099-NEC) as required by law.
              </li>
              <li>
                <strong>Improve &amp; Engage:</strong> Analyze plays/votes for recommendations; send notifications 
                (e.g., &ldquo;You won Artist of the Day!&rdquo;).
              </li>
              <li>
                <strong>Secure &amp; Comply:</strong> Detect fraud (e.g., duplicate votes, referral manipulation, 
                artificial play count inflation), enforce rules (age requirements, jurisdiction eligibility), respond 
                to legal requests and DMCA claims.
              </li>
              <li>
                <strong>Marketing:</strong> Email newsletters (opt-in only); no targeted ads at launch (future: 
                anonymized for partners).
              </li>
            </ul>
            <p className="note">No automated decisions with legal impact (e.g., no credit scoring).</p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 3: HOW WE SHARE YOUR INFORMATION   */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>3. How We Share Your Information</h2>
            <p>We do not sell your data. Sharing is limited to:</p>
            <ul>
              <li>
                <strong>Service Providers:</strong> Railway (backend hosting), Netlify (frontend hosting), Supabase 
                (database), and Cloudflare (media storage/CDN) for infrastructure; Stripe (payment processing and 
                payouts); Google (analytics, aggregated only).
              </li>
              <li>
                <strong>Affiliates/Partners:</strong> For features (e.g., OAuth); future advertising partners 
                (anonymized, consent-based).
              </li>
              <li>
                <strong>Legal:</strong> Subpoenas, court orders; to protect rights (e.g., IP infringement reports, 
                DMCA claims).
              </li>
              <li>
                <strong>Business Transfer:</strong> In the event of a merger, acquisition, or sale of assets, your 
                information may be transferred. We will notify you of any such change.
              </li>
              <li>
                <strong>Tax Authorities:</strong> We report earnings to the IRS as required by law (e.g., 1099-NEC 
                for U.S. users earning $600 or more per calendar year).
              </li>
            </ul>
            <p className="note">
              User Content (uploads): Publicly viewable in feeds/leaderboards; we host but you control (delete 
              anytime). Your referral chain structure (who referred whom) is used internally for revenue attribution 
              and is not publicly displayed.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 4: COOKIES & TRACKING              */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>4. Local Storage &amp; Tracking</h2>
            <ul>
              <li>
                <strong>Essential (localStorage):</strong> We use browser localStorage to store authentication tokens 
                and session data. This is required for the Services to function and cannot be disabled while using Unis.
                We do not use traditional cookies for authentication.
              </li>
              <li>
                <strong>Analytics:</strong> Google Analytics (opt-out via browser settings or Google&rsquo;s opt-out 
                add-on).
              </li>
              <li>
                <strong>Do Not Track:</strong> We honor Do Not Track browser signals where possible.
              </li>
            </ul>
            <p>
              Clearing your browser&rsquo;s localStorage will log you out. See our Cookie Policy for additional details.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 5: DATA RETENTION & YOUR RIGHTS    */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>5. Data Retention &amp; Your Rights</h2>
            
            <h3>Retention</h3>
            <ul>
              <li>Accounts: Indefinite (delete on request)</li>
              <li>Uploads/votes: 30 days post-deletion (backup)</li>
              <li>Earnings &amp; payout records: Retained for 7 years as required for tax compliance</li>
              <li>Logs: 90 days</li>
            </ul>

            <h3>Your Rights (CCPA/GDPR-inspired)</h3>
            <ul>
              <li>
                <strong>Access:</strong> Request a copy of your data (
                <a href="mailto:privacy@unis.com">privacy@unis.com</a>).
              </li>
              <li>
                <strong>Delete:</strong> Right to be forgotten (removes profile/uploads; votes anonymized; earnings 
                records retained as required by tax law).
              </li>
              <li>
                <strong>Correct/Opt-Out:</strong> Update your profile anytime; unsubscribe from marketing emails.
              </li>
              <li>
                <strong>Data Portability:</strong> Request an export of your data in a machine-readable format.
              </li>
              <li>
                <strong>California Residents:</strong> Right to opt out of data sale (we do not sell data); 
                non-discrimination for exercising your rights.
              </li>
            </ul>
            <p>
              We verify requests via email and respond within 30 days (up to 45 days for California-specific requests 
              where permitted). Appeals:{' '}
              <a href="mailto:support@unis.com">support@unis.com</a>.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 6: CHILDREN'S PRIVACY              */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>6. Children&rsquo;s Privacy</h2>
            <p>
              The Services are intended for users aged 13 and older, in compliance with COPPA. We do not knowingly 
              collect personal information from children under 13. If you believe a child under 13 has provided us 
              with personal information, please contact us at{' '}
              <a href="mailto:support@unis.com">support@unis.com</a> and we will promptly delete it. Features 
              involving monetary earnings (revenue sharing, referral income, supporter ad revenue) require users to 
              be at least 18 years old, or to have verifiable parental or guardian consent as described in our Terms 
              of Service.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 7: INTERNATIONAL TRANSFERS         */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>7. International Transfers</h2>
            <p>
              Unis is based in the United States, and our servers and service providers are located primarily in the 
              U.S. If you access the Services from outside the United States, your information may be transferred to 
              and processed in the U.S., where data protection laws may differ from those in your country. By using 
              the Services, you consent to this transfer. If we transfer data internationally, we will use appropriate 
              safeguards as required by applicable law.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 8: SECURITY                        */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>8. Security</h2>
            <p>
              We use HTTPS encryption in transit, hashed passwords (bcrypt), Row-Level Security (Supabase), 
              JWT-based authentication with server-side validation, and encryption at rest for media files. Financial 
              data is processed and stored by Stripe, which maintains PCI DSS Level 1 compliance. No system is 100% 
              secure&mdash;report vulnerabilities to{' '}
              <a href="mailto:support@unis.com">support@unis.com</a>.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 9: CHANGES TO THIS POLICY          */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Updates will be posted on this page. For material 
              changes, we will notify you via email at least 30 days before they take effect. Continued use of the 
              Services after the effective date constitutes acceptance.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 10: CONTACT US                     */}
          {/* ═══════════════════════════════════════════ */}
          <section className="policy-section">
            <h2>10. Contact Us</h2>
            <p>
              <strong>Email:</strong> <a href="mailto:privacy@unis.com">privacy@unis.com</a><br />
              <strong>Address:</strong> EasyCode LLC, 53 Lincoln Avenue, Brooklyn, NY 11208<br />
              <strong>Support:</strong> <a href="mailto:support@unis.com">support@unis.com</a>
            </p>
          </section>

          <footer className="policy-footer">
            <p>&copy; 2026 EasyCode LLC. All rights reserved.</p>
          </footer>

        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;