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
              <p><strong>Effective Date:</strong> March 31, 2026</p>
              <p><strong>Last Updated:</strong> March 31, 2026</p>
            </div>
          </header>

          <section className="terms-intro">
            <p>
              Welcome to Unis! These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Unis 
              website (unis.com), mobile application, and all related services (collectively, the &ldquo;Services&rdquo;), 
              operated by EasyCode LLC, a New York limited liability company (&ldquo;Unis,&rdquo; &ldquo;we,&rdquo; 
              &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By registering for an account, uploading content, or otherwise 
              using the Services, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, 
              do not use the Services.
            </p>
            <p>
              Unis is a hyperlocal music platform for discovery, voting, and community-driven awards within geographic 
              jurisdictions (e.g., Harlem). These Terms constitute a legally binding agreement between you and Unis. 
              Please review them carefully.
            </p>
            <p>
              Questions? Contact us at <a href="mailto:support@unis.com">support@unis.com</a>.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 1: ELIGIBILITY                     */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>1. Eligibility</h2>

            <h3>General Use</h3>
            <p>
              You must be at least 13 years old and reside in (or have a verifiable connection to) a supported 
              jurisdiction to use the Services. By using Unis, you affirm that: (a) you meet the age and location 
              requirements; and (b) you are not barred from using the Services under applicable law.
            </p>

            <h3>Monetized Accounts</h3>
            <p>
              To participate in any feature that involves earning, receiving, or withdrawing money&mdash;including 
              but not limited to artist revenue sharing, supporter ad revenue, and the referral income 
              program&mdash;you must be at least 18 years old, or have verifiable parental or legal guardian consent 
              documented through our designated process. Users under 18 with guardian consent are subject to 
              additional restrictions as outlined in Sections 11, 12, and 13.
            </p>

            <h3>Verification</h3>
            <p className="note">
              We may verify your age, location, or identity via geolocation, third-party services, or documentation 
              requests. Providing false information is grounds for immediate account termination and forfeiture of 
              any accrued earnings. Parents and guardians: You are responsible for supervising any minor&rsquo;s use 
              of Unis and for any activity on accounts you authorize.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 2: ACCOUNTS & SECURITY             */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>2. Accounts &amp; Security</h2>
            <ul>
              <li>
                <strong>Registration:</strong> You must provide accurate, current information (including email 
                address and zip code) when creating an account. You are solely responsible for maintaining the 
                confidentiality of your login credentials and for all activity under your account.
              </li>
              <li>
                <strong>Suspension &amp; Termination:</strong> We reserve the right to suspend or terminate accounts 
                that violate these Terms, engage in fraudulent activity, or otherwise abuse the platform. You may 
                delete your account at any time through your account settings.
              </li>
              <li>
                <strong>No Transfers:</strong> Accounts are non-transferable. You may not sell, trade, gift, or 
                share access to your account.
              </li>
            </ul>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 3: USER CONTENT & LICENSES         */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>3. User Content &amp; Licenses</h2>
            <p>
              &ldquo;User Content&rdquo; means any material you upload, submit, or make available through the 
              Services, including songs, audio recordings, videos, album artwork, profile information, comments, 
              and votes.
            </p>

            <h3>3.1 License Grant to Unis</h3>
            <p>
              By submitting User Content, you grant Unis a worldwide, non-exclusive, royalty-free, sublicensable, 
              transferable license to host, store, reproduce, display, distribute, promote, and create derivative 
              works of your content (e.g., thumbnails, preview clips, promotional materials) in connection with 
              operating and marketing the Services. This license continues for as long as your content remains on 
              the platform and for a reasonable period thereafter necessary to remove it from our systems.
            </p>

            <h3>3.2 Streaming Rights</h3>
            <p>
              The license in Section 3.1 specifically includes the right to publicly perform and digitally transmit 
              your audio content to users of the Services (public performance rights and digital audio transmission 
              rights). Unis operates as a direct-upload platform; we do not claim mechanical rights to your 
              compositions, and we do not distribute your content to third-party streaming services without your 
              explicit written consent.
            </p>

            <h3>3.3 Your Ownership</h3>
            <p>
              <strong>You retain full ownership and all intellectual property rights to your User Content. Unis 
              claims no ownership interest whatsoever.</strong> The license granted in Section 3.1 is limited to 
              what is necessary to operate and promote the Services.
            </p>

            <h3>3.4 Downloadable Artist Agreements</h3>
            <p>
              Artists who upload music to Unis may download a formal Artist Agreement from the platform documenting 
              their ownership, the scope of the license granted, and their revenue sharing arrangement. These Artist 
              Agreements supplement (and do not supersede) these Terms. In the event of any conflict between an 
              Artist Agreement and these Terms, these Terms shall control unless the Artist Agreement explicitly 
              states otherwise with respect to a specific provision.
            </p>

            <h3>3.5 Representations &amp; Warranties</h3>
            <p>By uploading User Content, you represent and warrant that:</p>
            <ul>
              <li>
                You own or have obtained all necessary rights, licenses, and permissions for the content, including 
                from co-writers, producers, featured artists, and sample owners.
              </li>
              <li>
                Your content does not infringe any third-party intellectual property rights, including copyrights, 
                trademarks, or rights of publicity.
              </li>
              <li>
                Your content complies with all applicable laws and does not contain material that is obscene, 
                defamatory, or otherwise unlawful.
              </li>
              <li>
                You have not granted exclusive rights to any third party that would prevent you from licensing the 
                content to Unis as described herein.
              </li>
            </ul>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 4: ACCEPTABLE USE                  */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>4. Acceptable Use</h2>
            <p>
              You agree to use the Services only for their intended purpose: discovering, uploading, voting on, 
              and engaging with local music. The following activities are strictly prohibited:
            </p>
            <ul>
              <li>
                <strong>Illegal or Harmful Conduct:</strong> Harassment, hate speech, threats, promotion of 
                violence, doxxing, or any activity that violates applicable law.
              </li>
              <li>
                <strong>Spam &amp; Manipulation:</strong> Fake votes, bot activity, vote farming via multiple 
                accounts, artificial inflation of play counts, or unsolicited commercial messages.
              </li>
              <li>
                <strong>Intellectual Property Theft:</strong> Uploading unauthorized covers, unlicensed samples, 
                or content you do not have the rights to distribute.
              </li>
              <li>
                <strong>Platform Disruption:</strong> Reverse-engineering, scraping, overloading servers, 
                attempting to access unauthorized areas of the platform, or any activity that degrades the 
                experience for other users.
              </li>
              <li>
                <strong>Financial Fraud:</strong> Manipulating referral codes, creating sham accounts to generate 
                referral income, or any scheme to fraudulently earn revenue through the platform.
              </li>
            </ul>
            <p className="note">
              Enforcement may include warnings, temporary suspension, permanent bans, voiding of accrued earnings, 
              and referral to law enforcement where appropriate. We use a combination of automated systems and 
              human moderation to detect violations.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 5: VOTING & AWARDS                 */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>5. Voting &amp; Awards</h2>

            <h3>Voting</h3>
            <p>
              Each user is limited to one vote per target per scope per day, enforced by our system. Votes are 
              cast through the voting wizard and may include CAPTCHA verification. Vote results contribute to 
              public leaderboards and awards.
            </p>

            <h3>Awards</h3>
            <p>
              Awards are generated automatically based on accumulated votes and play data. There is no guarantee 
              of winning any award. Awards are honorary recognitions of community support and do not carry monetary 
              value unless explicitly stated in a separate promotion governed by its own official rules. To the 
              extent any award is ever associated with a prize of monetary value, applicable sweepstakes, contest, 
              and tax laws will apply, and Unis will publish separate official rules for such promotions.
            </p>

            <h3>Anti-Manipulation</h3>
            <p className="note">
              Vote farming, multi-accounting, coordinated manipulation, and any artificial inflation of metrics 
              will result in voided votes, forfeited awards, and potential account termination.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 6: THIRD-PARTY SERVICES            */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>6. Third-Party Services</h2>
            <p>
              The Services integrate with third-party providers including but not limited to Google (OAuth 
              authentication), Cloudflare (storage and CDN), and Google (analytics). Your use of these 
              integrations is subject to those providers&rsquo; respective terms and privacy policies. Unis is 
              not responsible or liable for the practices of third-party providers.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 7: APP STORE COMPLIANCE            */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>7. Mobile Application &amp; App Store Terms</h2>
            <p>
              If you access Unis through a mobile application downloaded from the Apple App Store or Google Play 
              Store, the following additional terms apply:
            </p>
            <ul>
              <li>
                These Terms are between you and Unis (EasyCode LLC), not with Apple Inc. or Google LLC. Apple 
                and Google have no obligation to provide maintenance, support, or warranty for the app.
              </li>
              <li>
                To the extent required by applicable app store terms, Apple and Google are intended third-party 
                beneficiaries of these Terms and may enforce them against you.
              </li>
              <li>
                Any in-app purchases or subscriptions are subject to the applicable app store&rsquo;s payment 
                terms and refund policies.
              </li>
              <li>
                You agree to comply with all applicable app store developer guidelines and terms of service 
                when using the Unis mobile application.
              </li>
            </ul>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 8: DMCA & COPYRIGHT POLICY         */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>8. Copyright Policy (DMCA)</h2>
            <p>
              Unis respects the intellectual property rights of others and expects users to do the same. We comply 
              with the Digital Millennium Copyright Act (17 U.S.C. &sect; 512) and respond promptly to notices of 
              alleged infringement.
            </p>

            <h3>8.1 Designated DMCA Agent</h3>
            <p>
              Our designated agent for receiving notifications of claimed copyright infringement is:
            </p>
            <p>
              Charles Lamb, DMCA Agent<br />
              EasyCode LLC<br />
              53 Lincoln Avenue, Brooklyn, NY 11208<br />
              Email: <a href="mailto:dmca@unis.com">dmca@unis.com</a>
            </p>

            <h3>8.2 Filing a DMCA Notice</h3>
            <p>To file a notice of copyright infringement, provide the following in writing to our DMCA Agent:</p>
            <ul>
              <li>Identification of the copyrighted work you claim has been infringed.</li>
              <li>
                Identification of the material on Unis that you claim is infringing, with enough detail for 
                us to locate it.
              </li>
              <li>Your contact information (name, address, phone number, email).</li>
              <li>
                A statement that you have a good faith belief that the use is not authorized by the copyright 
                owner, its agent, or the law.
              </li>
              <li>
                A statement, under penalty of perjury, that the information in the notice is accurate and that 
                you are authorized to act on behalf of the copyright owner.
              </li>
              <li>Your physical or electronic signature.</li>
            </ul>

            <h3>8.3 Counter-Notification</h3>
            <p>
              If you believe your content was removed in error, you may submit a counter-notification to our 
              DMCA Agent including:
            </p>
            <ul>
              <li>Identification of the material that was removed and its prior location on the platform.</li>
              <li>
                A statement under penalty of perjury that you have a good faith belief the material was removed 
                as a result of mistake or misidentification.
              </li>
              <li>
                Your name, address, and phone number, and a statement consenting to jurisdiction of the federal 
                court in your district (or, if outside the U.S., the Southern District of New York) and that 
                you will accept service of process from the party who filed the original notice.
              </li>
              <li>Your physical or electronic signature.</li>
            </ul>
            <p>
              Upon receipt of a valid counter-notification, Unis will forward it to the original complainant and 
              restore the content within 10&ndash;14 business days unless we receive notice that a court action 
              has been filed.
            </p>

            <h3>8.4 Repeat Infringer Policy</h3>
            <p>
              <strong>Unis maintains a policy of terminating, in appropriate circumstances, the accounts of users 
              who are repeat infringers of copyright.</strong> Specifically: (a) users who receive two or more 
              valid DMCA takedown notices will have their accounts suspended pending review; (b) users who receive 
              three or more valid DMCA takedown notices will have their accounts permanently terminated and all 
              content removed; (c) any accrued but unpaid earnings associated with infringing content may be 
              forfeited.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 9: DISCLAIMERS & LIMITATIONS       */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>9. Disclaimers &amp; Limitation of Liability</h2>

            <h3>AS-IS Service</h3>
            <p>
              THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF 
              ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF 
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>

            <h3>Availability</h3>
            <p>
              We may interrupt or suspend the Services for maintenance, upgrades, or other reasons without prior 
              notice. We are not liable for any downtime.
            </p>

            <h3>User Content</h3>
            <p>
              You are solely responsible for your User Content. We do not endorse, verify, or assume liability 
              for any User Content or user interactions.
            </p>

            <h3>Limitation of Liability</h3>
            <p className="note">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, UNIS&rsquo;S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING 
              OUT OF OR RELATING TO THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE GREATER OF (A) $100 OR 
              (B) THE TOTAL AMOUNT YOU HAVE PAID TO UNIS IN THE 12 MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL 
              UNIS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING 
              LOST PROFITS, LOST REVENUE, OR LOST DATA.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 10: INDEMNIFICATION                */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>10. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Unis, EasyCode LLC, and their officers, directors, 
              employees, and agents from and against any and all claims, liabilities, damages, losses, and expenses 
              (including reasonable attorneys&rsquo; fees) arising out of or in connection with: (a) your User 
              Content; (b) your use or misuse of the Services; (c) your violation of these Terms; or (d) your 
              violation of any third-party rights, including intellectual property rights.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 11: ARTIST REVENUE SHARING         */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>11. Artist Revenue Sharing</h2>
            <p>
              Unis offers artists the opportunity to earn revenue from streams of their uploaded content, subject 
              to the terms below.
            </p>

            <h3>11.1 Revenue Share</h3>
            <p>
              Eligible artists will receive <strong>sixty percent (60%) of Net Streaming Revenue</strong> attributable 
              to streams of their content. &ldquo;Net Streaming Revenue&rdquo; means gross advertising revenue 
              and/or subscription revenue generated from streams of the artist&rsquo;s content, minus: (a) applicable 
              ad-serving platform fees (e.g., Google AdSense fees, AdsWizz fees); (b) payment processing fees 
              (e.g., Stripe transaction fees); (c) applicable taxes and government charges; and (d) refunds, 
              chargebacks, and bad debt. No deductions will be made for Unis&rsquo;s general operating expenses, 
              employee costs, or overhead.
            </p>

            <h3>11.2 Payment Schedule &amp; Thresholds</h3>
            <p>
              Earnings are calculated on a monthly basis. Payments will be issued within 45 days of the end of 
              each calendar month in which earnings accrue. A minimum payout threshold of $50.00 USD applies; 
              earnings below this threshold will roll over to the following month. Unis reserves the right to 
              adjust the minimum threshold with 30 days&rsquo; written notice.
            </p>

            <h3>11.3 Payment Method</h3>
            <p>
              Payments will be made via Stripe Connect (direct bank deposit) or such other payment method as 
              designated in your account settings. You are responsible for providing and maintaining accurate 
              payment information and completing Stripe onboarding.
            </p>

            <h3>11.4 Tax Obligations</h3>
            <p>
              You are solely responsible for all taxes associated with your earnings. For U.S.-based artists 
              earning $600 or more in a calendar year, Unis will issue an IRS Form 1099-NEC. You may be required 
              to submit a W-9 (or W-8BEN for non-U.S. persons, if applicable) before payments can be processed. 
              Failure to provide required tax documentation may result in payment withholding as required by law.
            </p>

            <h3>11.5 Unclaimed Earnings</h3>
            <p>
              Earnings that remain unclaimed for 12 months due to invalid payment information, failure to meet 
              identity verification requirements, or account abandonment may be forfeited after reasonable notice 
              (at least two emails to your registered address with a 30-day cure period). Unclaimed funds will 
              be handled in accordance with applicable state escheatment laws.
            </p>

            <h3>11.6 Withholding &amp; Forfeiture</h3>
            <p className="note">
              Unis may withhold, suspend, or forfeit payments if: (a) we reasonably suspect fraudulent activity, 
              manipulation of play counts, or violation of these Terms; (b) your content is subject to a pending 
              DMCA claim; or (c) your account is suspended or terminated for cause. If earnings are withheld 
              pending investigation and you are subsequently cleared, withheld amounts will be released in the 
              next payment cycle.
            </p>

            <h3>11.7 Digital Track Purchases</h3>
            <p>
              Artists may offer individual tracks for sale as digital downloads at a price they set,
              subject to a minimum price of $1.99 USD. Track purchases are processed via Stripe
              and are subject to a platform fee of 10% of the sale price. The remaining 90%, less
              Stripe processing fees, is deposited directly into the artist&rsquo;s connected Stripe
              account, typically within 2 business days. Track sale revenue is separate from ad-based
              earnings and is not subject to the $50.00 minimum payout threshold described in
              Section 11.2.
            </p>
            <p>
              Artists may configure each track as &ldquo;Free Download,&rdquo; &ldquo;Paid Download&rdquo;
              (at their chosen price), or &ldquo;Not Available for Download&rdquo; at any time through
              their artist dashboard or upload settings.
            </p>
            <p className="note">
              <strong>No Refunds on Digital Downloads.</strong> All digital track purchases are final
              and non-refundable. Buyers have the ability to stream any track in full before purchasing.
              Because digital files cannot be &ldquo;returned&rdquo; once downloaded, Unis does not offer
              refunds, credits, or exchanges for completed digital purchases. By completing a purchase,
              the buyer acknowledges and agrees to this policy. This no-refund policy does not affect any
              statutory rights that cannot be waived under applicable law.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 12: SUPPORTER AD REVENUE           */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>12. Supporter Ad Revenue Program</h2>
            <p>
              Unis offers a passive ad revenue program for qualifying listeners (&ldquo;Supporters&rdquo;). This 
              program is unique to Unis and operates as follows:
            </p>

            <h3>12.1 How It Works</h3>
            <p>
              When you use the Services and advertisements are displayed or played during your session, a portion 
              of the resulting ad revenue is allocated to the artist you have chosen to support, regardless of 
              which specific music is playing at the time. The current supporter allocation is 15% of display ad 
              revenue attributable to your session. The amount allocated is determined by Unis and may be adjusted 
              from time to time based on factors including available ad inventory and platform economics.
            </p>

            <h3>12.2 Eligibility</h3>
            <p>
              To participate in the Supporter Ad Revenue Program, you must: (a) maintain an active account in 
              good standing; (b) be at least 18 years old (or have documented guardian consent per Section 1); 
              (c) have selected an artist to support; and (d) meet any minimum activity thresholds established 
              by Unis from time to time.
            </p>

            <h3>12.3 Payment Terms</h3>
            <p>
              Supporter ad revenue directed to artists is subject to the same payment schedule, minimum payout 
              threshold ($50.00 USD), tax obligations, unclaimed earnings policy, and withholding provisions 
              described in Sections 11.2 through 11.6.
            </p>

            <h3>12.4 No Guarantee of Revenue</h3>
            <p>
              Ad revenue depends on third-party advertiser demand, ad fill rates, and market conditions. Unis does 
              not guarantee any minimum level of revenue. Actual amounts may be zero in periods of low ad inventory. 
              Unis reserves the right to modify, suspend, or discontinue this program at any time with 30 
              days&rsquo; written notice to participants.
            </p>

            <h3>12.5 Not Employment</h3>
            <p>
              Participation in the Supporter Ad Revenue Program does not create an employment, partnership, joint 
              venture, or agency relationship between you and Unis. You are an independent participant and are 
              responsible for your own taxes.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 13: REFERRAL INCOME PROGRAM        */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>13. Referral Income Program</h2>
            <p>
              Unis offers a referral program that rewards users for inviting new participants to the platform.
            </p>

            <h3>13.1 Structure</h3>
            <p>
              When you refer a new user who creates an account using your unique referral code, you earn a 
              percentage of the ad revenue attributable to that referred user&rsquo;s activity across up to three 
              levels: Level 1 (direct referrals) &mdash; 10%; Level 2 (your referrals&rsquo; referrals) &mdash; 5%; 
              Level 3 (third-degree referrals) &mdash; 2%. These percentages and tiers may be updated from time 
              to time and will be reflected on our Earnings page.
            </p>

            <h3>13.2 Important Clarifications</h3>
            <ul>
              <li>
                The referral program is funded entirely from advertising revenue generated by the platform. No 
                user is required to pay money to participate, and no user&rsquo;s earnings come from other 
                users&rsquo; payments.
              </li>
              <li>
                There is no requirement to recruit other users in order to use Unis or earn revenue as an artist 
                or supporter.
              </li>
              <li>
                Referral income is passive and incidental. It is not the primary purpose of the platform.
              </li>
              <li>
                If any level in a referral chain is unoccupied, that share reverts to Unis.
              </li>
              <li>
                Unis reserves the right to cap, modify, or terminate referral tiers and percentages at any time 
                with notice.
              </li>
            </ul>

            <h3>13.3 Anti-Abuse</h3>
            <p>
              The following referral activities are prohibited and will result in forfeiture of referral earnings 
              and potential account termination:
            </p>
            <ul>
              <li>Creating multiple accounts to self-refer.</li>
              <li>
                Offering cash payments, gift cards, or other incentives to users in exchange for using your 
                referral code (beyond sharing the code itself).
              </li>
              <li>Misrepresenting the referral program as a guaranteed income opportunity.</li>
              <li>Using bots, spam, or deceptive practices to distribute referral codes.</li>
            </ul>

            <h3>13.4 FTC Compliance</h3>
            <p>
              If you promote Unis or share your referral code on social media, blogs, or other public channels, 
              you must clearly disclose your financial relationship with Unis in compliance with FTC Endorsement 
              Guidelines (16 CFR Part 255). For example, include &ldquo;#ad&rdquo; or &ldquo;I earn a referral 
              bonus when you sign up&rdquo; in any promotional posts.
            </p>

            <h3>13.5 Payment Terms</h3>
            <p>
              Referral income is subject to the same payment schedule, minimum payout threshold, tax obligations, 
              and withholding provisions described in Sections 11.2 through 11.6.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 14: JURISDICTION EXPANSION         */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>14. Jurisdiction Expansion</h2>
            <p>
              Unis launches with coverage of specific geographic jurisdictions (initially, Harlem zip codes 
              10026&ndash;10039). We intend to expand to additional jurisdictions over time. When a new 
              jurisdiction is added:
            </p>
            <ul>
              <li>Existing Terms apply unless jurisdiction-specific terms are published.</li>
              <li>
                Users in new jurisdictions will be notified of any jurisdiction-specific terms or variations 
                at the time of onboarding.
              </li>
              <li>
                Jurisdiction-specific terms, if any, will be posted on the relevant jurisdiction page and 
                incorporated into these Terms by reference.
              </li>
            </ul>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 15: GOVERNING LAW & DISPUTES       */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>15. Governing Law &amp; Dispute Resolution</h2>
            <p>
              <strong>Governing Law:</strong> These Terms are governed by and construed in accordance with the 
              laws of the State of New York, without regard to its conflict of laws principles.
            </p>
            <p>
              <strong>Venue:</strong> For any disputes not subject to arbitration, you agree to the exclusive 
              jurisdiction of the state and federal courts located in New York County, New York.
            </p>
            <p>
              <strong>Arbitration:</strong> You and Unis agree that any dispute arising out of or relating to 
              these Terms or the Services shall be resolved through binding individual arbitration administered 
              by the American Arbitration Association (AAA) under its Consumer Arbitration Rules. The arbitration 
              filing fee shall not exceed $200 for claims under $10,000. You and Unis each waive the right to a 
              jury trial and the right to participate in a class action or class-wide arbitration.
            </p>
          </section>

          {/* ═══════════════════════════════════════════ */}
          {/* SECTION 16: CHANGES & MISCELLANEOUS        */}
          {/* ═══════════════════════════════════════════ */}
          <section className="terms-section">
            <h2>16. Changes &amp; Miscellaneous</h2>

            <h3>Modifications</h3>
            <p>
              We may update these Terms from time to time. We will notify you of material changes via email or 
              a prominent notice on the Services at least 30 days before they take effect. Continued use after 
              the effective date constitutes acceptance. Changes to revenue sharing percentages or payment terms 
              will not apply retroactively to earnings already accrued.
            </p>

            <h3>Severability</h3>
            <p>
              If any provision of these Terms is held invalid or unenforceable, the remaining provisions remain 
              in full effect.
            </p>

            <h3>Entire Agreement</h3>
            <p>
              These Terms, together with the Privacy Policy, Cookie Policy, and any applicable Artist Agreements, 
              constitute the entire agreement between you and Unis.
            </p>

            <h3>No Waiver</h3>
            <p>
              Our failure to enforce any right or provision of these Terms shall not constitute a waiver of that 
              right or provision.
            </p>

            <h3>Assignment</h3>
            <p>
              You may not assign your rights under these Terms. Unis may assign its rights and obligations in 
              connection with a merger, acquisition, or sale of assets.
            </p>

            <h3>Contact</h3>
            <p>
              <strong>Email:</strong> <a href="mailto:support@unis.com">support@unis.com</a><br />
              <strong>Address:</strong> EasyCode LLC, 53 Lincoln Avenue, Brooklyn, NY 11208
            </p>
          </section>

          <footer className="terms-footer">
            <p className="acknowledgment">
              By using Unis, you agree to these Terms. Thanks for building local music magic! 🎵
            </p>
            <p className="copyright">&copy; 2026 Unis Music All rights reserved.</p>
          </footer>

        </div>
      </div>
    </Layout>
  );
};

export default TermsOfService;