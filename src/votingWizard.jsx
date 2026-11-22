import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { useReward, formatScore } from './context/RewardContext';
import { useAuth } from './context/AuthContext';
import { useFeedback } from './context/FeedbackContext';
import { drawVoteCard, voteCardBlob, voteCardFileName } from './utils/voteCard'; // ★ share image
import { GENRE_IDS, GENRE_NAMES, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
// Points + interval list come from the help center's shared constants, so the
// wizard and the help page can never quote different numbers (helpContent
// rule #2). VOTE_POINTS mirrors ScoreUpdateService.onVote on the backend.
import { VOTE_POINTS, INTERVAL_WEIGHTS } from './data/helpContent';
import { buildUrl } from './utils/buildUrl';
import PhoneVerificationModal from './phoneVerificationModal';
import VisitorLockSheet from './components/VisitorLockSheet';
// The app's standard "no artwork" image — the song and artist pages use the
// same one, so a nominee with no photo looks the same here as everywhere else.
import fallbackArtwork from './assets/theQuiet.jpg';
import './votingWizard.scss';

// Theme-aware logo — mirrors the Header component so the wizard logo
// follows the user's active theme instead of always being blue.
import logoblue from './assets/unisLogoThree.svg';
import logoorange from './assets/logo-orange.png';
import logored from './assets/logo-red.png';
import logogreen from './assets/logo-green.png';
import logopurple from './assets/logo-purple.png';
import logoyellow from './assets/logo-gold.png';
import logodianna from './assets/logo-dianna.png';

const LOGO_MAP = {
  blue: logoblue,
  orange: logoorange,
  red: logored,
  green: logogreen,
  purple: logopurple,
  yellow: logoyellow,
  dianna: logodianna,
};

const TOTAL_STEPS = 3;

// -------------------------------------------------------------------------
// Artwork.
//
// WHY THE IMAGE ONLY "SOMETIMES" APPEARED — three separate causes:
//   1. The artist page opened the wizard with NO image field at all, so artist
//      votes from /artist/:id never had a picture.
//   2. Every value was run through buildUrl, which prefixes relative paths with
//      the API origin. The app's own bundled placeholder ("/assets/theQuiet-…
//      .jpg", used by the song page when a song has no artwork) was rewritten
//      to the backend and 404'd — so the image vanished for exactly those songs.
//   3. Only the FIRST field found was ever tried. If it failed, nothing else was.
//
// Now: collect every candidate URL (nominee fields → fetched details → the
// standard placeholder), try them in order, and only render an image once one
// has actually loaded. The image always appears.
// -------------------------------------------------------------------------
const ARTWORK_KEYS = [
  'imageUrl',
  'artworkUrl',
  'photoUrl',
  'artwork',
  'image',
  'coverUrl',
  'cover',
  'thumbnailUrl',
  'pictureUrl',
];

const APP_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

// Images the app ships itself (Vite assets, inlined data URIs, blob previews).
// These are already valid as-is and must never be sent through buildUrl.
function isAppAsset(url) {
  return (
    /^(data:|blob:)/i.test(url) ||
    url.startsWith(`${APP_BASE}assets/`) ||
    url.startsWith('/src/') ||
    url.startsWith('/@fs/') ||
    url.startsWith('/node_modules/')
  );
}

function toImageSrc(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  if (isAppAsset(value)) return value;
  // buildUrl handles the server's media: private R2 → public CDN, public URLs
  // pass through encoded, relative /uploads/ paths get the API origin.
  try {
    return buildUrl(value) || null;
  } catch (e) {
    return value;
  }
}

function collectArtwork(obj, out) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of ARTWORK_KEYS) {
    const src = toImageSrc(obj[k]);
    if (src && !out.includes(src)) out.push(src);
  }
}

function artworkCandidatesFor(n) {
  const out = [];
  if (!n) return out;
  collectArtwork(n, out);
  collectArtwork(n.song || n.track || n.artistProfile || n.user, out);
  return out;
}

// Average colour of the artwork, lifted a little — tints the glow and accents.
// Cross-origin images taint the canvas; that's fine, we just fall back to the
// theme colour (the image itself still shows).
function dominantColor(img) {
  try {
    const SIZE = 20;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 125) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    if (n === 0) return null;

    let R = r / n;
    let G = g / n;
    let B = b / n;
    const avg = (R + G + B) / 3;
    const lift = 1.28;
    R = Math.max(0, Math.min(255, avg + (R - avg) * lift));
    G = Math.max(0, Math.min(255, avg + (G - avg) * lift));
    B = Math.max(0, Math.min(255, avg + (B - avg) * lift));
    return [Math.round(R), Math.round(G), Math.round(B)];
  } catch (e) {
    return null;
  }
}

// -------------------------------------------------------------------------
// Name check helpers.
//
// The forward/backward check must accept exactly what a person can type:
//   - iPhones turn ' into ’ and - into — ("Smart Punctuation"), so an artist
//     named "Don't" could never be voted for from an iPhone. Quotes and dashes
//     are folded to plain ASCII before comparing.
//   - Extra/leading/trailing spaces don't count.
//   - Reversal is done per visible character (grapheme), so emoji and accented
//     letters reverse correctly instead of turning into garbage (QA Finding 7).
// -------------------------------------------------------------------------
function normalizeName(s) {
  return String(s || '')
    .normalize('NFC')
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function reverseGraphemes(s) {
  const str = String(s || '');
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(str), (part) => part.segment).reverse().join('');
  }
  return Array.from(str).reverse().join('');
}

// -------------------------------------------------------------------------
// Intervals — built from the help center's definition (INTERVAL_WEIGHTS) so
// every defined interval is offered. Midterm was missing before: opening the
// wizard from a Midterm leaderboard showed "Day" in the dropdown while the
// vote was actually sent as Midterm.
// -------------------------------------------------------------------------
const INTERVAL_LABEL = {
  daily: 'Day',
  weekly: 'Week',
  monthly: 'Month',
  quarterly: 'Quarter',
  midterm: 'Midterm',
  annual: 'Year',
};

const INTERVAL_OPTIONS = INTERVAL_WEIGHTS
  .filter((w) => INTERVAL_IDS[w.key])
  .map((w) => ({ value: w.key, label: INTERVAL_LABEL[w.key] || w.label }));

