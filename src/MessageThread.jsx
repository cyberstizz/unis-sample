// src/MessageThread.jsx
// One conversation. FOMO-inspired look on the two-lane backend, rebuilt for
// feel (Oct 2026 premium pass):
//
//   Speed     • send as fast as you type — every message gets its own bubble
//               right away and they deliver in order behind the scenes
//             • a failed message stays put: "Not delivered · Tap to retry"
//             • reactions show instantly; double-tap drops a heart burst
//             • threads you've opened reopen instantly (utils/dmThreads)
//   History   • older messages page in as you scroll up, without the view
//               jumping; the conversation starts with an intro card
//             • new messages never yank you down while you're reading back —
//               a "↓ New messages" pill appears instead
//   Touch     • long-press a bubble (or right-click on desktop) for the
//               reaction bar + Copy; the bubble squeezes while you hold
//             • swipe left to see each message's time (hover on desktop)
//             • vibration on Android, soft sounds muted while music plays
//   Phone     • full-screen (MessagePage), now-playing chip in the header
//
// Plays go through requestPlay → PlayChoiceModal; the Player counts them.
import React, {
  useState, useEffect, useLayoutEffect, useRef, useCallback, useContext, useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import { PlayerContext } from './context/playercontext';
import { fetchStandings } from './utils/standings';
import {
  getThread, putThread, fetchLatest, fetchOlder, parseServerTime, PAGE_SIZE, THREAD_FRESH_MS,
} from './utils/dmThreads';
import { haptic, playSound, primeSound } from './utils/dmFeedback';
import useLingering from './hooks/useLingering';
import SupportSheet from './SupportSheet';
import MessagePickerSheet from './MessagePickerSheet';
import {
  ArrowBackIcon, ArrowDownIcon, MoreIcon, ShareSongIcon, SupportIcon, SendIcon,
  ReactIcon, CopyIcon, RetryIcon, CloseIcon, FindIcon, NoteIcon, PlayGlyph, PauseGlyph,
} from './icons/UnisIcons';

const GROUP_GAP_MS = 5 * 60 * 1000;    // bubbles closer than this stack together
const SITTING_GAP_MS = 60 * 60 * 1000;  // a longer gap gets a time divider
const TYPING_RESEND_MS = 3000;          // re-announce "typing" at most this often
const TYPING_IDLE_MS = 4000;            // stop "typing" after this long idle
const PRESS_SHOW_MS = 110;              // bubble starts to squeeze
const LONG_PRESS_MS = 420;              // reaction bar opens
const DOUBLE_TAP_MS = 280;
const MOVE_CANCEL_PX = 9;
const NEAR_BOTTOM_PX = 96;              // "at the bottom" for auto-scroll
const LOAD_OLDER_PX = 260;              // start loading older this close to the top
const JUMP_SHOW_PX = 640;               // show the ↓ pill this far up
const REVEAL_MAX_PX = 68;               // swipe-left distance that shows times
const ECHO_WINDOW_MS = 2 * 60 * 1000;   // a server copy of my temp must be this recent
const TOAST_MS = 3600;
const BURST_MS = 820;

// Same set, same order as MessagingService.REACTIONS
const HEART = '❤️';
const REACTIONS = [HEART, '🔥', '😂', '😮', '😢', '👏'];
const REPORT_REASONS = ['Spam', 'Harassment or bullying', 'Something else'];

const keyOf = (m) => m._key || m.id;
const timeOf = (m) => parseServerTime(m.createdAt).getTime();

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clock(iso) {
  return parseServerTime(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function pillLabel(iso) {
  const d = parseServerTime(iso);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `Today ${clock(iso)}`;
  if (sameDay(d, yesterday)) return `Yesterday ${clock(iso)}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${clock(iso)}`;
}

function money(cents) {
  const value = (Number(cents) || 0) / 100;
  const [whole, frac] = value.toFixed(2).split('.');
  return { whole: `$${Number(whole).toLocaleString('en-US')}`, frac: `.${frac}` };
}

/** Is `server` the saved copy of my still-sending temp? */
function matchesTemp(temp, server) {
  return temp._temp && temp._status === 'sending'
    && temp.senderId === server.senderId
    && (temp.body || '') === (server.body || '')
    && String(temp.sharedSongId ?? '') === String(server.sharedSongId ?? '')
    && String(temp.supportPaymentId ?? '') === String(server.supportPaymentId ?? '')
    && timeOf(server) >= timeOf(temp) - ECHO_WINDOW_MS;
}

/**
 * Fold the newest server page into what's on screen: keep older pages already
 * loaded, let still-sending temps adopt their saved copies (same key, so
 * nothing re-animates), and keep failed temps. `gap` means more than a page
 * arrived since we last looked, so older cached messages can't be trusted
 * to connect.
 */
function mergeLatest(prev, latest) {
  const claimed = new Set();
  const adopted = new Map();
  const temps = [];
  prev.forEach((t) => {
    if (!t._temp) return;
    const hit = t._status === 'sending' && latest.find((s) => !claimed.has(s.id) && matchesTemp(t, s));
    if (hit) { claimed.add(hit.id); adopted.set(hit.id, t._key); } else temps.push(t);
  });

  const prevKeys = new Map(prev.filter((m) => !m._temp && m._key).map((m) => [m.id, m._key]));
  const merged = latest.map((m) => {
    const k = adopted.get(m.id) || prevKeys.get(m.id);
    return k ? { ...m, _key: k } : m;
  });

  const real = prev.filter((m) => !m._temp);
  const latestIds = new Set(latest.map((m) => m.id));
  const newestPrev = real[real.length - 1];
  const gap = latest.length >= PAGE_SIZE && newestPrev && !latestIds.has(newestPrev.id)
    && timeOf(newestPrev) < timeOf(latest[0]);
  const firstAt = latest.length ? timeOf(latest[0]) : Infinity;
  const older = gap ? [] : real.filter((m) => !latestIds.has(m.id) && timeOf(m) < firstAt);

  return { list: [...older, ...merged, ...temps], gap };
}

const Avatar = ({ name, photoUrl, size = 28, ring = false, online = false }) => {
  const [failed, setFailed] = useState(false);
  const face = photoUrl && !failed ? (
    <img className="udm-avatar" src={buildUrl(photoUrl)} alt="" onError={() => setFailed(true)} />
  ) : (
    <span className="udm-avatar udm-mono" style={{ fontSize: Math.round(size * 0.34) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
  return (
    <span className={`udm-face${ring ? ' udm-face--ring' : ''}`} style={{ width: size, height: size }}>
      {face}
      {online && <span className="udm-online" aria-hidden="true" />}
    </span>
  );
};

const VerifiedCheck = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Artist" className="udm-check">
    <path d="M12 1.8l2.6 1.9 3.2-.2 1 3.1 2.8 1.6-.6 3.1 1.6 2.8-2.2 2.3-.1 3.2-3.1.7-1.9 2.6-3-1.1-3 1.1-1.9-2.6-3.1-.7-.1-3.2L1.3 14l1.6-2.8-.6-3.1 2.8-1.6 1-3.1 3.2.2z" />
    <path d="M8 12.4l2.7 2.7L16.2 9.6" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Spinner = () => <span className="udm-spin" aria-hidden="true" />;

// ── Shared-song card ─────────────────────────────────────────────────────────
const TrackCard = ({ song, rank, onPlay, onOpen, className = '' }) => {
  if (!song) {
    return (
      <div className={`udm-track udm-track--loading ${className}`}>
        <span className="udm-track__art udm-track__art--blank" aria-hidden="true"><NoteIcon size={22} tone="on" /></span>
        <span className="udm-track__meta">
          <span className="udm-skel udm-skel--line" style={{ width: 120 }} />
          <span className="udm-skel udm-skel--line" style={{ width: 80 }} />
        </span>
      </div>
    );
  }
  const art = song.artworkUrl ? buildUrl(song.artworkUrl) : null;
  return (
    <div className={`udm-track ${className}`}>
      <button type="button" className="udm-track__open" onClick={onOpen} aria-label={`Open ${song.title}`}>
        {art
          ? <img className="udm-track__art" src={art} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          : <span className="udm-track__art udm-track__art--blank" aria-hidden="true"><NoteIcon size={22} tone="on" /></span>}
        <span className="udm-track__meta">
          <span className="udm-track__title">{song.title}</span>
          <span className="udm-track__sub">{song.artist?.username || 'Unknown artist'}</span>
          {rank && (
            <span className="udm-track__chips">
              <span className="udm-track__rank">#{rank.rank} {rank.place}</span>
              {typeof rank.movement === 'number' && rank.movement !== 0 && (
                <span className={`udm-track__move ${rank.movement > 0 ? 'is-up' : 'is-down'}`}>
                  {rank.movement > 0 ? '▲' : '▼'} {Math.abs(rank.movement)}
                </span>
              )}
            </span>
          )}
        </span>
      </button>
      <button type="button" className="udm-track__play" onClick={onPlay} aria-label={`Play ${song.title}`} disabled={!song.fileUrl}>
        <PlayGlyph size={18} />
      </button>
    </div>
  );
};

// ── Reaction chips under a bubble ────────────────────────────────────────────
const ReactionChips = ({ reactions, me, onToggle, disabled }) => {
  const groups = [];
  (reactions || []).forEach((r) => {
    const g = groups.find((x) => x.emoji === r.emoji);
    if (g) { g.count += 1; g.mine = g.mine || r.userId === me; } else groups.push({ emoji: r.emoji, count: 1, mine: r.userId === me });
  });
  // Chips that were there when the thread opened don't pop; new ones do.
  const initial = useRef(null);
  if (initial.current === null) initial.current = new Set(groups.map((g) => g.emoji));
  if (!groups.length) return null;
  return (
    <span className="udm-reacts">
      {groups.map((g) => (
        <button
          key={g.emoji}
          type="button"
          className={`udm-react${g.mine ? ' is-mine' : ''}${initial.current.has(g.emoji) ? '' : ' is-new'}`}
          onClick={() => onToggle(g.emoji)}
          disabled={disabled}
          aria-label={`${g.emoji} ${g.count}${g.mine ? ', yours — tap to remove' : ''}`}
        >
          <span aria-hidden="true">{g.emoji}</span>
          {g.count > 1 && <span className="udm-react__n">{g.count}</span>}
        </button>
      ))}
    </span>
  );
};

// ── Now playing (phone header) ───────────────────────────────────────────────
const NowPlaying = ({ media, isPlaying, onToggle, onOpen }) => {
  const art = media.artwork || media.artworkUrl || null;
  const title = media.title || media.name || 'Now playing';
  return (
    <div className={`udm-np${isPlaying ? ' is-playing' : ''}`}>
      <button type="button" className="udm-np__art" onClick={onOpen} aria-label={`Now playing: ${title}. Open the player`}>
        {art ? <img src={art} alt="" /> : <NoteIcon size={16} tone="on" />}
        <span className="udm-np__eq" aria-hidden="true"><i /><i /><i /></span>
      </button>
      <button type="button" className="udm-np__toggle" onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <PauseGlyph size={14} /> : <PlayGlyph size={14} />}
      </button>
    </div>
  );
};

const ThreadSkeleton = () => (
  <div className="udm-thread__skeleton" aria-hidden="true">
    {[['theirs', 62], ['theirs', 44], ['mine', 56], ['theirs', 38], ['mine', 70], ['mine', 34]].map(([side, w]) => (
      <div key={`${side}-${w}`} className={`udm-skel-line ${side}`}><span className="udm-skel udm-skel--bubble" style={{ width: `${w}%` }} /></div>
    ))}
  </div>
);

export default function MessageThread({
  conversation,
  currentUserId,
  incomingMessage,
  incomingReaction,
  incomingRead,
  otherTyping = false,
  otherOnline = false,
  isPhone = false,
  sendTyping,
  onBack,
  onActivity,
  onAccepted,
  onRequestGone,
}) {
  const navigate = useNavigate();
  const {
    requestPlay, currentMedia, isPlaying = false, togglePlayPause, toggleExpand,
  } = useContext(PlayerContext) || {};
  const me = currentUserId;

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState(null);           // { text, kind, n }
  const [supportOpen, setSupportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStep, setMenuStep] = useState('main');   // main | block | report | reported
  const [profile, setProfile] = useState(null);
  const [songs, setSongs] = useState({});              // songId → song
  const [ranks, setRanks] = useState({});              // songId → { rank, movement, place }
  const [amounts, setAmounts] = useState({});          // supportPaymentId → cents
  const [action, setAction] = useState(null);          // { key, below } — reaction bar open
  const [pressing, setPressing] = useState(null);      // key of the bubble being held
  const [burst, setBurst] = useState(null);            // { key, n } — heart burst
  const [requestBusy, setRequestBusy] = useState(null); // 'accept' | 'delete'
  const [jump, setJump] = useState({ far: false, unseen: 0 });

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const composerRef = useRef(null);
  const rootRef = useRef(null);
  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);
  const mountedRef = useRef(true);
  const queueRef = useRef(Promise.resolve());
  const animateKeys = useRef(new Set());
  const atBottomRef = useRef(true);
  const lastKeyRef = useRef(null);
  const anchorRef = useRef(null);       // { height, top } while older messages are prepended
  const snapBottomRef = useRef(true);   // jump (not glide) to the bottom on the next render
  const olderBusy = useRef(false);
  const wasDraftRef = useRef(!!conversation._draft);
  const typingState = useRef({ on: false, lastSent: 0, idle: null });
  const press = useRef({ key: null, t1: null, t2: null, fired: false, x: 0, y: 0, el: null });
  const lastTap = useRef({ key: null, at: 0 });
  const swipe = useRef(null);
  const toastTimer = useRef(null);
  const lastToast = useRef(null);
  const requestedSongs = useRef(new Set());
  const requestedAmounts = useRef(new Set());

  messagesRef.current = messages;
  hasMoreRef.current = hasMore;

  const otherId = conversation.otherUserId;
  const otherName = conversation.otherUsername || profile?.username || 'Member';
  const otherPhoto = conversation.otherPhotoUrl || profile?.photoUrl || null;
  const isDraft = !!conversation._draft;
  const role = String(conversation.otherRole || profile?.role || '').toLowerCase();
  const isArtist = role === 'artist';
  const place = conversation.otherJurisdictionName || profile?.jurisdiction?.name || null;

  // Lanes, from this viewer's side.
  const isRequestForMe = !isDraft && conversation.pending && !conversation.initiatedByMe;
  const myRequest = !isDraft && conversation.pending && conversation.initiatedByMe;
  const accepted = !isDraft && !conversation.pending;
  const iAlreadyAsked = myRequest && messages.some((m) => m.senderId === me && m._status !== 'failed');
  const textOnly = myRequest || isDraft;
  // A brand-new conversation sends one message, then waits for the server to
  // decide which lane it's in before allowing more.
  const draftLocked = isDraft && messages.some((m) => m.senderId === me && m._status !== 'failed');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(toastTimer.current);
      clearTimeout(press.current.t1);
      clearTimeout(press.current.t2);
    };
  }, []);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((text, kind = 'error') => {
    clearTimeout(toastTimer.current);
    setToast({ text, kind, n: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  if (toast) lastToast.current = toast;
  const toastAnim = useLingering(!!toast, 220);

  // ── Scrolling ──────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (smooth && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      else el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Keep the view where it should be after every change to the list.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const last = messages[messages.length - 1];
    const lastKey = last ? keyOf(last) : null;
    if (el) {
      if (anchorRef.current) {
        // Older messages were added above: keep what you're reading in place.
        el.scrollTop = anchorRef.current.top + (el.scrollHeight - anchorRef.current.height);
        anchorRef.current = null;
      } else if (snapBottomRef.current && messages.length) {
        el.scrollTop = el.scrollHeight;
        snapBottomRef.current = false;
        atBottomRef.current = true;
      } else if (lastKey && lastKey !== lastKeyRef.current && lastKeyRef.current !== null) {
        if (last.senderId === me || atBottomRef.current) scrollToBottom(true);
        else setJump((j) => ({ ...j, unseen: j.unseen + 1 }));
      }
    }
    lastKeyRef.current = lastKey;
  }, [messages, me, scrollToBottom]);

  const loadOlder = useCallback(async () => {
    if (olderBusy.current || !hasMoreRef.current || isDraft) return;
    const oldest = messagesRef.current.find((m) => !m._temp);
    if (!oldest) return;
    olderBusy.current = true;
    setLoadingOlder(true);
    try {
      const { messages: older, hasMore: more } = await fetchOlder(conversation.id, oldest.createdAt);
      if (!mountedRef.current) return;
      const el = scrollRef.current;
      if (el) anchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !ids.has(m.id)), ...prev];
      });
      setHasMore(more);
    } catch (err) {
      console.error('[Messages] older messages failed:', err?.message || err);
      if (mountedRef.current) showToast('Couldn’t load older messages.');
    } finally {
      olderBusy.current = false;
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, [conversation.id, isDraft, showToast]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = fromBottom < NEAR_BOTTOM_PX;
    const far = fromBottom > JUMP_SHOW_PX;
    setJump((j) => {
      const unseen = atBottomRef.current ? 0 : j.unseen;
      return j.far === far && j.unseen === unseen ? j : { far, unseen };
    });
    if (el.scrollTop < LOAD_OLDER_PX) loadOlder();
  };

  // A short first page that doesn't fill the screen can't be scrolled — pull more.
  useEffect(() => {
    const el = scrollRef.current;
    if (loading || !hasMore || !el) return;
    if (el.scrollHeight <= el.clientHeight + LOAD_OLDER_PX) loadOlder();
  }, [loading, hasMore, messages.length, loadOlder]);

  // Keyboard opening / composer growing: stay pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The floating composer's height decides the bottom padding and where the
  // ↓ pill and toasts sit.
  useEffect(() => {
    const el = composerRef.current;
    const root = rootRef.current;
    if (!el || !root || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      root.style.setProperty('--udm-composer-h', `${el.offsetHeight}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  // Drafts have no conversation row yet — fetch who we're talking to.
  useEffect(() => {
    if (!isDraft && conversation.otherRole) return undefined;
    let alive = true;
    apiCall({ url: `/v1/users/profile/${otherId}` })
      .then((res) => { if (alive) setProfile(res.data || null); })
      .catch((err) => console.error('[Messages] profile load failed (header shows name only):', err?.message || err));
    return () => { alive = false; };
  }, [otherId, isDraft, conversation.otherRole]);

  useEffect(() => {
    let alive = true;
    if (isDraft) {
      setLoading(false);
      setHasMore(false);
      return () => { alive = false; };
    }
    const id = conversation.id;

    // The draft just became a real conversation: carry its bubbles over
    // instead of flashing a loading state.
    if (wasDraftRef.current) {
      wasDraftRef.current = false;
      putThread(me, id, { messages: messagesRef.current.map((m) => ({ ...m, conversationId: id })), hasMore: false });
    }

    const cached = getThread(me, id);
    setLoadError(null);
    if (cached) {
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
      setLoading(false);
    } else {
      setMessages([]);
      setHasMore(false);
      setLoading(true);
    }
    snapBottomRef.current = true;
    lastKeyRef.current = null;

    fetchLatest(me, id, { maxAgeMs: THREAD_FRESH_MS })
      .then(({ messages: latest, hasMore: more }) => {
        if (!alive) return;
        const prev = messagesRef.current;
        if (!prev.length) {
          setMessages(latest);
          setHasMore(more);
        } else {
          const { list, gap } = mergeLatest(prev, latest);
          setMessages(list);
          setHasMore(cached && !gap ? hasMoreRef.current : more);
        }
        // Clears your unread count. In a request the server sends no Seen mark.
        apiCall({ method: 'post', url: `/v1/conversations/${id}/read` })
          .catch((err) => console.error('[Messages] mark-read failed:', err?.message || err));
      })
      .catch((err) => {
        console.error('[Messages] thread load failed:', err?.message || err);
        if (!alive) return;
        if (cached) showToast('Couldn’t refresh this conversation.');
        else setLoadError('Couldn’t load this conversation.');
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [conversation.id, isDraft, me, reloadTick, showToast]);

  // Remember the thread so reopening it is instant (in-flight sends excluded).
  useEffect(() => {
    if (isDraft || loading || loadError) return;
    putThread(me, conversation.id, {
      messages: messages.filter((m) => !m._temp || m._status === 'failed'),
      hasMore,
    });
  }, [messages, hasMore, isDraft, loading, loadError, me, conversation.id]);

  // ── Live events ────────────────────────────────────────────────────────────
  useEffect(() => {
    const msg = incomingMessage;
    if (!msg || msg.conversationId !== conversation.id) return;
    if (msg.senderId === me) {
      // My own message echoed back — it replaces its temp bubble in place.
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const i = prev.findIndex((m) => matchesTemp(m, msg));
        if (i >= 0) {
          const next = prev.slice();
          next[i] = { ...msg, _key: prev[i]._key };
          return next;
        }
        animateKeys.current.add(msg.id);    // sent from another device
        return [...prev, msg];
      });
      return;
    }
    if (!messagesRef.current.some((m) => m.id === msg.id)) playSound('receive', { muted: isPlaying });
    animateKeys.current.add(msg.id);
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    apiCall({ method: 'post', url: `/v1/conversations/${conversation.id}/read` })
      .catch((err) => console.error('[Messages] mark-read failed:', err?.message || err));
    // isPlaying is read at arrival time on purpose; it shouldn't re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingMessage, conversation.id, me]);

  useEffect(() => {
    if (!incomingReaction || incomingReaction.conversationId !== conversation.id) return;
    setMessages((prev) => prev.map((m) => (
      m.id === incomingReaction.messageId ? { ...m, reactions: incomingReaction.reactions || [] } : m)));
  }, [incomingReaction, conversation.id]);

  useEffect(() => {
    if (!incomingRead || incomingRead.conversationId !== conversation.id) return;
    const readAt = parseServerTime(incomingRead.readAt).getTime();
    setMessages((prev) => prev.map((m) => (
      m.senderId === me && !m._temp && !m.read && timeOf(m) <= readAt ? { ...m, read: true } : m)));
  }, [incomingRead, conversation.id, me]);

  const typing = useLingering(otherTyping && accepted, 180);
  useEffect(() => {
    if (typing.mounted && atBottomRef.current) scrollToBottom(true);
  }, [typing.mounted, scrollToBottom]);

  // ── Shared songs + support amounts ─────────────────────────────────────────
  const songIds = useMemo(
    () => [...new Set(messages.filter((m) => m.sharedSongId && m.supportPaymentId == null).map((m) => String(m.sharedSongId)))],
    [messages],
  );
  useEffect(() => {
    const missing = songIds.filter((id) => !requestedSongs.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => requestedSongs.current.add(id));

    Promise.allSettled(missing.map((id) => apiCall({ url: `/v1/media/song/${id}` }))).then((results) => {
      if (!mountedRef.current) return;
      const next = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[missing[i]] = r.value.data;
        else console.error('[Messages] shared song load failed:', r.reason?.message || r.reason);
      });
      setSongs((prev) => ({ ...prev, ...next }));

      // One standings read per jurisdiction, however many songs live there.
      const byPlace = {};
      Object.entries(next).forEach(([id, song]) => {
        const j = song?.jurisdiction;
        if (!j?.jurisdictionId) return;
        if (!byPlace[j.jurisdictionId]) byPlace[j.jurisdictionId] = { name: j.name, ids: [] };
        byPlace[j.jurisdictionId].ids.push(id);
      });
      Object.entries(byPlace).forEach(([jurisdictionId, { name, ids }]) => {
        fetchStandings({ type: 'song', jurisdictionId, genre: 'all', period: 'daily', limit: 50 })
          .then((board) => {
            if (!mountedRef.current || board.state !== 'LIVE') return;
            const found = {};
            board.entries.forEach((e) => {
              if (ids.includes(String(e.id)) && e.points > 0) {
                found[String(e.id)] = { rank: e.rank, movement: e.movement, place: name };
              }
            });
            setRanks((prev) => ({ ...prev, ...found }));
          })
          .catch((err) => console.error('[Messages] shared song rank failed (chip hidden):', err?.message || err));
      });
    });
  }, [songIds]);

  const supportIds = useMemo(
    () => [...new Set(messages.filter((m) => m.supportPaymentId != null).map((m) => String(m.supportPaymentId)))],
    [messages],
  );
  useEffect(() => {
    const missing = supportIds.filter((id) => !requestedAmounts.current.has(id) && !(id in amounts));
    if (!missing.length) return;
    missing.forEach((id) => requestedAmounts.current.add(id));

    Promise.allSettled([
      apiCall({ url: '/v1/support/sent', useCache: false }),
      apiCall({ url: '/v1/support/received', useCache: false }),
    ]).then((results) => {
      if (!mountedRef.current) return;
      const next = {};
      results.forEach((r) => {
        if (r.status !== 'fulfilled') {
          console.error('[Messages] support history load failed (amount hidden):', r.reason?.message || r.reason);
          return;
        }
        (Array.isArray(r.value.data) ? r.value.data : []).forEach((p) => {
          if (p?.id != null) next[String(p.id)] = p.amount;
        });
      });
      setAmounts((prev) => ({ ...prev, ...next }));
    });
  }, [supportIds, amounts]);

  // ── Menus close on outside press / Escape ──────────────────────────────────
  useEffect(() => {
    if (!menuOpen && !action) return undefined;
    const onDown = (e) => {
      if (menuOpen && !menuRef.current?.contains(e.target)) { setMenuOpen(false); setMenuStep('main'); }
      if (action && !e.target.closest?.('.udm-actions')) setAction(null);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false); setMenuStep('main'); setAction(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, action]);
  const menuAnim = useLingering(menuOpen, 160);

  // Grow the composer with its text (up to the CSS max-height).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // ── Typing out ─────────────────────────────────────────────────────────────
  const stopTyping = useCallback(() => {
    const t = typingState.current;
    clearTimeout(t.idle);
    if (t.on && accepted) sendTyping?.(conversation.id, false);
    t.on = false;
  }, [accepted, conversation.id, sendTyping]);

  const noteTyping = useCallback((text) => {
    if (!accepted || !sendTyping) return;
    const t = typingState.current;
    if (!text.trim()) { stopTyping(); return; }
    const now = Date.now();
    if (!t.on || now - t.lastSent > TYPING_RESEND_MS) {
      sendTyping(conversation.id, true);
      t.on = true;
      t.lastSent = now;
    }
    clearTimeout(t.idle);
    t.idle = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [accepted, sendTyping, conversation.id, stopTyping]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  // ── Sending (queued, in order) ─────────────────────────────────────────────
  const post = useCallback(async (data) => {
    const res = await apiCall({ method: 'post', url: '/v1/messages', data: { recipientId: otherId, source: 'dm', ...data } });
    return res.data;
  }, [otherId]);

  const deliver = useCallback((temp) => {
    const after = isRequestForMe ? onAccepted : onActivity;
    queueRef.current = queueRef.current.then(async () => {
      try {
        const saved = await post(temp._payload);
        if (!mountedRef.current) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) {
            // The socket echo already took this temp's place.
            return prev.filter((m) => m._key !== temp._key || m.id === saved.id);
          }
          return prev.map((m) => (m._key === temp._key ? { ...saved, _key: temp._key } : m));
        });
        after?.(saved);
      } catch (e) {
        console.error('[Messages] send failed:', e?.message || e);
        if (!mountedRef.current) return;
        const reason = e?.response?.data?.error || null;
        setMessages((prev) => prev.map((m) => (
          m._key === temp._key ? { ...m, _status: 'failed', _error: reason } : m)));
        haptic('error');
        if (reason) showToast(reason);
      }
    });
  }, [post, isRequestForMe, onAccepted, onActivity, showToast]);

  const enqueue = useCallback((payload) => {
    const key = `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const temp = {
      id: key,
      _key: key,
      _temp: true,
      _status: 'sending',
      _payload: payload,
      conversationId: conversation.id,
      senderId: me,
      body: payload.body || '',
      sharedSongId: payload.sharedSongId ?? null,
      supportPaymentId: payload.supportPaymentId ?? null,
      createdAt: new Date().toISOString(),
      read: false,
      reactions: [],
    };
    animateKeys.current.add(key);
    setMessages((prev) => [...prev, temp]);
    primeSound();
    haptic('send');
    playSound('send', { muted: isPlaying });
    deliver(temp);
  }, [conversation.id, me, isPlaying, deliver]);

  const send = useCallback(() => {
    const body = draft.trim();
    if (!body || draftLocked) return;
    setDraft('');
    stopTyping();
    enqueue({ body });
  }, [draft, draftLocked, stopTyping, enqueue]);

  const retry = useCallback((m) => {
    haptic('tap');
    const again = { ...m, _status: 'sending', _error: null, createdAt: new Date().toISOString() };
    setMessages((prev) => prev.map((x) => (x._key === m._key ? again : x)));
    deliver(again);
  }, [deliver]);

  const removeFailed = useCallback((m) => {
    setMessages((prev) => prev.filter((x) => x._key !== m._key));
  }, []);

  const shareSong = useCallback((result) => {
    setShareOpen(false);
    // Show the card right away with what the picker already knows.
    setSongs((prev) => (prev[result.id] ? prev : {
      ...prev,
      [result.id]: { songId: result.id, title: result.name, artworkUrl: result.artworkUrl, artist: { username: result.subtitle } },
    }));
    enqueue({ sharedSongId: result.id, body: '' });
  }, [enqueue]);

  // Support was recorded by the sheet → post the message that carries it.
  const handleSupportSent = useCallback(({ supportId, note, amount }) => {
    if (amount != null) setAmounts((prev) => ({ ...prev, [String(supportId)]: amount }));
    requestedAmounts.current.add(String(supportId));
    enqueue({ body: note || '', supportPaymentId: supportId });
    haptic('success');
  }, [enqueue]);

  // ── Requests ───────────────────────────────────────────────────────────────
  const acceptRequest = async () => {
    setRequestBusy('accept');
    try {
      await apiCall({ method: 'post', url: `/v1/conversations/${conversation.id}/accept` });
      haptic('success');
      onAccepted?.();
    } catch (e) {
      console.error('[Messages] accept failed:', e?.message || e);
      showToast(e?.response?.data?.error || 'Couldn’t accept this request.');
    } finally {
      if (mountedRef.current) setRequestBusy(null);
    }
  };

  const deleteRequest = async () => {
    setRequestBusy('delete');
    try {
      await apiCall({ method: 'post', url: `/v1/conversations/${conversation.id}/decline` });
      onRequestGone?.();
    } catch (e) {
      console.error('[Messages] delete request failed:', e?.message || e);
      showToast(e?.response?.data?.error || 'Couldn’t delete this request.');
      if (mountedRef.current) setRequestBusy(null);
    }
  };

  const block = async () => {
    try {
      await apiCall({ method: 'post', url: `/v1/users/${otherId}/block` });
      setMenuOpen(false);
      setMenuStep('main');
      onRequestGone?.();
    } catch (e) {
      console.error('[Messages] block failed:', e?.message || e);
      showToast(e?.response?.data?.error || `Couldn’t block ${otherName}.`);
      setMenuOpen(false);
      setMenuStep('main');
    }
  };

  const report = async (reason) => {
    try {
      await apiCall({ method: 'post', url: '/v1/messages/report', data: { reportedUserId: otherId, reason } });
      setMenuStep('reported');
    } catch (e) {
      console.error('[Messages] report failed:', e?.message || e);
      showToast(e?.response?.data?.error || 'Couldn’t send that report.');
      setMenuOpen(false);
      setMenuStep('main');
    }
  };

  // ── Reactions (instant, then confirmed) ────────────────────────────────────
  const react = useCallback(async (m, emoji, { add = false } = {}) => {
    setAction(null);
    if (!accepted || m._temp) return;
    const before = m.reactions || [];
    const mine = before.find((r) => r.userId === me);
    if (add && mine?.emoji === emoji) { haptic('react'); return; }  // double-tap on a heart you already gave
    const next = before.filter((r) => r.userId !== me);
    if (mine?.emoji !== emoji) next.push({ userId: me, emoji });
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions: next } : x)));
    haptic('react');
    try {
      const res = await apiCall({ method: 'post', url: `/v1/messages/${m.id}/reaction`, data: { emoji } });
      if (mountedRef.current && Array.isArray(res.data)) {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions: res.data } : x)));
      }
    } catch (e) {
      console.error('[Messages] reaction failed:', e?.message || e);
      if (!mountedRef.current) return;
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions: before } : x)));
      showToast(e?.response?.data?.error || 'Couldn’t add that reaction.');
    }
  }, [accepted, me, showToast]);

  const heart = useCallback((m) => {
    if (!accepted || m._temp) return;
    setBurst({ key: keyOf(m), n: Date.now() });
    react(m, HEART, { add: true });
  }, [accepted, react]);

  useEffect(() => {
    if (!burst) return undefined;
    const t = setTimeout(() => setBurst(null), BURST_MS);
    return () => clearTimeout(t);
  }, [burst]);

  const copyText = useCallback(async (m) => {
    setAction(null);
    try {
      await navigator.clipboard.writeText(m.body || '');
      haptic('tap');
      showToast('Copied', 'info');
    } catch (err) {
      console.error('[Messages] copy failed:', err?.message || err);
      showToast('Couldn’t copy that message.');
    }
  }, [showToast]);

  // Long-press / right-click → reaction bar + Copy, if there's anything to offer.
  const openActions = useCallback((m, el) => {
    const canReact = accepted && !m._temp;
    const canCopy = !!(m.body || '').trim();
    if (!canReact && !canCopy) return;
    const box = scrollRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect?.();
    const below = !!(box && r && r.top - box.top < 76);
    setAction({ key: keyOf(m), below });
  }, [accepted]);

  const cancelPress = useCallback(() => {
    clearTimeout(press.current.t1);
    clearTimeout(press.current.t2);
    setPressing(null);
  }, []);

  const bubbleHandlers = (m) => {
    const k = keyOf(m);
    const canReact = accepted && !m._temp;
    return {
      onTouchStart: (e) => {
        const t = e.touches[0];
        const el = e.currentTarget;
        cancelPress();
        press.current = {
          key: k,
          x: t.clientX,
          y: t.clientY,
          el,
          fired: false,
          t1: setTimeout(() => setPressing(k), PRESS_SHOW_MS),
          t2: setTimeout(() => {
            press.current.fired = true;
            setPressing(null);
            haptic('press');
            openActions(m, el);
          }, LONG_PRESS_MS),
        };
      },
      onTouchMove: (e) => {
        const t = e.touches[0];
        if (Math.hypot(t.clientX - press.current.x, t.clientY - press.current.y) > MOVE_CANCEL_PX) cancelPress();
      },
      onTouchEnd: (e) => {
        const fired = press.current.fired;
        cancelPress();
        if (fired) {
          if (e.cancelable) e.preventDefault();   // the hold shouldn't also count as a tap
          return;
        }
        if (!canReact) return;
        const now = Date.now();
        if (lastTap.current.key === k && now - lastTap.current.at < DOUBLE_TAP_MS) {
          lastTap.current = { key: null, at: 0 };
          heart(m);
        } else {
          lastTap.current = { key: k, at: now };
        }
      },
      onTouchCancel: cancelPress,
      onContextMenu: (e) => {
        e.preventDefault();
        openActions(m, e.currentTarget);
      },
      onDoubleClick: canReact ? () => heart(m) : undefined,
      onMouseDown: (e) => { if (e.detail > 1) e.preventDefault(); },   // no word-select on double-click
    };
  };

  // ── Swipe left to see times (touch) ────────────────────────────────────────
  const setReveal = (px) => scrollRef.current?.style.setProperty('--udm-reveal', `${px}px`);
  const onScrollTouchStart = (e) => {
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, mode: null };
  };
  const onScrollTouchMove = (e) => {
    const s = swipe.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      s.mode = dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.3 ? 'reveal' : 'scroll';
      if (s.mode === 'reveal') {
        cancelPress();
        scrollRef.current?.classList.add('is-revealing');
      }
    }
    if (s.mode === 'reveal') {
      const pull = Math.max(dx, -160);
      setReveal(pull > -REVEAL_MAX_PX ? pull : -REVEAL_MAX_PX + (pull + REVEAL_MAX_PX) * 0.25);
    }
  };
  const onScrollTouchEnd = () => {
    const s = swipe.current;
    swipe.current = null;
    if (s?.mode !== 'reveal') return;
    scrollRef.current?.classList.remove('is-revealing');
    setReveal(0);
  };

  const playSong = (song) => {
    if (!song?.fileUrl || !requestPlay) return;
    const url = buildUrl(song.fileUrl);
    const art = buildUrl(song.artworkUrl);
    requestPlay({
      type: 'song',
      id: song.songId,
      songId: song.songId,
      url,
      fileUrl: url,
      title: song.title,
      artist: song.artist?.username,
      artistId: song.artist?.userId,
      artwork: art,
      artworkUrl: art,
      source: 'dm',
    });
  };

  const openProfile = () => {
    setMenuOpen(false);
    navigate(isArtist ? `/artist/${otherId}` : `/user/${otherId}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const jumpToBottom = () => {
    haptic('tap');
    atBottomRef.current = true;
    setJump({ far: false, unseen: 0 });
    scrollToBottom(true);
  };

  // Lay the thread out: time dividers between sittings, bubbles grouped by sender.
  const rows = useMemo(() => {
    const out = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const t = timeOf(m);
      const d = parseServerTime(m.createdAt);
      const pill = !prev
        || !sameDay(parseServerTime(prev.createdAt), d)
        || t - timeOf(prev) > SITTING_GAP_MS;
      if (pill) out.push({ kind: 'pill', id: `pill-${keyOf(m)}`, label: pillLabel(m.createdAt) });

      const joinsPrev = prev && !pill && prev.senderId === m.senderId && t - timeOf(prev) < GROUP_GAP_MS;
      const joinsNext = next && next.senderId === m.senderId
        && timeOf(next) - t < GROUP_GAP_MS
        && sameDay(parseServerTime(next.createdAt), d);
      out.push({ kind: 'msg', id: keyOf(m), m, first: !joinsPrev, last: !joinsNext });
    });
    return out;
  }, [messages]);

  const lastMsg = messages[messages.length - 1];
  const showSeen = accepted && lastMsg && lastMsg.senderId === me && lastMsg.read && !lastMsg._temp && !otherTyping;
  const jumpAnim = useLingering(jump.unseen > 0 || jump.far, 180);
  const canSend = !!draft.trim() && !draftLocked;
  const shownToast = toast || lastToast.current;

  return (
    <div className="udm-thread" ref={rootRef}>
      <div className="udm-glow udm-glow--left" aria-hidden="true" />

      <header className="udm-thread__head">
        <button type="button" className="udm-round udm-back" onClick={onBack} aria-label="Back to messages">
          <ArrowBackIcon size={22} />
        </button>
        <button type="button" className="udm-thread__who" onClick={openProfile} aria-label={`View ${otherName}'s profile`}>
          <Avatar name={otherName} photoUrl={otherPhoto} size={44} ring={!!conversation.otherSupportsMe} online={otherOnline} />
          <span className="udm-thread__names">
            <span className="udm-thread__name">
              <span className="udm-thread__name-text">{otherName}</span>
              {isArtist && <VerifiedCheck />}
            </span>
            {(otherOnline || place) && (
              <span className="udm-thread__status">
                {otherOnline && <span className="udm-thread__active">Active now</span>}
                {place && (
                  <span className="udm-chip">
                    <FindIcon size={12} tone="on" />
                    {place}
                  </span>
                )}
              </span>
            )}
          </span>
        </button>

        {isPhone && currentMedia && (
          <NowPlaying media={currentMedia} isPlaying={isPlaying} onToggle={togglePlayPause} onOpen={toggleExpand} />
        )}

        <div className="udm-menu" ref={menuRef}>
          <button
            type="button"
            className="udm-round"
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen((o) => !o); setMenuStep('main'); }}
          >
            <MoreIcon size={22} />
          </button>
          {menuAnim.mounted && (
            <div className={`udm-menu__panel${menuAnim.leaving ? ' is-leaving' : ''}`} role="menu">
              {menuStep === 'main' && (
                <>
                  <button type="button" role="menuitem" className="udm-menu__item" onClick={openProfile}>View profile</button>
                  <button type="button" role="menuitem" className="udm-menu__item" onClick={() => setMenuStep('report')}>Report</button>
                  <button type="button" role="menuitem" className="udm-menu__item udm-menu__item--danger" onClick={() => setMenuStep('block')}>
                    Block {otherName}
                  </button>
                </>
              )}
              {menuStep === 'block' && (
                <div className="udm-menu__confirm">
                  <p>Block {otherName}? Neither of you can message the other until you unblock.</p>
                  <div>
                    <button type="button" className="udm-menu__btn" onClick={() => setMenuStep('main')}>Cancel</button>
                    <button type="button" className="udm-menu__btn udm-menu__btn--danger" onClick={block}>Block</button>
                  </div>
                </div>
              )}
              {menuStep === 'report' && (
                <div className="udm-menu__confirm">
                  <p>What&rsquo;s wrong? Unis reviews every report. Reporting doesn&rsquo;t block on its own.</p>
                  {REPORT_REASONS.map((r) => (
                    <button key={r} type="button" role="menuitem" className="udm-menu__item" onClick={() => report(r)}>{r}</button>
                  ))}
                </div>
              )}
              {menuStep === 'reported' && (
                <div className="udm-menu__confirm">
                  <p>Thanks — it&rsquo;s with Unis for review.</p>
                  <div>
                    <button type="button" className="udm-menu__btn" onClick={() => { setMenuOpen(false); setMenuStep('main'); }}>Done</button>
                    <button type="button" className="udm-menu__btn udm-menu__btn--danger" onClick={() => setMenuStep('block')}>Block too</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div
        className={`udm-thread__scroll${action ? ' has-focus' : ''}`}
        ref={scrollRef}
        onScroll={onScroll}
        onTouchStart={onScrollTouchStart}
        onTouchMove={onScrollTouchMove}
        onTouchEnd={onScrollTouchEnd}
        onTouchCancel={onScrollTouchEnd}
        role="log"
        aria-label={`Conversation with ${otherName}`}
      >
        {hasMore && (
          <div className="udm-older" role="status">
            {loadingOlder ? <><Spinner /><span className="udm-sr">Loading older messages</span></> : null}
          </div>
        )}

        {!loading && !loadError && !hasMore && (
          <div className="udm-intro">
            <Avatar name={otherName} photoUrl={otherPhoto} size={84} ring={!!conversation.otherSupportsMe} />
            <span className="udm-intro__name">
              {otherName}
              {isArtist && <VerifiedCheck size={18} />}
            </span>
            {(role || place) && (
              <span className="udm-intro__sub">
                {role ? (isArtist ? 'Artist' : 'Listener') : null}
                {role && place ? ' · ' : null}
                {place}
              </span>
            )}
            <button type="button" className="udm-intro__btn" onClick={openProfile}>View profile</button>
            {messages.length === 0 && (
              <p className="udm-intro__hint">
                {isDraft || myRequest
                  ? `Say hi to ${otherName}. If you don’t know each other yet, your first message goes to their Requests.`
                  : `Say something to ${otherName}.`}
              </p>
            )}
          </div>
        )}

        {loading && <ThreadSkeleton />}
        {loadError && (
          <div className="udm-thread__hint">
            {loadError}
            <button type="button" className="udm-link" onClick={() => setReloadTick((n) => n + 1)}>Try again</button>
          </div>
        )}

        {rows.map((row) => {
          if (row.kind === 'pill') {
            return <div key={row.id} className="udm-pill">{row.label}</div>;
          }
          const { m, first, last } = row;
          const k = keyOf(m);
          const mine = m.senderId === me;
          const isSupport = m.supportPaymentId != null;
          const isTrack = m.sharedSongId != null && !isSupport;
          const sending = m._status === 'sending';
          const failed = m._status === 'failed';
          const shape = `${first ? 'is-first' : ''} ${last ? 'is-last' : ''}${sending ? ' is-sending' : ''}${pressing === k ? ' is-pressing' : ''}`;
          const canReact = accepted && !m._temp;
          const isNew = animateKeys.current.has(k);
          const handlers = bubbleHandlers(m);

          let content;
          if (isSupport) {
            const cents = amounts[String(m.supportPaymentId)];
            const amt = cents != null ? money(cents) : null;
            content = (
              <div className={`udm-support ${shape}`} {...handlers}>
                <span className="udm-support__top">
                  <SupportIcon size={15} tone="on" />
                  {mine ? 'Support sent' : `${otherName} sent support`}
                </span>
                {amt && <span className="udm-support__amount">{amt.whole}<span>{amt.frac}</span></span>}
                {m.body && <span className="udm-support__note">{m.body}</span>}
              </div>
            );
          } else if (isTrack) {
            const song = songs[String(m.sharedSongId)];
            content = (
              <>
                <TrackCard
                  song={song}
                  rank={ranks[String(m.sharedSongId)]}
                  onPlay={() => playSong(song)}
                  onOpen={() => song?.songId && navigate(`/song/${song.songId}`)}
                  className={sending ? 'is-sending' : ''}
                />
                {m.body && <div className={`udm-bubble ${shape}`} {...handlers}>{m.body}</div>}
              </>
            );
          } else {
            content = (
              <div className={`udm-bubble ${shape}${failed ? ' is-failed' : ''}`} {...handlers}>
                {m.body}
              </div>
            );
          }

          const actionOpen = action?.key === k;
          const myEmoji = (m.reactions || []).find((r) => r.userId === me)?.emoji;

          return (
            <div
              key={k}
              className={`udm-line ${mine ? 'mine' : 'theirs'}${first ? ' is-first' : ''}${isNew ? ' is-new' : ''}${actionOpen ? ' is-focus' : ''}`}
            >
              <div className={`udm-row ${mine ? 'mine' : 'theirs'}`}>
                {!mine && (
                  <span className="udm-row__face">
                    {last ? <Avatar name={otherName} photoUrl={otherPhoto} size={28} /> : null}
                  </span>
                )}
                <div className="udm-row__stack">
                  {content}
                  <ReactionChips
                    reactions={m.reactions}
                    me={me}
                    disabled={!canReact}
                    onToggle={(emoji) => react(m, emoji)}
                  />
                  {burst?.key === k && <span key={burst.n} className="udm-burst" aria-hidden="true">{HEART}</span>}

                  {failed && (
                    <span className="udm-failed">
                      <button type="button" className="udm-failed__retry" onClick={() => retry(m)}>
                        <RetryIcon size={14} tone="on" />
                        Not delivered · Tap to retry
                      </button>
                      <button type="button" className="udm-failed__x" onClick={() => removeFailed(m)} aria-label="Remove this message">
                        <CloseIcon size={13} tone="on" />
                      </button>
                    </span>
                  )}

                  {actionOpen && (
                    <div className={`udm-actions${action.below ? ' is-below' : ''}`} role="menu" aria-label="Message actions">
                      {canReact && (
                        <span className="udm-actions__emoji">
                          {REACTIONS.map((emoji, i) => (
                            <button
                              key={emoji}
                              type="button"
                              role="menuitem"
                              style={{ '--i': i }}
                              className={`udm-actions__react${myEmoji === emoji ? ' is-mine' : ''}`}
                              onClick={() => react(m, emoji)}
                              aria-label={`React ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </span>
                      )}
                      {!!(m.body || '').trim() && (
                        <button type="button" role="menuitem" className="udm-actions__btn" onClick={() => copyText(m)}>
                          <CopyIcon size={17} />
                          Copy
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="udm-row__tools">
                  {canReact && (
                    <button
                      type="button"
                      className="udm-react-btn"
                      aria-label="React or copy"
                      aria-expanded={actionOpen}
                      onClick={(e) => (actionOpen ? setAction(null) : openActions(m, e.currentTarget))}
                    >
                      <ReactIcon size={18} />
                    </button>
                  )}
                  <span className="udm-row__stamp">{sending ? 'Sending…' : clock(m.createdAt)}</span>
                </span>
              </div>
              <span className="udm-line__time" aria-hidden="true">{clock(m.createdAt)}</span>
            </div>
          );
        })}

        {typing.mounted && (
          <div className={`udm-line theirs is-first${typing.leaving ? ' is-leaving' : ''}`} role="status">
            <div className="udm-row theirs">
              <span className="udm-row__face"><Avatar name={otherName} photoUrl={otherPhoto} size={28} /></span>
              <div className="udm-typing">
                <span className="udm-sr">{otherName} is typing</span>
                <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
              </div>
            </div>
          </div>
        )}

        {showSeen && (
          <div className="udm-seen">
            Seen
            <Avatar name={otherName} photoUrl={otherPhoto} size={16} />
          </div>
        )}
      </div>

      {jumpAnim.mounted && (
        <button
          type="button"
          className={`udm-jump${jumpAnim.leaving ? ' is-leaving' : ''}${jump.unseen > 0 ? ' has-new' : ''}`}
          onClick={jumpToBottom}
          aria-label={jump.unseen > 0 ? `${jump.unseen} new message${jump.unseen === 1 ? '' : 's'}, jump to latest` : 'Jump to latest'}
        >
          <ArrowDownIcon size={18} />
          {jump.unseen > 0 && <span>{jump.unseen === 1 ? 'New message' : `${jump.unseen} new messages`}</span>}
        </button>
      )}

      {toastAnim.mounted && shownToast && (
        <div className={`udm-toast udm-toast--${shownToast.kind}${toastAnim.leaving ? ' is-leaving' : ''}`} role={shownToast.kind === 'error' ? 'alert' : 'status'}>
          {shownToast.text}
        </div>
      )}

      <div className="udm-composer" ref={composerRef}>
        {isRequestForMe && (
          <div className="udm-request">
            <p className="udm-request__lead"><strong>{otherName}</strong> wants to message you</p>
            <p className="udm-request__sub">They won&rsquo;t know you&rsquo;ve seen this until you accept. Replying accepts too.</p>
            <div className="udm-request__actions">
              <button type="button" className="udm-request__btn" onClick={deleteRequest} disabled={!!requestBusy}>
                {requestBusy === 'delete' ? <Spinner /> : 'Delete'}
              </button>
              <button
                type="button"
                className="udm-request__btn udm-request__btn--danger"
                onClick={() => { setMenuOpen(true); setMenuStep('block'); }}
                disabled={!!requestBusy}
              >
                Block
              </button>
              <button type="button" className="udm-request__btn udm-request__btn--accept" onClick={acceptRequest} disabled={!!requestBusy}>
                {requestBusy === 'accept' ? <Spinner /> : 'Accept'}
              </button>
            </div>
          </div>
        )}

        {iAlreadyAsked ? (
          <div className="udm-composer__note">
            Message request sent. You can send more once {otherName} accepts.
          </div>
        ) : (
          <div className="udm-composer__bar">
            {!textOnly && (
              <button
                type="button"
                className="udm-composer__icon"
                aria-label="Share a song"
                onClick={() => { haptic('tap'); setShareOpen(true); }}
              >
                <ShareSongIcon size={22} />
              </button>
            )}
            <label className="udm-sr" htmlFor={`udm-input-${otherId}`}>Message {otherName}</label>
            <textarea
              id={`udm-input-${otherId}`}
              ref={inputRef}
              className={`udm-composer__input${textOnly ? ' udm-composer__input--solo' : ''}`}
              placeholder={myRequest ? 'Your one message request…' : `Message ${otherName}…`}
              value={draft}
              rows={1}
              enterKeyHint="send"
              onChange={(e) => { setDraft(e.target.value); noteTyping(e.target.value); }}
              onBlur={stopTyping}
              onKeyDown={onKeyDown}
            />
            {!textOnly && (
              <button
                type="button"
                className="udm-composer__icon udm-composer__support"
                aria-label="Send support"
                onClick={() => { haptic('tap'); setSupportOpen(true); }}
              >
                <SupportIcon size={21} tone="on" />
              </button>
            )}
            <button
              type="button"
              className="udm-composer__send"
              onMouseDown={(e) => e.preventDefault()}  // keep the keyboard open after sending
              onClick={send}
              disabled={!canSend}
              aria-label="Send message"
            >
              <SendIcon size={21} tone="on" />
            </button>
          </div>
        )}
      </div>

      <SupportSheet
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        artistId={otherId}
        artistName={otherName}
        source="dm"
        onSuccess={handleSupportSent}
      />

      <MessagePickerSheet
        open={shareOpen}
        mode="song"
        onClose={() => setShareOpen(false)}
        onPick={shareSong}
      />
    </div>
  );
}
