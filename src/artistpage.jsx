import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';
import { useAuth } from './context/AuthContext';
import { incrementGateSongCount } from './AuthGateSheet';
import { buildUrl } from './utils/buildUrl';
import MessageButton from './MessageButton';
import useModalA11y from './hooks/useModalA11y';

// ─── Award rail definitions ────────────────────────────────────
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

// Inline glyphs (project convention: inline SVG, never lucide inside buttons)
//
// One distinct symbol per voting interval, so a fan can read the rail at a
// glance: sun = daily, arc = weekly, half-moon = midterm, full moon = monthly,
// quarter-pie = quarterly, crown = annual. Entity is carried by COLOR, not
// shape — artist medals take the user's theme accent, song medals stay gold.
const INTERVAL_GLYPHS = {
  daily: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  ),
  weekly: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
      <path d="M4 14a8 8 0 0 1 16 0" />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 14l4.5-4" />
    </svg>
  ),
  midterm: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </svg>
  ),
  monthly: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="9.4" cy="9.6" r="1.5" fill="rgba(0,0,0,0.45)" />
      <circle cx="14.6" cy="13.4" r="2" fill="rgba(0,0,0,0.35)" />
      <circle cx="10" cy="15" r="1.1" fill="rgba(0,0,0,0.35)" />
    </svg>
  ),
  quarterly: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12V4a8 8 0 0 1 8 8z" fill="currentColor" stroke="none" />
      <path d="M12 12V4M12 12h8" />
    </svg>
  ),
  annual: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z" />
    </svg>
  ),
};

const AwardGlyph = ({ interval }) => INTERVAL_GLYPHS[interval] || INTERVAL_GLYPHS.annual;

// The medal chrome: ribbon tails + glass disc + double ring. Everything is
// currentColor, so the ENTIRE medal re-tints from CSS — artist medals take
// the user's theme accent, song medals take gold, and any future theme just
// works. The interval glyph is layered on top separately (see ap2-badge).
const MedalBase = () => (
  <svg className="ap2-badge__base" viewBox="0 0 64 80" aria-hidden="true">
    {/* Ribbon tails — splayed, notched, tucked behind the disc */}
    <g fill="currentColor" opacity="0.88">
      <g transform="translate(24.5 46) rotate(-16)">
        <path d="M-5.5 -4 h11 v27 l-5.5 -6.5 l-5.5 6.5 z" />
      </g>
      <g transform="translate(39.5 46) rotate(16)">
        <path d="M-5.5 -4 h11 v27 l-5.5 -6.5 l-5.5 6.5 z" />
      </g>
    </g>
    {/* Glass disc */}
    <circle cx="32" cy="29" r="26" fill="rgba(9, 9, 13, 0.78)" />
    {/* Outer ring + inner engraving ring */}
    <circle cx="32" cy="29" r="26" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="32" cy="29" r="20.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
  </svg>
);

const ZapGlyph = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);

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

