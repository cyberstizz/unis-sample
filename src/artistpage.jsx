import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import Layout from './layout';
import UnisLoader from './components/UnisLoader';
import AdSlot from './components/AdSlot';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';
import { useAuth } from './context/AuthContext';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import AuthGateSheet, { useAuthGate, incrementGateSongCount } from './AuthGateSheet';
import { buildUrl } from './utils/buildUrl';
import MessageButton from './MessageButton';
import DownloadModal from './DownloadModal';
import useModalA11y from './hooks/useModalA11y';
import SongMenu, { KebabIcon, anchorFromEvent } from './SongMenu'; // ★ song ⋮ menu
import { VoteIcon, SupportIcon } from './icons/UnisIcons';            // ★ Glow icons
import { visitorChip } from './utils/visitor';
import ArtistDiscography from './ArtistDiscography'; // ★ albums, EPs, mixtapes, singles
import ReleaseAlertBell from './ReleaseAlertBell'; // ★ release alerts

// ─────────────────────────────────────────────────────────────────────────────
// ArtistPage — v4 redesign (Nov 2026, signed-off mockup "Unis artist page
// redesign"): clear hero photo, one action row (Follow · Support · Message ·
// Shuffle · Play), full-width Vote on phones, Music / Photos / About tabs,
// Play & Shuffle use the whole catalog, awards on a shelf instead of over the
// photo, Standing with Week | Day only, ⋮ menu on every song row.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Award definitions ─────────────────────────────────────────
// 12 slots: 2 entities (artist, song) x 6 voting intervals. A medal only
// renders when that award has actually been won at least once.
//
// Interval keys are the LIVE names from the voting_intervals table,
// lowercased: Daily, Weekly, Midterm, Monthly, Quarterly, Annual.
// (An earlier version of this file used day/week/month/quarter/year/alltime —
// those never matched anything, and "alltime" isn't a real interval.)
//
// GET /v1/users/{artistId}/awards returns [{ entity, interval, count }].
// normalizeAwards() also still accepts a plain { "artist-daily": 3 } map.
//
// `rank` drives rail order: most prestigious medal sits at the top.
const AWARD_DEFS = [
  { key: 'artist-annual',    entity: 'artist', interval: 'annual',    rank: 0, label: 'Artist of the Year',      short: 'YR'  },
  { key: 'artist-quarterly', entity: 'artist', interval: 'quarterly', rank: 1, label: 'Artist of the Quarter',   short: 'QTR' },
  { key: 'artist-monthly',   entity: 'artist', interval: 'monthly',   rank: 2, label: 'Artist of the Month',     short: 'MO'  },
  { key: 'artist-midterm',   entity: 'artist', interval: 'midterm',   rank: 3, label: 'Artist of the Midterm',   short: 'MID' },
  { key: 'artist-weekly',    entity: 'artist', interval: 'weekly',    rank: 4, label: 'Artist of the Week',      short: 'WK'  },
  { key: 'artist-daily',     entity: 'artist', interval: 'daily',     rank: 5, label: 'Artist of the Day',       short: 'DAY' },
  { key: 'song-annual',      entity: 'song',   interval: 'annual',    rank: 0, label: 'Song of the Year',        short: 'YR'  },
  { key: 'song-quarterly',   entity: 'song',   interval: 'quarterly', rank: 1, label: 'Song of the Quarter',     short: 'QTR' },
  { key: 'song-monthly',     entity: 'song',   interval: 'monthly',   rank: 2, label: 'Song of the Month',       short: 'MO'  },
  { key: 'song-midterm',     entity: 'song',   interval: 'midterm',   rank: 3, label: 'Song of the Midterm',     short: 'MID' },
  { key: 'song-weekly',      entity: 'song',   interval: 'weekly',    rank: 4, label: 'Song of the Week',        short: 'WK'  },
  { key: 'song-daily',       entity: 'song',   interval: 'daily',     rank: 5, label: 'Song of the Day',         short: 'DAY' },
];

const normalizeAwards = (data) => {
  const map = {};
  if (!data) return map;
  if (Array.isArray(data)) {
    data.forEach((a) => {
      const key =
        a.key ||
        `${(a.entity || a.category || '').toLowerCase()}-${(a.interval || a.period || '').toLowerCase()}`;
      const count = a.count ?? a.wins ?? a.times ?? 0;
      if (key) map[key] = (map[key] || 0) + Number(count || 0);
    });
  } else if (typeof data === 'object') {
    Object.entries(data).forEach(([k, v]) => { map[k.toLowerCase()] = Number(v || 0); });
  }
  return map;
};

// ★ Medal glyphs, interval symbols and the zap are gone: medals now show the
// period as text (DAY/WK/MO/MID/QTR/YR) on the shelf, and Support uses the
// Glow set's SupportIcon like the rest of the app.
const SupportGlyph = ({ size = 15 }) => <SupportIcon size={size} tone="on" />;


// Average-color sampler for the "Popular" ambient row backgrounds.
// Draws the artwork into a 1x1 canvas and reads the resulting pixel.
// Requires CORS-enabled artwork (R2 already configured for this).
const extractAverageColor = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        resolve({ r: d[0], g: d[1], b: d[2] });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });

// ─── Real social brand marks ───────────────────────────────────
// Official glyphs (simple-icons paths), monochrome so they inherit color and
// stay theme-aware. Rendered bare — no boxes, no labels: the logo IS the
// affordance, exactly like every artist site does it.
const SOCIAL_ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.209 0-4-1.79-4-4 0-2.209 1.79-4 4-4 2.209 0 4 1.79 4 4 0 2.209-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
};

const SOCIAL_DEFS = [
  { key: 'instagram', name: 'Instagram', field: 'instagramUrl' },
  { key: 'twitter',   name: 'X',         field: 'twitterUrl'   },
  { key: 'tiktok',    name: 'TikTok',    field: 'tiktokUrl'    },
  { key: 'youtube',   name: 'YouTube',   field: 'youtubeUrl'   },
];

// GET /v1/media/songs/artist/{id} returns raw Song entities, whose play
// column is `playCount` (Long) — there is no `plays` field, which is why the
// track rows and the Fans Pick card always read "0 plays". `plays` is kept as
// a fallback for any endpoint that flattens it, matching the defensive
// pattern in changeDefaultSongWizard.jsx.
const playsOf = (song) => song?.playCount ?? song?.plays ?? 0;

const formatEffective = (iso) => {  if (!iso) return 'the start of next month';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'the start of next month';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
};

