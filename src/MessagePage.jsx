// src/MessagePage.jsx
// Inbox — FOMO-inspired look (Oct 2026 mockup) on the two-lane backend
// (MessagingService, sql/V2026_10f__messaging_lanes.sql):
//   • big "Messages" title, unread + requests line, accent "New" button
//   • Active now row (mutual activity status), Chats | Requests pills
//   • borderless rows: supporter ring, online dot, artist check, typing,
//     "You:" prefix, two-line right column (time + unread or Seen face)
//   • Requests lane with a Filtered folder for bulk / low-quality requests
//   • floating glass "Search" pill that filters the list in place
// One socket connection lives here and feeds the open thread.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import { useMessagingSocket } from './useMessagingSocket';
import Layout from './layout';
import MessageThread from './MessageThread';
import MessagePickerSheet from './MessagePickerSheet';
import MessageSettingsSheet from './MessageSettingsSheet';
import './messages.scss';

const TYPING_TTL_MS = 6000;      // a typing "on" with no follow-up expires after this
const REFRESH_DEBOUNCE_MS = 300; // bursts of socket events → one inbox reload

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return new Date(iso).toLocaleDateString([], { weekday: 'short' });
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function pingUnread() {
  window.dispatchEvent(new Event('unis:messages-updated'));
}

/** The backend writes these previews for media-only messages (MessagingService.buildPreview). */
const PREVIEW_SUPPORT = 'Sent support';
const PREVIEW_TRACK = 'Shared a track';

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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3.2c0 4.3 9 2.3 9 6.6 0 1.9-2 3.2-4.5 3.2s-4.5-1.3-4.5-3" />
        </svg>
        {conv.lastMessageMine ? 'You sent support' : 'Sent you support'}
      </span>
    );
  }
  if (text === PREVIEW_TRACK) {
    return (
      <span className="udm-conv__preview">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        {you}Shared a song
      </span>
    );
  }
  return <span className="udm-conv__preview">{text ? `${you}${text}` : 'No messages yet'}</span>;
};