const formatEffective = (iso) => {
  if (!iso) return 'the start of next month';
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
          <span className="ap2-supsheet__stateicon ap2-supsheet__stateicon--ok"><ZapGlyph size={24} /></span>
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
            <ZapGlyph size={14} />
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
// =============================================================================
const PhotoLightbox = ({ photos, index, artistName, onClose, onPrev, onNext }) => {
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

const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const { requestPlay } = useContext(PlayerContext);
  const { user, isGuest, refreshUser } = useAuth();
  const navigate = useNavigate();

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
  const [defaultSong, setDefaultSong] = useState(null);
  const [awards, setAwards] = useState({});       // normalized award counts
  const [standing, setStanding] = useState(null);  // jurisdiction ranking
  const [songColors, setSongColors] = useState({}); // songId -> ambient rgb
  const [photos, setPhotos] = useState([]);        // artist gallery photos
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [awardsRevealed, setAwardsRevealed] = useState(false); // medal rail entrance

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

  // Sticky header scroll detection
  const heroRef = useRef(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const handleScroll = useCallback(() => {
    if (!heroRef.current) return;
    const heroBottom = heroRef.current.getBoundingClientRect().bottom;
    // App header is a fixed 75px — reveal the bar once the hero passes under it.
    setShowStickyHeader(heroBottom < 90);
  }, []);

  useEffect(() => {
    const scrollTarget = heroRef.current?.closest('.layout-content') || window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

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
          defaultSongRes,
          followStatusRes,
          awardsRes,
          standingRes,
          photosRes,
        ] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/users/profile/${artistId}` }),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/followers/count` }).catch(() => ({ data: { count: 0 } })),
          apiCall({ method: 'get', url: `/v1/media/songs/artist/${artistId}` }).catch(() => ({ data: [] })),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/default-song` }).catch(() => ({ data: null })),
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
        setBio(artistData.bio || 'No bio available');
        setFollowerCount(followerCountRes.data.count || 0);
        setSongs(songsRes.data || []);
        setDefaultSong(defaultSongRes.data || null);
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

  // Sample ambient colors for the top songs shown in "Popular".
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const top = songs.slice(0, 5);
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
          map[e[0]] = `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0.34) 0%, rgba(${r}, ${g}, ${b}, 0.10) 55%, transparent 100%)`;
        }
      });
      setSongColors(map);
    };
    if (songs.length) run();
    return () => { cancelled = true; };
  }, [songs]);

  // Medal rails slide in AFTER the hero portrait has landed, so the artist's
  // face reads first and the prestige arrives as a second beat. Base delay
  // plus the per-medal stagger in SCSS finishes comfortably under 2s.
  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(() => setAwardsRevealed(true), 650);
    return () => clearTimeout(timer);
  }, [loading, artistId]);

  const handleFollow = async () => {
    const previousState = isFollowing;
    const previousCount = followerCount;
    setIsFollowing(!previousState);
    setFollowerCount(prev => (!previousState ? prev + 1 : prev - 1));
    try {
      if (!previousState) {
        await apiCall({ method: 'post', url: `/v1/users/${artistId}/follow` });
      } else {
        await apiCall({ method: 'delete', url: `/v1/users/${artistId}/follow` });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setIsFollowing(previousState);
      setFollowerCount(previousCount);
      alert('Something went wrong. Please try again.');
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
      if (data.status === 'immediate' || data.status === 'cancelled') {
        setIsSupporting(true);
        setPendingSwitch(null);
      }
      if (data.status === 'pending') {
        setPendingSwitch({ effectiveDate: data.effectiveDate || null });
      }
      refreshUser?.(); // sync user.supportedArtistId app-wide
    } catch (err) {
      console.error('[Support] supported-artist update failed:', { artistId, err });
      setSupporterError(err.response?.data?.error || 'Could not update your supported artist. Please try again.');
    } finally {
      setSupporterBusy(false);
    }
  };

  const handleShop = () => {
    // TODO: open artist storefront / buy-music flow
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
      alert('Bio updated successfully');
    } catch (err) { alert('Failed to update bio'); }
  };

  const handleVoteSuccess = () => setShowVotingWizard(false);

  const handleVote = () => {
    setSelectedNominee({
      id: artistId,
      name: artist.username,
      type: 'artist',
      jurisdiction: artist.jurisdiction,
    });
    setShowVotingWizard(true);
  };

  const handlePlayDefault = async () => {
    if (defaultSong?.fileUrl) {
      const fullUrl = buildUrl(defaultSong.fileUrl);
      if (isGuest) incrementGateSongCount();
      requestPlay({
        type: 'song',
        id: defaultSong.songId,
        songId: defaultSong.songId,
        url: fullUrl,
        fileUrl: fullUrl,
        title: defaultSong.title,
        artist: artist.username,
        artistId: artist.userId,
        artwork: buildUrl(defaultSong.artworkUrl) || buildUrl(artist.photoUrl),
        artworkUrl: buildUrl(defaultSong.artworkUrl) || buildUrl(artist.photoUrl),
      });
      if (defaultSong.songId && userId) {
        try {
          await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` });
        } catch (err) { console.error('Failed to track default song play:', err); }
      }
    } else {
      alert('No default song available for this artist');
    }
  };

  const handleSongClick = (songId) => navigate(`/song/${songId}`);

  const playSong = (song) => {
    if (!song) return;
    if (isGuest) incrementGateSongCount();
    requestPlay({
      type: 'song',
      id: song.songId,
      songId: song.songId,
      url: buildUrl(song.fileUrl),
      fileUrl: buildUrl(song.fileUrl),
      title: song.title,
      artist: artist.username,
      artistId: artist.userId,
      artwork: buildUrl(song.artworkUrl) || (artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet),
      artworkUrl: buildUrl(song.artworkUrl) || (artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet),
    });
  };

  if (loading) return (
    <Layout backgroundImage={theQuiet}>
      <div className="ap2-loading">Loading...</div>
    </Layout>
  );

  if (error || !artist) return (
    <Layout backgroundImage={theQuiet}>
      <div className="ap2-error">Artist not found</div>
    </Layout>
  );

  const artistPhoto = artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet;
  const topSong = songs.length > 0
    ? songs.reduce((prev, current) => (current.score || 0) > (prev.score || 0) ? current : prev, songs[0])
    : null;
  const topSongArtwork = topSong ? (buildUrl(topSong.artworkUrl) || artistPhoto) : artistPhoto;

  const isCurrentUser = userId === artistId;
  const showActionButtons = !isOwnProfile && !isCurrentUser;
  const isFirstPick = !user?.supportedArtistId;

  const fmt = (n) => (n || 0).toLocaleString();

  const earnedAwards = AWARD_DEFS
    .map((def) => ({ ...def, count: awards[def.key] || 0 }))
    .filter((a) => a.count > 0)
    .sort((a, b) => a.rank - b.rank); // most prestigious first

  // One trophy shelf: artist medals (theme-colored) lead, song medals (gold)
  // follow, each group ordered most prestigious → least.
  const artistAwards = earnedAwards.filter((a) => a.entity === 'artist');
  const songAwards = earnedAwards.filter((a) => a.entity === 'song');
  const shelfAwards = [...artistAwards, ...songAwards];

  const videoUrl = artist.featuredVideoUrl || artist.videoUrl || null;

  const standingPlace = standing?.genreName || artist.genre?.name || '';
  const standingArea = standing?.jurisdictionName || artist.jurisdiction?.name || 'your area';

  const supportSub = isSupporting
    ? 'They\u2019re your supported artist \u2014 your listening backs them.'
    : pendingSwitch
      ? `Switch locked in for ${formatEffective(pendingSwitch.effectiveDate)}.`
      : `Make ${artist.username} your supported artist.`;

  return (
    <Layout backgroundImage={artistPhoto}>
      {/* ===== STICKY HEADER — slides in under the app header (Spotify-style) ===== */}
      <div className={`ap2-sticky ${showStickyHeader ? 'ap2-sticky--visible' : ''}`}>
        <div className="ap2-sticky__inner">
          <div className="ap2-sticky__left">
            <img src={artistPhoto} alt={artist.username} className="ap2-sticky__avatar" />
            <span className="ap2-sticky__name">{artist.username}</span>
          </div>
          {showActionButtons && (
            <div className="ap2-sticky__actions">
              <button
                onClick={handleFollow}
                className={`ap2-sticky__btn ${isFollowing ? 'ap2-sticky__btn--following' : ''}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button onClick={handlePlayDefault} className="ap2-sticky__btn ap2-sticky__btn--play" disabled={!defaultSong}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                Play
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ap2-page">
        {/* ===== HERO — Full-bleed artist portrait ===== */}
        <section className="ap2-hero" ref={heroRef}>
          <div className="ap2-hero__backdrop">
            <img src={artistPhoto} alt="" className="ap2-hero__img" />
            <div className="ap2-hero__scrim" />
            <div className="ap2-hero__vignette" />
          </div>

          {/* Trophy shelf — the Unis prestige signal, in its own band across
              the top of the hero. Only earned awards render. Each medal names
              its award in full and carries a ×N win chip. Scrolls sideways
              like a trophy case when a decorated artist overflows it. */}
          {shelfAwards.length > 0 && (
            <div
              className={`ap2-badges ${awardsRevealed ? 'ap2-badges--in' : ''}`}
              role="list"
              aria-label={`${artist.username} awards`}
            >
              {shelfAwards.map((a, i) => (
                <div
                  key={a.key}
                  role="listitem"
                  className={`ap2-badge ap2-badge--${a.entity}`}
                  style={{ '--ap2-badge-delay': `${i * 0.09}s` }}
                  aria-label={`${a.label}, won ${a.count} ${a.count === 1 ? 'time' : 'times'}`}
                >
                  <span className="ap2-badge__medal">
                    <MedalBase />
                    <span className="ap2-badge__glyph"><AwardGlyph interval={a.interval} /></span>
                    <span className="ap2-badge__count" aria-hidden="true">×{a.count}</span>
                  </span>
                  <span className="ap2-badge__label" aria-hidden="true">{a.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="ap2-hero__content">
            <div className="ap2-hero__tags">
              <span
                className="ap2-hero__jurisdiction"
                onClick={() => navigate(`/jurisdiction/${artist.jurisdiction?.name}`)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-7-6.4-7-11a7 7 0 0 1 14 0c0 4.6-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
                </svg>
                {artist.jurisdiction?.name || 'Unknown'}
              </span>

              {standing && (standing.rank != null) && (
                <span className="ap2-hero__rank">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M5 4h14v3a5 5 0 0 1-4 4.9V14h2v2H7v-2h2v-2.1A5 5 0 0 1 5 7V4z" /><rect x="8" y="18" width="8" height="2" rx="1" />
                  </svg>
                  #{standing.rank}{standingPlace ? ` ${standingPlace}` : ''}
                  {standing.deltaSpots > 0 && (
                    <span className="ap2-hero__rank-up">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                      {standing.deltaSpots}
                    </span>
                  )}
                </span>
              )}
            </div>

            <h1 className="ap2-hero__name">{artist.username}</h1>

            <div className="ap2-hero__meta">
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(artist.totalPlays)}</span>
                <span className="ap2-hero__stat-label">Plays</span>
              </div>
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(followerCount)}</span>
                <span className="ap2-hero__stat-label">Followers</span>
              </div>
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(artist.score)}</span>
                <span className="ap2-hero__stat-label">Score</span>
              </div>
            </div>

            {showActionButtons && (
              <>
                <div className="ap2-hero__actions">
                  <button onClick={handlePlayDefault} className="ap2-hero__btn-play" disabled={!defaultSong}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                    Play Discography
                  </button>
                  <MessageButton recipientId={artistId} />
                  <button
                    onClick={openSupporterSheet}
                    className={`ap2-hero__btn-support ${isSupporting ? 'ap2-hero__btn-support--active' : ''}`}
                  >
                    <ZapGlyph size={15} />
                    {isSupporting ? 'Supporting' : 'Support'}
                  </button>
                  <button onClick={handleFollow} className={`ap2-hero__btn-follow ${isFollowing ? 'ap2-hero__btn-follow--active' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={handleVote} className="ap2-hero__btn-vote">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.8.6-5.1 4.6 1.5 6.7L12 17.3 5.9 20.8l1.5-6.7L2.3 9.5l6.8-.6L12 2z" /></svg>
                    Vote
                  </button>
                </div>
                <p className="ap2-hero__votehint">
                  <ZapGlyph size={13} />
                  Your vote moves them up the {standingArea} rankings
                </p>
              </>
            )}
          </div>
        </section>

        {/* ===== CARD BODY — Ambient background from artwork ===== */}
        <div className="ap2-body">
          <div className="ap2-body__ambient">
            <img src={topSongArtwork} alt="" className="ap2-body__ambient-img" />
            <div className="ap2-body__ambient-overlay" />
          </div>

          <div className="ap2-body__content">
            {/* Standing strip — democratic ranking (renders when backend supplies it) */}
            {standing && (standing.rank != null) && (
              <div className="ap2-card ap2-standing">
                <div className="ap2-standing__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" />
                  </svg>
                </div>
                <div className="ap2-standing__text">
                  <span className="ap2-standing__label">This week in {standingArea}</span>
                  <span className="ap2-standing__value">
                    #{standing.rank}{standing.total ? ` of ${standing.total}` : ''}{standingPlace ? ` in ${standingPlace}` : ''}
                    {standing.deltaSpots > 0 && ` · up ${standing.deltaSpots} spot${standing.deltaSpots > 1 ? 's' : ''}`}
                  </span>
                </div>
                {showActionButtons && (
                  <button className="ap2-standing__btn" onClick={handleVote}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.8.6-5.1 4.6 1.5 6.7L12 17.3 5.9 20.8l1.5-6.7L2.3 9.5l6.8-.6L12 2z" /></svg>
                    Boost
                  </button>
                )}
              </div>
            )}

            {/* Featured video — only when the artist has uploaded one */}
            {videoUrl && (
              <div className="ap2-card ap2-video">
                <span className="ap2-video__label">Featured Video</span>
                <div className="ap2-video__frame">
                  <video
                    className="ap2-video__el"
                    src={buildUrl(videoUrl)}
                    poster={artistPhoto}
                    controls
                    playsInline
                    preload="metadata"
                  />
                </div>
              </div>
            )}

            {/* Row 1: Featured Song + Support (support card hidden on your own page) */}
            <div className={`ap2-grid ap2-grid--featured ${!showActionButtons ? 'ap2-grid--single' : ''}`}>
              {topSong && (
                <div className="ap2-card ap2-featured">
                  <div className="ap2-featured__layout">
                    <div className="ap2-featured__artwork-wrap" onClick={() => handleSongClick(topSong.songId)}>
                      <img src={topSongArtwork} alt={topSong.title} className="ap2-featured__artwork" />
                      <button
                        className="ap2-featured__play-overlay"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(songs.find(s => s.songId === topSong.songId));
                        }}
                        aria-label="Play fans pick"
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                      </button>
                    </div>
                    <div className="ap2-featured__info">
                      <span className="ap2-featured__badge">Fans Pick</span>
                      <h3 className="ap2-featured__title" onClick={() => handleSongClick(topSong.songId)}>
                        {topSong.title}
                      </h3>
                      <p className="ap2-featured__desc">
                        {fmt(topSong.plays)} plays · {fmt(topSong.score)} score
                      </p>
                      <div className="ap2-featured__genre">{artist.genre?.name || 'Unknown Genre'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Support card — wired to the real supporter-switch mechanism */}
              {showActionButtons && (
                <div className="ap2-card ap2-support">
                  <div className="ap2-support__head">
                    <img src={artistPhoto} alt={artist.username} className="ap2-support__avatar" />
                    <div className="ap2-support__copy">
                      <h3 className="ap2-support__title">Support {artist.username}</h3>
                      <p className="ap2-support__sub">{supportSub}</p>
                    </div>
                  </div>
                  <div className="ap2-support__actions">
                    <button
                      className={`ap2-support__btn ap2-support__btn--support ${isSupporting ? 'ap2-support__btn--supporting' : ''}`}
                      onClick={openSupporterSheet}
                    >
                      <ZapGlyph size={16} />
                      {isSupporting ? 'Supporting' : 'Support'}
                    </button>
                    <button
                      className={`ap2-support__btn ap2-support__btn--follow ${isFollowing ? 'ap2-support__btn--following' : ''}`}
                      onClick={handleFollow}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                      </svg>
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button className="ap2-support__btn ap2-support__btn--shop" onClick={handleShop}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 2L3 6v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                      Shop
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Popular (theme-tinted, ambient rows) + Connect / About aside */}
            <div className="ap2-grid ap2-grid--lower">
              <div className="ap2-card ap2-popular">
                <div className="ap2-popular__header">
                  <h3>Popular</h3>
                  {songs.length > 5 && <span className="ap2-popular__seeall">See all</span>}
                </div>
                <div className="ap2-popular__list">
                  {songs.slice(0, 5).map((song, idx) => (
                    <div
                      key={song.songId}
                      className="ap2-track"
                      style={songColors[song.songId] ? { backgroundImage: songColors[song.songId] } : undefined}
                    >
                      <span className="ap2-track__num">{idx + 1}</span>
                      <img src={buildUrl(song.artworkUrl) || artistPhoto} alt={song.title} className="ap2-track__art" />
                      <div className="ap2-track__info">
                        <span className="ap2-track__title" onClick={() => handleSongClick(song.songId)}>
                          {song.title}
                        </span>
                        <span className="ap2-track__plays">{fmt(song.plays)} plays</span>
                      </div>
                      <button
                        className="ap2-track__play"
                        onClick={(e) => { e.stopPropagation(); playSong(song); }}
                        aria-label={`Play ${song.title}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                      </button>
                    </div>
                  ))}
                  {songs.length === 0 && <p className="ap2-empty">No songs yet</p>}
                </div>
              </div>

              <div className="ap2-aside">
                <div className="ap2-card ap2-connect">
                  <h3 className="ap2-connect__title">Connect</h3>
                  <div className="ap2-connect__links">
                    {artist.instagramUrl && (
                      <a href={artist.instagramUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                        <span className="ap2-connect__icon">📷</span>
                        <span className="ap2-connect__label">Instagram</span>
                        <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                      </a>
                    )}
                    {artist.twitterUrl && (
                      <a href={artist.twitterUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                        <span className="ap2-connect__icon">𝕏</span>
                        <span className="ap2-connect__label">Twitter</span>
                        <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                      </a>
                    )}
                    {artist.tiktokUrl && (
                      <a href={artist.tiktokUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                        <span className="ap2-connect__icon">🎵</span>
                        <span className="ap2-connect__label">TikTok</span>
                        <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                      </a>
                    )}
                    {!artist.instagramUrl && !artist.twitterUrl && !artist.tiktokUrl && (
                      <p className="ap2-empty">No social links yet</p>
                    )}
                  </div>
                </div>

                <div className="ap2-card ap2-about">
                  <h3 className="ap2-about__heading">About</h3>
                  <div className="ap2-about__photo-wrap">
                    <img src={artistPhoto} alt="" className="ap2-about__photo" />
                    <div className="ap2-about__photo-fade" />
                    {!isOwnProfile && (
                      <p className="ap2-about__bio-overlay">{bio}</p>
                    )}
                  </div>
                  {isOwnProfile && (
                    <div className="ap2-about__edit">
                      <textarea value={bio} onChange={handleBioChange} className="ap2-about__textarea" placeholder="Tell fans about yourself..." />
                      <button onClick={handleSaveBio} className="ap2-about__save">Save Bio</button>
                    </div>
                  )}
                  <div className="ap2-about__badges">
                    <div className="ap2-about__badge">
                      <span className="ap2-about__badge-value">{fmt(artist.score)}</span>
                      <span className="ap2-about__badge-label">Score</span>
                    </div>
                    <div className="ap2-about__badge">
                      <span className="ap2-about__badge-value">{fmt(followerCount)}</span>
                      <span className="ap2-about__badge-label">Followers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== PHOTOS — Instagram-style gallery (renders only when the
                 artist has uploaded photos via the dashboard) ===== */}
            {photos.length > 0 && (
              <div className="ap2-card ap2-gallery">
                <div className="ap2-gallery__header">
                  <h3>Photos</h3>
                  <span className="ap2-gallery__count">{photos.length}</span>
                </div>
                <div className="ap2-gallery__grid">
                  {photos.map((photo, idx) => (
                    <button
                      key={photo.photoId}
                      type="button"
                      className="ap2-gallery__tile"
                      onClick={() => setLightboxIndex(idx)}
                      aria-label={`Open photo ${idx + 1} of ${photos.length}`}
                    >
                      <img src={buildUrl(photo.photoUrl)} alt="" loading="lazy" />
                      <span className="ap2-gallery__tile-glow" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M11 8v6M8 11h6" /></svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
    </Layout>
  );
};

export default ArtistPage;