// src/FeaturesPage.jsx — /features
//
// What Unis does, section by section, opening one at a time like the Help
// center. Each open section shows its screenshots (from /public/features/)
// and its benefits, with the features behind each benefit as tags.
// Linked from the Help center and open to everyone, including people on the
// pre-launch side (prelaunchConfig OPEN_PATHS). Content: data/featuresContent.js.

import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from './layout';
import { FEATURE_SECTIONS, FEATURE_COUNT, NEW_COUNT } from './data/featuresContent';
import './featuresPage.scss';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const Chevron = () => (
  <svg className="ftp-chev" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 10l4 4 4-4" />
  </svg>
);

// The title with one word in the italic serif, like the rest of Unis.
const SectionTitle = ({ title, em }) => {
  if (!em || !title.includes(em)) return title;
  const at = title.indexOf(em);
  return (
    <>
      {title.slice(0, at)}
      <em>{em}</em>
      {title.slice(at + em.length)}
    </>
  );
};

// The small art in the hero: two songs' waveforms crossing, the way a Unis Mix
// looks in Now Playing. Fixed shapes, so it draws the same every time.
const HeroArt = () => {
  const bars = 44;
  const shape = (i, seed) => {
    const v = Math.abs(Math.sin(i * 0.61 + seed) * 0.6 + Math.sin(i * 1.7 + seed * 2) * 0.4);
    return 0.22 + v * 0.78;
  };
  return (
    <svg className="ftp-art" viewBox="0 0 220 64" aria-hidden="true" focusable="false">
      {Array.from({ length: bars }, (_, i) => {
        const x = 3 + i * 5;
        const fadeA = Math.min(1, Math.max(0, (bars - 8 - i) / 18));
        const fadeB = Math.min(1, Math.max(0, (i - 12) / 18));
        const hA = 52 * shape(i, 0.4) * (0.25 + 0.75 * fadeA);
        const hB = 52 * shape(i, 2.1) * (0.25 + 0.75 * fadeB);
        return (
          <g key={i}>
            <rect className="ftp-art__a" x={x} y={32 - hA / 2} width="2.4" height={hA} rx="1.2" opacity={0.25 + 0.75 * fadeA} />
            <rect className="ftp-art__b" x={x + 1.2} y={32 - hB / 2} width="2.4" height={hB} rx="1.2" opacity={0.25 + 0.75 * fadeB} />
          </g>
        );
      })}
      <path className="ftp-art__curve" d="M3 10 C 80 10, 140 54, 218 54" />
      <path className="ftp-art__curve ftp-art__curve--b" d="M3 54 C 80 54, 140 10, 218 10" />
    </svg>
  );
};

// A section's screenshots. One that isn't uploaded yet is left out, and if
// none are there the strip doesn't show at all.
const Shots = ({ shots }) => {
  const [missing, setMissing] = useState(() => new Set());
  const [loaded, setLoaded] = useState(() => new Set());
  const visible = shots.filter((s) => !missing.has(s.src));
  if (visible.length === 0) return null;

  const mark = (setter, src) => setter((prev) => {
    if (prev.has(src)) return prev;
    const next = new Set(prev);
    next.add(src);
    return next;
  });

  return (
    <div className={`ftp-shots ${visible.length === 1 ? 'is-single' : ''}`}>
      {visible.map((s) => (
        <figure key={s.src} className={`ftp-shot ${s.wide ? 'ftp-shot--wide' : ''} ${loaded.has(s.src) ? 'is-loaded' : ''}`}>
          <div className="ftp-shot__frame">
            <img
              src={s.src}
              alt={s.caption}
              loading="lazy"
              decoding="async"
              onLoad={() => mark(setLoaded, s.src)}
              onError={() => mark(setMissing, s.src)}
            />
          </div>
          <figcaption>{s.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
};

const FeaturesPage = () => {
  const [open, setOpen] = useState(FEATURE_SECTIONS[0]?.id || null);
  const refs = useRef({});

  const toggle = (id) => {
    const opening = open !== id;
    setOpen(opening ? id : null);
    if (!opening) return;
    // Bring the opened section's header into view (the one above it may have
    // just closed, which moves everything up).
    requestAnimationFrame(() => {
      const el = refs.current[id];
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    });
  };

  return (
    <Layout>
      <div className="ftp">
        <header className="ftp-hero">
          <HeroArt />
          <p className="ftp-hero__eyebrow">Features</p>
          <h1 className="ftp-hero__title">
            Everything Unis <em>does</em>
          </h1>
          <p className="ftp-hero__sub">
            What Unis does for listeners and artists, one section at a time. Tap a
            section to open it.
          </p>
          <div className="ftp-hero__stats">
            <span className="ftp-stat"><b>{FEATURE_COUNT}</b> features</span>
            <span className="ftp-stat ftp-stat--new"><b>{NEW_COUNT}</b> new this update</span>
          </div>
        </header>

        <div className="ftp-list">
          {FEATURE_SECTIONS.map((s, i) => {
            const isOpen = open === s.id;
            const newHere = s.benefits.some((b) => b.isNew);
            return (
              <section
                key={s.id}
                id={`features-${s.id}`}
                className={`ftp-sec ${isOpen ? 'open' : ''}`}
                ref={(el) => { refs.current[s.id] = el; }}
              >
                <button
                  type="button"
                  className="ftp-sec__head"
                  onClick={() => toggle(s.id)}
                  aria-expanded={isOpen}
                  aria-controls={`features-panel-${s.id}`}
                >
                  <span className="ftp-sec__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="ftp-sec__text">
                    <span className="ftp-sec__title">
                      <SectionTitle title={s.title} em={s.em} />
                    </span>
                    <span className="ftp-sec__blurb">{s.blurb}</span>
                  </span>
                  {newHere && <span className="ftp-new" aria-label="Has new features">New</span>}
                  <Chevron />
                </button>

                <div className="ftp-sec__panel" id={`features-panel-${s.id}`} hidden={!isOpen}>
                  {isOpen && (
                    <>
                      <Shots shots={s.shots} />
                      <ul className="ftp-bens">
                        {s.benefits.map((b) => (
                          <li key={b.t} className={`ftp-ben ${b.isNew ? 'is-new' : ''}`}>
                            <div className="ftp-ben__top">
                              <h3 className="ftp-ben__t">{b.t}</h3>
                              {b.isNew && <span className="ftp-new">New</span>}
                            </div>
                            <p className="ftp-ben__d">{b.d}</p>
                            <ul className="ftp-tags" aria-label="Features">
                              {b.tags.map((tag) => <li key={tag}>{tag}</li>)}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="ftp-foot">
          <p>
            Want the rules behind votes, wins and payouts?{' '}
            <Link to="/help">Read the Help center</Link>.
          </p>
          <p>
            Questions? <a href="mailto:support@unismusic.com">support@unismusic.com</a>
          </p>
        </footer>
      </div>
    </Layout>
  );
};

export default FeaturesPage;