const INTERVAL_ALIASES = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  quarter: 'quarterly',
  'semi-annual': 'midterm',
  year: 'annual',
  yearly: 'annual',
};

function normalizeInterval(value) {
  const k = String(value || '').toLowerCase();
  const key = INTERVAL_ALIASES[k] || k;
  return INTERVAL_IDS[key] ? key : 'daily';
}

// Interval → the noun the copy reads naturally with ("for the week").
const INTERVAL_NOUN = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  midterm: 'half-year',
  annual: 'year',
};

// The nominee's home jurisdiction UUID, from whatever shape the page passed.
function nomineeHomeJurisdictionId(n) {
  if (!n) return null;
  if (n.jurisdictionId) return n.jurisdictionId;
  if (n.jurisdiction && typeof n.jurisdiction === 'object' && n.jurisdiction.jurisdictionId) {
    return n.jurisdiction.jurisdictionId;
  }
  if (typeof n.jurisdiction === 'string') {
    const slug = n.jurisdiction.toLowerCase().trim().replace(/\s+/g, '-');
    return JURISDICTION_IDS[slug] || null;
  }
  return null;
}

const formatText = (str) =>
  str ? String(str).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const readThemePrimary = () => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--unis-primary').trim();
    return v || '#163387';
  } catch (e) {
    return '#163387';
  }
};

// ★ When a race's results come in, in words, on the race's own clock.
// closesAt (from /v1/awards/standings) is the instant the period ends — the
// local midnight after its last day — so a minute before it is that last day.
//   same day → "tonight at midnight", this week → "Sunday at midnight",
//   further out → "Dec 31 at midnight".
const RESULTS_FALLBACK = {
  daily: 'tonight at midnight',
  weekly: 'Sunday at midnight',
};
function closeLabel(closesAt, timeZone, intervalKey) {
  const fallback = RESULTS_FALLBACK[intervalKey] || `when the ${INTERVAL_NOUN[intervalKey] || 'period'} ends`;
  if (!closesAt) return fallback;
  try {
    const end = new Date(new Date(closesAt).getTime() - 60 * 1000);
    if (Number.isNaN(end.getTime())) return fallback;
    const opt = timeZone ? { timeZone } : {};
    const dayKey = (d) => d.toLocaleDateString('en-CA', opt);
    if (dayKey(end) === dayKey(new Date())) return 'tonight at midnight';
    const daysAway = (end.getTime() - Date.now()) / 86400000;
    if (daysAway < 6.5) return `${end.toLocaleDateString('en-US', { ...opt, weekday: 'long' })} at midnight`;
    return `${end.toLocaleDateString('en-US', { ...opt, month: 'short', day: 'numeric' })} at midnight`;
  } catch {
    return fallback;
  }
}

// --- ANIMATION VARIANTS ---------------------------------------------------

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
};

const modalVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.98,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

const stepVariantsForward = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.18, ease: 'easeIn' } },
};

const stepVariantsBackward = {
  enter: { opacity: 0, x: -24 },
  center: { opacity: 1, x: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.18, ease: 'easeIn' } },
};

const iconDraw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.7, ease: 'easeInOut' } },
};

// --- COMPONENT ------------------------------------------------------------

const EMPTY_EXTRAS = { genreId: null, artwork: null, pending: false };

