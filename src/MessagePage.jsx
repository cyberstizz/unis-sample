// src/MessagePage.jsx
// Inbox — ★ Nov 2026 redesign (signed-off mockup "Unis messages inbox"):
//   • header: title + "2 unread · 1 request", round Settings + New buttons
//   • a real search bar at the top (the floating Search pill is gone)
//   • requests are a card at the top, not a quiet tab — tapping it opens the
//     Requests view, where each request has Accept / Decline right on the row
//   • filter chips: All · Unread · Artists · Supporters (from data each row
//     already carries — otherRole, otherSupportsMe, unreadCount)
//   • each row shows the person's area (otherJurisdictionName)
//   • first visit: "Say hi to the artists around you" — this week's top
//     artists in the user's area (GET /v1/awards/standings), each with a
//     Message button. Desktop shows the same as cards in the empty right pane.
// Earlier passes (Oct 2026 premium pass, still true):
//   • rows, tabs and buttons all answer a press; rows start loading their
//     thread the moment a finger lands (utils/dmThreads)
//   • Chats | Requests highlight slides between tabs; skeleton rows while
//     loading; "now · 2m · 5m" stay live
//   • new messages update the row instantly, then the server confirms
//   • PHONE: an open thread takes the whole screen — it slides in over the
//     inbox, the player bar tucks away (a now-playing chip lives in the
//     thread header), the composer rides on top of the keyboard, and the
//     browser's back button / swipe-back / Android back close the thread
//     instead of leaving Messages
// One socket connection lives here and feeds the open thread.
import React, {
  useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { useFeedback } from './context/FeedbackContext';
import buildUrl from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import { useMessagingSocket } from './useMessagingSocket';
import { prefetchThread, parseServerTime, previewFor } from './utils/dmThreads';
import { INTERVAL_IDS } from './utils/idMappings';
import { haptic } from './utils/dmFeedback';
import Layout from './layout';
import MessageThread from './MessageThread';
import MessagePickerSheet from './MessagePickerSheet';
import MessageSettingsSheet from './MessageSettingsSheet';
import {
  ArrowBackIcon, SlidersIcon, ComposeIcon, SearchIcon, CloseIcon, FilterIcon,
  MessagesIcon, NoteIcon, SupportIcon, FindIcon,
} from './icons/UnisIcons';
import './messages.scss';
import TeamInviteCards from './TeamInviteCards'; // ★ artist team invites

const PHONE_QUERY = '(max-width: 820px)';
const TYPING_TTL_MS = 6000;      // a typing "on" with no follow-up expires after this
const REFRESH_DEBOUNCE_MS = 400; // bursts of socket events → one inbox reload
const CLOSE_MS = 340;            // matches the .udm-stage slide in messages.scss
const TICK_MS = 30000;           // relative times refresh this often

const IS_IOS = typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent || '')
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const reducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The backend writes these previews for media-only messages (MessagingService.buildPreview). */
const PREVIEW_SUPPORT = 'Sent support';
const PREVIEW_TRACK = 'Shared a track';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function relativeTime(iso, now) {
  if (!iso) return '';
  const then = parseServerTime(iso);
  const diff = Math.max(0, (now - then.getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return then.toLocaleDateString([], { weekday: 'short' });
  return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function pingUnread() {
  window.dispatchEvent(new Event('unis:messages-updated'));
}

function useMediaQuery(query) {
  const read = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

function useNow(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// Pinned chats: up to 3, private to you (PUT /v1/conversations/{id}/pin).
const PIN_LIMIT = 3;
const LONG_PRESS_MS = 480;
const MOVE_TOLERANCE = 10;

const PinGlyph = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="udm-pin">
    <path d="M9.5 3.5h5l-.8 6.2 3.3 3.3H7l3.3-3.3z" fill="currentColor" fillOpacity="0.25" />
    <path d="M12 13v7.5" />
  </svg>
);

const pinTime = (c) => {
  const t = parseServerTime(c.pinnedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const VerifiedCheck = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Artist" className="udm-check">
    <path d="M12 1.8l2.6 1.9 3.2-.2 1 3.1 2.8 1.6-.6 3.1 1.6 2.8-2.2 2.3-.1 3.2-3.1.7-1.9 2.6-3-1.1-3 1.1-1.9-2.6-3.1-.7-.1-3.2L1.3 14l1.6-2.8-.6-3.1 2.8-1.6 1-3.1 3.2.2z" />
    <path d="M8 12.4l2.7 2.7L16.2 9.6" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Avatar with the optional supporter ring and online dot. */
const Avatar = ({ name, photoUrl, size = 56, ring = false, online = false }) => {
  const [failed, setFailed] = useState(false);
  const face = photoUrl && !failed ? (
    <img className="udm-avatar" src={buildUrl(photoUrl)} alt="" onError={() => setFailed(true)} />
  ) : (
    <span className="udm-avatar udm-mono" style={{ fontSize: Math.round(size * 0.32) }} aria-hidden="true">
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

const Dots = () => (
  <span className="udm-dots" aria-hidden="true"><span /><span /><span /></span>
);

const Preview = ({ conv, typing }) => {
  if (typing) {
    return <span className="udm-conv__preview udm-conv__preview--typing">typing <Dots /></span>;
  }
  const text = conv.lastMessagePreview;
  const you = conv.lastMessageMine ? 'You: ' : '';
  if (text === PREVIEW_SUPPORT) {
    return (
      <span className="udm-conv__preview udm-conv__preview--money">
        <SupportIcon size={15} tone="on" />
        {conv.lastMessageMine ? 'You sent support' : 'Sent you support'}
      </span>
    );
  }
  if (text === PREVIEW_TRACK) {
    return (
      <span className="udm-conv__preview">
        <NoteIcon size={15} tone="on" />
        {you}Shared a song
      </span>
    );
  }
  return <span className="udm-conv__preview">{text ? `${you}${text}` : 'No messages yet'}</span>;
};

const InboxSkeleton = () => (
  <div className="udm-list__skeleton" aria-hidden="true">
    {[58, 72, 46, 64, 52, 68, 40].map((w) => (
      <div key={w} className="udm-skel-row">
        <span className="udm-skel udm-skel--circle" />
        <span className="udm-skel-row__lines">
          <span className="udm-skel udm-skel--line" style={{ width: `${w}%` }} />
          <span className="udm-skel udm-skel--line udm-skel--faint" style={{ width: `${w + 18}%` }} />
        </span>
      </div>
    ))}
  </div>
);

export default function MessagesPage() {
  const { user } = useAuth();
  const me = user?.userId;
  const location = useLocation();
  const navigate = useNavigate();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const now = useNow(TICK_MS);
  const feedback = useFeedback();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('chats');           // view: chats | requests
  const [showFiltered, setShowFiltered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [chip, setChip] = useState('all');           // ★ all | unread | artists | supporters
  const [requestBusy, setRequestBusy] = useState({}); // ★ conversationId → 'accept' | 'decline'
  // ★ This week's top artists in the user's area (first visit + desktop pane).
  const [suggestions, setSuggestions] = useState({ status: 'idle', items: [], live: true });

  // Live events the open thread consumes.
  const [incoming, setIncoming] = useState(null);
  const [liveReaction, setLiveReaction] = useState(null);
  const [liveRead, setLiveRead] = useState(null);
  const [typingMap, setTypingMap] = useState({});    // conversationId → true
  const [presence, setPresence] = useState({});      // userId → online (overrides the last fetch)

  const udmRef = useRef(null);
  const stageRef = useRef(null);
  // Where the phone thread screen is attached — found after the first render,
  // once the page is in the document (see the comment by createPortal below).
  const [stageHost, setStageHost] = useState(null);
  const typingTimers = useRef({});
  const refreshTimer = useRef(null);
  const closeTimer = useRef(null);
  const composeHandled = useRef(false);

  // Refs so callbacks always see the latest values.
  const conversationsRef = useRef(conversations);
  const loadingRef = useRef(loading);
  const selectedIdRef = useRef(selectedId);
  const isPhoneRef = useRef(isPhone);
  const pathRef = useRef(location.pathname);
  conversationsRef.current = conversations;
  loadingRef.current = loading;
  selectedIdRef.current = selectedId;
  isPhoneRef.current = isPhone;
  pathRef.current = location.pathname;

  // History: on phones, opening a thread adds a history entry whose state
  // names the thread ({ udmThread: conversationId | "to:<userId>" }), so
  // back / swipe-back / Android back close it. entryRef = the thread the
  // current entry stands for.
  const entryRef = useRef(null);
  const restoreRef = useRef(null);
  const closeByButton = useRef(false);

  // Hand-off from a profile / dashboard "Message" button.
  // compose = { userId, username?, photoUrl? }. Legacy openWith still supported.
  const compose = useMemo(
    () => location.state?.compose
      || (location.state?.openWith ? { userId: location.state.openWith } : null),
    [location.state],
  );

  const loadConversations = useCallback(async () => {
    try {
      // No lane → every row you can see, each tagged with its lane.
      const res = await apiCall({ url: '/v1/conversations', useCache: false });
      setConversations(res.data || []);
      setPresence({});
      return res.data || [];
    } catch (err) {
      console.error('[Messages] inbox load failed:', err?.message || err);
      // Keeping the rows already on screen is right, but in silence it looked
      // like nothing had changed — a refresh that quietly failed.
      feedback.error("Couldn't refresh your messages. Check your connection.", { id: 'dm-inbox' });
      return conversationsRef.current;
    } finally {
      setLoading(false);
      pingUnread();
    }
  }, [feedback]);

  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(loadConversations, REFRESH_DEBOUNCE_MS);
  }, [loadConversations]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => () => {
    clearTimeout(refreshTimer.current);
    clearTimeout(closeTimer.current);
    Object.values(typingTimers.current).forEach(clearTimeout);
  }, []);

  // iPhone only shows :active press states when the page listens for touches.
  useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);

  /** Reflect a message in its inbox row right away; the next refresh confirms. */
  const patchRow = useCallback((msg, { mine, open }) => {
    setConversations((prev) => {
      const i = prev.findIndex((c) => c.id === msg.conversationId);
      if (i < 0) return prev;
      const c = prev[i];
      const next = {
        ...c,
        lastMessagePreview: previewFor(msg) || c.lastMessagePreview,
        lastMessageMine: mine,
        lastMessageAt: msg.createdAt || c.lastMessageAt,
        lastMessageSeen: false,
        unreadCount: mine || open ? 0 : (c.unreadCount || 0) + 1,
      };
      return [next, ...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  }, []);

  // ── Opening and closing threads ───────────────────────────────────────────
  const pushThreadEntry = useCallback((key) => {
    if (!isPhoneRef.current || !key) return;
    const replace = !!entryRef.current;
    entryRef.current = key;
    navigate(pathRef.current, { replace, state: { udmThread: key } });
  }, [navigate]);

  const openExisting = useCallback((conv, { push = true } = {}) => {
    clearTimeout(closeTimer.current);
    setClosing(false);
    setDraft(null);
    setSelectedId(conv.id);
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)));
    pingUnread();
    if (push) pushThreadEntry(conv.id);
  }, [pushThreadEntry]);

  // Open a person's thread: their existing conversation, or a draft that the
  // first message turns into a real one.
  const openWithUser = useCallback(({ userId, username, photoUrl }, { push = true } = {}) => {
    const existing = conversationsRef.current.find((c) => c.otherUserId === userId);
    if (existing) {
      if (existing.lane && existing.lane !== 'chats') {
        setTab('requests');
        setShowFiltered(existing.lane === 'filtered');
      }
      openExisting(existing, { push });
      return;
    }
    clearTimeout(closeTimer.current);
    setClosing(false);
    setSelectedId(null);
    setTab('chats');
    setDraft({
      id: `draft-${userId}`,
      otherUserId: userId,
      otherUsername: username || null,
      otherPhotoUrl: photoUrl || null,
      _draft: true,
      lane: 'chats',
      lastMessageAt: null,
      lastMessagePreview: '',
      unreadCount: 0,
    });
    if (push) pushThreadEntry(`to:${userId}`);
  }, [openExisting, pushThreadEntry]);

  const finishClose = useCallback(() => {
    setSelectedId(null);
    setDraft(null);
    setClosing(false);
  }, []);

  const closeThread = useCallback(({ animate = true } = {}) => {
    clearTimeout(closeTimer.current);
    if (!isPhoneRef.current || !animate || reducedMotion()) { finishClose(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(finishClose, CLOSE_MS);
  }, [finishClose]);

  // The thread's back button (and Delete / Block): on phones, step back
  // through history so the browser and the screen agree.
  const requestClose = useCallback(() => {
    haptic('tap');
    if (isPhoneRef.current && entryRef.current) {
      closeByButton.current = true;
      navigate(-1);
    } else {
      closeThread({ animate: true });
    }
  }, [navigate, closeThread]);

  const tryRestore = useCallback(() => {
    const wanted = restoreRef.current;
    if (!wanted || loadingRef.current) return;
    restoreRef.current = null;
    if (wanted.startsWith('to:')) {
      openWithUser({ userId: wanted.slice(3) }, { push: false });
      return;
    }
    const c = conversationsRef.current.find((x) => x.id === wanted);
    if (!c) { entryRef.current = null; return; }
    if (c.lane && c.lane !== 'chats') {
      setTab('requests');
      setShowFiltered(c.lane === 'filtered');
    }
    openExisting(c, { push: false });
  }, [openExisting, openWithUser]);

  useEffect(() => { if (!loading) tryRestore(); }, [loading, tryRestore]);

  // Back / forward through thread entries.
  useEffect(() => {
    const wanted = location.state?.udmThread || null;
    if (wanted && wanted === entryRef.current) return;
    if (!wanted) {
      if (!entryRef.current) return;
      entryRef.current = null;
      // iPhone's swipe-back already animated the page away; don't slide twice.
      const animate = closeByButton.current || !IS_IOS;
      closeByButton.current = false;
      closeThread({ animate });
      return;
    }
    // An entry for a thread that isn't open (back from a profile, forward): reopen it.
    entryRef.current = wanted;
    restoreRef.current = wanted;
    tryRestore();
    // Only history moves should run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (!compose || loading || composeHandled.current) return;
    composeHandled.current = true;
    navigate(location.pathname, { replace: true, state: {} });
    openWithUser(compose);
  }, [compose, loading, openWithUser, navigate, location.pathname]);

  // Once a draft's real conversation exists (after the first message), swap to it.
  useEffect(() => {
    if (!draft) return;
    const real = conversations.find((c) => c.otherUserId === draft.otherUserId);
    if (!real) return;
    setSelectedId(real.id);
    setDraft(null);
    if (entryRef.current === `to:${draft.otherUserId}`) {
      entryRef.current = real.id;
      navigate(pathRef.current, { replace: true, state: { udmThread: real.id } });
    }
  }, [conversations, draft, navigate]);

  // ── Socket ────────────────────────────────────────────────────────────────
  const setTyping = useCallback((conversationId, on) => {
    clearTimeout(typingTimers.current[conversationId]);
    setTypingMap((m) => {
      if (!!m[conversationId] === on) return m;
      const next = { ...m };
      if (on) next[conversationId] = true; else delete next[conversationId];
      return next;
    });
    if (on) {
      typingTimers.current[conversationId] = setTimeout(() => setTyping(conversationId, false), TYPING_TTL_MS);
    }
  }, []);

  const onSocketMessage = useCallback((message) => {
    setIncoming(message);
    const mine = message.senderId === me;
    if (!mine) setTyping(message.conversationId, false);
    patchRow(message, { mine, open: message.conversationId === selectedIdRef.current });
    scheduleRefresh();
  }, [me, setTyping, patchRow, scheduleRefresh]);

  const { sendTyping } = useMessagingSocket(onSocketMessage, {
    onTyping: (e) => setTyping(e.conversationId, !!e.typing),
    onPresence: (e) => setPresence((p) => ({ ...p, [e.userId]: !!e.online })),
    onReaction: (e) => setLiveReaction({ ...e, _at: Date.now() }),
    onRead: (e) => { setLiveRead({ ...e, _at: Date.now() }); scheduleRefresh(); },
    onConversation: () => scheduleRefresh(),
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const isOnline = useCallback(
    (c) => (c.otherUserId in presence ? presence[c.otherUserId] : !!c.otherOnline),
    [presence],
  );

  const chats = useMemo(() => conversations.filter((c) => (c.lane || 'chats') === 'chats'), [conversations]);
  const requests = useMemo(() => conversations.filter((c) => c.lane === 'requests'), [conversations]);
  const filtered = useMemo(() => conversations.filter((c) => c.lane === 'filtered'), [conversations]);
  const activeNow = useMemo(() => chats.filter(isOnline).slice(0, 12), [chats, isOnline]);
  const unreadThreads = chats.filter((c) => c.unreadCount > 0).length;

  const laneRows = tab === 'requests' ? (showFiltered ? filtered : requests) : chats;
  const CHIP_TEST = {
    all: () => true,
    unread: (c) => c.unreadCount > 0,
    artists: (c) => c.otherRole === 'artist',
    supporters: (c) => !!c.otherSupportsMe,
  };
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const test = tab === 'chats' ? (CHIP_TEST[chip] || CHIP_TEST.all) : CHIP_TEST.all;
    const rows = laneRows.filter((c) => test(c) && (!q
      || (c.otherUsername || '').toLowerCase().includes(q)
      || (c.lastMessagePreview || '').toLowerCase().includes(q)
      || (c.otherJurisdictionName || '').toLowerCase().includes(q)));
    if (tab !== 'chats') return rows;
    // Pinned chats stay on top, in the order they were pinned.
    const pinned = rows.filter((c) => c.pinnedAt).sort((a, b) => pinTime(a) - pinTime(b));
    return pinned.length ? [...pinned, ...rows.filter((c) => !c.pinnedAt)] : rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneRows, filter, chip, tab]);

  const realSelected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );
  const selected = realSelected || draft;
  const stageOpen = !!selected && !closing;

  // ★ Artists around you — loaded only when it will be seen: a first visit
  // (no chats yet) or the empty right-hand pane on desktop.
  const homeJurisdictionId = user?.jurisdiction?.jurisdictionId || null;
  const homeName = user?.jurisdiction?.name || 'your area';
  const wantSuggestions = !loading && (chats.length === 0 || !isPhone);
  useEffect(() => {
    if (!wantSuggestions || suggestions.status !== 'idle') return undefined;
    if (!homeJurisdictionId || !INTERVAL_IDS.weekly) {
      setSuggestions({ status: 'none', items: [], live: true });
      return undefined;
    }
    let cancelled = false;
    setSuggestions((cur) => ({ ...cur, status: 'loading' }));
    apiCall({
      method: 'get',
      url: `/v1/awards/standings?type=artist&jurisdictionId=${homeJurisdictionId}&intervalId=${INTERVAL_IDS.weekly}&limit=8`,
    })
      .then((res) => {
        if (cancelled) return;
        const items = (res.data?.entries || [])
          .filter((e) => e.targetId && String(e.targetId) !== String(me))
          .slice(0, 6)
          .map((e) => ({
            id: e.targetId,
            name: e.name || e.artistName || 'Artist',
            photoUrl: e.artworkUrl || null,
            rank: e.rank,
          }));
        setSuggestions({ status: items.length ? 'ready' : 'none', items, live: res.data?.state === 'LIVE' });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[Messages] artist suggestions failed:', err?.response?.status, err?.message);
        setSuggestions({ status: 'none', items: [], live: true });
      });
    return () => { cancelled = true; };
  }, [wantSuggestions, suggestions.status, homeJurisdictionId, me]);

  useLayoutEffect(() => {
    const el = udmRef.current;
    setStageHost(el?.closest('.app-wrapper') || document.getElementById('root') || document.body);
  }, []);

  // PHONE: the open thread owns the screen — tuck the player bar away and
  // stop the page behind it from scrolling.
  useEffect(() => {
    if (!isPhone) return undefined;
    document.body.classList.toggle('udm-immersive', stageOpen);
    return () => document.body.classList.remove('udm-immersive');
  }, [isPhone, stageOpen]);

  // PHONE: size the stage to the part of the screen the keyboard leaves, so
  // the composer sits right on top of it (iPhone doesn't resize the page).
  useEffect(() => {
    const el = stageRef.current;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!isPhone || !el || !vv) return undefined;
    const apply = () => {
      el.style.setProperty('--udm-vvh', `${vv.height}px`);
      el.style.setProperty('--udm-vvt', `${vv.offsetTop}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, [isPhone, stageHost]);


  const openPicker = () => { haptic('tap'); setPickerOpen(true); };

  const pickPerson = (person) => {
    setPickerOpen(false);
    openWithUser({ userId: person.id, username: person.name, photoUrl: person.artworkUrl });
  };

  const openRequests = () => {
    haptic('tap');
    setTab('requests');
    setShowFiltered(false);
  };

  const closeRequests = () => {
    haptic('tap');
    setTab('chats');
    setShowFiltered(false);
  };

  const pickChip = (next) => {
    if (next !== chip) haptic('tap');
    setChip(next);
  };

  // ★ Accept / Decline right on the request row (same endpoints the thread uses).
  const answerRequest = async (c, action) => {
    if (requestBusy[c.id]) return;
    const name = c.otherUsername || 'them';
    setRequestBusy((b) => ({ ...b, [c.id]: action }));
    try {
      await apiCall({ method: 'post', url: `/v1/conversations/${c.id}/${action}` });
      haptic(action === 'accept' ? 'success' : 'tap');
      feedback.success(action === 'accept' ? `You can now message ${name}` : `Request from ${name} declined`);
      await loadConversations();
    } catch (err) {
      console.error(`[Messages] ${action} request failed:`, err?.message || err);
      feedback.error(action === 'accept'
        ? 'Couldn’t accept this request. Try again.'
        : 'Couldn’t decline this request. Try again.');
    } finally {
      setRequestBusy((b) => {
        const next = { ...b };
        delete next[c.id];
        return next;
      });
    }
  };

  // ★ Pin / unpin a chat. Optimistic, rolled back if the server says no.
  const [pinMenu, setPinMenu] = useState(null); // { conv, x, y }
  const pinBusy = useRef(new Set());

  const togglePin = useCallback(async (c) => {
    if (!c || c._draft || c.lane !== 'chats' || pinBusy.current.has(c.id)) return;
    const pinning = !c.pinnedAt;
    const name = c.otherUsername || 'this chat';
    if (pinning && conversations.filter((x) => x.lane === 'chats' && x.pinnedAt).length >= PIN_LIMIT) {
      haptic('error');
      feedback.info(`You can pin up to ${PIN_LIMIT} chats. Unpin one first.`, { id: 'dm-pin' });
      return;
    }
    const before = c.pinnedAt || null;
    const setPinnedAt = (value) => setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, pinnedAt: value } : x)));
    pinBusy.current.add(c.id);
    setPinnedAt(pinning ? new Date().toISOString() : null);
    try {
      const res = await apiCall({ method: 'put', url: `/v1/conversations/${c.id}/pin`, data: { pinned: pinning } });
      if (pinning && res.data?.pinnedAt) setPinnedAt(res.data.pinnedAt);
      haptic('success');
      feedback.success(pinning ? `Pinned ${name}` : `Unpinned ${name}`, { id: 'dm-pin' });
      console.info(`[Messages] ${pinning ? 'pinned' : 'unpinned'} conversation ${c.id}`);
    } catch (err) {
      setPinnedAt(before);
      console.error(`[Messages] ${pinning ? 'pin' : 'unpin'} failed:`, err?.response?.status, err?.message);
      feedback.error(err?.response?.data?.error
        || (pinning ? 'Couldn’t pin this chat. Try again.' : 'Couldn’t unpin this chat. Try again.'), { id: 'dm-pin' });
    } finally {
      pinBusy.current.delete(c.id);
    }
  }, [conversations, feedback]);

  const openPinMenu = (c, x, y) => {
    haptic('press');
    setPinMenu({ conv: c, x, y });
  };
  const closePinMenu = useCallback(() => setPinMenu(null), []);

  useEffect(() => {
    if (!pinMenu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePinMenu(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', closePinMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closePinMenu);
    };
  }, [pinMenu, closePinMenu]);

  // Long-press (touch) or right-click (mouse) on a chat row opens Pin / Unpin.
  const press = useRef({ timer: null, x: 0, y: 0, fired: false });
  const clearPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };
  useEffect(() => () => clearPress(), []);

  const rowGestures = (c) => {
    if (c.lane !== 'chats') return {};
    return {
      onContextMenu: (e) => {
        e.preventDefault();
        clearPress();
        openPinMenu(c, e.clientX, e.clientY);
      },
      onPointerDown: (e) => {
        press.current.fired = false;
        if (e.pointerType !== 'touch') return;
        clearPress();
        press.current.x = e.clientX;
        press.current.y = e.clientY;
        press.current.timer = setTimeout(() => {
          press.current.timer = null;
          press.current.fired = true;
          openPinMenu(c, press.current.x, press.current.y);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e) => {
        if (!press.current.timer) return;
        if (Math.abs(e.clientX - press.current.x) > MOVE_TOLERANCE
          || Math.abs(e.clientY - press.current.y) > MOVE_TOLERANCE) clearPress();
      },
      onPointerUp: clearPress,
      onPointerCancel: clearPress,
      onPointerLeave: clearPress,
      onClickCapture: (e) => {
        // The long-press opened the menu — don't also open the chat.
        if (press.current.fired) {
          press.current.fired = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
    };
  };

  const messageArtist = (a) => {
    haptic('tap');
    openWithUser({ userId: a.id, username: a.name, photoUrl: a.photoUrl });
  };

  const onThreadActivity = useCallback((saved) => {
    const known = saved && conversationsRef.current.some((c) => c.id === saved.conversationId);
    if (!known) { loadConversations(); return; }   // a draft just became a real conversation
    patchRow(saved, { mine: true, open: true });
    scheduleRefresh();
  }, [loadConversations, patchRow, scheduleRefresh]);

  const subline = loading
    ? ' '
    : conversations.length === 0
      ? 'No conversations yet'
      : [
        unreadThreads > 0 ? `${unreadThreads} unread` : 'All caught up',
        requests.length > 0 ? `${requests.length} request${requests.length === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · ');

  const emptyActions = (
    <div className="udm-empty__actions">
      <button type="button" className="udm-new udm-new--sm" onClick={openPicker}>
        <ComposeIcon size={18} tone="on" />
        New message
      </button>
      <button type="button" className="udm-ghost" onClick={() => navigate('/findpage')}>
        <FindIcon size={17} />
        Find artists near you
      </button>
    </div>
  );

  const thread = selected ? (
    <MessageThread
      key={selected.otherUserId}
      conversation={selected}
      currentUserId={me}
      incomingMessage={incoming}
      incomingReaction={liveReaction}
      incomingRead={liveRead}
      otherTyping={!!typingMap[selected.id]}
      otherOnline={selected._draft ? false : isOnline(selected)}
      isPhone={isPhone}
      sendTyping={sendTyping}
      onBack={requestClose}
      onActivity={onThreadActivity}
      onAccepted={() => { setTab('chats'); setShowFiltered(false); loadConversations(); }}
      onRequestGone={() => { requestClose(); loadConversations(); }}
      pinned={!!realSelected?.pinnedAt}
      onTogglePin={realSelected && realSelected.lane === 'chats' ? () => togglePin(realSelected) : undefined}
    />
  ) : null;

  return (
    <Layout hideFooter>
      <div ref={udmRef} className={`udm${isPhone && stageOpen ? ' udm--stage-open' : ''}`}>
        <aside className="udm-list" aria-label="Conversations">
          <div className="udm-glow" aria-hidden="true" />

          {tab === 'requests' ? (
            <header className="udm-list__head udm-list__head--sub">
              <button type="button" className="udm-round" onClick={closeRequests} aria-label="Back to messages">
                <ArrowBackIcon size={20} />
              </button>
              <h1 className="udm-list__title udm-list__title--sub">
                {showFiltered ? 'Filtered requests' : 'Requests'}
              </h1>
            </header>
          ) : (
            <header className="udm-list__head">
              <div className="udm-list__titlerow">
                <div className="udm-list__titles">
                  <h1 className="udm-list__title">Messages</h1>
                  <span className="udm-list__sub">
                    {unreadThreads > 0 && !loading
                      ? <><b>{unreadThreads} unread</b>{subline.replace(/^\d+ unread/, '')}</>
                      : subline}
                  </span>
                </div>
                <div className="udm-list__actions">
                  <button type="button" className="udm-round" onClick={() => { haptic('tap'); setSettingsOpen(true); }} aria-label="Message settings">
                    <SlidersIcon size={20} />
                  </button>
                  <button type="button" className="udm-round udm-round--solid" onClick={openPicker} aria-label="New message">
                    <ComposeIcon size={19} tone="on" />
                  </button>
                </div>
              </div>

              {conversations.length > 0 || loading ? (
                <label className="udm-search" htmlFor="udm-filter">
                  <SearchIcon size={18} />
                  <span className="udm-sr">Search messages</span>
                  <input
                    id="udm-filter"
                    type="search"
                    value={filter}
                    placeholder="Search messages"
                    onChange={(e) => setFilter(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setFilter(''); }}
                    autoComplete="off"
                  />
                  {filter && (
                    <button type="button" className="udm-search__clear" onClick={() => setFilter('')} aria-label="Clear search">
                      <CloseIcon size={15} tone="on" />
                    </button>
                  )}
                </label>
              ) : (
                // No chats yet: search means finding someone new.
                <button type="button" className="udm-search udm-search--button" onClick={openPicker}>
                  <SearchIcon size={18} />
                  Search anyone on Unis
                </button>
              )}
            </header>
          )}

          <div className="udm-list__scroll">
            {/* Artist team invites, pinned on top (Accept / Decline) */}
            {tab === 'chats' && <TeamInviteCards />}

            {/* Requests can't hide: a card at the top, not a quiet tab */}
            {tab === 'chats' && !loading && requests.length > 0 && (
              <button type="button" className="udm-reqcard" onClick={openRequests}>
                <Avatar name={requests[0].otherUsername} photoUrl={requests[0].otherPhotoUrl} size={40} />
                <span className="udm-reqcard__text">
                  <span className="udm-reqcard__title">Message requests</span>
                  <span className="udm-reqcard__sub">
                    {requests[0].otherUsername || 'Someone'}
                    {requests.length > 1 ? ` and ${requests.length - 1} other${requests.length > 2 ? 's' : ''} want` : ' wants'} to message you
                  </span>
                </span>
                <span className="udm-badge">{requests.length}</span>
                <ArrowBackIcon size={15} tone="on" className="udm-folder__chev" />
              </button>
            )}

            {tab === 'chats' && activeNow.length > 0 && (
              <section className="udm-active" aria-label="Active now">
                <h2 className="udm-active__label">
                  <span className="udm-active__pulse" aria-hidden="true" />
                  Active now
                </h2>
                <div className="udm-active__row">
                  {activeNow.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="udm-active__item"
                      onPointerDown={() => prefetchThread(me, c.id)}
                      onClick={() => openExisting(c)}
                      aria-label={`${c.otherUsername || 'Unknown'}, active now`}
                    >
                      <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} size={60} ring={c.otherSupportsMe} online />
                      <span className="udm-active__name">{(c.otherUsername || 'Unknown').split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tab === 'chats' && !loading && chats.length > 0 && (
              <div className="udm-chips" role="tablist" aria-label="Filter conversations">
                {[
                  ['all', 'All', null],
                  ['unread', 'Unread', unreadThreads || null],
                  ['artists', 'Artists', null],
                  ['supporters', 'Supporters', null],
                ].map(([id, label, count]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={chip === id}
                    className={`udm-chip${chip === id ? ' is-on' : ''}`}
                    onClick={() => pickChip(id)}
                  >
                    {label}
                    {count != null && chip !== id && <span className="udm-chip__count">{count}</span>}
                  </button>
                ))}
              </div>
            )}

            {tab === 'requests' && !showFiltered && !loading && requests.length > 0 && (
              <p className="udm-list__note">
                People you don&rsquo;t follow yet. They won&rsquo;t know you&rsquo;ve seen it until you accept.
              </p>
            )}

            {loading && <InboxSkeleton />}

            {/* First visit: the artists around you */}
            {!loading && tab === 'chats' && chats.length === 0 && !draft && (
              <div className="udm-first">
                <h2 className="udm-first__title">Say hi to the artists <em>around you</em></h2>
                <p className="udm-first__sub">
                  Tell an artist you like their music. It&rsquo;s how a lot of Unis friendships start.
                </p>
                {suggestions.status === 'loading' && <InboxSkeleton />}
                {suggestions.status === 'ready' && (
                  <section className="udm-suggest" aria-label={`Top artists in ${homeName}`}>
                    <p className="udm-suggest__label">
                      Top in {homeName} {suggestions.live ? 'this week' : 'last week'}
                    </p>
                    {suggestions.items.slice(0, 5).map((a, i) => (
                      <div key={a.id} className="udm-suggest__row">
                        <span className="udm-suggest__rank">{a.rank || i + 1}</span>
                        <Avatar name={a.name} photoUrl={a.photoUrl} size={44} />
                        <span className="udm-suggest__name">
                          <span className="udm-conv__name-text">{a.name}</span>
                          <VerifiedCheck size={15} />
                        </span>
                        <button type="button" className="udm-suggest__msg" onClick={() => messageArtist(a)} aria-label={`Message ${a.name}`}>
                          Message
                        </button>
                      </div>
                    ))}
                  </section>
                )}
                {suggestions.status === 'ready' ? (
                  <button type="button" className="udm-ghost udm-ghost--wide" onClick={() => navigate('/findpage')}>
                    <FindIcon size={17} />
                    See more artists near you
                  </button>
                ) : suggestions.status !== 'loading' && emptyActions}
              </div>
            )}

            {!loading && tab === 'requests' && laneRows.length === 0 && (
              <div className="udm-empty udm-empty--quiet">
                <span className="udm-empty__icon">
                  {showFiltered ? <FilterIcon size={30} /> : <MessagesIcon size={30} />}
                </span>
                <h2 className="udm-empty__title">
                  {showFiltered ? <>Nothing <em>filtered</em></> : <>No <em>requests</em></>}
                </h2>
                <p className="udm-empty__sub">
                  {showFiltered
                    ? 'Bulk and low-quality requests would show up here.'
                    : 'Messages from people you don’t know yet wait here. They never notify you.'}
                </p>
              </div>
            )}

            {!loading && laneRows.length > 0 && visible.length === 0 && (
              <div className="udm-list__hint">
                {filter.trim()
                  ? <>No conversations match &ldquo;{filter.trim()}&rdquo;.</>
                  : 'Nothing here right now.'}
              </div>
            )}

            {!loading && visible.map((c) => {
              const unread = c.unreadCount > 0;
              const typing = !!typingMap[c.id];
              const online = isOnline(c);
              const isRequest = c.lane === 'requests';
              const busy = requestBusy[c.id];
              const pinned = !isRequest && !!c.pinnedAt;
              const g = rowGestures(c);
              const row = (
                <button
                  type="button"
                  key={c.id}
                  className={`udm-conv${c.id === selectedId ? ' active' : ''}${unread ? ' unread' : ''}${pinned ? ' pinned' : ''}`}
                  {...g}
                  onPointerDown={(e) => { prefetchThread(me, c.id); g.onPointerDown?.(e); }}
                  onClick={() => openExisting(c)}
                  aria-label={`${c.otherUsername || 'Unknown'}${pinned ? ', pinned' : ''}${c.otherJurisdictionName ? `, ${c.otherJurisdictionName}` : ''}${online ? ', active now' : ''}${unread ? `, ${c.unreadCount} unread` : ''}`}
                >
                  <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} size={52} ring={c.otherSupportsMe} online={online} />
                  <span className="udm-conv__body">
                    <span className="udm-conv__name">
                      <span className="udm-conv__name-text">{c.otherUsername || 'Unknown'}</span>
                      {c.otherRole === 'artist' && <VerifiedCheck size={15} />}
                      {c.otherJurisdictionName && (
                        <span className="udm-conv__place">{c.otherJurisdictionName}</span>
                      )}
                    </span>
                    <Preview conv={c} typing={typing} />
                  </span>
                  <span className="udm-conv__side">
                    <span className="udm-conv__time">
                      {pinned && <PinGlyph />}
                      {relativeTime(c.lastMessageAt, now)}
                    </span>
                    {unread ? (
                      <span className="udm-badge" key={c.unreadCount}>{c.unreadCount}</span>
                    ) : c.lastMessageSeen ? (
                      <span className="udm-conv__seen" title="Seen">
                        <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} size={16} />
                        <span className="udm-sr">Seen</span>
                      </span>
                    ) : (
                      <span className="udm-conv__spacer" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
              if (!isRequest) return row;
              return (
                <div key={c.id} className="udm-reqrow">
                  {row}
                  <div className="udm-reqrow__actions">
                    <button
                      type="button"
                      className="udm-reqrow__btn udm-reqrow__btn--accept"
                      onClick={() => answerRequest(c, 'accept')}
                      disabled={!!busy}
                    >
                      {busy === 'accept' ? 'Accepting…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="udm-reqrow__btn"
                      onClick={() => answerRequest(c, 'decline')}
                      disabled={!!busy}
                    >
                      {busy === 'decline' ? 'Declining…' : 'Decline'}
                    </button>
                  </div>
                </div>
              );
            })}

            {tab === 'requests' && !showFiltered && !loading && (
              <button type="button" className="udm-folder" onClick={() => { haptic('tap'); setShowFiltered(true); }}>
                <FilterIcon size={19} />
                Filtered requests
                <span className="udm-folder__count">{filtered.length}</span>
                <ArrowBackIcon size={15} tone="on" className="udm-folder__chev" />
              </button>
            )}
            {tab === 'requests' && showFiltered && (
              <button type="button" className="udm-folder udm-folder--back" onClick={() => setShowFiltered(false)}>
                <ArrowBackIcon size={18} tone="on" />
                Back to requests
              </button>
            )}
          </div>

          <div className="udm-list__fade" aria-hidden="true" />
        </aside>

        {!isPhone && (
          <section className="udm-main">
            {thread || (
              <div className="udm-main__placeholder">
                <span className="udm-empty__icon udm-empty__icon--lg"><MessagesIcon size={40} /></span>
                <h2 className="udm-main__title">
                  {chats.length > 0 ? 'Pick a chat, or say hi to the artists ' : 'Say hi to the artists '}
                  <em>around you</em>
                </h2>
                {suggestions.status === 'ready' ? (
                  <>
                    <p className="udm-empty__sub">Top in {homeName} {suggestions.live ? 'this week' : 'last week'}</p>
                    <div className="udm-cards">
                      {suggestions.items.map((a, i) => (
                        <div key={a.id} className="udm-card">
                          <Avatar name={a.name} photoUrl={a.photoUrl} size={72} />
                          <span className="udm-card__name">
                            <span className="udm-conv__name-text">{a.name}</span>
                            <VerifiedCheck size={15} />
                          </span>
                          <span className="udm-card__meta">#{a.rank || i + 1} this week</span>
                          <button type="button" className="udm-suggest__msg" onClick={() => messageArtist(a)} aria-label={`Message ${a.name}`}>
                            Message
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="udm-empty__sub">
                      {activeNow.length > 0
                        ? `${activeNow.length} ${activeNow.length === 1 ? 'person is' : 'people are'} active now.`
                        : 'Pick a chat, or start a new one.'}
                    </p>
                    {activeNow.length > 0 && (
                      <div className="udm-placeholder__faces">
                        {activeNow.slice(0, 5).map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            className="udm-placeholder__face"
                            onPointerDown={() => prefetchThread(me, c.id)}
                            onClick={() => openExisting(c)}
                            aria-label={`Message ${c.otherUsername || 'Unknown'}`}
                          >
                            <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} size={54} ring={c.otherSupportsMe} online />
                          </button>
                        ))}
                      </div>
                    )}
                    {emptyActions}
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* PHONE thread screen. Attached to .app-wrapper (the app shell), not
          inside the page and not straight into #root:
            • inside the page it would sit under the header — the page's
              .layout-container is its own z-index:1 layer
            • straight into #root it would also cover the "Play now / Add to
              queue" prompt and the expanded player, which live in the shell
          In the shell it sits above the header, sidebar and song pop-ups, and
          below the player and that prompt (z-index in messages.scss). */}
      {isPhone && stageHost && createPortal(
        <div
          className={`udm-stage${stageOpen ? ' is-open' : ''}`}
          ref={stageRef}
          aria-hidden={!stageOpen}
        >
          {thread}
        </div>,
        stageHost,
      )}

      {/* Pin / Unpin — from a long-press or right-click on a chat row */}
      {pinMenu && stageHost && createPortal(
        <div
          className="udm-pinlayer"
          onPointerDown={closePinMenu}
          onContextMenu={(e) => { e.preventDefault(); closePinMenu(); }}
        >
          <div
            className="udm-pinmenu"
            role="menu"
            aria-label={`Options for ${pinMenu.conv.otherUsername || 'this chat'}`}
            style={{
              left: Math.max(8, Math.min(pinMenu.x, window.innerWidth - 228)),
              top: Math.max(8, Math.min(pinMenu.y, window.innerHeight - 120)),
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="udm-pinmenu__name">{pinMenu.conv.otherUsername || 'Unknown'}</span>
            <button
              type="button"
              role="menuitem"
              className="udm-pinmenu__item"
              autoFocus
              onClick={() => { const c = pinMenu.conv; closePinMenu(); togglePin(c); }}
            >
              <PinGlyph size={18} />
              {pinMenu.conv.pinnedAt ? 'Unpin chat' : 'Pin chat'}
            </button>
          </div>
        </div>,
        stageHost,
      )}

      <MessagePickerSheet
        open={pickerOpen}
        mode="people"
        excludeUserId={me}
        onClose={() => setPickerOpen(false)}
        onPick={pickPerson}
      />

      <MessageSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChanged={scheduleRefresh}
      />
    </Layout>
  );
}
