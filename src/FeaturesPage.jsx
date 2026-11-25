// src/FeaturesPage.jsx — /features
//
// Everything Unis does, in one list. Linked from the Help center and open to
// everyone, including people on the pre-launch "Coming soon" side
// (prelaunchConfig OPEN_PATHS). The list itself lives in data/featuresContent.js.

import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from './layout';
import { FEATURE_GROUPS, FEATURE_COUNT, NEW_COUNT } from './data/featuresContent';
import './featuresPage.scss';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The group title with one word set in the italic serif, like the rest of Unis.
const GroupTitle = ({ title, em }) => {
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
// looks in Now Playing. Fixed shapes, so it renders the same every time.
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

const FeaturesPage = () => {
  const [query, setQuery] = useState('');
  const [newOnly, setNewOnly] = useState(false);
  const groupRefs = useRef({});

  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    return FEATURE_GROUPS
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          if (newOnly && !it.isNew) return false;
          if (!q) return true;
          return (
            it.t.toLowerCase().includes(q) ||
            it.d.toLowerCase().includes(q) ||
            g.title.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [q, newOnly]);

  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  const filtered = Boolean(q) || newOnly;

  const jumpTo = (id) => {
    const el = groupRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  const clear = () => {
    setQuery('');
    setNewOnly(false);
  };

  return (
    <Layout>
      <div className="ftp">
        <header className="ftp-hero">
          <div className="ftp-hero__text">
            <p className="ftp-hero__eyebrow">Features</p>
            <h1 className="ftp-hero__title">
              Everything Unis <em>does</em>
            </h1>
            <p className="ftp-hero__sub">
              Every feature, big and small, for listeners and for artists. The
              ones marked <span className="ftp-new ftp-new--inline">New</span> arrived in the latest update.
            </p>
            <div className="ftp-hero__stats">
              <span className="ftp-stat"><b>{FEATURE_COUNT}</b> features</span>
              <span className="ftp-stat ftp-stat--new"><b>{NEW_COUNT}</b> new this update</span>
              <Link className="ftp-stat ftp-stat--link" to="/help">How it all works &rarr;</Link>
            </div>
          </div>
          <HeroArt />
        </header>

        <div className="ftp-bar">
          <div className="ftp-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.4" />
              <path d="M16 16l4 4" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search features"
              aria-label="Search features"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                &times;
              </button>
            )}
          </div>
          <button
            type="button"
            className={`ftp-toggle ${newOnly ? 'is-on' : ''}`}
            aria-pressed={newOnly}
            onClick={() => setNewOnly((v) => !v)}
          >
            <span className="ftp-toggle__dot" aria-hidden="true" />
            New only
          </button>
        </div>

        {!filtered && (
          <nav className="ftp-jump" aria-label="Feature groups">
            {FEATURE_GROUPS.map((g, i) => (
              <button key={g.id} type="button" className="ftp-jump__chip" onClick={() => jumpTo(g.id)}>
                <span className="ftp-jump__n">{String(i + 1).padStart(2, '0')}</span>
                {g.title}
              </button>
            ))}
          </nav>
        )}

        {filtered && (
          <p className="ftp-count" role="status">
            {shown === 0
              ? 'No features match.'
              : `${shown} ${shown === 1 ? 'feature' : 'features'}`}
            <button type="button" onClick={clear}>Show everything</button>
          </p>
        )}

        {groups.map((g) => {
          const n = FEATURE_GROUPS.findIndex((x) => x.id === g.id) + 1;
          return (
            <section
              key={g.id}
              className="ftp-group"
              id={`features-${g.id}`}
              ref={(el) => { groupRefs.current[g.id] = el; }}
              aria-labelledby={`features-${g.id}-title`}
            >
              <div className="ftp-group__head">
                <span className="ftp-group__n" aria-hidden="true">{String(n).padStart(2, '0')}</span>
                <div>
                  <h2 className="ftp-group__title" id={`features-${g.id}-title`}>
                    <GroupTitle title={g.title} em={g.em} />
                  </h2>
                  <p className="ftp-group__intro">{g.intro}</p>
                </div>
                <span className="ftp-group__count">{g.items.length}</span>
              </div>
              <ul className="ftp-list">
                {g.items.map((it) => (
                  <li key={it.t} className={`ftp-item ${it.isNew ? 'is-new' : ''}`}>
                    <div className="ftp-item__top">
                      <h3 className="ftp-item__t">{it.t}</h3>
                      {it.isNew && <span className="ftp-new">New</span>}
                    </div>
                    <p className="ftp-item__d">{it.d}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

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
