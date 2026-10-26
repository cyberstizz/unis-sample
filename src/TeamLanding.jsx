// ─────────────────────────────────────────────────────────────────────────────
// The Unis street team, the pitch page: /team (public, no app chrome)
//
// Same visual family as /sponsor (it reuses sponsorLanding.scss). It's a
// members' program, not a job: the page says so plainly, because it matters
// legally as well as honestly. No shifts, no quotas, no pay; members earn
// only through the referral code every member has. 18 and older.
// "Join the street team" opens the form at /team/join.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from './assets/unisLogoThree.svg';
import './sponsorLanding.scss';
import './teamPages.scss';

const QUESTIONS = [
  {
    q: 'Is this a job?',
    a: 'No. It’s a program for Unis members. There are no shifts, quotas, hours or pay, and you can skip any meetup. Like every member, you earn through your own referral code.',
  },
  {
    q: 'Who can join?',
    a: 'Unis members 18 and older. Living in Harlem helps, because the meetups are here.',
  },
  {
    q: 'How do I earn?',
    a: 'Everyone who signs up with your code is yours. Each month you get 10% of their monthly share, 5% of the people they bring in, and 2% one step further, for as long as they keep listening. Phone verification is needed to be paid, and cash-out starts at $50.',
  },
  {
    q: 'What happens at a meetup?',
    a: 'You meet at the spot, team up, and help people sign up on their own phones with your code. You choose which meetups to come to.',
  },
  {
    q: 'Do I need an account first?',
    a: 'Yes. The form asks for the email on your Unis account. If you don’t have one yet, the email we send you has a link to make one.',
  },
  {
    q: 'How do I stop?',
    a: 'Turn street team emails off on your street team page, any time.',
  },
];

const TeamLanding = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = 'The Unis street team';
    return () => { document.title = previous; };
  }, []);

  return (
    <div className="sl-page tm-page">
      <header className="sl-top">
        <Link to="/" className="sl-top__brand" aria-label="Unis home">
          <img src={logo} alt="" />
        </Link>
        <nav className="sl-top__nav" aria-label="Street team page">
          <a href="#how">How it works</a>
          <a href="#rules">Rules</a>
          <Link className="sl-top__cta" to="/team/join">Join</Link>
        </nav>
      </header>

      <main>
        <section className="sl-hero tm-hero">
          <div className="sl-hero__copy">
            <h1 className="sl-hero__headline">
              <span>Power to the people</span>
              <span>who press play.</span>
            </h1>
            <p className="sl-hero__lede">
              On Unis, Harlem decides who gets heard, not a playlist editor and not a label. The street
              team is how the word gets out: neighbors who meet up, sign people up together, and earn from
              everyone they bring in, like every Unis member.
            </p>
            <div className="sl-actions">
              <Link className="sl-btn" to="/team/join">Join the street team</Link>
              <a className="sl-textlink" href="#how">See how it works</a>
            </div>
          </div>

          <div className="tm-badge" aria-hidden="true">
            <span className="tm-badge__eyebrow">Your code</span>
            <span className="tm-badge__code">HARLEM&#8209;YOU</span>
            <span className="tm-badge__line">Everyone you sign up is yours, for as long as they listen.</span>
          </div>
        </section>

        <section className="sl-facts" aria-label="What the street team is">
          <div className="sl-fact">
            <h2>Come when you can</h2>
            <p>No shifts and no quotas. Pick the meetups that fit your week and skip the rest.</p>
          </div>
          <div className="sl-fact">
            <h2>Better together</h2>
            <p>
              Signing people up is easier, and more fun, as a group. Meetups happen at the developments,
              venues and blocks around Harlem.
            </p>
          </div>
          <div className="sl-fact">
            <h2>Your code, your community</h2>
            <p>Every person who joins with your code is yours, three levels deep, like every member.</p>
          </div>
        </section>

        <section className="sl-how" id="how" aria-labelledby="tm-how-title">
          <h2 id="tm-how-title" className="sl-section-title">From your phone to the block</h2>
          <ol className="sl-steps">
            <li>
              <h3>Have a Unis account</h3>
              <p>Your account comes with your own referral code.</p>
            </li>
            <li>
              <h3>Join the team</h3>
              <p>Tell us how you want to help and when you&rsquo;re usually free, then confirm your email.</p>
            </li>
            <li>
              <h3>Pick a meetup</h3>
              <p>Each meetup comes by email. Tap I&rsquo;m in or Can&rsquo;t make it. Change your mind any time.</p>
            </li>
            <li>
              <h3>Sign people up together</h3>
              <p>Bring your phone. People sign up on their own phones with your code.</p>
            </li>
          </ol>
        </section>

        <section className="sl-why" aria-labelledby="tm-why-title">
          <h2 id="tm-why-title" className="sl-why__statement">Your code helps change how music works.</h2>
          <p>
            On Unis a neighborhood decides who wins, and the artists people back get paid. Every person you
            bring in is one more vote for the artists on your block, and one more listener who earns too.
          </p>
        </section>

        <section className="sl-faq" id="rules" aria-labelledby="tm-rules-title">
          <h2 id="tm-rules-title" className="sl-section-title">The rules</h2>
          <ul className="tm-rules">
            <li>Be kind and take no for an answer.</li>
            <li>People sign up on their own phones. Never type anyone&rsquo;s password or handle their login.</li>
            <li>Never promise anyone a dollar amount.</li>
            <li>Never post flyers on lampposts, poles or other public property. Posters only go up where a shop owner says yes.</li>
            <li>Talk to people outside, on the sidewalk and in public spaces. Don&rsquo;t go into a NYCHA building unless a resident or the tenant association invites you.</li>
            <li>When you share your code online, say that you earn from it, for example &ldquo;I earn a share when you sign up with my code.&rdquo;</li>
          </ul>

          <h2 className="sl-section-title tm-faq-title">Questions</h2>
          <div className="sl-faq__list">
            {QUESTIONS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="sl-final">
          <h2 className="sl-final__title">Help Harlem pick its own stars.</h2>
          <p>Two minutes to join. Come when you can.</p>
          <Link className="sl-btn" to="/team/join">Join the street team</Link>
        </section>
      </main>

      <footer className="sl-foot">
        <span>&copy; {new Date().getFullYear()} Unis Music Corporation</span>
        <nav aria-label="Legal">
          <Link to="/help">Help</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
};

export default TeamLanding;
