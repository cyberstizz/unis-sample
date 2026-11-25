// src/LibraryLists.jsx
//
// Liked Songs (/liked) and Recently played (/recent), from the listener
// features design, plus the feed's "Jump back in" row.
//
// Liked Songs: search, sort, and genre chips that change what Play and
//   Shuffle actually play (only the songs shown go into the queue). Shuffle is
//   a true Fisher–Yates shuffle (the player's), so nothing repeats.
// Recently played: the same list on every device, grouped by day. "Remove
//   from recently played" only hides a song here; its plays still count.

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart, Play, Shuffle, Search, X, History, MoreHorizontal, ArrowUpDown, ChevronRight,
} from 'lucide-react';
import Layout from './layout';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { songToTrack } from './utils/songTrack';
import './playback.scss';

const totalTime = (songs) => {
  const ms = songs.reduce((n, s) => n + (s.duration || 0), 0);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
};
const fmtLen = (ms) => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SORTS = [
  { id: 'recent', label: 'Recently liked' },
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
];

const trackOf = (song, source) => {
  const t = songToTrack(song, source);
  return t ? { ...t, duration: song.duration || 0, genre: song.genre?.name || null } : null;
};

// ============================================================================
// LIKED SONGS
// ============================================================================
export function LikedSongsPage() {
  const { requestPlayCollection, requestPlay } = useContext(PlayerContext);
  const feedback = useFeedback();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [genre, setGenre] = useState('all');
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    let off = false;
    apiCall({ method: 'get', url: '/v1/me/liked-songs', useCache: false })
      .then((res) => { if (!off) setRows((Array.isArray(res.data) ? res.data : []).map((r) => ({ at: r.likedAt, t: trackOf(r.song, 'liked') })).filter((r) => r.t)); })
      .catch((err) => { if (!off) { setRows([]); feedback.error(errorMessage(err, 'Couldn’t load your liked songs.')); } });
    return () => { off = true; };
  }, [feedback]);

  const genres = useMemo(() => {
    const counts = new Map();
    (rows || []).forEach((r) => { if (r.t.genre) counts.set(r.t.genre, (counts.get(r.t.genre) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ g, n }));
  }, [rows]);

  const shown = useMemo(() => {
    let list = (rows || []).slice();
    if (genre !== 'all') list = list.filter((r) => r.t.genre === genre);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => `${r.t.title} ${r.t.artist}`.toLowerCase().includes(q));
    if (sort === 'title') list.sort((a, b) => a.t.title.localeCompare(b.t.title));
    if (sort === 'artist') list.sort((a, b) => a.t.artist.localeCompare(b.t.artist));
    return list;
  }, [rows, genre, query, sort]);

  const filtered = genre !== 'all' || query.trim();
  const play = (shuffle) => {
    const tracks = shown.map((r) => r.t);
    if (!tracks.length) return;
    requestPlayCollection({ tracks, playlist: { playlistId: 'liked-songs', name: 'Liked Songs' }, shuffle });
  };

  return (
    <Layout>
      <div className="lsx-page">
        <header className="lsx-hero">
          <span className="lsx-cover lsx-cover--liked" aria-hidden="true"><Heart size={46} fill="currentColor" /></span>
          <div>
            <div className="lsx-kicker">Playlist</div>
            <h1>Liked Songs</h1>
            <p>{rows ? `${rows.length} ${rows.length === 1 ? 'song' : 'songs'}${rows.length ? ` · ${totalTime(rows.map((r) => r.t))}` : ''}` : 'Loading…'}</p>
          </div>
        </header>

        {rows && rows.length === 0 ? (
          <div className="lsx-empty">
            <span className="lsx-empty-icon" aria-hidden="true"><Heart size={26} /></span>
            <strong>Songs you like live here</strong>
            <p>Tap the heart on any song and it lands here.</p>
            <button type="button" className="lsx-btn" onClick={() => navigate('/discover')}>Find songs near you</button>
          </div>
        ) : (
          <>
            <div className="lsx-actions">
              <button type="button" className="lsx-play" onClick={() => play(false)} disabled={!shown.length}><Play size={18} fill="currentColor" aria-hidden="true" /> Play</button>
              <button type="button" className="lsx-btn" onClick={() => play(true)} disabled={!shown.length}><Shuffle size={17} aria-hidden="true" /> Shuffle</button>
            </div>
            <div className="lsx-tools">
              <label className="lsx-find">
                <Search size={15} aria-hidden="true" />
                <span className="lsx-sr">Search liked songs</span>
                <input type="search" value={query} placeholder="Search liked songs" onChange={(e) => setQuery(e.target.value)} />
                {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
              </label>
              <div className="lsx-sort">
                <button type="button" className="lsx-chip" onClick={() => setSortOpen((v) => !v)} aria-expanded={sortOpen}>
                  <ArrowUpDown size={14} aria-hidden="true" /> {SORTS.find((x) => x.id === sort)?.label}
                </button>
                {sortOpen && (
                  <div className="lsx-menu" role="menu">
                    {SORTS.map((o) => (
                      <button key={o.id} type="button" role="menuitemradio" aria-checked={sort === o.id} onClick={() => { setSort(o.id); setSortOpen(false); }}>{o.label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {genres.length > 1 && (
              <div className="lsx-chips" role="radiogroup" aria-label="Genre">
                <button type="button" role="radio" aria-checked={genre === 'all'} className={`lsx-chip ${genre === 'all' ? 'is-on' : ''}`} onClick={() => setGenre('all')}>All</button>
                {genres.map(({ g, n }) => (
                  <button key={g} type="button" role="radio" aria-checked={genre === g} className={`lsx-chip ${genre === g ? 'is-on' : ''}`} onClick={() => setGenre(g)}>{g} <span>{n}</span></button>
                ))}
              </div>
            )}
            {filtered && shown.length > 0 && (
              <p className="lsx-filter-note">{genre !== 'all' ? `${genre} filter on` : 'Search on'}: Play and Shuffle only use these {shown.length} {shown.length === 1 ? 'song' : 'songs'}.</p>
            )}
            <ul className="lsx-list">
              {(rows ? shown : Array.from({ length: 6 }, () => null)).map((r, i) => (
                r ? (
                  <li key={`${r.t.id}-${i}`}>
                    <button type="button" className="lsx-row" onClick={() => requestPlay(r.t)}>
                      <img src={r.t.artworkUrl || '/assets/placeholder.jpg'} alt="" />
                      <span className="lsx-row-text"><strong>{r.t.title}</strong><span>{r.t.artist}{r.t.genre ? ` · ${r.t.genre}` : ''}</span></span>
                      <span className="lsx-row-time">{fmtLen(r.t.duration)}</span>
                      <Heart size={17} className="lsx-row-heart" fill="currentColor" aria-label="Liked" />
                    </button>
                  </li>
                ) : <li key={`g${i}`} className="lsx-ghost" aria-hidden="true" />
              ))}
            </ul>
            {rows && shown.length === 0 && <p className="lsx-filter-note">No liked songs match.</p>}
          </>
        )}
      </div>
    </Layout>
  );
}

// ============================================================================
// RECENTLY PLAYED
// ============================================================================
const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: diff < 7 ? 'long' : undefined, month: 'short', day: 'numeric' });
};
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function RecentlyPlayedPage() {
  const { requestPlay } = useContext(PlayerContext);
  const feedback = useFeedback();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    let off = false;
    apiCall({ method: 'get', url: '/v1/me/recently-played?limit=100', useCache: false })
      .then((res) => { if (!off) setRows((Array.isArray(res.data) ? res.data : []).map((r) => ({ at: r.playedAt, t: trackOf(r.song, 'recent') })).filter((r) => r.t)); })
      .catch((err) => { if (!off) { setRows([]); feedback.error(errorMessage(err, 'Couldn’t load what you played.')); } });
    return () => { off = true; };
  }, [feedback]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const hide = async (t) => {
    setMenu(null);
    const before = rows;
    setRows((list) => list.filter((r) => r.t.id !== t.id));
    try {
      await apiCall({ method: 'post', url: `/v1/me/recently-played/${t.id}/hide` });
      feedback.success('Removed from Recently played · your plays still count');
    } catch (err) {
      setRows(before);
      feedback.error(errorMessage(err, 'Couldn’t remove it. Try again.'));
    }
  };

  const groups = useMemo(() => {
    const out = [];
    (rows || []).forEach((r) => {
      const d = dayLabel(r.at);
      if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, items: [] });
      out[out.length - 1].items.push(r);
    });
    return out;
  }, [rows]);

  return (
    <Layout>
      <div className="lsx-page">
        <header className="lsx-hero lsx-hero--plain">
          <span className="lsx-cover lsx-cover--recent" aria-hidden="true"><History size={40} /></span>
          <div>
            <div className="lsx-kicker">Library</div>
            <h1>Recently played</h1>
            <p>Same list on every device you sign in on.</p>
          </div>
        </header>
        {rows && rows.length === 0 ? (
          <div className="lsx-empty">
            <span className="lsx-empty-icon" aria-hidden="true"><History size={26} /></span>
            <strong>Nothing played yet</strong>
            <p>Songs show up here after you listen to them for a bit.</p>
            <button type="button" className="lsx-btn" onClick={() => navigate('/discover')}>Find songs near you</button>
          </div>
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.day} className="lsx-day">
                <h2>{g.day}</h2>
                <ul className="lsx-list">
                  {g.items.map((r) => (
                    <li key={`${r.t.id}-${r.at}`} className="lsx-li">
                      <button type="button" className="lsx-row" onClick={() => requestPlay(r.t)}>
                        <img src={r.t.artworkUrl || '/assets/placeholder.jpg'} alt="" />
                        <span className="lsx-row-text"><strong>{r.t.title}</strong><span>{r.t.artist}</span></span>
                        <span className="lsx-row-time">{timeLabel(r.at)}</span>
                      </button>
                      <div className="lsx-menu-wrap">
                        <button type="button" className="lsx-more" aria-label={`More for ${r.t.title}`} onClick={(e) => { e.stopPropagation(); setMenu(menu === r.t.id ? null : r.t.id); }}>
                          <MoreHorizontal size={18} />
                        </button>
                        {menu === r.t.id && (
                          <div className="lsx-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                            <button type="button" role="menuitem" onClick={() => hide(r.t)}><X size={15} /> Remove from recently played</button>
                            <button type="button" role="menuitem" onClick={() => navigate(`/song/${r.t.id}`)}><ChevronRight size={15} /> Song page</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!rows && <ul className="lsx-list">{Array.from({ length: 6 }, (_, i) => <li key={i} className="lsx-ghost" aria-hidden="true" />)}</ul>}
            {rows && rows.length > 0 && <p className="lsx-filter-note">Removing only hides a song here. Your plays still count for the artist.</p>}
          </>
        )}
      </div>
    </Layout>
  );
}

// ============================================================================
// FEED: Jump back in
// ============================================================================
export function JumpBackIn() {
  const { user } = useAuth();
  const { requestPlay } = useContext(PlayerContext);
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!user) return undefined;
    let off = false;
    apiCall({ method: 'get', url: '/v1/me/recently-played?limit=12', useCache: false })
      .then((res) => { if (!off) setItems((Array.isArray(res.data) ? res.data : []).map((r) => trackOf(r.song, 'jump_back_in')).filter(Boolean)); })
      .catch(() => { if (!off) setItems([]); });
    return () => { off = true; };
  }, [user]);
  // New listeners don't see an empty row.
  if (!user || items.length === 0) return null;
  return (
    <section className="jbi" aria-labelledby="jbi-title">
      <div className="jbi-head">
        <h2 id="jbi-title">Jump back in</h2>
        <Link to="/recent" className="jbi-all">See all <ChevronRight size={15} aria-hidden="true" /></Link>
      </div>
      <div className="jbi-row">
        <Link to="/liked" className="jbi-card jbi-card--liked">
          <span className="jbi-art jbi-art--liked" aria-hidden="true"><Heart size={34} fill="currentColor" /></span>
          <strong>Liked Songs</strong>
          <span>Playlist</span>
        </Link>
        {items.map((t) => (
          <button key={t.id} type="button" className="jbi-card" onClick={() => requestPlay(t)}>
            <span className="jbi-art"><img src={t.artworkUrl || '/assets/placeholder.jpg'} alt="" /></span>
            <strong>{t.title}</strong>
            <span>{t.artist}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
