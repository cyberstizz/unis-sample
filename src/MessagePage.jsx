// src/MessagePage.jsx
// Inbox — FOMO-inspired look on the two-lane backend, rebuilt for feel
// (Oct 2026 premium pass):
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
import buildUrl from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import { useMessagingSocket } from './useMessagingSocket';
import { prefetchThread, parseServerTime, previewFor } from './utils/dmThreads';
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

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('chats');           // chats | requests
  const [showFiltered, setShowFiltered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [indicator, setIndicator] = useState(null);  // { x, w } of the active tab

  // Live events the open thread consumes.
  const [incoming, setIncoming] = useState(null);
  const [liveReaction, setLiveReaction] = useState(null);
  const [liveRead, setLiveRead] = useState(null);
  const [typingMap, setTypingMap] = useState({});    // conversationId → true
  const [presence, setPresence] = useState({});      // userId → online (overrides the last fetch)

  const searchRef = useRef(null);
  const stageRef = useRef(null);
  const tabRefs = useRef({});
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
      return conversationsRef.current;
    } finally {
      setLoading(false);
      pingUnread();
    }
  }, []);

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

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

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
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return laneRows;
    return laneRows.filter((c) =>
      (c.otherUsername || '').toLowerCase().includes(q)
      || (c.lastMessagePreview || '').toLowerCase().includes(q));
  }, [laneRows, filter]);

  const realSelected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );
  const selected = realSelected || draft;
  const stageOpen = !!selected && !closing;

  // The sliding Chats | Requests highlight.
  useLayoutEffect(() => {
    const b = tabRefs.current[tab];
    if (!b) return;
    setIndicator((cur) => (cur && cur.x === b.offsetLeft && cur.w === b.offsetWidth
      ? cur : { x: b.offsetLeft, w: b.offsetWidth }));
  }, [tab, requests.length, loading, activeNow.length]);

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
  }, [isPhone]);

  const closeSearch = () => { setSearchOpen(false); setFilter(''); };

  const openPicker = () => { haptic('tap'); setPickerOpen(true); };

  const pickPerson = (person) => {
    setPickerOpen(false);
    openWithUser({ userId: person.id, username: person.name, photoUrl: person.artworkUrl });
  };

  const switchTab = (next) => {
    if (next !== tab) haptic('tap');
    setTab(next);
    setShowFiltered(false);
  };

  const onThreadActivity = useCallback((saved) => {
    const known = saved && conversationsRef.current.some((c) => c.id === saved.conversationId);
    if (!known) { loadConversations(); return; }   // a draft just became a real conversation
    patchRow(saved, { mine: true, open: true });
    scheduleRefresh();
  }, [loadConversations, patchRow, scheduleRefresh]);

  const subline = loading
    ? ' '
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
    />
  ) : null;

  const portalTarget = typeof document !== 'undefined'
    ? (document.getElementById('root') || document.body)
    : null;

  return (
    <Layout hideFooter>
      <div className={`udm${isPhone && stageOpen ? ' udm--stage-open' : ''}`}>
        <aside className="udm-list" aria-label="Conversations">
          <div className="udm-glow" aria-hidden="true" />

          <header className="udm-list__head">
            <div className="udm-list__toprow">
              <button type="button" className="udm-round" onClick={() => navigate(-1)} aria-label="Back">
                <ArrowBackIcon size={22} />
              </button>
              <button type="button" className="udm-round" onClick={() => { haptic('tap'); setSettingsOpen(true); }} aria-label="Message settings">
                <SlidersIcon size={22} />
              </button>
            </div>
            <div className="udm-list__titlerow">
              <div className="udm-list__titles">
                <h1 className="udm-list__title">Messages</h1>
                <span className="udm-list__sub">{subline}</span>
              </div>
              <button type="button" className="udm-new" onClick={openPicker}>
                <ComposeIcon size={19} tone="on" />
                New
              </button>
            </div>
          </header>

          <div className="udm-list__scroll">
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
                      <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} size={66} ring={c.otherSupportsMe} online />
                      <span className="udm-active__name">{(c.otherUsername || 'Unknown').split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="udm-tabs" role="tablist" aria-label="Inbox lanes">
              <span
                className={`udm-tabs__ind${indicator ? ' is-ready' : ''}`}
                style={indicator ? { transform: `translateX(${indicator.x}px)`, width: indicator.w } : undefined}
                aria-hidden="true"
              />
              <button
                type="button"
                role="tab"
                ref={(el) => { tabRefs.current.chats = el; }}
                aria-selected={tab === 'chats'}
                className={`udm-tab${tab === 'chats' ? ' is-on' : ''}`}
                onClick={() => switchTab('chats')}
              >
                Chats
              </button>
              <button
                type="button"
                role="tab"
                ref={(el) => { tabRefs.current.requests = el; }}
                aria-selected={tab === 'requests'}
                className={`udm-tab${tab === 'requests' ? ' is-on' : ''}`}
                onClick={() => switchTab('requests')}
              >
                Requests
                {requests.length > 0 && <span className="udm-tab__count">{requests.length}</span>}
              </button>
            </div>

            {tab === 'requests' && showFiltered && (
              <button type="button" className="udm-folder udm-folder--back" onClick={() => setShowFiltered(false)}>
                <ArrowBackIcon size={18} tone="on" />
                Filtered requests
              </button>
            )}

            {loading && <InboxSkeleton />}

            {!loading && laneRows.length === 0 && !(tab === 'chats' && draft) && (
              tab === 'chats' ? (
                <div className="udm-empty">
                  <span className="udm-empty__icon"><MessagesIcon size={34} /></span>
                  <h2 className="udm-empty__title">No chats <em>yet</em></h2>
                  <p className="udm-empty__sub">Message an artist near you, or anyone on Unis.</p>
                  {emptyActions}
                </div>
              ) : (
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
              )
            )}

            {!loading && filter && laneRows.length > 0 && visible.length === 0 && (
              <div className="udm-list__hint">No conversations match &ldquo;{filter.trim()}&rdquo;.</div>
            )}

            {!loading && visible.map((c) => {
              const unread = c.unreadCount > 0;
              const typing = !!typingMap[c.id];
              const online = isOnline(c);
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`udm-conv${c.id === selectedId ? ' active' : ''}${unread ? ' unread' : ''}`}
                  onPointerDown={() => prefetchThread(me, c.id)}
                  onClick={() => openExisting(c)}
                  aria-label={`${c.otherUsername || 'Unknown'}${online ? ', active now' : ''}${unread ? `, ${c.unreadCount} unread` : ''}`}
                >
                  <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} ring={c.otherSupportsMe} online={online} />
                  <span className="udm-conv__body">
                    <span className="udm-conv__name">
                      <span className="udm-conv__name-text">{c.otherUsername || 'Unknown'}</span>
                      {c.otherRole === 'artist' && <VerifiedCheck />}
                    </span>
                    <Preview conv={c} typing={typing} />
                  </span>
                  <span className="udm-conv__side">
                    <span className="udm-conv__time">{relativeTime(c.lastMessageAt, now)}</span>
                    {unread ? (
                      <span className="udm-badge" key={c.unreadCount}>{c.unreadCount}</span>
                    ) : c.lastMessageSeen ? (
                      <span className="udm-conv__seen" title="Seen">
                        <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} size={18} />
                        <span className="udm-sr">Seen</span>
                      </span>
                    ) : (
                      <span className="udm-conv__spacer" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })}

            {tab === 'requests' && !showFiltered && !loading && (
              <>
                {requests.length > 0 && (
                  <p className="udm-list__note">
                    They won&rsquo;t know you&rsquo;ve seen a request until you accept it.
                  </p>
                )}
                <button type="button" className="udm-folder" onClick={() => { haptic('tap'); setShowFiltered(true); }}>
                  <FilterIcon size={19} />
                  Filtered requests
                  <span className="udm-folder__count">{filtered.length}</span>
                  <ArrowBackIcon size={15} tone="on" className="udm-folder__chev" />
                </button>
              </>
            )}
          </div>

          <div className="udm-list__fade" aria-hidden="true" />

          {searchOpen ? (
            <div className="udm-float udm-float--input">
              <SearchIcon size={19} />
              <label className="udm-sr" htmlFor="udm-filter">Search conversations</label>
              <input
                id="udm-filter"
                ref={searchRef}
                type="search"
                value={filter}
                placeholder="Search conversations"
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
                autoComplete="off"
              />
              <button type="button" className="udm-float__close" onClick={closeSearch} aria-label="Close search">
                <CloseIcon size={17} tone="on" />
              </button>
            </div>
          ) : (
            conversations.length > 0 && (
              <button type="button" className="udm-float" onClick={() => { haptic('tap'); setSearchOpen(true); }}>
                <SearchIcon size={19} />
                Search
              </button>
            )
          )}
        </aside>

        {!isPhone && (
          <section className="udm-main">
            {thread || (
              <div className="udm-main__placeholder">
                <span className="udm-empty__icon udm-empty__icon--lg"><MessagesIcon size={44} /></span>
                <h2 className="udm-empty__title">Say <em>something</em></h2>
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
              </div>
            )}
          </section>
        )}
      </div>

      {isPhone && portalTarget && createPortal(
        <div
          className={`udm-stage${stageOpen ? ' is-open' : ''}`}
          ref={stageRef}
          aria-hidden={!stageOpen}
        >
          {thread}
        </div>,
        portalTarget,
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
