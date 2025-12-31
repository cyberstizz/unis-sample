import React from 'react';
import Layout from './layout';
import './termsOfService.scss';
import backimage from './assets/randomrapper.jpeg';

const TermsOfService = () => {
  return (
    <Layout backgroundImage={backimage}>
      <div className="terms-container">
        <div className="terms-content">
          
          <header className="terms-header">
            <h1>Unis Terms of Service</h1>
            <div className="terms-meta">
              <p><strong>Effective Date:</strong> November 30, 2025</p>
              <p><strong>Last Updated:</strong> November 30, 2025</p>
            </div>
          </header>

          <section className="terms-intro">
            <p>
              Welcome to Unis! These Terms of Service ("Terms") govern your access to and use of the Unis website, 
              mobile app, and services (collectively, "Services"), operated by Unis Inc., a New York corporation 
              ("Unis," "we," "us," or "our"). By registering, uploading, or using the Services, you agree to these 
              Terms and our Privacy Policy. If you don't agree, do not use the Services.
            </p>
            <p>
              Unis is a music UGC platform for local discovery/voting/awards in jurisdictions (e.g., Harlem). Review 
              these Terms carefully—they form a binding contract.
            </p>
            <p>
              If you have questions, contact <a href="mailto:support@unis.com">support@unis.com</a>.
            </p>
          </section>

          <section className="terms-section">
            <h2>1. Eligibility</h2>
            <p>
              You must be 13+ and reside in a supported jurisdiction (e.g., Harlem zips like 10026-10039 at launch). 
              By using, you affirm: (a) you meet age/location requirements; (b) you are not barred from using the 
              Services (e.g., sex offender registries). Parents/guardians: Supervise minors.
            </p>
            <p className="note">
              We may verify zip code via geolocation/third parties; providing false information may result in termination.
            </p>
          </section>

          <section className="terms-section">
            <h2>2. Accounts & Security</h2>
            <ul>
              <li>
                <strong>Registration:</strong> Provide accurate information (email, zip code). You own your account; 
                keep your password confidential.
              </li>
              <li>
                <strong>Termination:</strong> We may suspend/terminate accounts for violations (e.g., spam); you may 
                delete your account anytime.
              </li>
              <li>
                <strong>Transfers:</strong> No selling or sharing accounts.
              </li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>3. User Content & Licenses</h2>
            <p>
              "User Content" includes uploads (songs/videos/artwork), votes, profiles, and comments.
            </p>

            <h3>Your License to Us</h3>
            <p>
              By submitting content, you grant Unis a worldwide, non-exclusive, royalty-free, perpetual, sublicensable 
              license to host, display, promote, and distribute (e.g., in feeds/awards). This includes the right to 
              create derivatives (e.g., thumbnails).
            </p>

            <h3>Your Retention</h3>
            <p>
              You retain ownership and intellectual property rights to your content; we claim no ownership.
            </p>

            <h3>Representations</h3>
            <p>By uploading, you warrant that you:</p>
            <ul>
              <li>Own or control all necessary rights to the Content</li>
              <li>Have not infringed on third-party rights (e.g., no unlicensed samples)</li>
              <li>Comply with all applicable laws (e.g., no obscenity)</li>
            </ul>

            <h3>Removal & DMCA</h3>
            <p>
              Report violations to <a href="mailto:support@unis.com">support@unis.com</a>; we may remove content 
              without notice. Copyright claims should be sent to <a href="mailto:dmca@unis.com">dmca@unis.com</a>; 
              we respond expeditiously in accordance with the DMCA.
            </p>
          </section>

          <section className="terms-section">
            <h2>4. Acceptable Use</h2>
            <p>Use Services only as intended (discover/vote/upload local music). Prohibited activities include:</p>
            <ul>
              <li><strong>Illegal/harmful content:</strong> Harassment, hate speech, violence promotion</li>
              <li><strong>Spam/abuse:</strong> Fake votes, bots, commercial spam</li>
              <li><strong>IP theft:</strong> Unauthorized covers/samples</li>
              <li><strong>System disruption:</strong> Reverse-engineering, overloading servers</li>
            </ul>
            <p className="note">
              We enforce these rules via moderation (AI/human) and user reports. Violations may result in 
              warnings or permanent bans.
            </p>
          </section>

          <section className="terms-section">
            <h2>5. Voting & Awards</h2>
            
            <h3>Voting</h3>
            <p>
              One vote per user per target per scope per day (enforced); voting occurs via wizard (with CAPTCHA). 
              Results appear in leaderboards and determine awards.
            </p>

            <h3>Awards</h3>
            <p>
              Automated awards (midnight cron jobs) based on votes/plays; there are no guarantees of winning.
            </p>

            <h3>Manipulation</h3>
            <p className="note">
              No vote farming (e.g., multi-accounts)—violations result in bans and voided votes.
            </p>
          </section>

          <section className="terms-section">
            <h2>6. Third-Party Services</h2>
            <p>
              Services integrate third-party providers including OAuth (Google), storage (Cloudflare), and analytics 
              (Google Analytics). Their respective policies apply; we are not liable for third-party services.
            </p>
          </section>

          <section className="terms-section">
            <h2>7. Disclaimers & Limitations</h2>
            
            <h3>AS-IS Service</h3>
            <p>
              Services provided "as is" with no warranties (express or implied), including availability or accuracy.
            </p>

            <h3>Availability</h3>
            <p>
              Services may be interrupted for maintenance; we have no liability for downtime.
            </p>

            <h3>User Content</h3>
            <p>
              User Content is your responsibility; we do not endorse it and are not liable for it.
            </p>

            <h3>Limitation of Liability</h3>
            <p className="note">
              Maximum liability: $100 or direct damages incurred. We have no liability for indirect damages (e.g., 
              lost profits) or for User Content/user interactions.
            </p>
          </section>

          <section className="terms-section">
            <h2>8. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Unis, its officers, directors, employees, and agents from 
              any claims, damages, or expenses (including legal fees) arising from your Content or use of the Services 
              (e.g., intellectual property lawsuits).
            </p>
          </section>

          <section className="terms-section">
            <h2>9. Governing Law & Disputes</h2>
            <p>
              These Terms are governed by New York law (without regard to conflicts of law principles). Venue for 
              any disputes shall be the courts of New York County.
            </p>
            <p>
              Disputes shall be resolved through binding arbitration (American Arbitration Association) with a $200 
              filing fee cap. Class action lawsuits are waived.
            </p>
          </section>

          <section className="terms-section">
            <h2>10. Changes & Miscellaneous</h2>
            
            <h3>Changes to Terms</h3>
            <p>
              Updates will be posted here; continued use constitutes acceptance (30 days notice for material changes).
            </p>

            <h3>Severability</h3>
            <p>
              If any provision is found invalid, the remaining provisions remain in effect.
            </p>

            <h3>Entire Agreement</h3>
            <p>
              These Terms supersede all prior agreements.
            </p>

            <h3>Contact</h3>
            <p>
              <strong>Email:</strong> <a href="mailto:support@unis.com">support@unis.com</a><br />
              <strong>Address:</strong> Unis Inc., 123 Harlem Ave, New York, NY 10026
            </p>
          </section>

          <footer className="terms-footer">
            <p className="acknowledgment">
              By using Unis, you agree to these Terms. Thanks for building local music magic! 🎵
            </p>
            <p className="copyright">© 2025 Unis Inc. All rights reserved.</p>
          </footer>

        </div>
      </div>
    </Layout>
  );
};

export default TermsOfService;