// =============================================================================
// SupporterSheet — direct "make this artist my supported artist" confirm.
//
// The jurisdiction-first SupportedArtistPicker (profile page) is for browsing;
// here the fan is ALREADY on the artist's page, so the flow is a single
// confirm. Same endpoint + semantics as the picker:
//   PUT /v1/users/{userId}/supported-artist  { artistId }
//   → { status: 'immediate' | 'pending' | 'cancelled', effectiveDate? }
// First-ever pick lands immediately; changing an existing pick queues to
// month-end; re-picking your current artist cancels any queued change.
// =============================================================================
const SupporterSheet = ({
  show,
  onClose,
  artistName,
  artistPhoto,
  isFirstPick,
  alreadySupporting,
  busy,
  error,
  result,
  onConfirm,
}) => {
  const modalRef = useRef(null);
  useModalA11y({ active: show, onClose, modalRef });

  if (!show) return null;

  const renderBody = () => {
    if (result) {
      const status = result.status;
      if (status === 'immediate') {
        return (
          <div className="ap2-supsheet__state">
            <span className="ap2-supsheet__stateicon ap2-supsheet__stateicon--ok">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <h3 className="ap2-supsheet__statetitle">You&rsquo;re now supporting {artistName}</h3>
            <p className="ap2-supsheet__statesub">Your listening backs them from this moment on.</p>
            <button className="ap2-supsheet__btn ap2-supsheet__btn--primary" onClick={onClose}>Done</button>
          </div>
        );
      }
      if (status === 'pending') {
        return (
          <div className="ap2-supsheet__state">
            <span className="ap2-supsheet__stateicon ap2-supsheet__stateicon--clock">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
            </span>
            <h3 className="ap2-supsheet__statetitle">Locked in</h3>
            <p className="ap2-supsheet__statesub">
              You&rsquo;ll switch to {artistName} on {formatEffective(result.effectiveDate)}. Until then your current pick keeps your backing.
            </p>
            <button className="ap2-supsheet__btn ap2-supsheet__btn--primary" onClick={onClose}>Done</button>
          </div>
        );
      }
      if (status === 'cancelled') {
        return (
          <div className="ap2-supsheet__state">
            <span className="ap2-supsheet__stateicon ap2-supsheet__stateicon--ok">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <h3 className="ap2-supsheet__statetitle">Queued switch cancelled</h3>
            <p className="ap2-supsheet__statesub">You&rsquo;re staying with {artistName}.</p>
            <button className="ap2-supsheet__btn ap2-supsheet__btn--primary" onClick={onClose}>Done</button>
          </div>
        );
      }
    }

    if (alreadySupporting) {
      return (
        <div className="ap2-supsheet__state">
          <span className="ap2-supsheet__stateicon ap2-supsheet__stateicon--ok"><SupportGlyph size={24} /></span>
          <h3 className="ap2-supsheet__statetitle">{artistName} is your supported artist</h3>
          <p className="ap2-supsheet__statesub">Every stream you play on Unis puts weight behind them.</p>
          <button className="ap2-supsheet__btn ap2-supsheet__btn--primary" onClick={onClose}>Done</button>
        </div>
      );
    }

    return (
      <>
        <img src={artistPhoto} alt="" className="ap2-supsheet__photo" />
        <h3 className="ap2-supsheet__title">Make {artistName} your supported artist?</h3>
        <p className="ap2-supsheet__copy">
          {isFirstPick
            ? 'Your first pick takes effect right away — your listening on Unis backs them directly.'
            : `You already support another artist. Switches take effect at the start of next month, so ${artistName} becomes your pick on the 1st.`}
        </p>
        {error && <p className="ap2-supsheet__error" role="alert">{error}</p>}
        <div className="ap2-supsheet__actions">
          <button className="ap2-supsheet__btn ap2-supsheet__btn--primary" onClick={onConfirm} disabled={busy}>
            <SupportGlyph size={14} />
            {busy ? 'Saving…' : (isFirstPick ? 'Support them' : 'Switch to them')}
          </button>
          <button className="ap2-supsheet__btn ap2-supsheet__btn--ghost" onClick={onClose} disabled={busy}>
            Not now
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="ap2-supsheet" role="presentation" onClick={onClose}>
      <div
        className="ap2-supsheet__card"
        role="dialog"
        aria-modal="true"
        aria-label={`Support ${artistName}`}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ap2-supsheet__close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        {renderBody()}
      </div>
    </div>
  );
};

// =============================================================================
// PhotoLightbox — Instagram-style full-screen viewer for the gallery grid.
// Arrow keys + on-screen chevrons + touch swipe; Esc / backdrop / × to close
// (Esc + focus trap come from useModalA11y).
// Exported so the song page opens the artist's photos in the same viewer.
// =============================================================================
export const PhotoLightbox = ({ photos, index, artistName, onClose, onPrev, onNext }) => {
  const modalRef = useRef(null);
  const touchStartX = useRef(null);
  const active = index != null;
  useModalA11y({ active, onClose, modalRef });

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [active, onPrev, onNext]);

  if (!active) return null;

  const photo = photos[index];
  if (!photo) return null;
  const multiple = photos.length > 1;

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta > 0) onPrev(); else onNext();
  };

  return (
    <div
      className="ap2-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${artistName} photos, ${index + 1} of ${photos.length}`}
      ref={modalRef}
      onClick={onClose}
    >
      <button className="ap2-lightbox__close" onClick={onClose} aria-label="Close photo viewer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>

      {multiple && (
        <button
          className="ap2-lightbox__nav ap2-lightbox__nav--prev"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Previous photo"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}

      <figure
        className="ap2-lightbox__stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img src={buildUrl(photo.photoUrl)} alt={`${artistName} photo ${index + 1}`} className="ap2-lightbox__img" />
        <figcaption className="ap2-lightbox__counter">{index + 1} / {photos.length}</figcaption>
      </figure>

      {multiple && (
        <button
          className="ap2-lightbox__nav ap2-lightbox__nav--next"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Next photo"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}
    </div>
  );
};

// =============================================================================
// ShopSheet — the Shop button's home. Lists this artist's downloadable songs
// (policy 'free' or 'paid'); tapping one hands off to the shared DownloadModal
// (same component + song shape the player uses). Empty state when the artist
// has nothing for sale yet.
// =============================================================================
const formatSongPrice = (song) => {
  if (song.downloadPolicy === 'paid' && song.downloadPrice) {
    return `$${(Number(song.downloadPrice) / 100).toFixed(2)}`;
  }
  return 'Free';
};

const ShopSheet = ({ show, onClose, artistName, songs, onPick }) => {
  const modalRef = useRef(null);
  useModalA11y({ active: show, onClose, modalRef });

  if (!show) return null;

  const sellable = songs.filter((s) => s.downloadPolicy !== 'unavailable');

  return (
    <div className="ap2-supsheet" role="presentation" onClick={onClose}>
      <div
        className="ap2-supsheet__card ap2-shopsheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${artistName} shop`}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ap2-supsheet__close" onClick={onClose} aria-label="Close shop">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <h3 className="ap2-supsheet__title">{artistName}&rsquo;s Shop</h3>

        {sellable.length === 0 ? (
          <div className="ap2-shopsheet__empty">
            <span className="ap2-supsheet__stateicon ap2-supsheet__stateicon--ok">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2L3 6v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
            <p className="ap2-supsheet__statesub">
              Nothing for sale yet — {artistName} hasn&rsquo;t put any songs up for download. Check back soon.
            </p>
            <button className="ap2-supsheet__btn ap2-supsheet__btn--primary" onClick={onClose}>Got it</button>
          </div>
        ) : (
          <div className="ap2-shopsheet__list">
            {sellable.map((song) => (
              <button
                key={song.songId}
                type="button"
                className="ap2-shopsheet__row"
                onClick={() => onPick(song)}
              >
                <img src={buildUrl(song.artworkUrl) || undefined} alt="" className="ap2-shopsheet__art" />
                <span className="ap2-shopsheet__info">
                  <span className="ap2-shopsheet__songtitle">{song.title}</span>
                  <span className="ap2-shopsheet__meta">{playsOf(song).toLocaleString()} plays</span>
                </span>
                <span className={`ap2-shopsheet__price ${song.downloadPolicy === 'paid' ? 'ap2-shopsheet__price--paid' : ''}`}>
                  {formatSongPrice(song)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// ArtistStanding — ★ one card for the artist's rank (replaces the separate
// "This week in …" strip and the four-period Territory rank).
//
// Week | Day only, always opening on Week (signed off Nov 2026 — the extra
// Month/Year options were analysis paralysis).
//
// Reads the PUBLIC endpoint GET /v1/users/{artistId}/territory-rank:
//   { status?, genreName, periods: { today|week|…: [ { jurisdictionId,
//     jurisdictionName, overallRank, genreRank } ] } }
// If ranks haven't been computed but /standing has a rank, it shows that
// instead of vanishing.
// =============================================================================
const STANDING_PERIODS = [
  { id: 'week', label: 'Week' },
  { id: 'today', label: 'Day' },
];

const ArtistStanding = ({ artistName, standing, territory, className = '' }) => {
  // The page reads /territory-rank once (the scroll bar uses it too).
  const { state, data } = territory || { state: 'loading', data: null };
  const [period, setPeriod] = useState('week');

  if (state === 'loading') return null;

  const fallbackRank = standing && standing.rank != null ? standing : null;

  // No territory ranks — show /standing's weekly rank if there is one.
  if (state === 'hidden' || !data) {
    if (!fallbackRank) return null;
    return (
      <section className={`ap3-card ap3-standing ${className}`} aria-label={`${artistName} standing`}>
        <div className="ap3-standing__head">
          <h3 className="ap3-h3 ap3-h3--sm">Standing</h3>
        </div>
        <p className="ap3-standing__headline">
          <span className="ap3-standing__num">#{fallbackRank.rank}</span>
          <span className="ap3-standing__in">in {fallbackRank.jurisdictionName || 'their area'}</span>
        </p>
        <p className="ap3-standing__move">
          This week{fallbackRank.genreName ? ` · ${fallbackRank.genreName}` : ''}
          {fallbackRank.total ? ` · of ${fallbackRank.total}` : ''}
          {fallbackRank.deltaSpots > 0 ? ` · up ${fallbackRank.deltaSpots} spot${fallbackRank.deltaSpots > 1 ? 's' : ''}` : ''}
        </p>
      </section>
    );
  }

  if (data.status === 'calculating') {
    return (
      <section className={`ap3-card ap3-standing ${className}`} aria-label={`${artistName} standing`}>
        <h3 className="ap3-h3 ap3-h3--sm">Standing</h3>
        <p className="ap3-standing__move">
          Ranks are worked out every night. {artistName}&rsquo;s standing shows up after tonight&rsquo;s update.
        </p>
      </section>
    );
  }

  const rows = (data.periods && data.periods[period]) || [];
  const home = rows[0] || null;
  const genreName = data.genreName || null;

  // "up N spots" comes from /standing, which is a weekly number.
  const moveBits = [];
  if (genreName) moveBits.push(genreName);
  if (period === 'week' && fallbackRank?.deltaSpots > 0) {
    moveBits.push(`up ${fallbackRank.deltaSpots} spot${fallbackRank.deltaSpots > 1 ? 's' : ''} this week`);
  } else {
    moveBits.push(period === 'week' ? 'this week' : 'today');
  }

  return (
    <section className={`ap3-card ap3-standing ${className}`} aria-label={`${artistName} standing`}>
      <div className="ap3-standing__head">
        <h3 className="ap3-h3 ap3-h3--sm">Standing</h3>
        <div className="ap3-seg" role="tablist" aria-label="Rank period">
          {STANDING_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === period}
              className={p.id === period ? 'is-on' : ''}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="ap3-standing__move">No ranking yet for {period === 'week' ? 'this week' : 'today'}.</p>
      ) : (
        <>
          {home && home.overallRank != null && (
            <p className="ap3-standing__headline">
              <span className="ap3-standing__num">#{home.overallRank}</span>
              <span className="ap3-standing__in">in {home.jurisdictionName}</span>
            </p>
          )}
          <p className="ap3-standing__move">{moveBits.join(' · ')}</p>
          <ol className="ap3-standing__list">
            {rows.map((j, i) => (
              <li
                key={j.jurisdictionId || `${j.jurisdictionName}-${i}`}
                className={`ap3-standing__row ${i === 0 ? 'is-home' : ''}`}
              >
                <span className="ap3-standing__place">
                  <span className="ap3-standing__placename">{j.jurisdictionName}</span>
                  {j.genreRank != null && genreName && (
                    <span className="ap3-standing__genre">#{j.genreRank} in {genreName}</span>
                  )}
                </span>
                <span className="ap3-standing__rank">{j.overallRank != null ? `#${j.overallRank}` : '—'}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};

// ─── Small inline glyphs the Glow set doesn't have yet (same 1.8 stroke) ───
const GlowDefs = () => (
  <svg width="0" height="0" className="ap3-defs" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="ap3-glow" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--unis-primary, #163387), white 62%)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--unis-primary, #163387), white 18%)' }} />
      </linearGradient>
    </defs>
  </svg>
);

const G = ({ size = 20, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const PlayFill = ({ size = 22, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" focusable="false">
    <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" />
  </svg>
);
const PauseFill = ({ size = 18, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" focusable="false">
    <rect x="6.5" y="5" width="3.8" height="14" rx="1.2" />
    <rect x="13.7" y="5" width="3.8" height="14" rx="1.2" />
  </svg>
);
const ShuffleGlyph = ({ size = 24 }) => (
  <G size={size}>
    <path d="M3 7h3.5c4.5 0 6.5 10 11 10H20" />
    <path d="M3 17h3.5c1.6 0 2.8-1.3 3.8-3M13.7 10c1-1.7 2.2-3 3.8-3H20" />
    <path d="M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" stroke="url(#ap3-glow)" />
  </G>
);
const FollowGlyph = ({ size = 16, on = false }) => (
  <G size={size}>
    <circle cx="9.5" cy="8" r="3.6" />
    <path d="M3.5 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" />
    {on
      ? <path d="M15.5 11l2 2 3.5-4" stroke="url(#ap3-glow)" />
      : <path d="M18.5 8v6M15.5 11h6" stroke="url(#ap3-glow)" />}
  </G>
);
const ShareGlyph = ({ size = 19 }) => (
  <G size={size}>
    <path d="M12 15V4" />
    <path d="M8 8l4-4 4 4" stroke="url(#ap3-glow)" />
    <path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" />
  </G>
);
const BackGlyph = ({ size = 20 }) => (<G size={size}><path d="M15 5l-7 7 7 7" /></G>);
const ChevronGlyph = ({ size = 18 }) => (<G size={size}><path d="M9 6l6 6-6 6" /></G>);
const PinGlyph = ({ size = 13 }) => (
  <G size={size}>
    <path d="M12 21.3C9.6 19.5 4.6 15.1 4.6 9.9a7.4 7.4 0 0 1 14.8 0c0 5.2-5 9.6-7.4 11.4z" />
    <circle cx="12" cy="9.9" r="2.6" fill="url(#ap3-glow)" stroke="none" />
  </G>
);
const UpGlyph = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
const ShopGlyph = ({ size = 17 }) => (
  <G size={size}>
    <path d="M6 3.5L3.8 6.6v12.2a1.7 1.7 0 0 0 1.7 1.7h13a1.7 1.7 0 0 0 1.7-1.7V6.6L18 3.5z" />
    <path d="M3.8 6.6h16.4" />
    <path d="M15.6 10a3.6 3.6 0 0 1-7.2 0" stroke="url(#ap3-glow)" />
  </G>
);

const TABS = [
  { id: 'music', label: 'Music' },
  { id: 'photos', label: 'Photos' },
  { id: 'about', label: 'About' },
];

const POPULAR_COUNT = 5;

const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const { requestPlayCollection, currentMedia, isPlaying, togglePlayPause } = useContext(PlayerContext);
  const { user, isGuest, refreshUser } = useAuth();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { triggerGate, gateProps } = useAuthGate();

  const userId = user?.userId;

  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [bio, setBio] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [awards, setAwards] = useState({});       // normalized award counts
  const [standing, setStanding] = useState(null);  // weekly jurisdiction ranking
  const [songColors, setSongColors] = useState({}); // songId -> ambient gradient
  const [featuredAmbient, setFeaturedAmbient] = useState(null); // Fans Pick tint
  const [photos, setPhotos] = useState([]);        // artist gallery photos
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showShopSheet, setShowShopSheet] = useState(false);
  const [shopSong, setShopSong] = useState(null); // song handed to DownloadModal
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [tab, setTab] = useState('music');          // ★ music | photos | about
  const [songMenu, setSongMenu] = useState(null);   // ★ { song, anchor, key }

  // ---- Supporter (switch-supported-artist) state ------------------------
  const [isSupporting, setIsSupporting] = useState(false);
  const [showSupporterSheet, setShowSupporterSheet] = useState(false);
  const [supporterBusy, setSupporterBusy] = useState(false);
  const [supporterError, setSupporterError] = useState(null);
  const [supporterResult, setSupporterResult] = useState(null);
  const [pendingSwitch, setPendingSwitch] = useState(null); // { effectiveDate }

  // AuthContext's user (UserDto) carries supportedArtistId, so the live
  // "Supporting" state costs zero extra API calls.
  useEffect(() => {
    setIsSupporting(Boolean(userId && user?.supportedArtistId === artistId));
  }, [userId, user?.supportedArtistId, artistId]);

  // New artist → back to the Music tab, list collapsed.
  useEffect(() => {
    setTab('music');
    setShowAllSongs(false);
  }, [artistId]);

  // ★ The bar that follows you (Nov 2026). As the big name slides under the
  // app header it fades out and the bar's name rises in with the scroll; the
  // round Play only docks in the bar once the page's own Play has gone under
  // it, so there are never two on screen (Spotify's overlap complaint).
  //
  // The page scrolls the window on some layouts and .layout-content on
  // others, so both are watched. (The old bar listened to only one of them,
  // which is why it stopped showing after the v4 redesign.)
  const heroRef = useRef(null);
  const tabsRef = useRef(null);
  const nameRef = useRef(null);
  const playRef = useRef(null);
  const barRef = useRef(null);
  const [barShown, setBarShown] = useState(false);
  const [barDocked, setBarDocked] = useState(false);

  const APP_HEADER = 75; // keep in sync with $ap2-header-h
  const HAND_OFF = 70;   // px of scroll the name hand-off takes

  const measureBar = useCallback(() => {
    const name = nameRef.current;
    const bar = barRef.current;
    if (!name || !bar) return;
    const barH = bar.offsetHeight || 56;
    // 0 while the name sits clear of the header, 1 once it has gone under.
    const top = name.getBoundingClientRect().top;
    const hand = Math.max(0, Math.min(1, (APP_HEADER + 40 - top) / HAND_OFF));
    bar.style.setProperty('--ap3-hand', hand.toFixed(3));
    name.style.opacity = String(1 - hand);
    setBarShown(hand > 0.5);

    const play = playRef.current;
    const playBottom = play ? play.getBoundingClientRect().bottom : -1;
    setBarDocked(playBottom < APP_HEADER + barH);
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measureBar(); });
    };
    const content = heroRef.current?.closest('.layout-content');
    const targets = [window, content].filter(Boolean);
    targets.forEach((t) => t.addEventListener('scroll', onScroll, { passive: true }));
    window.addEventListener('resize', onScroll);
    measureBar();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      targets.forEach((t) => t.removeEventListener('scroll', onScroll));
      window.removeEventListener('resize', onScroll);
    };
  }, [loading, measureBar]);

  const scrollToTop = () => {
    const content = heroRef.current?.closest('.layout-content');
    if (content && content.scrollTop > 0) content.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ★ Territory rank, read once: the Standing card and the bar's rank line.
  const [territory, setTerritory] = useState({ state: 'loading', data: null });

  useEffect(() => {
    if (!artistId) return undefined;
    let cancelled = false;
    setTerritory({ state: 'loading', data: null });

    apiCall({ method: 'get', url: `/v1/users/${artistId}/territory-rank` })
      .then((res) => {
        if (cancelled) return;
        const payload = res.data || null;
        const hasRows = payload?.periods
          && STANDING_PERIODS.some(({ id }) => Array.isArray(payload.periods[id]) && payload.periods[id].length);
        if (!payload || (!hasRows && payload.status !== 'calculating')) {
          setTerritory({ state: 'hidden', data: null });
          return;
        }
        setTerritory({ state: 'ready', data: payload });
        console.log('[Standing] loaded:', { artistId, status: payload.status });
      })
      .catch((err) => {
        if (cancelled) return;
        // Never break the page over a ranking read — fall back or hide.
        console.error('[Standing] load failed:', { artistId, err });
        setTerritory({ state: 'hidden', data: null });
      });

    return () => { cancelled = true; };
  }, [artistId]);

  useEffect(() => {
    if (!artistId) return;

    const fetchAll = async () => {
      setLoading(true);
      setError('');

      try {
        const isViewingOther = userId && userId !== artistId;

        const [
          artistRes,
          followerCountRes,
          songsRes,
          followStatusRes,
          awardsRes,
          standingRes,
          photosRes,
        ] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/users/profile/${artistId}` }),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/followers/count` }).catch(() => ({ data: { count: 0 } })),
          apiCall({ method: 'get', url: `/v1/media/songs/artist/${artistId}` }).catch(() => ({ data: [] })),
          isViewingOther
            ? apiCall({ method: 'get', url: `/v1/users/${artistId}/is-following` }).catch(() => ({ data: { isFollowing: false } }))
            : Promise.resolve({ data: { isFollowing: false } }),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/awards` }).catch(() => ({ data: [] })),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/standing` }).catch(() => ({ data: null })),
          // Public gallery endpoint returns { photos: [...], max } — see ArtistPhotoController.
          apiCall({ method: 'get', url: `/v1/users/${artistId}/photos` }).catch((err) => {
            console.error('Artist photos load failed:', artistId, err);
            return { data: { photos: [] } };
          }),
        ]);

        const artistData = artistRes.data;
        setArtist(artistData);
        setBio(artistData.bio || ''); // ★ empty stays empty (was 'No bio available')
        setFollowerCount(followerCountRes.data.count || 0);
        setSongs(Array.isArray(songsRes.data) ? songsRes.data : []);
        setIsFollowing(followStatusRes.data.isFollowing || false);
        setAwards(normalizeAwards(awardsRes.data));
        setStanding(standingRes.data || null);
        setPhotos(Array.isArray(photosRes.data?.photos) ? photosRes.data.photos : []);
      } catch (err) {
        console.error('Failed to load artist:', err);
        setError('Failed to load artist details');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [artistId, userId]);

  // ★ Popular = most played first. This order also drives Play all.
  const popularSongs = useMemo(
    () => [...songs].sort((a, b) => playsOf(b) - playsOf(a)),
    [songs]
  );

  // Ambient colours for the rows that can be on screen.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const top = popularSongs.slice(0, 12);
      const entries = await Promise.all(
        top.map(async (song) => {
          const url = buildUrl(song.artworkUrl);
          if (!url) return null;
          try {
            const rgb = await extractAverageColor(url);
            return [song.songId, rgb];
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const map = {};
      entries.forEach((e) => {
        if (e) {
          const { r, g, b } = e[1];
          map[e[0]] = `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0.30) 0%, rgba(${r}, ${g}, ${b}, 0.08) 60%, rgba(255, 255, 255, 0.02) 100%)`;
        }
      });
      setSongColors(map);
    };
    if (popularSongs.length) run();
    return () => { cancelled = true; };
  }, [popularSongs]);

  // Ambient wash for the Fans Pick card, sampled from that song's artwork.
  useEffect(() => {
    let cancelled = false;
    if (!songs.length) { setFeaturedAmbient(null); return undefined; }

    const top = songs.reduce(
      (prev, cur) => ((cur.score || 0) > (prev.score || 0) ? cur : prev),
      songs[0]
    );
    const url = buildUrl(top?.artworkUrl);
    if (!url) { setFeaturedAmbient(null); return undefined; }

    extractAverageColor(url)
      .then(({ r, g, b }) => {
        if (cancelled) return;
        setFeaturedAmbient({
          backgroundImage:
            `linear-gradient(110deg, rgba(${r}, ${g}, ${b}, 0.30) 0%, rgba(${r}, ${g}, ${b}, 0.08) 55%, rgba(255, 255, 255, 0.03) 100%)`,
          borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
        });
      })
      .catch(() => { if (!cancelled) setFeaturedAmbient(null); });

    return () => { cancelled = true; };
  }, [songs]);

  const handleFollow = async () => {
    if (isGuest) {
      feedback.info('Log in to follow artists', { action: { label: 'Log in', onClick: () => navigate('/login') } });
      return;
    }
    const previousState = isFollowing;
    const previousCount = followerCount;
    const who = artist?.username || 'this artist';
    setIsFollowing(!previousState);
    setFollowerCount(prev => (!previousState ? prev + 1 : prev - 1));
    try {
      if (!previousState) {
        await apiCall({ method: 'post', url: `/v1/users/${artistId}/follow` });
      } else {
        await apiCall({ method: 'delete', url: `/v1/users/${artistId}/follow` });
      }
      feedback.success(previousState ? `Unfollowed ${who}` : `Following ${who}`, { id: 'artist-follow' });
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setIsFollowing(previousState);
      setFollowerCount(previousCount);
      feedback.error(errorMessage(err, previousState ? `Couldn't unfollow ${who}. Try again.` : `Couldn't follow ${who}. Try again.`));
    }
  };

  // ---- Supporter switch (the real Support mechanism) --------------------
  const openSupporterSheet = () => {
    if (isGuest) { navigate('/login'); return; }
    setSupporterResult(null);
    setSupporterError(null);
    setShowSupporterSheet(true);
  };

  const confirmSupporter = async () => {
    if (!userId) return;
    setSupporterBusy(true);
    setSupporterError(null);
    try {
      const res = await apiCall({
        method: 'put',
        url: `/v1/users/${userId}/supported-artist`,
        data: { artistId },
      });
      const data = res.data || {};
      console.log('[Support] supported-artist update ok:', { artistId, status: data.status });
      setSupporterResult(data);
      const who = artist?.username || 'this artist';
      if (data.status === 'immediate' || data.status === 'cancelled') {
        setIsSupporting(true);
        setPendingSwitch(null);
        feedback.success(data.status === 'cancelled' ? `Pending switch cancelled — you're still supporting ${who}` : `You now support ${who}`);
      }
      if (data.status === 'pending') {
        setPendingSwitch({ effectiveDate: data.effectiveDate || null });
        const when = data.effectiveDate ? new Date(data.effectiveDate).toLocaleDateString() : 'soon';
        feedback.success(`Switch saved — you'll support ${who} starting ${when}`);
      }
      refreshUser?.(); // sync user.supportedArtistId app-wide
    } catch (err) {
      console.error('[Support] supported-artist update failed:', { artistId, err });
      const text = err.response?.data?.error || 'Could not update your supported artist. Please try again.';
      setSupporterError(text);
      feedback.error(text);
    } finally {
      setSupporterBusy(false);
    }
  };

  const handleShop = () => {
    if (isGuest) { navigate('/login'); return; }
    console.log('[Shop] open:', { artistId, sellableCount: songs.filter((s) => s.downloadPolicy !== 'unavailable').length });
    setShowShopSheet(true);
  };

  const handleShopPick = (song) => {
    console.log('[Shop] song picked:', { songId: song.songId, policy: song.downloadPolicy, price: song.downloadPrice });
    setShowShopSheet(false);
    setShopSong(song);
  };

  // ---- Gallery lightbox --------------------------------------------------
  const showPrevPhoto = useCallback(() => {
    setLightboxIndex((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);

  const showNextPhoto = useCallback(() => {
    setLightboxIndex((i) => (i == null ? i : (i + 1) % photos.length));
  }, [photos.length]);

  const handleBioChange = (e) => setBio(e.target.value);

  const handleSaveBio = async () => {
    try {
      await apiCall({ method: 'put', url: `/v1/users/profile/${artistId}/bio`, data: { bio } });
      feedback.success('Bio saved');
    } catch (err) {
      console.error('Failed to update bio:', err);
      feedback.error(errorMessage(err, "Couldn't save your bio. Try again."));
    }
  };

  const handleVoteSuccess = () => setShowVotingWizard(false);

  const handleVote = () => {
    setSelectedNominee({
      id: artistId,
      name: artist.username,
      type: 'artist',
      jurisdiction: artist.jurisdiction,
      jurisdictionId: artist.jurisdiction?.jurisdictionId || null,
      genreId: artist.genre?.genreId || null,
      photoUrl: artist.photoUrl || null,
    });
    setShowVotingWizard(true);
  };

  // ---- Playback ------------------------------------------------------------
  // No /play POST here: the Player counts the play (15s / 25% gate).
  const toTrack = useCallback((song) => {
    const fallbackArt = artist?.photoUrl ? buildUrl(artist.photoUrl) : theQuiet;
    const art = buildUrl(song.artworkUrl) || fallbackArt;
    return {
      type: 'song',
      id: song.songId,
      songId: song.songId,
      url: buildUrl(song.fileUrl),
      fileUrl: buildUrl(song.fileUrl),
      title: song.title,
      artist: artist?.username,
      artistId: artist?.userId,
      artwork: art,
      artworkUrl: art,
    };
  }, [artist]);

  const catalog = useMemo(
    () => popularSongs.filter((s) => s.fileUrl).map(toTrack),
    [popularSongs, toTrack]
  );

  // ★ Play / Shuffle / tap a row → the whole catalog, most played first.
  // Same "Play now / Add to queue" prompt as playlists, so the queue is
  // never wiped.
  const playCatalog = ({ startIndex = 0, shuffle = false } = {}) => {
    if (!catalog.length) {
      feedback.info(`${artist?.username || 'This artist'} hasn’t uploaded any songs yet`);
      return;
    }
    if (isGuest) incrementGateSongCount();
    requestPlayCollection({ tracks: catalog, startIndex, shuffle, title: artist?.username });
  };

  const playFromSong = (song) => {
    const index = catalog.findIndex((t) => t.songId === song.songId);
    if (index < 0) return;
    playCatalog({ startIndex: index });
  };

  // ---- Song ⋮ menu -----------------------------------------------------------
  const openSongMenu = useCallback((song, anchor) => {
    setSongMenu((current) => (
      current && current.song.id === song.id && anchor && anchor.left !== anchor.right
        && current.anchor?.trigger === anchor.trigger
        ? null
        : { song, anchor, key: Date.now() }
    ));
  }, []);
  const closeSongMenu = useCallback(() => setSongMenu(null), []);
  const playFromMenu = useCallback((track) => {
    if (isGuest) incrementGateSongCount();
    requestPlayCollection({ tracks: [track], title: track.title });
  }, [isGuest, requestPlayCollection]);
  const requireAccount = useCallback(() => triggerGate('generic'), [triggerGate]);

  // ---- Share the artist ------------------------------------------------------
  const handleShareArtist = async () => {
    const url = `${window.location.origin}/artist/${artistId}`;
    const name = artist?.username || 'this artist';
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `${name} on Unis`, url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.warn('[Artist] share sheet failed, copying instead:', err?.message);
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      feedback.success('Link copied');
    } catch (err) {
      console.warn('[Artist] clipboard blocked:', err?.message);
      feedback.info(`Copy this link: ${url}`);
    }
  };

  const goToTab = (id) => {
    setTab(id);
    // Bring the tab bar into view so the new content starts on screen.
    const el = tabsRef.current;
    if (el && el.getBoundingClientRect().top < 80) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openAbout = () => {
    setTab('about');
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return (
    <Layout backgroundImage={theQuiet}>
      <UnisLoader label="Loading artist..." />
    </Layout>
  );

  if (error || !artist) return (
    <Layout backgroundImage={theQuiet}>
      <div className="ap2-error">Artist not found</div>
    </Layout>
  );

  const artistPhoto = artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet;
  const aboutPhoto = photos.length ? buildUrl(photos[0].photoUrl) : artistPhoto;
  const topSong = songs.length > 0
    ? songs.reduce((prev, current) => (current.score || 0) > (prev.score || 0) ? current : prev, songs[0])
    : null;
  const topSongArtwork = topSong ? (buildUrl(topSong.artworkUrl) || artistPhoto) : artistPhoto;

  const isCurrentUser = userId === artistId;
  const showActionButtons = !isOwnProfile && !isCurrentUser;
  const isFirstPick = !user?.supportedArtistId;

  const fmt = (n) => (n || 0).toLocaleString();

  // Awards: artist medals first, then song medals, most prestigious first.
  const earnedAwards = AWARD_DEFS
    .map((def) => ({ ...def, count: awards[def.key] || 0 }))
    .filter((a) => a.count > 0)
    .sort((a, b) => (a.entity === b.entity ? a.rank - b.rank : (a.entity === 'artist' ? -1 : 1)));
  const totalWins = earnedAwards.reduce((sum, a) => sum + a.count, 0);

  const socialLinks = SOCIAL_DEFS
    .map((d) => ({ ...d, url: artist[d.field] }))
    .filter((d) => Boolean(d.url));

  const videoUrl = artist.featuredVideoUrl || artist.videoUrl || null;

  const standingPlace = standing?.genreName || artist.genre?.name || '';
  const standingArea = standing?.jurisdictionName || artist.jurisdiction?.name || 'your area';
  const hasRank = Boolean(standing && standing.rank != null);

  // Bar line: what's playing (if it's theirs), else this week's home rank.
  const playingThem = Boolean(currentMedia)
    && (currentMedia.artistId === artistId || currentMedia.artistData?.userId === artistId);
  const weekHome = territory.state === 'ready' ? territory.data?.periods?.week?.[0] : null;
  const barRank = weekHome && weekHome.overallRank != null
    ? `#${weekHome.overallRank} in ${weekHome.jurisdictionName} this week`
    : hasRank
      ? `#${standing.rank} in ${standing.jurisdictionName || standingArea} this week`
      : (artist.jurisdiction?.name || '');
  const onDockPlay = () => (playingThem ? togglePlayPause() : playCatalog());

  const supportSub = isSupporting
    ? `Your listening backs ${artist.username} every month.`
    : pendingSwitch
      ? `You'll switch to ${artist.username} on ${formatEffective(pendingSwitch.effectiveDate)}.`
      : `Make ${artist.username} your supported artist and your listening backs them.`;

  const visibleSongs = showAllSongs ? popularSongs : popularSongs.slice(0, POPULAR_COUNT);
  const bioText = (bio || '').trim();
  const bioParagraphs = bioText ? bioText.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean) : [];

  // Shape the ⋮ menu (SongMenu) expects — same as feed items.
  const menuSong = (song) => {
    const t = toTrack(song);
    return { ...t, id: song.songId, type: 'song', artistData: { userId: artist.userId, username: artist.username } };
  };

  const stats = (
    <p className="ap3-statline">
      <b>{fmt(artist.totalPlays)}</b> plays · <b>{fmt(followerCount)}</b> {followerCount === 1 ? 'follower' : 'followers'} · <b>{fmt(artist.score)}</b> score
    </p>
  );

  return (
    <Layout backgroundImage={artistPhoto}>
      <GlowDefs />

      {/* ===== THE BAR THAT FOLLOWS YOU — their photo, blurred and tinted, under the app header ===== */}
      <div
        ref={barRef}
        className={`ap3-bar${barShown ? ' is-shown' : ''}${barDocked ? ' is-docked' : ''}`}
        aria-hidden={!barShown}
        inert={!barShown}
      >
        <img src={artistPhoto} alt="" className="ap3-bar__photo" />
        <div className="ap3-bar__tint" />
        <div className="ap3-bar__inner">
          <button type="button" className="ap3-bar__who" onClick={scrollToTop} aria-label={`Back to the top of ${artist.username}`}>
            <img src={artistPhoto} alt="" className="ap3-bar__avatar" />
            <span className="ap3-bar__text">
              <span className="ap3-bar__name">{artist.username}</span>
              {playingThem && isPlaying ? (
                <span className="ap3-bar__line">
                  <span className="ap3-bar__eq" aria-hidden="true"><i /><i /><i /></span>
                  Playing · {currentMedia.title}
                </span>
              ) : barRank ? (
                <span className="ap3-bar__line">{barRank}</span>
              ) : null}
            </span>
          </button>

          {showActionButtons && (
            <button type="button" className="ap3-bar__vote" onClick={handleVote}>
              <VoteIcon size={16} />
              Vote
            </button>
          )}
          {showActionButtons && !isFollowing && (
            <button type="button" className="ap3-bar__follow ap3-hide-phone" onClick={handleFollow}>
              Follow
            </button>
          )}
          <button
            type="button"
            className="ap3-bar__shuffle ap3-hide-phone"
            onClick={() => playCatalog({ shuffle: true })}
            disabled={!catalog.length}
            aria-label={`Shuffle all of ${artist.username}'s songs`}
          >
            <ShuffleGlyph size={20} />
          </button>
          <button
            type="button"
            className="ap3-bar__play"
            onClick={onDockPlay}
            disabled={!catalog.length && !playingThem}
            aria-label={playingThem && isPlaying ? 'Pause' : `Play all of ${artist.username}'s songs`}
            tabIndex={barDocked ? 0 : -1}
          >
            {playingThem && isPlaying ? <PauseFill size={16} /> : <PlayFill size={17} />}
          </button>
        </div>
      </div>

      <div className="ap2-page ap3">
        {/* ===== HERO — the photo stays clear ===== */}
        <section className="ap3-hero" ref={heroRef}>
          <img src={artistPhoto} alt="" className="ap3-hero__img" />
          <div className="ap3-hero__scrim" />
          <div className="ap3-hero__tint" />

          <div className="ap3-hero__top">
            <button type="button" className="ap3-circ ap3-circ--glass" onClick={() => navigate(-1)} aria-label="Back">
              <BackGlyph />
            </button>
            <button type="button" className="ap3-circ ap3-circ--glass" onClick={handleShareArtist} aria-label={`Share ${artist.username}`}>
              <ShareGlyph />
            </button>
          </div>

          <div className="ap3-hero__content">
            <div className="ap3-hero__chips">
              {artist.jurisdiction?.name && (
                <button
                  type="button"
                  className="ap3-chip"
                  onClick={() => navigate(`/jurisdiction/${artist.jurisdiction.name}`)}
                >
                  <PinGlyph />
                  {artist.jurisdiction.name}
                </button>
              )}
              {!artist.jurisdiction?.name && visitorChip(artist) && (
                <span className="ap3-chip">
                  <PinGlyph />
                  {visitorChip(artist)}
                </span>
              )}
              {hasRank && (
                <span className="ap3-chip ap3-chip--rank">
                  #{standing.rank}{standingPlace ? ` in ${standingPlace}` : ''}
                  {standing.deltaSpots > 0 && (
                    <span className="ap3-chip__up" aria-label={`up ${standing.deltaSpots}`}>
                      <UpGlyph />{standing.deltaSpots}
                    </span>
                  )}
                </span>
              )}
            </div>
            <h1 className="ap3-hero__name" ref={nameRef}>{artist.username}</h1>
            <div className="ap3-hide-phone">{stats}</div>
          </div>
        </section>

        {/* ===== IDENTITY + ACTIONS ===== */}
        <div className="ap3-wrap ap3-identity">
          <div className="ap3-hide-desktop">{stats}</div>

          {bioText && (
            <div className="ap3-teaser ap3-hide-desktop">
              <p className="ap3-teaser__text">{bioText}</p>
              <button type="button" className="ap3-link ap3-link--bright" onClick={openAbout}>
                more about {artist.username}
              </button>
            </div>
          )}

          <div className="ap3-actions">
            {showActionButtons && (
              <button
                type="button"
                className={`ap3-pill ap3-act--follow ${isFollowing ? 'is-on' : ''}`}
                onClick={handleFollow}
                aria-pressed={isFollowing}
              >
                <FollowGlyph on={isFollowing} />
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
            {/* ★ Release alerts: the bell picks every release, big releases only, or off */}
            {showActionButtons && !isGuest && (
              <ReleaseAlertBell artistId={artistId} artistName={artist.username} isFollowing={isFollowing} className="ap3-circ" />
            )}
            {showActionButtons && (
              <button type="button" className="ap3-pill ap3-pill--vote ap3-act--vote ap3-hide-phone" onClick={handleVote}>
                <VoteIcon size={18} />
                Vote
              </button>
            )}
            {showActionButtons && (
              <button
                type="button"
                className={`ap3-circ ap3-act--support ${isSupporting ? 'is-on' : ''}`}
                onClick={openSupporterSheet}
                aria-label={isSupporting ? `Supporting ${artist.username}` : `Support ${artist.username}`}
                title={isSupporting ? 'Supporting' : 'Support'}
              >
                <SupportIcon size={21} active={false} tone={isSupporting ? 'on' : 'default'} />
              </button>
            )}
            {showActionButtons && (
              <MessageButton
                iconOnly
                className="ap3-circ ap3-act--message"
                recipientId={artistId}
                recipientName={artist.username}
                recipientPhotoUrl={artist.photoUrl ? buildUrl(artist.photoUrl) : null}
              />
            )}
            <button type="button" className="ap3-circ ap3-act--share ap3-hide-phone" onClick={handleShareArtist} aria-label={`Share ${artist.username}`} title="Share">
              <ShareGlyph />
            </button>

            <span className="ap3-actions__spacer" aria-hidden="true" />

            <button
              type="button"
              className="ap3-circ ap3-circ--bare ap3-act--shuffle"
              onClick={() => playCatalog({ shuffle: true })}
              disabled={!catalog.length}
              aria-label={`Shuffle all of ${artist.username}'s songs`}
              title="Shuffle all"
            >
              <ShuffleGlyph />
            </button>
            <button
              ref={playRef}
              type="button"
              className="ap3-play ap3-act--play"
              onClick={() => playCatalog()}
              disabled={!catalog.length}
              aria-label={`Play all of ${artist.username}'s songs`}
              title="Play all"
            >
              <PlayFill />
            </button>
          </div>

          {showActionButtons && (
            <button type="button" className="ap3-votecard ap3-hide-desktop" onClick={handleVote}>
              <VoteIcon size={22} />
              <span className="ap3-votecard__text">
                <span className="ap3-votecard__title">Vote for {artist.username}</span>
                <span className="ap3-votecard__sub">Moves them up the {standingArea} rankings</span>
              </span>
              <ChevronGlyph />
            </button>
          )}
        </div>

        {/* ===== TABS ===== */}
        <div className="ap3-tabs" ref={tabsRef}>
          <div className="ap3-wrap ap3-tabs__row" role="tablist" aria-label={artist.username}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`ap3-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`ap3-panel-${t.id}`}
                className={`ap3-tab ${tab === t.id ? 'is-on' : ''}`}
                onClick={() => goToTab(t.id)}
              >
                {t.label}
                {t.id === 'photos' && photos.length > 0 && <span className="ap3-tab__count">{photos.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ===== MUSIC ===== */}
        {tab === 'music' && (
          <div className="ap3-wrap ap3-music" role="tabpanel" id="ap3-panel-music" aria-labelledby="ap3-tab-music">
            <div className="ap3-music__main">
              {topSong && (
                <div className="ap3-card ap3-pick" style={featuredAmbient || undefined}>
                  <button type="button" className="ap3-pick__open" onClick={() => playFromSong(topSong)} aria-label={`Play ${topSong.title}`}>
                    <img src={topSongArtwork} alt="" className="ap3-pick__art" />
                    <span className="ap3-pick__info">
                      <span className="ap3-pick__badge">Fans pick</span>
                      <span className="ap3-pick__title">{topSong.title}</span>
                      <span className="ap3-pick__meta">
                        Song · {fmt(playsOf(topSong))} plays{artist.genre?.name ? ` · ${artist.genre.name}` : ''}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ap3-pick__play"
                    onClick={() => playFromSong(topSong)}
                    aria-label={`Play ${topSong.title}`}
                  >
                    <PlayFill size={17} color="#111" />
                  </button>
                </div>
              )}

              <section className="ap3-popular" aria-label="Popular songs">
                <div className="ap3-sechead">
                  <h3 className="ap3-h3">Popular</h3>
                  {popularSongs.length > POPULAR_COUNT && (
                    <button type="button" className="ap3-link" onClick={() => setShowAllSongs((v) => !v)}>
                      {showAllSongs ? 'Show less' : `See all ${popularSongs.length}`}
                    </button>
                  )}
                </div>
                {popularSongs.length === 0 ? (
                  <p className="ap2-empty">No songs yet</p>
                ) : (
                  <ol className="ap3-tracks">
                    {visibleSongs.map((song, idx) => (
                      <li
                        key={song.songId}
                        className={`ap3-track ${songMenu?.song?.id === song.songId ? 'is-menu' : ''}`}
                        style={songColors[song.songId] ? { backgroundImage: songColors[song.songId] } : undefined}
                      >
                        <button
                          type="button"
                          className="ap3-track__main"
                          onClick={() => playFromSong(song)}
                          aria-label={`Play ${song.title}`}
                        >
                          <span className="ap3-track__num">{idx + 1}</span>
                          <img src={buildUrl(song.artworkUrl) || artistPhoto} alt="" className="ap3-track__art" />
                          <span className="ap3-track__info">
                            <span className="ap3-track__title">{song.title}</span>
                            <span className="ap3-track__plays">{fmt(playsOf(song))} plays</span>
                          </span>
                          <span className="ap3-track__plays ap3-track__plays--wide">{fmt(playsOf(song))} plays</span>
                        </button>
                        <button
                          type="button"
                          className="ap3-kebab"
                          aria-label={`More options for ${song.title}`}
                          aria-haspopup="menu"
                          aria-expanded={songMenu?.song?.id === song.songId}
                          onClick={(e) => { e.stopPropagation(); openSongMenu(menuSong(song), anchorFromEvent(e)); }}
                        >
                          <KebabIcon />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <div className="ap3-music__aside">
              {bioText && (
                <div className="ap3-card ap3-aboutcard ap3-hide-phone">
                  <img src={aboutPhoto} alt="" className="ap3-aboutcard__img" />
                  <div className="ap3-aboutcard__body">
                    <h3 className="ap3-h3 ap3-h3--sm"><em>About</em> {artist.username}</h3>
                    <p className="ap3-aboutcard__text">{bioText}</p>
                    <button type="button" className="ap3-link ap3-link--bright" onClick={openAbout}>Read more</button>
                  </div>
                </div>
              )}

              <ArtistStanding
                artistName={artist.username}
                standing={standing}
                territory={territory}
                className="ap3-o-standing"
              />

              {showActionButtons && (
                <div className="ap3-card ap3-support ap3-o-support">
                  <div className="ap3-support__head">
                    <img src={artistPhoto} alt="" className="ap3-support__avatar" />
                    <div>
                      <h3 className="ap3-support__title">Support {artist.username}</h3>
                      <p className="ap3-support__sub">{supportSub}</p>
                    </div>
                  </div>
                  <div className="ap3-support__actions">
                    <button
                      type="button"
                      className={`ap3-pill ${isSupporting ? 'is-on' : ''}`}
                      onClick={openSupporterSheet}
                    >
                      <SupportIcon size={17} tone={isSupporting ? 'on' : 'default'} />
                      {isSupporting ? 'Supporting' : 'Support'}
                    </button>
                    <button type="button" className="ap3-pill" onClick={handleShop}>
                      <ShopGlyph />
                      Buy songs
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="ap3-music__wide">
              {/* ★ Latest release + Discography (albums, EPs, mixtapes, singles) */}
              <ArtistDiscography
                artistId={artistId}
                artistName={artist.username}
                songs={songs}
                onShowAllSongs={() => {
                  setShowAllSongs(true);
                  document.querySelector('.ap3-popular')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
              {videoUrl && (
                <section className="ap3-card ap3-video ap3-o-video" aria-label="Featured video">
                  <h3 className="ap3-h3 ap3-h3--sm">Featured video</h3>
                  <div className="ap3-video__frame">
                    <video
                      className="ap3-video__el"
                      src={buildUrl(videoUrl)}
                      poster={artistPhoto}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  </div>
                </section>
              )}

              {earnedAwards.length > 0 && (
                <section className="ap3-awards ap3-o-awards" aria-label={`${artist.username} awards`}>
                  <div className="ap3-sechead">
                    <h3 className="ap3-h3">Awards <em>{fmt(totalWins)} {totalWins === 1 ? 'win' : 'wins'}</em></h3>
                  </div>
                  <ul className="ap3-awards__shelf">
                    {earnedAwards.map((a) => (
                      <li
                        key={a.key}
                        className="ap3-medal"
                        aria-label={`${a.label}, won ${a.count} ${a.count === 1 ? 'time' : 'times'}`}
                      >
                        <span className={`ap3-medal__disc ap3-medal__disc--${a.entity}`} aria-hidden="true">{a.short}</span>
                        <span className="ap3-medal__text" aria-hidden="true">
                          <span className="ap3-medal__label">{a.label}</span>
                          <span className="ap3-medal__count">&times;{fmt(a.count)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {photos.length > 0 && (
                <section className="ap3-photostrip ap3-o-photos" aria-label="Photos">
                  <div className="ap3-sechead">
                    <h3 className="ap3-h3">Photos</h3>
                    <button type="button" className="ap3-link" onClick={() => goToTab('photos')}>
                      See all {photos.length}
                    </button>
                  </div>
                  <div className="ap3-photostrip__row">
                    {photos.slice(0, 6).map((photo, idx) => (
                      <button
                        key={photo.photoId}
                        type="button"
                        className="ap3-photostrip__tile"
                        onClick={() => setLightboxIndex(idx)}
                        aria-label={`Open photo ${idx + 1} of ${photos.length}`}
                      >
                        <img src={buildUrl(photo.photoUrl)} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <div className="ap3-o-ad">
                <AdSlot placement="artist" />
              </div>
            </div>
          </div>
        )}

        {/* ===== PHOTOS ===== */}
        {tab === 'photos' && (
          <div className="ap3-photos" role="tabpanel" id="ap3-panel-photos" aria-labelledby="ap3-tab-photos">
            {photos.length === 0 ? (
              <p className="ap2-empty ap3-wrap">
                {isOwnProfile || isCurrentUser
                  ? 'No photos yet. Add some from your artist dashboard.'
                  : `${artist.username} hasn’t posted any photos yet.`}
              </p>
            ) : (
              <>
                <p className="ap3-photos__hint ap3-wrap">
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'} · tap one to open it full screen
                </p>
                <div className="ap3-photos__grid">
                  {photos.map((photo, idx) => (
                    <button
                      key={photo.photoId}
                      type="button"
                      className="ap3-photos__tile"
                      onClick={() => setLightboxIndex(idx)}
                      aria-label={`Open photo ${idx + 1} of ${photos.length}`}
                    >
                      <img src={buildUrl(photo.photoUrl)} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== ABOUT — the bio gets its own room, never on top of the photo ===== */}
        {tab === 'about' && (
          <div className="ap3-wrap ap3-about" role="tabpanel" id="ap3-panel-about" aria-labelledby="ap3-tab-about">
            <img src={aboutPhoto} alt={`${artist.username}`} className="ap3-about__img" />
            <div className="ap3-about__body">
              <h2 className="ap3-about__title"><em>About</em> {artist.username}</h2>

              <div className="ap3-about__stats">
                <div className="ap3-stat"><b>{fmt(artist.totalPlays)}</b><span>Plays</span></div>
                <div className="ap3-stat"><b>{fmt(followerCount)}</b><span>{followerCount === 1 ? 'Follower' : 'Followers'}</span></div>
                <div className="ap3-stat"><b>{fmt(artist.score)}</b><span>Score</span></div>
                <div className="ap3-stat"><b>{fmt(totalWins)}</b><span>Awards won</span></div>
              </div>

              {(artist.jurisdiction?.name || visitorChip(artist) || artist.genre?.name) && (
                <div className="ap3-about__tags">
                  {artist.jurisdiction?.name && (
                    <button type="button" className="ap3-chip ap3-chip--flat" onClick={() => navigate(`/jurisdiction/${artist.jurisdiction.name}`)}>
                      <PinGlyph />{artist.jurisdiction.name}
                    </button>
                  )}
                  {!artist.jurisdiction?.name && visitorChip(artist) && (
                    <span className="ap3-chip ap3-chip--flat"><PinGlyph />{visitorChip(artist)}</span>
                  )}
                  {artist.genre?.name && <span className="ap3-chip ap3-chip--flat">{artist.genre.name}</span>}
                </div>
              )}

              {isOwnProfile ? (
                <div className="ap3-about__edit">
                  <label htmlFor="ap3-bio" className="ap3-about__label">Your bio</label>
                  <textarea
                    id="ap3-bio"
                    value={bio}
                    onChange={handleBioChange}
                    className="ap3-about__textarea"
                    placeholder="Tell fans about yourself…"
                    rows={8}
                  />
                  <button type="button" onClick={handleSaveBio} className="ap3-pill is-on">Save bio</button>
                </div>
              ) : bioParagraphs.length > 0 ? (
                <div className="ap3-about__bio">
                  {bioParagraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              ) : (
                <p className="ap3-about__empty">{artist.username} hasn&rsquo;t written a bio yet.</p>
              )}

              {socialLinks.length > 0 && (
                <section aria-label="Connect">
                  <h3 className="ap3-h3 ap3-h3--sm ap3-about__connecthead">Connect</h3>
                  <div className="ap3-about__links">
                    {socialLinks.map((sl) => (
                      <a
                        key={sl.key}
                        href={sl.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="ap3-social"
                        aria-label={`${artist.username} on ${sl.name}`}
                      >
                        <span className="ap3-social__icon">{SOCIAL_ICONS[sl.key]}</span>
                        <span className="ap3-social__name">{sl.name}</span>
                        <ChevronGlyph size={16} />
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        userId={userId}
        filters={{
          selectedGenre: artist.genre?.name?.toLowerCase().replace('/', '-') || 'unknown',
          selectedType: 'artist',
          selectedInterval: 'daily',
          selectedJurisdiction: artist.jurisdiction?.name?.toLowerCase().replace(' ', '-') || 'unknown',
        }}
      />

      <SupporterSheet
        show={showSupporterSheet}
        onClose={() => setShowSupporterSheet(false)}
        artistName={artist.username}
        artistPhoto={artistPhoto}
        isFirstPick={isFirstPick}
        alreadySupporting={isSupporting && !supporterResult}
        busy={supporterBusy}
        error={supporterError}
        result={supporterResult}
        onConfirm={confirmSupporter}
      />

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        artistName={artist.username}
        onClose={() => setLightboxIndex(null)}
        onPrev={showPrevPhoto}
        onNext={showNextPhoto}
      />

      <ShopSheet
        show={showShopSheet}
        onClose={() => setShowShopSheet(false)}
        artistName={artist.username}
        songs={songs}
        onPick={handleShopPick}
      />

      {/* Same component + song shape the player uses for its download flow */}
      <DownloadModal
        isOpen={Boolean(shopSong)}
        onClose={() => setShopSong(null)}
        song={shopSong ? {
          id: shopSong.songId,
          title: shopSong.title || 'Untitled',
          artist: artist.username,
          artworkUrl: buildUrl(shopSong.artworkUrl) || artistPhoto,
          downloadUrl: buildUrl(shopSong.fileUrl),
          downloadPolicy: shopSong.downloadPolicy || 'free',
          downloadPrice: shopSong.downloadPrice || null,
          fileName: `${artist.username} - ${shopSong.title || 'Track'}.mp3`,
        } : {}}
      />

      {/* ★ Song ⋮ menu (Play next · Add to queue · Save to playlist · Download · Share · Go to song) */}
      {songMenu && (
        <SongMenu
          key={songMenu.key}
          song={songMenu.song}
          anchor={songMenu.anchor}
          onClose={closeSongMenu}
          onPlayNow={playFromMenu}
          isGuest={isGuest}
          onRequireAccount={requireAccount}
        />
      )}

      <AuthGateSheet {...gateProps} />
    </Layout>
  );
};

export default ArtistPage;
