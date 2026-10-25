// src/MessagePickerSheet.jsx
// One sheet, two jobs (Oct 2026 messaging restyle):
//   mode="people"  → the inbox "New" button: find someone to message
//   mode="song"    → the thread "Share a song" button: pick a song to share
// Both search through the existing GET /v1/search endpoint.
//
// Rendered into #root (not inside the page) so the player bar can never sit
// on top of it, and it slides away when closed instead of vanishing.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import useModalA11y from './hooks/useModalA11y';
import useLingering from './hooks/useLingering';
import { SearchIcon } from './icons/UnisIcons';

const COPY = {
  people: { title: 'New message', placeholder: 'Search people', type: 'user', empty: 'Search for an artist or listener by name.' },
  song: { title: 'Share a song', placeholder: 'Search songs', type: 'song', empty: 'Search for a song to share.' },
};

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

const SkeletonRows = ({ round }) => (
  <div aria-hidden="true">
    {[62, 48, 70, 54].map((w) => (
      <div key={w} className="udm-skel-row udm-skel-row--sheet">
        <span className={`udm-skel ${round ? 'udm-skel--circle' : 'udm-skel--square'}`} />
        <span className="udm-skel-row__lines">
          <span className="udm-skel udm-skel--line" style={{ width: `${w}%` }} />
          <span className="udm-skel udm-skel--line udm-skel--faint" style={{ width: `${w - 20}%` }} />
        </span>
      </div>
    ))}
  </div>
);

export default function MessagePickerSheet({ open, mode = 'people', onClose, onPick, excludeUserId }) {
  const copy = COPY[mode] || COPY.people;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const sheetRef = useRef(null);
  const { mounted, leaving } = useLingering(open, 240);

  useModalA11y({ active: open, onClose, modalRef: sheetRef });

  // Fresh sheet every time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setStatus('idle');
  }, [open, mode]);

  // Debounced search.
  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (q.length < 2) { setResults([]); setStatus('idle'); return undefined; }

    let cancelled = false;
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const res = await apiCall({
          method: 'get',
          url: `/v1/search?q=${encodeURIComponent(q)}&type=${copy.type}&limit=20`,
          useCache: false,
        });
        if (cancelled) return;
        const list = (res.data?.results || []).filter((r) => r.id !== excludeUserId);
        setResults(list);
        setStatus('done');
      } catch (err) {
        console.error(`[Messages] ${mode} search failed:`, err?.message || err);
        if (!cancelled) { setResults([]); setStatus('error'); }
      }
    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, open, copy.type, mode, excludeUserId]);

  if (!mounted) return null;

  const sheet = (
    <div
      className={`udm-sheet${leaving ? ' is-leaving' : ''}`}
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="udm-sheet__panel" role="dialog" aria-modal="true" aria-label={copy.title} ref={sheetRef} tabIndex={-1}>
        <div className="udm-sheet__grab" aria-hidden="true" />
        <div className="udm-sheet__head">
          <label className="udm-sheet__search">
            <SearchIcon size={19} />
            <span className="udm-sr">{copy.placeholder}</span>
            <input
              type="search"
              value={query}
              placeholder={copy.placeholder}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          <button type="button" className="udm-sheet__close" onClick={onClose}>Cancel</button>
        </div>

        <h2 className="udm-sheet__title">{copy.title}</h2>

        <div className="udm-sheet__list" aria-live="polite">
          {status === 'idle' && <p className="udm-sheet__hint">{copy.empty}</p>}
          {status === 'loading' && (
            <>
              <span className="udm-sr">Searching…</span>
              <SkeletonRows round={mode !== 'song'} />
            </>
          )}
          {status === 'error' && <p className="udm-sheet__hint">Search isn&rsquo;t available right now.</p>}
          {status === 'done' && results.length === 0 && (
            <p className="udm-sheet__hint">No matches for &ldquo;{query.trim()}&rdquo;.</p>
          )}

          {status !== 'loading' && results.map((r) => {
            const img = r.artworkUrl ? buildUrl(r.artworkUrl) : null;
            const isArtist = String(r.type).toLowerCase() === 'artist'
              || String(r.extra?.role || '').toLowerCase() === 'artist';
            return (
              <button key={r.id} type="button" className="udm-sheet__row" onClick={() => onPick(r)}>
                {img ? (
                  <img
                    className={mode === 'song' ? 'udm-sheet__art' : 'udm-sheet__avatar'}
                    src={img}
                    alt=""
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                ) : (
                  <span className={`udm-mono ${mode === 'song' ? 'udm-sheet__art' : 'udm-sheet__avatar'}`} aria-hidden="true">
                    {initials(r.name)}
                  </span>
                )}
                <span className="udm-sheet__meta">
                  <span className="udm-sheet__name">{r.name}</span>
                  <span className="udm-sheet__sub">
                    {mode === 'song' ? (r.subtitle || 'Song') : (isArtist ? 'Artist' : 'Listener')}
                    {mode === 'people' && r.subtitle ? ` · ${r.subtitle}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.getElementById('root') || document.body);
}
