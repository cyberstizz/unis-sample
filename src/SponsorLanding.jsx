// ─────────────────────────────────────────────────────────────────────────────
// Sponsor Harlem, the pitch page: /sponsor (public, no app chrome)
//
// What a shop owner sees first, from a street-team QR code, a link you send a
// prospect, or the "Your business here" ad card. The one big moment is the
// live preview: they type their shop's name and a line, and watch their own
// sponsorship appear inside a Unis screen. "Book a week" carries what they
// typed (and the crew member's ?ref code) into the booking form at
// /sponsor/book.
//
// Stripe sends buyers back to /sponsor?status=paid|canceled; those visits are
// passed straight on to /sponsor/book, which shows the result.
//
// Prices come from the server (GET /api/v1/sponsors/options) so this page and
// the form always agree; the defaults below only show if that call fails.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { SponsorCard } from './components/AdSlot';
import logo from './assets/unisLogoThree.svg';
import './components/adSlot.scss';
import './sponsorLanding.scss';

const FALLBACK_AREAS = [
  { key: 'uptown', label: 'Uptown Harlem', weekPriceCents: 2500 },
  { key: 'downtown', label: 'Downtown Harlem', weekPriceCents: 2500 },
  { key: 'harlem', label: 'All of Harlem', weekPriceCents: 4000 },
];

// Made-up songs for the preview screen. Their "covers" are drawn in CSS, so no
// real artwork appears on a marketing page.
const PREVIEW_SONGS = [
  { title: 'Lenox After Dark', artist: 'Kay Monroe', plays: '2.4K', hue: 222 },
  { title: 'Sugar Hill Summer', artist: 'Dre Vaughn', plays: '1.9K', hue: 268 },
  { title: '125th & Late', artist: 'Sol Rivers', plays: '1.2K', hue: 196 },
  { title: 'Brownstone Steps', artist: 'Nia Lowe', plays: '980', hue: 242 },
];

const dollars = (cents) => {
  const n = Number(cents || 0) / 100;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
};

