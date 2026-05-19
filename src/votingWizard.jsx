import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { apiCall } from './components/axiosInstance';
import { useReward } from './context/RewardContext';
import { useAuth } from './context/AuthContext';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import { buildUrl } from './utils/buildUrl';
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
// Artwork resolver.
//
// The nominee object's shape depends on WHERE the wizard was opened:
//   - From voteawards.jsx it's normalized and has `imageUrl` (already
//     absolute, via buildUrl).
//   - From the home/song/artist pages it's often the raw entity, where the
//     field is `artworkUrl` (song) or `photoUrl` (artist) and the path is
//     RELATIVE.
//
// So: pick the first present field, and only run buildUrl when the value
// isn't already absolute (avoids double-prefixing the voteawards URL).
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

function resolveArtwork(n) {
  if (!n) return null;
  let raw = null;
  for (const k of ARTWORK_KEYS) {
    if (n[k] && typeof n[k] === 'string') {
      raw = n[k];
      break;
    }
  }
  // Nested fallbacks some payloads use (e.g. n.song.artworkUrl)
  if (!raw) {
    const nested = n.song || n.track || n.artistProfile || n.user || null;
    if (nested) {
      for (const k of ARTWORK_KEYS) {
        if (nested[k] && typeof nested[k] === 'string') {
          raw = nested[k];
          break;
        }
      }
    }
  }
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw; // already absolute
  try {
    return buildUrl(raw);
  } catch (e) {
    return raw;
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

const VotingWizard = ({ show, onClose, onVoteSuccess, nominee, userId, filters }) => {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [currentFilters, setCurrentFilters] = useState({
    selectedGenre: 'rap-hiphop',
    selectedType: 'artist',
    selectedInterval: 'daily',
    selectedJurisdiction: 'harlem',
  });
  const { showReward } = useReward();
  const { theme } = useAuth();
  const activeLogo = LOGO_MAP[theme] || logoblue;

  const [artistNameForward, setArtistNameForward] = useState('');
  const [artistNameBackward, setArtistNameBackward] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [eligibleJurisdictionIds, setEligibleJurisdictionIds] = useState([]);
  const [isFetchingJurisdictions, setIsFetchingJurisdictions] = useState(false);
  const [voteResult, setVoteResult] = useState({ status: 'idle', message: '', details: '' });

  // Dominant color pulled from the artwork — tints the ambient glow, the
  // thumbnail ring, and the modal accent. "R, G, B"; null → theme fallback.
  const [artRGB, setArtRGB] = useState(null);
  // Whether the artwork actually loaded (false → hide thumb/ambient cleanly).
  const [artworkFailed, setArtworkFailed] = useState(false);
  const prevShowRef = useRef(false);
  const latestRef = useRef({ nominee, filters });
  latestRef.current = { nominee, filters };

  const selectedNominee = nominee;

  // Resolve the artwork URL once per nominee, regardless of field name.
  const artworkUrl = useMemo(() => resolveArtwork(selectedNominee), [selectedNominee]);

  const reversedNomineeName = useMemo(
    () => (selectedNominee ? selectedNominee.name.split('').reverse().join('') : ''),
    [selectedNominee]
  );

  const getKeyFromId = (id) =>
    Object.keys(JURISDICTION_IDS).find((k) => JURISDICTION_IDS[k] === id);

  // --- DIAGNOSTIC ---------------------------------------------------------
  // If the wizard is open with a nominee but we couldn't resolve any
  // artwork, log exactly what keys the nominee DOES have so the missing
  // field can be added (to the payload or to ARTWORK_KEYS above).
  useEffect(() => {
    if (show && selectedNominee && !artworkUrl) {
      console.warn(
        '[VotingWizard] No artwork could be resolved for this nominee. ' +
          'The ambient background and thumbnail need an image URL. ' +
          'Nominee keys present:',
        Object.keys(selectedNominee),
        '\nFull nominee object:',
        selectedNominee
      );
    } else if (show && artworkUrl) {
      console.debug('[VotingWizard] Resolved artwork URL:', artworkUrl);
    }
  }, [show, selectedNominee, artworkUrl]);

  // --- RESET STATE ONLY ON OPEN TRANSITION --------------------------------
  useEffect(() => {
    if (show && !prevShowRef.current) {
      const { nominee: n, filters: f } = latestRef.current;
      const homeKey = getKeyFromId(n?.jurisdiction?.jurisdictionId);

      setStep(1);
      setDirection(1);
      setVoteResult({ status: 'idle', message: '', details: '' });
      setArtistNameForward('');
      setArtistNameBackward('');
      setSubmitting(false);
      setEligibleJurisdictionIds([]);
      setCurrentFilters({
        selectedGenre: n?.genreKey || f?.selectedGenre || 'rap-hiphop',
        selectedType: n?.type || f?.selectedType || 'artist',
        selectedInterval: f?.selectedInterval || 'daily',
        selectedJurisdiction: homeKey || f?.selectedJurisdiction || 'harlem',
      });
    }
    prevShowRef.current = show;
  }, [show]); // ← only `show` — DO NOT add `nominee` or `filters` here

  // --- LOAD ARTWORK + EXTRACT DOMINANT COLOR ------------------------------
  useEffect(() => {
    setArtworkFailed(false);

    if (!show || !artworkUrl) {
      setArtRGB(null);
      return;
    }

    let active = true;
    const img = new Image();

    img.onload = () => {
      if (!active) return;

      try {
        const SIZE = 20;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;

        const ctx = canvas.getContext('2d');
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

        if (n === 0) {
          setArtRGB(null);
          return;
        }

        let R = r / n;
        let G = g / n;
        let B = b / n;

        const avg = (R + G + B) / 3;
        const lift = 1.28;

        R = Math.max(0, Math.min(255, avg + (R - avg) * lift));
        G = Math.max(0, Math.min(255, avg + (G - avg) * lift));
        B = Math.max(0, Math.min(255, avg + (B - avg) * lift));

        setArtRGB([Math.round(R), Math.round(G), Math.round(B)]);
      } catch (e) {
        // This can happen when the image loads visually but the canvas is tainted.
        // Keep the artwork visible and simply fall back to the theme color.
        setArtRGB(null);
      }
    };

    img.onerror = () => {
      if (!active) return;

      setArtworkFailed(true);
      setArtRGB(null);
      console.warn('[VotingWizard] Artwork failed to load:', artworkUrl);
    };

    img.src = artworkUrl;

    return () => {
      active = false;
    };
  }, [show, artworkUrl]);

  // --- FETCH ELIGIBLE JURISDICTIONS (BREADCRUMB) --------------------------
  useEffect(() => {
    if (!show || !nominee) return;

    let cancelled = false;

    const fetchEligibleJurisdictions = async () => {
      setIsFetchingJurisdictions(true);

      let nomineeJurisdictionId = null;

      if (nominee.jurisdiction) {
        if (typeof nominee.jurisdiction === 'object' && nominee.jurisdiction.jurisdictionId) {
          nomineeJurisdictionId = nominee.jurisdiction.jurisdictionId;
        } else if (typeof nominee.jurisdiction === 'string') {
          const slug = nominee.jurisdiction.toLowerCase().replace(/\s+/g, '-');
          nomineeJurisdictionId = JURISDICTION_IDS[slug];
        }
      }

      if (!nomineeJurisdictionId && nominee.id && nominee.type) {
        try {
          const endpoint =
            nominee.type === 'artist'
              ? `/v1/users/${nominee.id}`
              : `/v1/media/song/${nominee.id}`;
          const response = await apiCall({ method: 'get', url: endpoint });
          const fetchedJurisdiction = response.data.jurisdiction;
          if (fetchedJurisdiction?.jurisdictionId) {
            nomineeJurisdictionId = fetchedJurisdiction.jurisdictionId;
          }
        } catch (err) {
          console.error('Failed to fetch nominee details for jurisdiction:', err);
        }
      }

      if (cancelled) return;

      if (!nomineeJurisdictionId) {
        setEligibleJurisdictionIds(Object.values(JURISDICTION_IDS));
        setIsFetchingJurisdictions(false);
        return;
      }

      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${nomineeJurisdictionId}/breadcrumb`,
        });
        if (cancelled) return;

        const eligibleIds = response.data
          .filter((j) => j.votingEnabled !== false)
          .map((j) => j.jurisdictionId);

        setEligibleJurisdictionIds(eligibleIds);

        setCurrentFilters((prev) => {
          const currentId = JURISDICTION_IDS[prev.selectedJurisdiction];
          if (currentId && !eligibleIds.includes(currentId)) {
            const homeKey = getKeyFromId(nomineeJurisdictionId);
            if (homeKey) return { ...prev, selectedJurisdiction: homeKey };
          }
          return prev;
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch eligible jurisdictions:', err);

        const homeKey = getKeyFromId(nomineeJurisdictionId);
        let fallback = [];
        if (homeKey === 'downtown-harlem' || homeKey === 'uptown-harlem') {
          fallback = [JURISDICTION_IDS[homeKey], JURISDICTION_IDS['harlem']];
        } else if (homeKey === 'harlem') {
          fallback = [JURISDICTION_IDS['harlem']];
        } else {
          fallback = Object.values(JURISDICTION_IDS);
        }
        setEligibleJurisdictionIds(fallback);
      } finally {
        if (!cancelled) setIsFetchingJurisdictions(false);
      }
    };

    fetchEligibleJurisdictions();
    return () => {
      cancelled = true;
    };
  }, [show, nominee?.id]);

  const isJurisdictionEligible = (optionKey) => {
    if (isFetchingJurisdictions) return false;
    if (eligibleJurisdictionIds.length === 0) return true;
    return eligibleJurisdictionIds.includes(JURISDICTION_IDS[optionKey]);
  };

  // --- CONFETTI ON SUCCESS ------------------------------------------------
  useEffect(() => {
    if (voteResult.status === 'success') triggerFireworks();
  }, [voteResult.status]);

  const triggerFireworks = () => {
    const duration = 2200;
    const animationEnd = Date.now() + duration;
    const palette = artRGB
      ? [`rgb(${artRGB.join(',')})`, '#ffffff', '#C0C0C0', '#163387']
      : ['#163387', '#3a5fcf', '#C0C0C0', '#ffffff'];
    const defaults = {
      startVelocity: 28,
      spread: 360,
      ticks: 70,
      zIndex: 99999,
      colors: palette,
    };
    const rand = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 40 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 220);
  };

  // --- NAV ----------------------------------------------------------------
  const handleNext = () => {
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
    setVoteResult({ status: 'idle', message: '' });

    if (artistNameForward.toLowerCase() !== selectedNominee.name.toLowerCase()) {
      setVoteResult({
        status: 'error',
        message: 'Name Forward Invalid',
        details: 'The name entered forward does not match.',
      });
      return;
    }
    if (artistNameBackward.toLowerCase() !== reversedNomineeName.toLowerCase()) {
      setVoteResult({
        status: 'error',
        message: 'Name Backward Invalid',
        details: 'The name entered backward does not match.',
      });
      return;
    }

    setSubmitting(true);

    try {
      const voteData = {
        userId,
        targetType: currentFilters.selectedType,
        targetId: selectedNominee.id,
        genreId: GENRE_IDS[currentFilters.selectedGenre],
        jurisdictionId: JURISDICTION_IDS[currentFilters.selectedJurisdiction],
        intervalId: INTERVAL_IDS[currentFilters.selectedInterval],
        voteDate: new Date().toISOString().split('T')[0],
      };

      await apiCall({ method: 'post', url: '/v1/vote/submit', data: voteData });

      setVoteResult({ status: 'success', message: 'Vote Recorded' });

      showReward({
        points: 25,
        label: 'Vote counted',
        type: 'vote',
        anchor: 'center',
      });
    } catch (err) {
      console.error('Vote submission failed:', err);
      const status = err.response?.status;
      if (status === 409) {
        setVoteResult({
          status: 'duplicate',
          message: 'Already Voted',
          details: 'You have already cast a vote in this category for this interval.',
        });
      } else if (status === 403) {
        setVoteResult({
          status: 'ineligible',
          message: 'Vote Rejected',
          details: 'You are not eligible to vote in this jurisdiction.',
        });
      } else {
        setVoteResult({
          status: 'network',
          message: 'Connection Failed',
          details: 'We could not reach the server. Please try again.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatText = (str) =>
    str ? str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

  const forwardMatches =
    artistNameForward.length > 0 &&
    artistNameForward.toLowerCase() === (selectedNominee?.name || '').toLowerCase();
  const backwardMatches =
    artistNameBackward.length > 0 &&
    artistNameBackward.toLowerCase() === reversedNomineeName.toLowerCase();
  const canSubmit = forwardMatches && backwardMatches && !submitting;

  const showArtwork = Boolean(artworkUrl) && !artworkFailed;

  // --- RESULT RENDER ------------------------------------------------------
  const renderResult = () => {
    const { status, message, details } = voteResult;

    let iconColor = '#163387';
    let IconSVG = null;

    switch (status) {
      case 'success':
        iconColor = artRGB ? `rgb(${artRGB.join(',')})` : '#163387';
        IconSVG = (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <motion.path
              d="M20 6L9 17l-5-5"
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
        break;
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
        iconColor = '#D85A3B';
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
        iconColor = '#D85A3B';
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

    return (
      <div className={`vw-result vw-result--${status}`}>
        <div className="vw-result__icon" style={{ borderColor: iconColor }}>
          {IconSVG}
        </div>
        <h2 className="vw-result__heading" style={{ color: iconColor }}>
          {message}
        </h2>

        {status === 'success' ? (
          <div className="vw-receipt">
            <span className="vw-receipt__label">Confirmed Nominee</span>
            <h3 className="vw-receipt__name">{selectedNominee.name}</h3>
            <div className="vw-receipt__rule" />
            <div className="vw-receipt__grid">
              <div>
                <span>Type</span>
                <strong>{formatText(currentFilters.selectedType)}</strong>
              </div>
              <div>
                <span>Interval</span>
                <strong>{formatText(currentFilters.selectedInterval)}</strong>
              </div>
              <div>
                <span>Genre</span>
                <strong>{formatText(currentFilters.selectedGenre)}</strong>
              </div>
              <div>
                <span>Jurisdiction</span>
                <strong>{formatText(currentFilters.selectedJurisdiction)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <p className="vw-result__details">{details}</p>
        )}

        <div className="vw-actions vw-actions--center">
          {status === 'success' ? (
            <button className="vw-btn vw-btn--primary" onClick={() => onVoteSuccess(selectedNominee.id)}>
              Done
            </button>
          ) : (
            <button
              className="vw-btn vw-btn--ghost"
              onClick={() => setVoteResult({ status: 'idle' })}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  };

  // --- STEP RENDER --------------------------------------------------------
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
                <h1 className="vw-nominee">{selectedNominee.name}</h1>
              </div>
              {showArtwork && (
                <div className="vw-thumb">
                  <img
                    src={artworkUrl}
                    alt={selectedNominee.name}
                    onError={() => setArtworkFailed(true)}
                  />
                </div>
              )}
            </div>

            <div className="vw-fields">
              <div className="vw-field">
                <label>Genre</label>
                <div className="vw-chip vw-chip--locked">{formatText(currentFilters.selectedGenre)}</div>
              </div>
              <div className="vw-field">
                <label>Category</label>
                <div className="vw-chip vw-chip--locked">{formatText(currentFilters.selectedType)}</div>
              </div>
              <div className="vw-field">
                <label>Interval</label>
                <select
                  className="vw-select"
                  value={currentFilters.selectedInterval}
                  onChange={(e) =>
                    setCurrentFilters({ ...currentFilters, selectedInterval: e.target.value })
                  }
                >
                  <option value="daily">Day</option>
                  <option value="weekly">Week</option>
                  <option value="monthly">Month</option>
                  <option value="quarterly">Quarter</option>
                  <option value="annual">Year</option>
                </select>
              </div>
              <div className="vw-field">
                <label>Jurisdiction</label>
                <select
                  className="vw-select"
                  value={currentFilters.selectedJurisdiction}
                  onChange={(e) =>
                    setCurrentFilters({ ...currentFilters, selectedJurisdiction: e.target.value })
                  }
                  disabled={isFetchingJurisdictions}
                >
                  {isFetchingJurisdictions ? (
                    <option>Loading…</option>
                  ) : (
                    Object.keys(JURISDICTION_IDS)
                      .filter(isJurisdictionEligible)
                      .map((key) => (
                        <option key={key} value={key}>
                          {formatText(key)}
                        </option>
                      ))
                  )}
                </select>
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
                <strong>{selectedNominee.name}</strong>
              </div>
              <div className="vw-summary__row">
                <span>As</span>
                <strong>
                  {formatText(currentFilters.selectedType)} of the {formatText(currentFilters.selectedInterval)}
                </strong>
              </div>
              <div className="vw-summary__row">
                <span>In</span>
                <strong>{formatText(currentFilters.selectedJurisdiction)}</strong>
              </div>
              <div className="vw-summary__row">
                <span>Genre</span>
                <strong>{formatText(currentFilters.selectedGenre)}</strong>
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
                  <label>Forward</label>
                  <span className="vw-ref">{selectedNominee.name}</span>
                </div>
                <div className="vw-input-wrap">
                  <input
                    type="text"
                    value={artistNameForward}
                    onChange={(e) => setArtistNameForward(e.target.value)}
                    placeholder="Type the name…"
                    disabled={submitting}
                    autoComplete="off"
                    spellCheck="false"
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
                  <label>Backward</label>
                  <span className="vw-ref vw-ref--reverse">{reversedNomineeName}</span>
                </div>
                <div className="vw-input-wrap">
                  <input
                    type="text"
                    value={artistNameBackward}
                    onChange={(e) => setArtistNameBackward(e.target.value)}
                    placeholder="Type the name reversed…"
                    disabled={submitting}
                    autoComplete="off"
                    spellCheck="false"
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

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="vw-overlay"
          key="vw-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={`vw-modal ${voteResult.status === 'success' ? 'vw-modal--success' : ''}`}
            style={modalStyle}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient artwork wash — blurred copy of the cover/photo */}
            {showArtwork && (
              <div
                className="vw-ambient"
                style={{ backgroundImage: `url("${artworkUrl}")` }}
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
                <button className="vw-close" onClick={onClose} aria-label="Close">
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
                  <button onClick={handleNext} className="vw-btn vw-btn--primary">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VotingWizard;