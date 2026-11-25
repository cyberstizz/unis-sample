// src/libraryPage.jsx
//
// Your library — /playlists (Nov 2026).
//
// Designed with Scout → Sketch → Ship (canvas "Unis playlist + library
// pages"). Replaces the popup playlist manager with a real page, the way
// Spotify, Apple Music and YouTube Music all do it. The rules it follows:
//   • Chips filter (All · By you · Following), Sort sorts, and the list/grid
//     switch changes the view. All three are remembered on this device,
//     because people hate losing their sort.
//   • The playlist that's playing shows moving bars, so you find it in one look.
//   • Search covers your library first, then public playlists on Unis.
//   • Below your library: playlists from around your area (with "Start one"
//     at the end of the row), Official picks and Popular on Unis.
//   • New playlist (here, or the sidebar's +, which opens /playlists?new=1)
//     creates it and opens it right away, ready to fill.
//
// The popup (playlistManager.jsx) is kept in the repo but no longer opened.

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, X, ArrowUpDown, ChevronDown, LayoutGrid, List, Music,
  ImagePlus, Lock, EyeOff, Globe, MapPin,
  Heart, History,
} from 'lucide-react';
import Layout from './layout';
import './playback.scss';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import axiosInstance from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import useModalA11y from './hooks/useModalA11y';
import { buildUrl } from './utils/buildUrl';
import './libraryPage.scss';

const VIEW_KEY = 'unis-library-view';
const CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'By you' },
  { id: 'following', label: 'Following' },
];
const SORTS = [
  { id: 'recents', label: 'Recents' },
  { id: 'az', label: 'Alphabetical' },
  { id: 'creator', label: 'Creator' },
  { id: 'songs', label: 'Most songs' },
];

const readView = () => {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}');
    return {
      chip: CHIPS.some((c) => c.id === v.chip) ? v.chip : 'all',
      sort: SORTS.some((o) => o.id === v.sort) ? v.sort : 'recents',
      view: v.view === 'grid' ? 'grid' : 'list',
    };
  } catch {
    return { chip: 'all', sort: 'recents', view: 'list' };
  }
};

const idOf = (pl) => pl?.playlistId || pl?.id;
const songsWord = (n) => `${n} song${n === 1 ? '' : 's'}`;