export default function MessagesPage() {
  const { user } = useAuth();
  const currentUserId = user?.userId;
  const location = useLocation();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('chats');           // chats | requests
  const [showFiltered, setShowFiltered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState('');

  // Live events the open thread consumes.
  const [incoming, setIncoming] = useState(null);
  const [liveReaction, setLiveReaction] = useState(null);
  const [liveRead, setLiveRead] = useState(null);
  const [liveConversation, setLiveConversation] = useState(null);
  const [typingMap, setTypingMap] = useState({});    // conversationId → true
  const [presence, setPresence] = useState({});      // userId → online (overrides the last fetch)

  const searchRef = useRef(null);
  const typingTimers = useRef({});
  const refreshTimer = useRef(null);

  // Hand-off from a profile / dashboard "Message" button.
  // compose = { userId, username?, photoUrl? }. Legacy openWith still supported.
  const compose = location.state?.compose
    || (location.state?.openWith ? { userId: location.state.openWith } : null);
  const composeHandled = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      // No lane → every row you can see, each tagged with its lane.
      const res = await apiCall({ url: '/v1/conversations', useCache: false });
      setConversations(res.data || []);
      setPresence({});
      return res.data || [];
    } catch (err) {
      console.error('[Messages] inbox load failed:', err?.message || err);
      setConversations([]);
      return [];
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
    Object.values(typingTimers.current).forEach(clearTimeout);
  }, []);

  const openExisting = useCallback((conv) => {
    setDraft(null);
    setSelectedId(conv.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)));
    pingUnread();
  }, []);

  // Open a person's thread: their existing conversation, or a draft that the
  // first message turns into a real one.
  const openWithUser = useCallback(({ userId, username, photoUrl }) => {
    const existing = conversations.find((c) => c.otherUserId === userId);
    if (existing) {
      if (existing.lane !== 'chats') setTab('requests');
      openExisting(existing);
      return;
    }
    setSelectedId(null);
    setTab('chats');
    setDraft({
      id: `draft-${userId}`,
      otherUserId: userId,
      otherUsername: username || 'Member',
      otherPhotoUrl: photoUrl || null,
      _draft: true,
      lane: 'chats',
      lastMessageAt: null,
      lastMessagePreview: '',
      unreadCount: 0,
    });
  }, [conversations, openExisting]);

  useEffect(() => {
    if (!compose || loading || composeHandled.current) return;
    composeHandled.current = true;
    openWithUser(compose);
    navigate(location.pathname, { replace: true, state: {} });
  }, [compose, loading, openWithUser, navigate, location.pathname]);

  // Once a draft's real conversation exists (after the first message), swap to it.
  useEffect(() => {
    if (!draft) return;
    const real = conversations.find((c) => c.otherUserId === draft.otherUserId);
    if (real) { setSelectedId(real.id); setDraft(null); }
  }, [conversations, draft]);

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
    if (message.senderId !== currentUserId) setTyping(message.conversationId, false);
    scheduleRefresh();
  }, [currentUserId, setTyping, scheduleRefresh]);

  const { sendTyping } = useMessagingSocket(onSocketMessage, {
    onTyping: (e) => setTyping(e.conversationId, !!e.typing),
    onPresence: (e) => setPresence((p) => ({ ...p, [e.userId]: !!e.online })),
    onReaction: (e) => setLiveReaction({ ...e, _at: Date.now() }),
    onRead: (e) => { setLiveRead({ ...e, _at: Date.now() }); scheduleRefresh(); },
    onConversation: (e) => { setLiveConversation({ ...e, _at: Date.now() }); scheduleRefresh(); },
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

  const closeSearch = () => { setSearchOpen(false); setFilter(''); };

  const pickPerson = (person) => {
    setPickerOpen(false);
    openWithUser({ userId: person.id, username: person.name, photoUrl: person.artworkUrl });
  };

  const switchTab = (next) => {
    setTab(next);
    setShowFiltered(false);
  };

  const subline = loading
    ? ' '
    : [
      unreadThreads > 0 ? `${unreadThreads} unread` : 'All caught up',
      requests.length > 0 ? `${requests.length} request${requests.length === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ');

  const emptyCopy = tab === 'requests'
    ? (showFiltered
      ? { lead: 'Nothing filtered', sub: 'Bulk and low-quality requests would show up here.' }
      : { lead: 'No message requests', sub: 'Messages from people you don’t know yet wait here. They never notify you.' })
    : { lead: 'No conversations yet', sub: 'Message an artist or a listener — start with the New button.' };

  return (
    <Layout hideFooter>
      <div className={`udm ${selected ? 'udm--thread-open' : ''}`}>
        <aside className="udm-list" aria-label="Conversations">
          <div className="udm-glow" aria-hidden="true" />

          <header className="udm-list__head">
            <div className="udm-list__toprow">
              <button type="button" className="udm-round" onClick={() => navigate(-1)} aria-label="Back">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button type="button" className="udm-round" onClick={() => setSettingsOpen(true)} aria-label="Message settings">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
                </svg>
              </button>
            </div>
            <div className="udm-list__titlerow">
              <div className="udm-list__titles">
                <h1 className="udm-list__title">Messages</h1>
                <span className="udm-list__sub">{subline}</span>
              </div>
              <button type="button" className="udm-new" onClick={() => setPickerOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
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
                    <button type="button" key={c.id} className="udm-active__item" onClick={() => openExisting(c)}
                      aria-label={`${c.otherUsername || 'Unknown'}, active now`}>
                      <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} size={66} ring={c.otherSupportsMe} online />
                      <span className="udm-active__name">{(c.otherUsername || 'Unknown').split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="udm-tabs" role="tablist" aria-label="Inbox lanes">
              <button type="button" role="tab" aria-selected={tab === 'chats'}
                className={`udm-tab${tab === 'chats' ? ' is-on' : ''}`} onClick={() => switchTab('chats')}>
                Chats
              </button>
              <button type="button" role="tab" aria-selected={tab === 'requests'}
                className={`udm-tab${tab === 'requests' ? ' is-on' : ''}`} onClick={() => switchTab('requests')}>
                Requests
                {requests.length > 0 && <span className="udm-tab__count">{requests.length}</span>}
              </button>
            </div>

            {tab === 'requests' && showFiltered && (
              <button type="button" className="udm-folder udm-folder--back" onClick={() => setShowFiltered(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
                Filtered requests
              </button>
            )}

            {loading && <div className="udm-list__hint">Loading…</div>}

            {!loading && laneRows.length === 0 && !(tab === 'chats' && draft) && (
              <div className="udm-list__empty">
                <MessageCircle size={30} aria-hidden="true" />
                <p className="udm-list__empty-lead">{emptyCopy.lead}</p>
                <p className="udm-list__empty-sub">{emptyCopy.sub}</p>
              </div>
            )}

            {!loading && filter && laneRows.length > 0 && visible.length === 0 && (
              <div className="udm-list__hint">No conversations match &ldquo;{filter.trim()}&rdquo;.</div>
            )}

            {visible.map((c) => {
              const unread = c.unreadCount > 0;
              const typing = !!typingMap[c.id];
              const online = isOnline(c);
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`udm-conv${c.id === selectedId ? ' active' : ''}${unread ? ' unread' : ''}`}
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
                    <span className="udm-conv__time">{relativeTime(c.lastMessageAt)}</span>
                    {unread ? (
                      <span className="udm-badge">{c.unreadCount}</span>
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
                <button type="button" className="udm-folder" onClick={() => setShowFiltered(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 5h18l-7 8v6l-4-2v-4z" />
                  </svg>
                  Filtered requests
                  <span className="udm-folder__count">{filtered.length}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            )}
          </div>

          <div className="udm-list__fade" aria-hidden="true" />

          {searchOpen ? (
            <div className="udm-float udm-float--input">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ) : (
            conversations.length > 0 && (
              <button type="button" className="udm-float" onClick={() => setSearchOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                </svg>
                Search
              </button>
            )
          )}
        </aside>

        <section className="udm-main">
          {selected ? (
            <MessageThread
              key={selected.otherUserId}
              conversation={selected}
              currentUserId={currentUserId}
              incomingMessage={incoming}
              incomingReaction={liveReaction}
              incomingRead={liveRead}
              incomingConversation={liveConversation}
              otherTyping={!!typingMap[selected.id]}
              otherOnline={selected._draft ? false : isOnline(selected)}
              sendTyping={sendTyping}
              onBack={() => { setSelectedId(null); setDraft(null); }}
              onActivity={() => loadConversations()}
              onAccepted={() => { setTab('chats'); setShowFiltered(false); loadConversations(); }}
              onRequestGone={() => { setSelectedId(null); loadConversations(); }}
            />
          ) : (
            <div className="udm-main__placeholder">
              <MessageCircle size={36} aria-hidden="true" />
              <p>Pick a conversation</p>
              <button type="button" className="udm-new udm-new--ghost" onClick={() => setPickerOpen(true)}>New message</button>
            </div>
          )}
        </section>
      </div>

      <MessagePickerSheet
        open={pickerOpen}
        mode="people"
        excludeUserId={currentUserId}
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