const cleanRef = (raw) => (raw || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

const QUESTIONS = [
  {
    q: 'What can I advertise?',
    a: 'Local businesses and services in or near Harlem. We don’t run ads for alcohol, tobacco, vaping or cannabis, gambling, weapons, adult content, political campaigns, or high-interest lending, and the link has to go to your own business.',
  },
  {
    q: 'Who sees it?',
    a: 'People using Unis in the area you pick: Uptown, Downtown, or all of Harlem. Members who pay for Unis Plus don’t see ads, so your spot goes to everyone else.',
  },
  {
    q: 'What if it isn’t approved?',
    a: 'You get the full amount back on your card, and we tell you why. You can fix it and book again.',
  },
  {
    q: 'How will I know it worked?',
    a: 'The day after your weeks end, we email you how many times your sponsorship was shown and tapped.',
  },
  {
    q: 'Is it a subscription?',
    a: 'No. You pay once, by card, for the weeks you pick. Nothing renews.',
  },
  {
    q: 'Do I need a Unis account?',
    a: 'No. Your business name, an email for the receipt, and a card are all it takes.',
  },
];

const Cover = ({ hue, initial }) => (
  <span className="sl-cover" style={{ '--hue': hue }} aria-hidden="true">{initial}</span>
);

/** The phone screen with the visitor's own sponsorship sitting between songs. */
const LivePreview = ({ name, line }) => {
  const typed = Boolean(name.trim() || line.trim());
  return (
    <figure className="sl-phone">
      <div className="sl-phone__frame">
        <div className="sl-phone__screen">
          <div className="sl-phone__head">
            <span className="sl-phone__place">Uptown Harlem</span>
            <span className="sl-phone__title">Trending today</span>
          </div>
          <ul className="sl-phone__songs">
            {PREVIEW_SONGS.slice(0, 2).map((s, i) => (
              <li key={s.title}>
                <span className="sl-phone__rank">{i + 1}</span>
                <Cover hue={s.hue} initial={s.title.charAt(0)} />
                <span className="sl-phone__song"><b>{s.title}</b><small>{s.artist}</small></span>
                <span className="sl-phone__plays">{s.plays}</span>
              </li>
            ))}
          </ul>
          <div className={`ad-slot ad-slot--banner sl-phone__ad ${typed ? 'is-live' : ''}`}>
            <span className="ad-slot__label">Sponsored · Local</span>
            <div className="ad-slot__body">
              <SponsorCard
                preview
                sponsor={{
                  businessName: name.trim() || 'Your shop',
                  headline: line.trim() || 'Your one line, right here, between the songs.',
                }}
              />
            </div>
          </div>
          <ul className="sl-phone__songs">
            {PREVIEW_SONGS.slice(2).map((s, i) => (
              <li key={s.title}>
                <span className="sl-phone__rank">{i + 3}</span>
                <Cover hue={s.hue} initial={s.title.charAt(0)} />
                <span className="sl-phone__song"><b>{s.title}</b><small>{s.artist}</small></span>
                <span className="sl-phone__plays">{s.plays}</span>
              </li>
            ))}
          </ul>
          <div className="sl-phone__player" aria-hidden="true">
            <Cover hue={222} initial="L" />
            <span className="sl-phone__song"><b>Lenox After Dark</b><small>Kay Monroe</small></span>
            <span className="sl-phone__eq"><i /><i /><i /><i /></span>
          </div>
        </div>
      </div>
      <figcaption>Live preview. Type your shop&rsquo;s name and watch it appear.</figcaption>
    </figure>
  );
};

const SponsorLanding = () => {
  const [params] = useSearchParams();
  const ref = cleanRef(params.get('ref'));
  const returned = params.get('status');
  const [name, setName] = useState('');
  const [line, setLine] = useState('');
  const [areas, setAreas] = useState(FALLBACK_AREAS);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Sponsor Harlem on Unis';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    if (returned) return undefined;
    let cancelled = false;
    apiCall({ method: 'get', url: '/v1/sponsors/options', useCache: false })
      .then((res) => {
        const list = res?.data?.areas;
        if (!cancelled && Array.isArray(list) && list.length && list.every((a) => a.label && a.weekPriceCents > 0)) {
          setAreas(list);
        }
      })
      .catch(() => { /* the defaults stay */ });
    return () => { cancelled = true; };
  }, [returned]);

  const bookHref = useMemo(() => {
    const q = new URLSearchParams();
    if (ref) q.set('ref', ref);
    if (name.trim()) q.set('name', name.trim());
    if (line.trim()) q.set('line', line.trim());
    const s = q.toString();
    return `/sponsor/book${s ? `?${s}` : ''}`;
  }, [ref, name, line]);

  // Back from Stripe: the booking form shows how it went.
  if (returned) return <Navigate to={`/sponsor/book?${params.toString()}`} replace />;

  const from = dollars(Math.min(...areas.map((a) => a.weekPriceCents)));

  return (
    <div className="sl-page">
      <header className="sl-top">
        <Link to="/" className="sl-top__brand" aria-label="Unis home">
          <img src={logo} alt="" />
        </Link>
        <nav className="sl-top__nav" aria-label="Sponsor page">
          <a href="#how">How it works</a>
          <a href="#prices">Prices</a>
          <Link className="sl-top__cta" to={bookHref}>Book a week</Link>
        </nav>
      </header>

      <main>
        <section className="sl-hero">
          <div className="sl-hero__copy">
            <h1 className="sl-hero__headline">
              <span>Your block</span>
              <span>is listening.</span>
            </h1>
            <p className="sl-hero__lede">
              Unis is where Harlem finds its own artists. Put your shop in front of the people listening
              in your neighborhood, one week at a time, from {from}.
            </p>

            <div className="sl-try">
              <label className="sl-try__field">
                <span>Your shop&rsquo;s name</span>
                <input value={name} maxLength={60} autoComplete="organization" placeholder="Lenox Cuts"
                  onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="sl-try__field">
                <span>One line about it</span>
                <input value={line} maxLength={80} placeholder="Fresh fades on Lenox, walk-ins welcome"
                  onChange={(e) => setLine(e.target.value)} />
              </label>
            </div>

            <div className="sl-actions">
              <Link className="sl-btn" to={bookHref}>Book a week</Link>
              <a className="sl-textlink" href="#how">See how it works</a>
            </div>
            {ref && <p className="sl-ref">Referred by <strong>{ref}</strong></p>}
          </div>

          <LivePreview name={name} line={line} />
        </section>

        <section className="sl-facts" aria-label="Who sees it">
          <div className="sl-fact">
            <h2>Seen by your neighbors</h2>
            <p>
              Your sponsorship only shows to people using Unis in the area you pick, while they find, play
              and vote on local music.
            </p>
          </div>
          <div className="sl-fact">
            <h2>Clearly labeled</h2>
            <p>
              It says Sponsored · Local and sits between songs. It never interrupts a track and never
              pretends to be one.
            </p>
          </div>
          <div className="sl-fact">
            <h2>Room to stand out</h2>
            <p>No more than three businesses share a neighborhood in any week, so yours gets seen.</p>
          </div>
        </section>

        <section className="sl-board" id="prices" aria-labelledby="sl-prices-title">
          <div className="sl-board__inner">
            <h2 id="sl-prices-title" className="sl-board__title">One week, one price.</h2>
            <dl className="sl-menu">
              {areas.map((a) => (
                <div className="sl-menu__row" key={a.key}>
                  <dt>{a.label}</dt>
                  <span className="sl-menu__dots" aria-hidden="true" />
                  <dd>{dollars(a.weekPriceCents)} <small>a week</small></dd>
                </div>
              ))}
            </dl>
            <p className="sl-board__note">
              Book up to four weeks in a row. One payment by card, no subscription. If we can&rsquo;t run it,
              every cent comes back.
            </p>
          </div>
        </section>

        <section className="sl-how" id="how" aria-labelledby="sl-how-title">
          <h2 id="sl-how-title" className="sl-section-title">From your counter to their screen</h2>
          <ol className="sl-steps">
            <li>
              <h3>Pick your neighborhood and week</h3>
              <p>Weeks start on Monday. Choose Uptown, Downtown or all of Harlem.</p>
            </li>
            <li>
              <h3>Make it yours</h3>
              <p>Add your logo, one line, and a link to your website, Instagram or Google Maps page.</p>
            </li>
            <li>
              <h3>Pay once</h3>
              <p>By card, on Stripe&rsquo;s secure checkout. Unis never sees your card.</p>
            </li>
            <li>
              <h3>Go live on Monday</h3>
              <p>We review every booking within one business day and email you when it&rsquo;s approved.</p>
            </li>
          </ol>
        </section>

        <section className="sl-why" aria-labelledby="sl-why-title">
          <h2 id="sl-why-title" className="sl-why__statement">Part of your week goes back to Harlem&rsquo;s artists.</h2>
          <p>
            Sponsorships are how Unis earns, and every month Unis shares what it earns with the community:
            the artists people support and the neighbors who bring new listeners in. Nobody is paid to look
            at your ad. They&rsquo;re here for the music, and you&rsquo;re part of how it keeps going.
          </p>
        </section>

        <section className="sl-faq" aria-labelledby="sl-faq-title">
          <h2 id="sl-faq-title" className="sl-section-title">Questions shop owners ask</h2>
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
          <h2 className="sl-final__title">Say hello to the block.</h2>
          <p>One page, one payment, live on Monday.</p>
          <Link className="sl-btn" to={bookHref}>Book a week</Link>
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

export default SponsorLanding;