// A playlist's cover: its own image, else a 2×2 mosaic, else one artwork.
const Cover = ({ pl, className = '' }) => {
  const [broken, setBroken] = useState(false);
  const cover = pl.coverImageUrl && !broken ? buildUrl(pl.coverImageUrl) : null;
  const art = (pl.firstFourArtworks || []).filter(Boolean).map((u) => buildUrl(u));
  return (
    <span className={`lib-cover ${className}`} aria-hidden="true">
      {cover ? (
        <img src={cover} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : art.length >= 4 ? (
        <span className="lib-cover__mosaic">{art.slice(0, 4).map((u) => <img key={u} src={u} alt="" loading="lazy" />)}</span>
      ) : art.length > 0 ? (
        <img src={art[0]} alt="" loading="lazy" />
      ) : (
        <span className="lib-cover__empty"><Music size={22} /></span>
      )}
    </span>
  );
};

const Eq = () => <span className="lib-eq" aria-hidden="true"><i /><i /><i /></span>;

export default function LibraryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, isGuest } = useAuth();
  const signedIn = !!user && !isGuest;
  const { triggerGate, gateProps } = useAuthGate();
  const feedback = useFeedback();
  const {
    playlists = [], followedPlaylists = [], refreshPlaylists, loadFollowedPlaylists,
    currentMedia, isPlaying,
  } = useContext(PlayerContext) || {};

  const home = user?.jurisdiction || null; // { jurisdictionId, name }
  const homeName = home?.name || 'your area';

  // ── Remembered view: chip, sort, list/grid ──
  const [{ chip, sort, view }, setPrefs] = useState(readView);
  const setPref = (patch) => setPrefs((prev) => {
    const next = { ...prev, ...patch };
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    return next;
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onUnis, setOnUnis] = useState({ status: 'idle', items: [] });
  const searchRef = useRef(null);

  // ── Library data (lives in PlayerContext, shared with the sidebar) ──
  useEffect(() => {
    if (!signedIn) return;
    refreshPlaylists?.();
    loadFollowedPlaylists?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // ── Explore rails ──
  const [rails, setRails] = useState({ local: null, official: null, popular: null });
  useEffect(() => {
    let cancelled = false;
    const get = (url) => axiosInstance.get(url).then((r) => r.data || []).catch((err) => {
      console.error(`[Library] ${url} failed:`, err?.message);
      return [];
    });
    Promise.all([
      home?.jurisdictionId ? get(`/v1/playlists/community/${home.jurisdictionId}`) : Promise.resolve([]),
      get('/v1/playlists/official'),
      get('/v1/playlists/discover'),
    ]).then(([local, official, popular]) => {
      if (cancelled) return;
      setRails({ local, official, popular });
      console.info('[Library] rails loaded:', { local: local.length, official: official.length, popular: popular.length });
    });
    return () => { cancelled = true; };
  }, [home?.jurisdictionId]);

  // ── Close the sort menu on outside click / Escape ──
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  // ── Your library: own playlists first, then saved ones, never twice ──
  const library = useMemo(() => {
    const seen = new Set();
    const out = [];
    playlists.forEach((pl) => { const id = idOf(pl); if (id && !seen.has(String(id))) { seen.add(String(id)); out.push({ ...pl, id, mine: true }); } });
    followedPlaylists.forEach((pl) => { const id = idOf(pl); if (id && !seen.has(String(id))) { seen.add(String(id)); out.push({ ...pl, id, mine: false }); } });
    return out;
  }, [playlists, followedPlaylists]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = library.filter((pl) => (chip === 'mine' ? pl.mine : chip === 'following' ? !pl.mine : true));
    if (q) list = list.filter((pl) => `${pl.name} ${pl.creatorName || ''}`.toLowerCase().includes(q));
    const by = {
      recents: (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
      az: (a, b) => (a.name || '').localeCompare(b.name || ''),
      creator: (a, b) => (a.mine ? 'You' : a.creatorName || '').localeCompare(b.mine ? 'You' : b.creatorName || '') || (a.name || '').localeCompare(b.name || ''),
      songs: (a, b) => (b.songCount || 0) - (a.songCount || 0),
    }[sort];
    return [...list].sort(by);
  }, [library, chip, sort, query]);

  // Search reaches past your library into public playlists on Unis.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setOnUnis({ status: 'idle', items: [] }); return undefined; }
    setOnUnis((prev) => ({ ...prev, status: 'loading' }));
    const t = setTimeout(() => {
      axiosInstance.get(`/v1/playlists/search?q=${encodeURIComponent(q)}`)
        .then((r) => setOnUnis({ status: 'ready', items: r.data || [] }))
        .catch((err) => {
          console.error('[Library] search failed:', err?.message);
          setOnUnis({ status: 'ready', items: [] });
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const libraryIds = useMemo(() => new Set(library.map((pl) => String(pl.id))), [library]);
  const unisHits = onUnis.items.filter((pl) => !libraryIds.has(String(idOf(pl))));

  const playingId = isPlaying && currentMedia?.origin?.type === 'playlist' ? String(currentMedia.origin.playlistId) : null;
  const open = (pl) => navigate(`/playlist/${idOf(pl)}`);

  const subFor = (pl) => {
    if (pl.type === 'community') return `Community · ${pl.mine ? 'You' : pl.creatorName || 'Unis'}`;
    if (pl.type === 'official') return 'Official · Unis';
    if (pl.mine) return `Playlist · ${songsWord(pl.songCount || 0)}`;
    return `Playlist · ${pl.creatorName || 'Unis'}`;
  };

  const sortLabel = (SORTS.find((o) => o.id === sort) || SORTS[0]).label;
  const mineCount = library.filter((pl) => pl.mine).length;
  const savedCount = library.length - mineCount;

  // ── New playlist ──
  const createOpen = params.get('new') === '1';
  const openCreate = (type = 'personal') => {
    if (!signedIn) { triggerGate('generic'); return; }
    setParams((p) => { const n = new URLSearchParams(p); n.set('new', '1'); if (type === 'community') n.set('type', 'community'); else n.delete('type'); return n; });
  };
  const closeCreate = useCallback(() => {
    setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); n.delete('type'); return n; }, { replace: true });
  }, [setParams]);

  // Guests who land on ?new=1 (an old link) get the sign-in sheet instead.
  useEffect(() => {
    if (createOpen && !signedIn && user !== undefined) {
      closeCreate();
      triggerGate('generic');
    }
  }, [createOpen, signedIn, user, closeCreate, triggerGate]);

  // ── Render helpers ──
  const rail = (label, title, items, endCard = null) => {
    if (!items?.length && !endCard) return null;
    return (
      <section className="lib-rail" aria-label={label}>
        <h2 className="lib-h2">{title}</h2>
        <div className="lib-rail__row">
          {(items || []).map((pl) => (
            <button type="button" key={idOf(pl)} className="lib-card" onClick={() => open(pl)}>
              <Cover pl={pl} />
              <span className="lib-card__name">{pl.name}</span>
              <span className="lib-card__sub">
                {songsWord(pl.songCount || 0)}{pl.followerCount ? ` · ${pl.followerCount.toLocaleString()} saves` : ''}
              </span>
            </button>
          ))}
          {endCard}
        </div>
      </section>
    );
  };

  const libraryBody = () => {
    if (shown.length === 0) {
      if (query.trim()) return <p className="lib-note">Nothing in your library matches &ldquo;{query.trim()}&rdquo;.</p>;
      if (library.length === 0) {
        return (
          <div className="lib-empty">
            <span className="lib-empty__icon"><Music size={26} /></span>
            <p className="lib-empty__title">Start your <em>first</em> playlist</p>
            <p className="lib-empty__sub">Collect the songs you love from your block and beyond. Saved playlists show up here too.</p>
            <button type="button" className="lib-btn" onClick={() => openCreate()}><Plus size={16} /> New playlist</button>
          </div>
        );
      }
      return <p className="lib-note">{chip === 'mine' ? 'You haven’t made a playlist yet.' : 'You haven’t saved anyone else’s playlist yet.'}</p>;
    }
    if (view === 'grid') {
      return (
        <div className="lib-grid">
          {shown.map((pl) => {
            const playing = playingId === String(pl.id);
            return (
              <button type="button" key={pl.id} className={`lib-card lib-card--grid${playing ? ' is-playing' : ''}`} onClick={() => open(pl)} aria-label={`${pl.name}${playing ? ', playing' : ''}`}>
                <Cover pl={pl} />
                <span className="lib-card__name">{playing && <Eq />}<span>{pl.name}</span></span>
                <span className="lib-card__sub">{subFor(pl)}</span>
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <ul className="lib-list">
        {shown.map((pl) => {
          const playing = playingId === String(pl.id);
          return (
            <li key={pl.id}>
              <button type="button" className={`lib-row${playing ? ' is-playing' : ''}`} onClick={() => open(pl)} aria-label={`${pl.name}${playing ? ', playing' : ''}`}>
                <Cover pl={pl} className="lib-cover--row" />
                <span className="lib-row__text">
                  <span className="lib-row__name">{pl.name}</span>
                  <span className="lib-row__sub">
                    {pl.type !== 'community' && pl.type !== 'official' && pl.mine && pl.visibility === 'private' && <Lock size={11} aria-hidden="true" />}
                    {subFor(pl)}
                  </span>
                </span>
                {playing && <Eq />}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Layout>
      <div className="lib">
        <div className="lib-glow" aria-hidden="true" />

        <header className="lib-head">
          <div>
            <h1 className="lib-title">Your <em>library</em></h1>
            <p className="lib-sub">
              {signedIn
                ? library.length
                  ? `${mineCount} playlist${mineCount === 1 ? '' : 's'} · ${savedCount} saved`
                  : 'Nothing saved yet'
                : 'Sign in to build yours'}
            </p>
          </div>
          <div className="lib-head__actions">
            {signedIn && (
              <button
                type="button"
                className="lib-round lib-narrow"
                onClick={() => setSearchOpen((o) => !o)}
                aria-label="Search your library"
                aria-expanded={searchOpen}
              >
                <Search size={18} />
              </button>
            )}
            <button type="button" className="lib-round lib-round--solid lib-narrow" onClick={() => openCreate()} aria-label="New playlist">
              <Plus size={19} />
            </button>
            <button type="button" className="lib-btn lib-wide" onClick={() => openCreate()}>
              <Plus size={16} /> New playlist
            </button>
          </div>
        </header>

        {!signedIn ? (
          <div className="lib-guest">
            <p className="lib-guest__title">Make it <em>yours</em></p>
            <p className="lib-guest__sub">Sign in to make playlists, save other people&rsquo;s, and earn from every listener you bring.</p>
            <button type="button" className="lib-btn" onClick={() => navigate('/login')}>Sign in</button>
          </div>
        ) : (
          <>
            <div className="lib-controls">
              <div className="lib-chips" role="tablist" aria-label="Filter your library">
                {CHIPS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={chip === c.id}
                    className={`lib-chip${chip === c.id ? ' is-on' : ''}`}
                    onClick={() => setPref({ chip: c.id })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <label className={`lib-search${searchOpen ? ' is-open' : ''}`} htmlFor="lib-search">
                <Search size={15} aria-hidden="true" />
                <span className="lib-sr">Search your library</span>
                <input
                  id="lib-search"
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder="Search your library"
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
                />
                {query && (
                  <button type="button" className="lib-search__clear" onClick={() => setQuery('')} aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </label>

              <div className="lib-tools">
                <div className="lib-menu-wrap">
                  <button
                    type="button"
                    className="lib-tool"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                    aria-expanded={menuOpen}
                    aria-label={`Sort: ${sortLabel}`}
                  >
                    <ArrowUpDown size={14} aria-hidden="true" /> {sortLabel} <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {menuOpen && (
                    <div className="lib-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                      {SORTS.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={sort === o.id}
                          className={sort === o.id ? 'is-on' : ''}
                          onClick={() => { setPref({ sort: o.id }); setMenuOpen(false); }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="lib-tool lib-tool--icon"
                  onClick={() => setPref({ view: view === 'list' ? 'grid' : 'list' })}
                  aria-label={view === 'list' ? 'Show as grid' : 'Show as list'}
                  title={view === 'list' ? 'Show as grid' : 'Show as list'}
                >
                  {view === 'list' ? <LayoutGrid size={17} /> : <List size={17} />}
                </button>
              </div>
            </div>

            {/* ★ Pinned: Liked Songs and Recently played */}
            {!query.trim() && (
              <div className="lsx-pins">
                <Link to="/liked" className="lsx-pin">
                  <span className="lsx-pin-art lsx-pin-art--liked" aria-hidden="true"><Heart size={20} fill="currentColor" /></span>
                  <span><strong>Liked Songs</strong><span>Playlist · pinned</span></span>
                </Link>
                <Link to="/recent" className="lsx-pin">
                  <span className="lsx-pin-art lsx-pin-art--recent" aria-hidden="true"><History size={20} /></span>
                  <span><strong>Recently played</strong><span>Library</span></span>
                </Link>
              </div>
            )}

            {libraryBody()}

            {query.trim().length >= 2 && (
              <section className="lib-rail" aria-label="Playlists on Unis">
                <h2 className="lib-h2">On <em>Unis</em></h2>
                {onUnis.status === 'loading' && <p className="lib-note">Searching&hellip;</p>}
                {onUnis.status === 'ready' && unisHits.length === 0 && (
                  <p className="lib-note">No public playlists match &ldquo;{query.trim()}&rdquo;.</p>
                )}
                {unisHits.length > 0 && (
                  <ul className="lib-list">
                    {unisHits.map((pl) => (
                      <li key={idOf(pl)}>
                        <button type="button" className="lib-row" onClick={() => open(pl)}>
                          <Cover pl={pl} className="lib-cover--row" />
                          <span className="lib-row__text">
                            <span className="lib-row__name">{pl.name}</span>
                            <span className="lib-row__sub">{subFor(pl)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

        {/* ── Explore ── */}
        {!query.trim() && (
          <>
            {rail(
              `Around ${homeName}`,
              <>Around <em>{homeName}</em></>,
              rails.local,
              signedIn && home?.jurisdictionId ? (
                <button type="button" className="lib-card lib-card--start" onClick={() => openCreate('community')}>
                  <span className="lib-cover lib-cover--start" aria-hidden="true"><Plus size={30} /></span>
                  <span className="lib-card__name">Start one for the block</span>
                  <span className="lib-card__sub">Neighbors suggest, votes decide</span>
                </button>
              ) : null,
            )}
            {rail('Official picks', 'Official picks', rails.official)}
            {rail('Popular on Unis', <>Popular on <em>Unis</em></>, rails.popular)}
          </>
        )}
      </div>

      {createOpen && signedIn && (
        <NewPlaylistSheet
          home={home}
          initialType={params.get('type') === 'community' ? 'community' : 'personal'}
          onClose={closeCreate}
          onCreated={(pl, name) => {
            refreshPlaylists?.();
            feedback.success(pl?.type === 'community' ? `“${name}” is live for ${homeName}` : `Playlist “${name}” created`);
            const id = idOf(pl);
            if (id) navigate(`/playlist/${id}`, { replace: true });
            else closeCreate();
          }}
          onError={(err) => feedback.error(errorMessage(err, "Couldn't create the playlist. Try again."))}
        />
      )}

      <AuthGateSheet {...gateProps} />
    </Layout>
  );
}

// ── New playlist: a sheet on phones, a centred window on desktop ──
function NewPlaylistSheet({ home, initialType, onClose, onCreated, onError }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(initialType === 'community' && home?.jurisdictionId ? 'community' : 'personal');
  const [visibility, setVisibility] = useState('private');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);
  const fileRef = useRef(null);
  const feedback = useFeedback();

  useModalA11y({ active: true, onClose: () => { if (!saving) onClose(); }, modalRef: sheetRef });
  // The trap focuses the first control (Close); start on the name instead.
  const nameRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => nameRef.current?.focus(), 30); return () => clearTimeout(t); }, []);

  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);

  const pickCover = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { feedback.error('Cover images must be under 5 MB. Pick a smaller one.'); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const create = async () => {
    const clean = name.trim();
    if (!clean || saving) return;
    setSaving(true);
    try {
      let coverImageUrl = null;
      if (coverFile) {
        const form = new FormData();
        form.append('cover', coverFile);
        // No manual Content-Type: axios adds the multipart boundary itself.
        const up = await axiosInstance.post('/v1/playlists/cover', form);
        coverImageUrl = up.data?.coverImageUrl || null;
      }
      const community = type === 'community';
      const res = await axiosInstance.post('/v1/playlists', {
        name: clean,
        type: community ? 'community' : 'personal',
        visibility: community ? 'public' : visibility,
        description: description.trim() || null,
        jurisdictionId: community ? home?.jurisdictionId : null,
        coverImageUrl,
      });
      console.info('[Library] created playlist:', { id: res.data?.playlistId, type: res.data?.type });
      onCreated(res.data, clean);
    } catch (err) {
      console.error('[Library] create failed:', err?.response?.status, err?.message);
      onError(err);
      setSaving(false);
    }
  };

  return (
    <div className="lib-layer">
      <div className="lib-scrim" onClick={() => { if (!saving) onClose(); }} aria-hidden="true" />
      <section ref={sheetRef} className="lib-sheet" role="dialog" aria-modal="true" aria-labelledby="lib-new-title">
        <span className="lib-sheet__grab" aria-hidden="true" />
        <div className="lib-sheet__head">
          <h2 id="lib-new-title" className="lib-sheet__title">New <em>playlist</em></h2>
          <button type="button" className="lib-round" onClick={onClose} disabled={saving} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="lib-sheet__top">
          <button type="button" className="lib-sheet__cover" onClick={() => fileRef.current?.click()} aria-label={coverPreview ? 'Change cover' : 'Add a cover'}>
            {coverPreview ? <img src={coverPreview} alt="" /> : <ImagePlus size={24} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickCover} />
          <label className="lib-field" htmlFor="lib-new-name">
            <span>Name</span>
            <input
              id="lib-new-name"
              ref={nameRef}
              type="text"
              value={name}
              maxLength={100}
              placeholder={type === 'community' ? 'e.g. Harlem After Dark' : 'e.g. Late Night Vibes'}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            />
          </label>
        </div>

        {home?.jurisdictionId && (
          <div className="lib-field">
            <span>Type</span>
            <div className="lib-seg">
              <button type="button" className={type === 'personal' ? 'is-on' : ''} aria-pressed={type === 'personal'} onClick={() => setType('personal')}>Just mine</button>
              <button type="button" className={type === 'community' ? 'is-on' : ''} aria-pressed={type === 'community'} onClick={() => setType('community')}>
                <MapPin size={13} aria-hidden="true" /> For {home.name}
              </button>
            </div>
            {type === 'community' && (
              <p className="lib-hint">Public to everyone. Neighbors suggest songs and the votes decide what stays.</p>
            )}
          </div>
        )}

        {type === 'community' ? (
          <label className="lib-field" htmlFor="lib-new-desc">
            <span>Description (optional)</span>
            <input id="lib-new-desc" type="text" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="What's this playlist for?" />
          </label>
        ) : (
          <div className="lib-field">
            <span>Who can see it</span>
            <div className="lib-seg">
              {[
                ['private', 'Private', <Lock key="i" size={13} aria-hidden="true" />],
                ['unlisted', 'Unlisted', <EyeOff key="i" size={13} aria-hidden="true" />],
                ['public', 'Public', <Globe key="i" size={13} aria-hidden="true" />],
              ].map(([v, label, icon]) => (
                <button key={v} type="button" className={visibility === v ? 'is-on' : ''} aria-pressed={visibility === v} onClick={() => setVisibility(v)}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <p className="lib-hint">
              {visibility === 'private' && 'Only you can open it.'}
              {visibility === 'unlisted' && 'Anyone with the link can open it. It won’t appear in search.'}
              {visibility === 'public' && 'Anyone can open it, and it shows up in search.'}
            </p>
          </div>
        )}

        <button type="button" className="lib-btn lib-btn--wide" onClick={create} disabled={!name.trim() || saving}>
          {saving ? 'Creating…' : 'Create and open'}
        </button>
      </section>
    </div>
  );
}
