import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from './layout';
import { HELP_SECTIONS } from './data/helpContent';
import './helpPage.scss';

// ── Chevron ─────────────────────────────────────────────────────────────────
// Inline SVG for the same reason the sidebar uses them: Lucide does not render
// reliably inside buttons here, and the rotation is driven entirely by CSS.

const Chevron = () => (
  <svg className="help-chev" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 10l4 4 4-4" />
  </svg>
);

// Strip JSX down to searchable text so the filter can match on article bodies,
// not just their titles. Runs once per render of the filter, over a small
// fixed corpus, so there is no reason to memoise harder than this.
const toText = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join(' ');
  if (React.isValidElement(node)) return toText(node.props?.children);
  return '';
};

const HelpPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [openSection, setOpenSection] = useState(null);
  const [openArticle, setOpenArticle] = useState(null);

  const sectionRefs = useRef({});

  // Only published sections reach the reader. Draft entries stay in the data
  // file so the remaining work is visible to us, not to them.
  const published = useMemo(
    () => HELP_SECTIONS.filter((s) => s.status === 'published' && s.articles.length > 0),
    []
  );

  // ── Search ────────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return published;
    return published
      .map((s) => ({
        ...s,
        articles: s.articles.filter(
          (a) =>
            a.q.toLowerCase().includes(q) ||
            toText(a.a).toLowerCase().includes(q)
        ),
      }))
      .filter(
        (s) =>
          s.articles.length > 0 ||
          s.title.toLowerCase().includes(q) ||
          s.blurb.toLowerCase().includes(q)
      );
  }, [q, published]);

  // ── Deep links ────────────────────────────────────────────────────────────
  // /help#voting opens the voting section; /help#voting-points opens that
  // section AND expands the single article, so a support reply can link
  // straight at one answer.
  useEffect(() => {
    const hash = (location.hash || '').replace('#', '');
    if (!hash) return;

    const bySection = published.find((s) => s.id === hash);
    if (bySection) {
      setOpenSection(hash);
      setOpenArticle(null);
    } else {
      const owner = published.find((s) => s.articles.some((a) => a.id === hash));
      if (!owner) return;
      setOpenSection(owner.id);
      setOpenArticle(hash);
    }

    // Wait for the expanded panel to lay out before scrolling to it.
    const target = bySection ? hash : published.find((s) => s.articles.some((a) => a.id === hash))?.id;
    const t = setTimeout(() => {
      sectionRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, [location.hash, published]);

  const toggleSection = useCallback((id) => {
    setOpenSection((cur) => (cur === id ? null : id));
    setOpenArticle(null);
  }, []);

  const toggleArticle = useCallback((id) => {
    setOpenArticle((cur) => (cur === id ? null : id));
  }, []);

  const clearSearch = () => {
    setQuery('');
    if (location.hash) navigate('/help', { replace: true });
  };

  return (
    <Layout>
      <div className="help-page">
        <header className="help-hero">
          <p className="help-hero__eyebrow">Help center</p>
          <h1 className="help-hero__title">How Unis works</h1>
          <p className="help-hero__sub">
            Every rule that decides a vote, a win, or a payout — written out in
            plain language.
          </p>

          <div className="help-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.4" />
              <path d="M16 16l4 4" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help"
              aria-label="Search help"
            />
            {query && (
              <button type="button" onClick={clearSearch} aria-label="Clear search">
                &times;
              </button>
            )}
          </div>
        </header>

        {results.length === 0 ? (
          <div className="help-empty">
            <p>Nothing matches &ldquo;{query}&rdquo;.</p>
            <button type="button" onClick={clearSearch}>Show all topics</button>
          </div>
        ) : (
          <div className="help-list">
            {results.map((section) => {
              const isOpen = openSection === section.id || Boolean(q);
              return (
                <section
                  key={section.id}
                  className={`help-topic ${isOpen ? 'open' : ''}`}
                  ref={(el) => { sectionRefs.current[section.id] = el; }}
                >
                  <button
                    type="button"
                    className="help-topic__head"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={`panel-${section.id}`}
                  >
                    <span className="help-topic__id">{section.title}</span>
                    <span className="help-topic__blurb">{section.blurb}</span>
                    <span className="help-topic__count">
                      {section.articles.length}
                    </span>
                    <Chevron />
                  </button>

                  <div
                    className="help-topic__panel"
                    id={`panel-${section.id}`}
                    hidden={!isOpen}
                  >
                    {section.articles.map((article) => {
                      const aOpen = openArticle === article.id;
                      return (
                        <article
                          key={article.id}
                          className={`help-qa ${aOpen ? 'open' : ''}`}
                          id={article.id}
                        >
                          <button
                            type="button"
                            className="help-qa__q"
                            onClick={() => toggleArticle(article.id)}
                            aria-expanded={aOpen}
                          >
                            <span>{article.q}</span>
                            <Chevron />
                          </button>
                          {aOpen && <div className="help-qa__a">{article.a}</div>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <footer className="help-foot">
          <p>
            Still stuck? Reach us at{' '}
            <a href="mailto:support@unis.com">support@unis.com</a> and we will
            get back to you.
          </p>
          <p className="help-foot__links">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/cookie">Cookies</a>
            <a href="/report">Report infringement</a>
          </p>
        </footer>
      </div>
    </Layout>
  );
};

export default HelpPage;