const VotingWizard = ({ show, onClose, onVoteSuccess, nominee, userId, filters }) => {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [currentFilters, setCurrentFilters] = useState({
    selectedGenre: 'rap',
    selectedType: 'artist',
    selectedInterval: 'daily',
  });
  const { setScoreTotal, displayedScore } = useReward();
  const { theme, user, isGuest, refreshUser } = useAuth();
  const navigate = useNavigate();
  const activeLogo = LOGO_MAP[theme] || logoblue;

  const [artistNameForward, setArtistNameForward] = useState('');
  const [artistNameBackward, setArtistNameBackward] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard — state updates are async, so a fast double-tap or
  // Enter-then-click could otherwise fire two submits.
  const submittingRef = useRef(false);

  // Jurisdiction dropdown = the nominee's chain ∩ where THIS user can vote.
  //   loading → ready | unresolved (couldn't load) | none (no overlap)
  const [jurisdictionOptions, setJurisdictionOptions] = useState([]);
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState('');
  const [jurisdictionStatus, setJurisdictionStatus] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  // Jurisdictions the page context points at (e.g. the leaderboard the user
  // was browsing) — used to pick the default selection.
  const preferredJurisdictionsRef = useRef([]);

  // Anything the page didn't pass that we fetched from the nominee itself.
  const [nomineeExtras, setNomineeExtras] = useState(EMPTY_EXTRAS);

  const [voteResult, setVoteResult] = useState({ status: 'idle', message: '', details: '' });
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  // ★ After a vote: the most local race, live (ranks only), and share state.
  //   race.status: idle | loading | ready | none
  const [race, setRace] = useState({ status: 'idle', entries: [], closesAt: null, timeZone: null });
  const [sharing, setSharing] = useState(false);
  const feedback = useFeedback();

  // The artwork URL that actually LOADED (null until one does).
  const [artworkSrc, setArtworkSrc] = useState(null);
  // Dominant colour "R, G, B" from the artwork; null → theme fallback.
  const [artRGB, setArtRGB] = useState(null);

  const prevShowRef = useRef(false);
  const latestRef = useRef({ nominee, filters });
  latestRef.current = { nominee, filters };

  const selectedNominee = nominee;
  const nomineeName = (selectedNominee?.name || '').trim();
  const reversedNomineeName = useMemo(
    () => reverseGraphemes(nomineeName.normalize('NFC')),
    [nomineeName]
  );

  // --- RESET STATE ONLY ON OPEN TRANSITION --------------------------------
  useEffect(() => {
    if (show && !prevShowRef.current) {
      const { nominee: n, filters: f } = latestRef.current;

      setStep(1);
      setDirection(1);
      setVoteResult({ status: 'idle', message: '', details: '' });
      setRace({ status: 'idle', entries: [], closesAt: null, timeZone: null });
      setSharing(false);
      setArtistNameForward('');
      setArtistNameBackward('');
      setSubmitting(false);
      submittingRef.current = false;
      setShowPhoneModal(false);
      setArtworkSrc(null);
      setArtRGB(null);
      setJurisdictionOptions([]);
      setSelectedJurisdictionId('');
      setJurisdictionStatus('loading');

      preferredJurisdictionsRef.current = [
        JURISDICTION_IDS[f?.selectedJurisdiction],
        nomineeHomeJurisdictionId(n),
      ].filter(Boolean);

      setCurrentFilters({
        selectedGenre: n?.genreKey || f?.selectedGenre || 'rap',
        selectedType: n?.type || f?.selectedType || 'artist',
        selectedInterval: normalizeInterval(f?.selectedInterval),
      });
    }
    prevShowRef.current = show;
  }, [show]); // ← only `show` — DO NOT add `nominee` or `filters` here

  // --- RESOLVE NOMINEE CONTEXT + ELIGIBLE JURISDICTIONS --------------------
  // 1. If the page didn't hand us the nominee's jurisdiction, genre, or any
  //    image, fetch the nominee itself (one request) to fill the gaps.
  // 2. Load the nominee's jurisdiction chain AND the voter's eligible list in
  //    parallel, and offer only the overlap. The breadcrumb endpoint has no
  //    votingEnabled flag, so on its own it listed areas where voting is off
  //    and areas the voter can't vote in — both always rejected by the server
  //    after the user had already typed the name forward and backward.
  useEffect(() => {
    if (!show || !nominee) return undefined;

    let cancelled = false;

    const run = async () => {
      setJurisdictionStatus('loading');

      let homeId = nomineeHomeJurisdictionId(nominee);
      const hasArtwork = artworkCandidatesFor(nominee).length > 0;
      const canFetchDetails =
        Boolean(nominee.id) && (nominee.type === 'artist' || nominee.type === 'song');
      const needDetails = canFetchDetails && (!homeId || !nominee.genreId || !hasArtwork);

      setNomineeExtras({ ...EMPTY_EXTRAS, pending: needDetails });

      if (needDetails) {
        try {
          const url =
            nominee.type === 'artist'
              ? `/v1/users/profile/${nominee.id}`
              : `/v1/media/song/${nominee.id}`;
          const res = await apiCall({ method: 'get', url });
          if (cancelled) return;
          const d = res?.data || {};
          homeId = homeId || d.jurisdiction?.jurisdictionId || null;
          setNomineeExtras({
            genreId: d.genre?.genreId || null,
            artwork: toImageSrc(nominee.type === 'artist' ? d.photoUrl : d.artworkUrl),
            pending: false,
          });
        } catch (err) {
          if (cancelled) return;
          console.error('[VotingWizard] Could not load nominee details:', { nomineeId: nominee.id, err });
          setNomineeExtras(EMPTY_EXTRAS);
        }
      }

      if (!homeId) {
        console.error('[VotingWizard] Nominee jurisdiction unresolved — refusing to guess.', {
          nomineeId: nominee.id,
          type: nominee.type,
        });
        setJurisdictionOptions([]);
        setJurisdictionStatus('unresolved');
        return;
      }

      const [crumbRes, eligibleRes] = await Promise.allSettled([
        apiCall({ method: 'get', url: `/v1/jurisdictions/${homeId}/breadcrumb` }),
        apiCall({ method: 'get', url: '/v1/vote/eligible-jurisdictions' }),
      ]);
      if (cancelled) return;

      if (crumbRes.status !== 'fulfilled') {
        console.error('[VotingWizard] Failed to load nominee jurisdiction chain:', crumbRes.reason);
        setJurisdictionOptions([]);
        setJurisdictionStatus('unresolved');
        return;
      }

      // Breadcrumb is root → leaf; show most local first.
      const chain = (Array.isArray(crumbRes.value?.data) ? crumbRes.value.data : [])
        .filter((j) => j && j.jurisdictionId && j.votingEnabled !== false)
        .map((j) => ({ jurisdictionId: j.jurisdictionId, name: j.name }))
        .reverse();

      let options = chain;
      if (eligibleRes.status === 'fulfilled' && Array.isArray(eligibleRes.value?.data)) {
        const eligible = new Set(
          eligibleRes.value.data.map((j) => j?.jurisdictionId).filter(Boolean)
        );
        options = chain.filter((o) => eligible.has(o.jurisdictionId));
      } else {
        // Degraded mode: offer the nominee's chain; the server still validates
        // and returns a clear reason if this voter can't vote there.
        console.warn(
          '[VotingWizard] Could not load your eligible jurisdictions; server will validate.',
          eligibleRes.reason
        );
      }

      if (options.length === 0) {
        setJurisdictionOptions([]);
        setJurisdictionStatus(chain.length > 0 ? 'none' : 'unresolved');
        return;
      }

      setJurisdictionOptions(options);
      const preferred = [...preferredJurisdictionsRef.current, homeId];
      setSelectedJurisdictionId((prev) => {
        if (options.some((o) => o.jurisdictionId === prev)) return prev;
        const match = preferred.find((id) => options.some((o) => o.jurisdictionId === id));
        return match || options[0].jurisdictionId;
      });
      setJurisdictionStatus('ready');
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [show, nominee?.id, nominee?.type, reloadKey]);

  // --- ARTWORK: TRY EACH CANDIDATE UNTIL ONE LOADS ------------------------
  const artCandidates = useMemo(() => {
    const list = artworkCandidatesFor(selectedNominee);
    if (nomineeExtras.artwork && !list.includes(nomineeExtras.artwork)) {
      list.push(nomineeExtras.artwork);
    }
    // Hold the placeholder back while the details fetch might still find the
    // real image, so the user doesn't see the placeholder flash first.
    if (!nomineeExtras.pending && !list.includes(fallbackArtwork)) {
      list.push(fallbackArtwork);
    }
    return list;
  }, [selectedNominee, nomineeExtras.artwork, nomineeExtras.pending]);

  const artKey = JSON.stringify(artCandidates);

  useEffect(() => {
    if (!show) return undefined;

    let active = true;
    const list = JSON.parse(artKey);
    let i = 0;

    const tryNext = () => {
      if (!active) return;
      if (i >= list.length) {
        setArtworkSrc(null);
        setArtRGB(null);
        return;
      }
      const src = list[i];
      i += 1;
      const img = new Image();
      img.onload = () => {
        if (!active) return;
        setArtworkSrc(src);
        setArtRGB(dominantColor(img));
      };
      img.onerror = () => {
        if (!active) return;
        if (src !== fallbackArtwork) {
          console.warn('[VotingWizard] Artwork failed to load, trying next source:', src);
        }
        tryNext();
      };
      img.src = src;
    };

    tryNext();
    return () => {
      active = false;
    };
  }, [show, artKey]);

  // --- CLOSE (never mid-submit) -------------------------------------------
  // Closing while the request is in flight would hide the result — the vote
  // could count with the user never knowing, then a retry hits "Already Voted".
  const handleClose = () => {
    if (submittingRef.current) return;
    onClose?.();
  };

  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !showPhoneModal) handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- DERIVED ------------------------------------------------------------
  // Genre: the nominee's real UUID first, then fetched details, then the
  // page's filter. The label is derived from the SAME id that gets submitted,
  // so what the user sees is always what they vote in.
  const resolvedGenreId =
    selectedNominee?.genreId ||
    nomineeExtras.genreId ||
    GENRE_IDS[currentFilters.selectedGenre] ||
    GENRE_IDS[String(currentFilters.selectedGenre || '').toLowerCase()] ||
    null;
  const genreLabel = formatText(GENRE_NAMES[resolvedGenreId] || currentFilters.selectedGenre);

  const typeWord = formatText(currentFilters.selectedType); // "Song"
  const intervalKey = currentFilters.selectedInterval;
  const intervalNoun = INTERVAL_NOUN[intervalKey] || formatText(intervalKey);
  const category = `${typeWord} of the ${intervalNoun}`; // "Song of the week"

  // ONE VOTE, COUNTED UP THE CHAIN. The voter doesn't pick a jurisdiction:
  // the vote counts once in every open race the voter and the nominee share
  // (jurisdictionOptions, most local first). The server decides this itself
  // and ignores the jurisdictionId sent with the vote.
  const selectedJurisdictionName =
    jurisdictionOptions.length > 0 ? jurisdictionOptions.map((o) => o.name).join(' · ') : '…';

  // ★ AFTER A VOTE — the most local race it counts in, live.
  // GET /v1/awards/standings is the read-only live board (the vote itself
  // clears its cache on the server, so the new vote is already counted).
  // Ranks only — no scores on this screen.
  const raceJurisdiction = jurisdictionOptions[0] || null;
  const raceJurisdictionId = raceJurisdiction?.jurisdictionId || null;
  const voteType = currentFilters.selectedType;
  useEffect(() => {
    if (voteResult.status !== 'success') return undefined;
    const intervalId = INTERVAL_IDS[intervalKey];
    if (!raceJurisdictionId || !intervalId || !resolvedGenreId) {
      setRace({ status: 'none', entries: [], closesAt: null, timeZone: null });
      return undefined;
    }
    let cancelled = false;
    setRace((r) => ({ ...r, status: 'loading' }));
    apiCall({
      method: 'get',
      url: `/v1/awards/standings?type=${encodeURIComponent(voteType)}&jurisdictionId=${raceJurisdictionId}&genreId=${resolvedGenreId}&intervalId=${intervalId}&limit=50`,
      useCache: false,
    })
      .then((res) => {
        if (cancelled) return;
        const data = res.data || {};
        const live = data.state === 'LIVE';
        const all = Array.isArray(data.entries) ? data.entries : [];
        const mineIdx = all.findIndex((e) => String(e.targetId) === String(selectedNominee?.id));
        // Top three — or top two plus the pick, when the pick is further down.
        const shown = mineIdx >= 3 ? [...all.slice(0, 2), all[mineIdx]] : all.slice(0, 3);
        setRace({
          status: live && shown.length ? 'ready' : 'none',
          entries: shown.map((e) => ({
            rank: e.rank,
            id: e.targetId,
            name: e.name,
            artistName: e.artistName || null,
            art: e.artworkUrl ? toImageSrc(e.artworkUrl) : null,
            mine: String(e.targetId) === String(selectedNominee?.id),
          })),
          pickArtist: mineIdx >= 0 ? all[mineIdx].artistName || null : null,
          closesAt: live ? data.closesAt || null : null,
          timeZone: data.raceTimezone || null,
        });
        console.info('[VotingWizard] race loaded', { state: data.state, pickRank: mineIdx >= 0 ? all[mineIdx].rank : null });
      })
      .catch((err) => {
        if (cancelled) return;
        // The vote already counted — a missing board just hides the card.
        console.error('[VotingWizard] race standings failed:', err?.response?.status, err?.message);
        setRace({ status: 'none', entries: [], closesAt: null, timeZone: null });
      });
    return () => { cancelled = true; };
  }, [voteResult.status, raceJurisdictionId, intervalKey, resolvedGenreId, voteType, selectedNominee?.id]);

  // Problems the user should learn about on step 1 — before typing anything.
  let issue = null;
  if (isGuest) {
    issue = {
      kind: 'guest',
      title: 'Sign in to vote',
      body: 'Voting is for Unis members. Sign in or create a free account to cast your vote.',
      actionLabel: 'Sign in',
      onAction: () => {
        onClose?.();
        navigate('/login');
      },
    };
  } else if (user && !user.phoneVerified) {
    issue = {
      kind: 'phone',
      title: 'Verify your phone to vote',
      body: 'A quick phone check keeps voting fair — one person, one vote. It takes about a minute.',
      actionLabel: 'Verify phone',
      onAction: () => setShowPhoneModal(true),
    };
  } else if (jurisdictionStatus === 'unresolved') {
    issue = {
      kind: 'load',
      title: 'Couldn’t load this race',
      body: `We couldn’t confirm where ${nomineeName || 'this nominee'} can be voted on, so we won’t guess. Check your connection and try again.`,
      actionLabel: 'Try again',
      onAction: () => setReloadKey((k) => k + 1),
    };
  } else if (jurisdictionStatus === 'none') {
    issue = {
      kind: 'area',
      title: 'Outside your voting area',
      body: `You and ${nomineeName || 'this nominee'} aren’t in any open race together yet, so this vote can’t be counted. You can vote for artists and songs from your own area and the areas around it.`,
    };
  }

  const canProceed =
    !issue &&
    jurisdictionStatus === 'ready' &&
    Boolean(selectedJurisdictionId) &&
    Boolean(resolvedGenreId) &&
    Boolean(INTERVAL_IDS[intervalKey]);

  const forwardMatches =
    artistNameForward.trim().length > 0 &&
    normalizeName(artistNameForward) === normalizeName(nomineeName);
  const backwardMatches =
    artistNameBackward.trim().length > 0 &&
    normalizeName(artistNameBackward) === normalizeName(reversedNomineeName);
  const canSubmit = forwardMatches && backwardMatches && !submitting;

  const showArtwork = Boolean(artworkSrc);

  // --- NAV ----------------------------------------------------------------
  const handleNext = () => {
    if (step === 1 && !canProceed) return;
    setVoteResult({ status: 'idle', message: '' });
    if (step < TOTAL_STEPS) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  // --- SUBMIT -------------------------------------------------------------
  const handleConfirmVote = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setVoteResult({ status: 'idle', message: '' });

    if (!forwardMatches) {
      setVoteResult({
        status: 'error',
        message: 'Name Forward Invalid',
        details: 'The name entered forward does not match.',
      });
      return;
    }
    if (!backwardMatches) {
      setVoteResult({
        status: 'error',
        message: 'Name Backward Invalid',
        details: 'The name entered backward does not match.',
      });
      return;
    }

    if (!user?.phoneVerified) {
      setVoteResult({
        status: 'ineligible',
        message: isGuest ? 'Sign In Required' : 'Phone Not Verified',
        details: isGuest ? 'Sign in to vote.' : 'Verify your phone number to vote.',
      });
      return;
    }

    // Resolve every ID up front and refuse to send a doomed request. Each
    // missing piece gets its own named message.
    const genreId = resolvedGenreId;
    const jurisdictionId = jurisdictionOptions.some((o) => o.jurisdictionId === selectedJurisdictionId)
      ? selectedJurisdictionId
      : null;
    const intervalId = INTERVAL_IDS[intervalKey];

    const missing =
      (!genreId && 'genre') || (!jurisdictionId && 'jurisdiction') || (!intervalId && 'interval');
    if (missing) {
      console.error(`[VotingWizard] Vote blocked — unresolved ${missing}:`, {
        genreId, jurisdictionId, intervalId, filters: currentFilters, nomineeId: selectedNominee?.id,
      });
      setVoteResult({
        status: 'error',
        message: 'Vote Not Sent',
        details: `We couldn't identify this vote's ${missing}. Please close and reopen the wizard — if it keeps happening, contact support.`,
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const voteData = {
        userId,
        targetType: currentFilters.selectedType,
        targetId: selectedNominee.id,
        genreId,
        jurisdictionId,
        intervalId,
        // No voteDate — the server stamps the date in the platform timezone.
      };

      await apiCall({ method: 'post', url: '/v1/vote/submit', data: voteData });

      // Capture the EXACT running score for the takeover (before → after).
      const rawBefore =
        displayedScore ??
        user?.score ??
        user?.totalScore ??
        user?.points ??
        null;

      let scoreBefore = null;
      let scoreAfter = null;
      if (rawBefore != null && Number.isFinite(Number(rawBefore))) {
        scoreBefore = Number(rawBefore);
        scoreAfter = scoreBefore + VOTE_POINTS;
        setScoreTotal(scoreAfter); // keep the app-wide running total in sync
      }

      console.info('[VotingWizard] Vote recorded', {
        targetType: voteData.targetType,
        targetId: voteData.targetId,
        jurisdictionId,
        intervalId,
      });

      setVoteResult({
        status: 'success',
        message: 'Vote Recorded',
        points: VOTE_POINTS,
        scoreBefore,
        scoreAfter,
      });
    } catch (err) {
      const resp = err.response;
      const status = resp?.status;
      const data = resp?.data;
      // The backend sends {code, message} JSON; legacy plain-string bodies are
      // accepted too so no message is ever lost.
      const serverMsg =
        (data && typeof data === 'object' && (data.message || data.error))
        || (typeof data === 'string' && data.trim() ? data.trim() : '');

      console.error('Vote submission failed:', { status, serverMsg, data, err });

      if (!resp) {
        // ONLY a request that never reached the server is a connection problem.
        setVoteResult({
          status: 'network',
          message: 'Connection Failed',
          details: 'We could not reach the server. Check your connection and try again — your vote was not counted.',
        });
      } else if (status === 409) {
        setVoteResult({
          status: 'duplicate',
          message: 'Already Voted',
          details: serverMsg || 'You have already cast a vote in this category for this interval.',
        });
      } else if (status === 403) {
        setVoteResult({
          status: 'ineligible',
          message: 'Vote Rejected',
          details: serverMsg || 'You are not eligible to cast this vote.',
        });
      } else if (status >= 400 && status < 500) {
        setVoteResult({
          status: 'error',
          message: 'Vote Rejected',
          details: serverMsg || `The server rejected this vote (code ${status}). Please close the wizard and try again.`,
        });
      } else {
        setVoteResult({
          status: 'error',
          message: 'Server Error',
          details: serverMsg
            ? `${serverMsg} — your vote was not counted.`
            : `Something went wrong on our end (code ${status}). Your vote was not counted — please try again.`,
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // --- RESULT RENDER (errors) ---------------------------------------------
  const renderResult = () => {
    const { status, message, details } = voteResult;

    let iconColor = '#D85A3B';
    let IconSVG = null;

    switch (status) {
      case 'duplicate':
        iconColor = '#E0A93C';
        IconSVG = (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <motion.path
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke={iconColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={iconDraw}
              initial="hidden"
              animate="visible"
            />
          </svg>
        );
        break;
      case 'ineligible':
        IconSVG = (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <motion.g variants={iconDraw} initial="hidden" animate="visible">
              <circle cx="12" cy="12" r="9" stroke={iconColor} strokeWidth="2" fill="none" />
              <path d="M5.6 5.6l12.8 12.8" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
            </motion.g>
          </svg>
        );
        break;
      default:
        IconSVG = (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <motion.path
              d="M18 6L6 18M6 6l12 12"
              stroke={iconColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={iconDraw}
              initial="hidden"
              animate="visible"
            />
          </svg>
        );
    }

    // "Already voted" / "not eligible" won't change by retrying the same
    // race — send the user back to step 1 to pick another interval or area.
    const changeSelection = status === 'duplicate' || status === 'ineligible';

    return (
      <div className={`vw-result vw-result--${status}`} role="alert">
        <div className="vw-result__icon" style={{ borderColor: iconColor }}>
          {IconSVG}
        </div>
        <h2 className="vw-result__heading" style={{ color: iconColor }}>
          {message}
        </h2>
        <p className="vw-result__details">{details}</p>

        <div className="vw-actions vw-actions--center">
          <button
            className="vw-btn vw-btn--ghost"
            onClick={() => {
              setVoteResult({ status: 'idle' });
              if (changeSelection) {
                setDirection(-1);
                setStep(1);
              }
            }}
          >
            {changeSelection ? 'Change Selection' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  };

  // --- SUCCESS: VOTE CELEBRATION (★ redesigned Nov 2026) --------------------
  // About two seconds, no confetti (people vote every day). The pick gets a
  // check seal; "Counts in" lights up the races the vote counts in, most
  // local first; the race card shows where that race stands right now (ranks
  // only); one line of points; Share my pick (a story image) and Done.
  const weight = (INTERVAL_WEIGHTS.find((w) => w.key === intervalKey) || {}).weight || null;
  const resultsWhen = closeLabel(race.closesAt, race.timeZone, intervalKey);
  const isSongVote = voteType === 'song';
  const pickArtist = isSongVote
    ? (race.pickArtist || selectedNominee?.artistName || selectedNominee?.artist?.username
      || (typeof selectedNominee?.artist === 'string' ? selectedNominee.artist : null))
    : null;

  const shareMyPick = async () => {
    if (sharing) return;
    setSharing(true);
    const place = raceJurisdiction?.name || '';
    const vote = {
      kind: isSongVote ? 'song' : 'artist',
      name: nomineeName,
      artistName: pickArtist,
      award: category,
      place,
      genre: genreLabel,
      closes: `Voting for this ${intervalNoun} closes ${resultsWhen}`,
      artworkUrl: artworkSrc,
      themeColor: readThemePrimary(),
      logoSrc: activeLogo,
    };

    // The link carries the voter's referral code, so anyone who joins from
    // the share is credited to them.
    let link = `${window.location.origin}/${isSongVote ? 'song' : 'artist'}/${selectedNominee?.id}`;
    try {
      if (userId) {
        const res = await apiCall({ method: 'get', url: `/v1/users/profile-summary/${userId}` });
        const code = res.data?.referralCode;
        if (code) link += `?ref=${encodeURIComponent(code)}`;
      }
    } catch (err) {
      console.warn('[VotingWizard] referral code unavailable for share link:', err?.message);
    }
    const text = `I voted for ${nomineeName}${pickArtist ? ` by ${pickArtist}` : ''} for ${category}${place ? ` in ${place}` : ''} on Unis. Cast yours:`;

    let file = null;
    try {
      const canvas = document.createElement('canvas');
      await drawVoteCard(canvas, vote);
      const blob = await voteCardBlob(canvas);
      if (blob) file = new File([blob], voteCardFileName(vote), { type: 'image/png' });
    } catch (err) {
      console.error('[VotingWizard] share image failed, sharing the link instead:', err?.message);
    }

    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `My vote for ${category}`, text: `${text} ${link}` });
      } else if (navigator.share) {
        await navigator.share({ title: `My vote for ${category}`, text, url: link });
      } else {
        // Desktop browsers without a share sheet: save the image, copy the link.
        if (file) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(file);
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }
        try {
          await navigator.clipboard.writeText(`${text} ${link}`);
          feedback.success(file ? 'Image saved and link copied' : 'Link copied');
        } catch {
          feedback.success(file ? 'Image saved' : `Copy this link: ${link}`);
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('[VotingWizard] share failed:', err?.message);
        feedback.error("Couldn't open sharing. Try again.");
      }
    } finally {
      setSharing(false);
    }
  };

  const renderSuccessTakeover = () => {
    const { points = VOTE_POINTS, scoreAfter } = voteResult;
    const hasScore = typeof scoreAfter === 'number';
    const chain = jurisdictionOptions.length ? jurisdictionOptions : [];
    // Each "Counts in" node lights up 300ms after the last one.
    const nodeDelay = (i) => `${880 + i * 330}ms`;

    return (
      <div className="vw-cel" role="status" aria-live="polite">
        {showArtwork && (
          <div className="vw-cel__ambient" style={{ backgroundImage: `url("${artworkSrc}")` }} aria-hidden="true" />
        )}
        <div className="vw-cel__scrim" aria-hidden="true" />

        <div className="vw-cel__frame">
          <header className="vw-cel__top">
            <img src={activeLogo} alt="UNIS" className="vw-cel__logo" />
            <button className="vw-cel__close" onClick={handleClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          {/* The pick, sealed */}
          <div className={`vw-cel__pick ${isSongVote ? 'is-song' : ''}`}>
            <span className="vw-cel__ring" aria-hidden="true" />
            {showArtwork ? (
              <img src={artworkSrc} alt="" className="vw-cel__art" />
            ) : (
              <span className="vw-cel__art vw-cel__art--empty" aria-hidden="true" />
            )}
            <span className="vw-cel__seal" aria-hidden="true">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <span
                  key={a}
                  className="vw-cel__spark"
                  style={{
                    '--sx': `${Math.round(Math.cos((a * Math.PI) / 180) * 34)}px`,
                    '--sy': `${Math.round(Math.sin((a * Math.PI) / 180) * 34)}px`,
                  }}
                />
              ))}
              <span className="vw-cel__check">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
          </div>

          <div className="vw-cel__words">
            <p className="vw-cel__eyebrow vw-cel__in" style={{ '--d': '520ms' }}>Vote counted</p>
            <h2 className="vw-cel__head vw-cel__in" style={{ '--d': '600ms' }}>
              You backed <em className={nomineeName.length > 12 ? 'is-long' : ''}>{nomineeName}</em>
            </h2>
            <p className="vw-cel__race vw-cel__in" style={{ '--d': '680ms' }}>
              {category}{pickArtist ? ` · by ${pickArtist}` : genreLabel ? ` · ${genreLabel}` : ''}
            </p>
          </div>

          {chain.length > 0 && (
            <div className="vw-cel__card vw-cel__in" style={{ '--d': '780ms' }}>
              <div className="vw-cel__cardhead">
                <span className="vw-cel__label">Counts in</span>
                {weight && (
                  <span className="vw-cel__weight">
                    <b>+{weight}</b> to {isSongVote ? 'the song' : nomineeName} in each
                  </span>
                )}
              </div>
              <ol className="vw-cel__chain" style={{ '--n': chain.length }}>
                {chain.map((j, i) => (
                  <li key={j.jurisdictionId || j.name} className="vw-cel__node">
                    {i > 0 && (
                      <span className="vw-cel__line" aria-hidden="true">
                        <span className="vw-cel__linefill" style={{ '--d': `${880 + (i - 1) * 330 + 150}ms` }} />
                      </span>
                    )}
                    <span className="vw-cel__dot" style={{ '--d': nodeDelay(i) }} aria-hidden="true" />
                    <span className="vw-cel__place">{j.name}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {race.status === 'loading' && (
            <div className="vw-cel__card vw-cel__racecard is-loading" aria-hidden="true">
              <span className="vw-cel__skel" />
              <span className="vw-cel__skel" />
              <span className="vw-cel__skel" />
            </div>
          )}
          {race.status === 'ready' && (
            <div className="vw-cel__card vw-cel__racecard vw-cel__in" style={{ '--d': '1650ms' }}>
              <div className="vw-cel__cardhead">
                <span className="vw-cel__racetitle">{raceJurisdiction?.name} right now</span>
                <span className="vw-cel__closes">Results {resultsWhen}</span>
              </div>
              <ol className="vw-cel__board">
                {race.entries.map((e) => (
                  <li key={e.id} className={`vw-cel__row ${e.mine ? 'is-mine' : ''}`}>
                    <span className="vw-cel__rank">{e.rank}</span>
                    {e.art ? (
                      <img src={e.art} alt="" className={`vw-cel__thumb ${isSongVote ? 'is-song' : ''}`} />
                    ) : (
                      <span className={`vw-cel__thumb vw-cel__thumb--empty ${isSongVote ? 'is-song' : ''}`} aria-hidden="true" />
                    )}
                    <span className="vw-cel__name">
                      {e.name}{isSongVote && e.artistName ? ` · ${e.artistName}` : ''}
                    </span>
                    {e.mine && <span className="vw-cel__tag">Your pick</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {race.status === 'none' && (
            <p className="vw-cel__closesline vw-cel__in" style={{ '--d': '900ms' }}>Results {resultsWhen}</p>
          )}

          <div className="vw-cel__spacer" />

          <p className="vw-cel__points vw-cel__in" style={{ '--d': '1900ms' }}>
            <b>+{points} points</b> for you{hasScore ? <> · score {formatScore(scoreAfter)}</> : null}
          </p>
          <div className="vw-cel__actions vw-cel__in" style={{ '--d': '1950ms' }}>
            <button type="button" className="vw-cel__btn vw-cel__btn--ghost" onClick={shareMyPick} disabled={sharing}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 15V4" />
                <path d="M8 8l4-4 4 4" />
                <path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" />
              </svg>
              {sharing ? 'Making image…' : 'Share my pick'}
            </button>
            <button
              type="button"
              className="vw-cel__btn vw-cel__btn--solid"
              onClick={() => onVoteSuccess?.(selectedNominee?.id)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- STEP RENDER --------------------------------------------------------
  const renderIssue = () => {
    if (!issue) return null;
    return (
      <div className={`vw-notice vw-notice--${issue.kind}`} role="status">
        <span className="vw-notice__dot" aria-hidden="true" />
        <div className="vw-notice__text">
          <strong>{issue.title}</strong>
          <p>{issue.body}</p>
        </div>
        {issue.actionLabel && (
          <button type="button" className="vw-notice__btn" onClick={issue.onAction}>
            {issue.actionLabel}
          </button>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    if (!selectedNominee) return null;

    switch (step) {
      case 1:
        return (
          <div className="vw-step">
            <div className="vw-step__head">
              <div className="vw-step__head-main">
                <span className="vw-eyebrow">Step 1 — Review</span>
                <h2 className="vw-title">Confirm your vote for</h2>
                <h1 className="vw-nominee">{nomineeName}</h1>
              </div>
              <div className={`vw-thumb ${showArtwork ? '' : 'vw-thumb--loading'}`}>
                {showArtwork && <img src={artworkSrc} alt={nomineeName} />}
              </div>
            </div>

            {renderIssue()}

            <div className="vw-fields">
              <div className="vw-field">
                <label>Genre</label>
                <div className="vw-chip vw-chip--locked">{genreLabel}</div>
              </div>
              <div className="vw-field">
                <label>Category</label>
                <div className="vw-chip vw-chip--locked">{typeWord}</div>
              </div>
              <div className="vw-field">
                <label htmlFor="vw-interval">Interval</label>
                <select
                  id="vw-interval"
                  className="vw-select"
                  value={currentFilters.selectedInterval}
                  onChange={(e) =>
                    setCurrentFilters({ ...currentFilters, selectedInterval: e.target.value })
                  }
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="vw-field">
<label id="vw-counts-in-label">Counts in</label>
                <div className="vw-select" role="note" aria-labelledby="vw-counts-in-label">
                  {jurisdictionStatus === 'loading' ? 'Loading…' : selectedJurisdictionName}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="vw-step">
            <span className="vw-eyebrow">Step 2 — Confirm</span>
            <h2 className="vw-title">Final confirmation</h2>

            <div className="vw-summary">
              <div className="vw-summary__row">
                <span>Nominee</span>
                <strong>{nomineeName}</strong>
              </div>
              <div className="vw-summary__row">
                <span>As</span>
                <strong>{category}</strong>
              </div>
              <div className="vw-summary__row">
                <span>Counts in</span>
                <strong>{selectedJurisdictionName}</strong>
              </div>
              <div className="vw-summary__row">
                <span>Genre</span>
                <strong>{genreLabel}</strong>
              </div>
            </div>

            <p className="vw-warning">
              <span className="vw-warning__dot" />
              This vote cannot be undone for the selected interval.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="vw-step">
            <span className="vw-eyebrow">Step 3 — Secure</span>
            <h2 className="vw-title">
              Type the name <em>forward</em> and <em>backward</em>
            </h2>
            <p className="vw-sub">A small check to prevent mistaken votes.</p>

            <form onSubmit={handleConfirmVote} className="vw-form">
              <div className={`vw-input-group ${forwardMatches ? 'vw-input-group--match' : ''}`}>
                <div className="vw-input-meta">
                  <label htmlFor="vw-name-forward">Forward</label>
                  <span className="vw-ref">{nomineeName}</span>
                </div>
                <div className="vw-input-wrap">
                  <input
                    id="vw-name-forward"
                    type="text"
                    value={artistNameForward}
                    onChange={(e) => setArtistNameForward(e.target.value)}
                    placeholder="Type the name…"
                    disabled={submitting}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    enterKeyHint="next"
                  />
                  {forwardMatches && (
                    <span className="vw-check" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </div>
              </div>

              <div className={`vw-input-group ${backwardMatches ? 'vw-input-group--match' : ''}`}>
                <div className="vw-input-meta">
                  <label htmlFor="vw-name-backward">Backward</label>
                  <span className="vw-ref vw-ref--reverse">{reversedNomineeName}</span>
                </div>
                <div className="vw-input-wrap">
                  <input
                    id="vw-name-backward"
                    type="text"
                    value={artistNameBackward}
                    onChange={(e) => setArtistNameBackward(e.target.value)}
                    placeholder="Type the name reversed…"
                    disabled={submitting}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    enterKeyHint="done"
                  />
                  {backwardMatches && (
                    <span className="vw-check" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className={`vw-btn vw-btn--primary vw-btn--full ${submitting ? 'vw-btn--loading' : ''}`}
                disabled={!canSubmit}
              >
                {submitting ? 'Submitting…' : 'Cast Vote'}
              </button>
            </form>
          </div>
        );

      default:
        return null;
    }
  };

  const isResult = voteResult.status !== 'idle';
  const stepVariants = direction >= 0 ? stepVariantsForward : stepVariantsBackward;

  const modalStyle = artRGB ? { '--vw-art': artRGB.join(', ') } : undefined;

  // Visitors (joined from outside an open area) vote once their own city
  // opens. The server refuses their vote too (VISITOR_NO_VOTE); this says why
  // before they fill anything in, and offers their referral code instead.
  if (show && user?.visitor) {
    return <VisitorLockSheet kind="vote" nomineeName={nomineeName} onClose={onClose} />;
  }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            className="vw-overlay"
            key="vw-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleClose}
          >
            <motion.div
              className={`vw-modal ${voteResult.status === 'success' ? 'vw-modal--success' : ''}`}
              style={modalStyle}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={nomineeName ? `Vote for ${nomineeName}` : 'Vote'}
            >
              {voteResult.status === 'success' ? (
                renderSuccessTakeover()
              ) : (
                <>
                  {/* Ambient artwork wash — blurred copy of the cover/photo */}
                  {showArtwork && (
                    <div
                      className="vw-ambient"
                      style={{ backgroundImage: `url("${artworkSrc}")` }}
                      aria-hidden="true"
                    />
                  )}

                  <div className="vw-modal__inner">
                    {/* Header */}
                    <header className="vw-header">
                      <div className="vw-brand">
                        <img src={activeLogo} alt="UNIS" className="vw-brand__logo" />
                        <span className="vw-brand__step">
                          {isResult ? 'Result' : `${step} of ${TOTAL_STEPS}`}
                        </span>
                      </div>
                      <button
                        className="vw-close"
                        onClick={handleClose}
                        aria-label="Close"
                        disabled={submitting}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </header>

                    {/* Progress rail */}
                    {!isResult && (
                      <div
                        className="vw-progress"
                        role="progressbar"
                        aria-valuenow={step}
                        aria-valuemin={1}
                        aria-valuemax={TOTAL_STEPS}
                      >
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className={`vw-progress__seg ${n <= step ? 'vw-progress__seg--active' : ''}`}
                          >
                            <motion.div
                              className="vw-progress__fill"
                              initial={false}
                              animate={{ scaleX: n <= step ? 1 : 0 }}
                              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                              style={{ transformOrigin: 'left center' }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Body */}
                    <div className="vw-body">
                      <AnimatePresence mode="wait" custom={direction}>
                        {isResult ? (
                          <motion.div
                            key="result"
                            variants={stepVariantsForward}
                            initial="enter"
                            animate="center"
                            exit="exit"
                          >
                            {renderResult()}
                          </motion.div>
                        ) : (
                          <motion.div
                            key={`step-${step}`}
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                          >
                            {renderStepContent()}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Footer */}
                    {!isResult && step < 3 && (
                      <footer className="vw-footer">
                        {step > 1 ? (
                          <button onClick={handleBack} className="vw-btn vw-btn--ghost" disabled={submitting}>
                            Back
                          </button>
                        ) : (
                          <div />
                        )}
                        <button
                          onClick={handleNext}
                          className="vw-btn vw-btn--primary"
                          disabled={step === 1 && !canProceed}
                        >
                          Next
                        </button>
                      </footer>
                    )}

                    {!isResult && step === 3 && (
                      <footer className="vw-footer">
                        <button onClick={handleBack} className="vw-btn vw-btn--ghost" disabled={submitting}>
                          Back
                        </button>
                        <span className="vw-footer__hint">
                          {!forwardMatches || !backwardMatches ? 'Type both names exactly to enable' : 'Ready to cast'}
                        </span>
                      </footer>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rendered OUTSIDE the animated modal: the modal's transform would
          otherwise trap this fixed-position sheet inside the wizard's box. */}
      <PhoneVerificationModal
        show={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onVerified={async () => {
          setShowPhoneModal(false);
          try {
            await refreshUser?.();
          } catch (e) {
            console.error('[VotingWizard] refreshUser after phone verification failed:', e);
          }
        }}
      />
    </>
  );
};

export default VotingWizard;