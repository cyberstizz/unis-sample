// src/MessagePage.jsx
// Inbox — FOMO-inspired restyle (Oct 2026 mockup). Same data and socket wiring
// as before; the look changed:
//   • big "Messages" title + unread line, accent "New" button (people search)
//   • borderless rows: 56px avatars, two-line right column (time + unread)
//   • floating glass "Search" pill that filters the list in place
// Lanes (Chats | Requests), presence and typing arrive with the messaging
// backend pass — this page is laid out so they slot in without a redesign.
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
import './messages.scss';

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

const Avatar = ({ name, photoUrl, size = 56 }) => {
  const [failed, setFailed] = useState(false);
  if (photoUrl && !failed) {
    return (
      <img
        className="udm-avatar"
        style={{ width: size, height: size }}
        src={buildUrl(photoUrl)}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="udm-avatar udm-mono" style={{ width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
};

const Preview = ({ text }) => {
  if (text === PREVIEW_SUPPORT) {
    return (
      <span className="udm-conv__preview udm-conv__preview--money">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3.2c0 4.3 9 2.3 9 6.6 0 1.9-2 3.2-4.5 3.2s-4.5-1.3-4.5-3" />
        </svg>
        Sent support
      </span>
    );
  }
  if (text === PREVIEW_TRACK) {
    return (
      <span className="udm-conv__preview">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        Shared a song
      </span>
    );
  }
  return <span className="udm-conv__preview">{text || 'No messages yet'}</span>;
};

export default function MessagesPage() {
  const { user } = useAuth();
  const currentUserId = user?.userId;
  const location = useLocation();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const searchRef = useRef(null);

  // Hand-off from a profile / dashboard "Message" button.
  // compose = { userId, username?, photoUrl? }. Legacy openWith still supported.
  const compose = location.state?.compose
    || (location.state?.openWith ? { userId: location.state.openWith } : null);
  const composeHandled = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiCall({ url: '/v1/conversations', useCache: false });
      setConversations(res.data || []);
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

  useEffect(() => { loadConversations(); }, [loadConversations]);

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
    if (existing) { openExisting(existing); return; }
    setSelectedId(null);
    setDraft({
      id: `draft-${userId}`,
      otherUserId: userId,
      otherUsername: username || 'Member',
      otherPhotoUrl: photoUrl || null,
      _draft: true,
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

  const onSocketMessage = useCallback((message) => {
    setIncoming(message);
    loadConversations();
  }, [loadConversations]);

  useMessagingSocket(onSocketMessage);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const realSelected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );
  const selected = realSelected || draft;

  const unreadThreads = conversations.filter((c) => c.unreadCount > 0).length;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.otherUsername || '').toLowerCase().includes(q)
      || (c.lastMessagePreview || '').toLowerCase().includes(q));
  }, [conversations, filter]);

  const closeSearch = () => { setSearchOpen(false); setFilter(''); };

  const pickPerson = (person) => {
    setPickerOpen(false);
    openWithUser({ userId: person.id, username: person.name, photoUrl: person.artworkUrl });
  };

  return (
    <Layout hideFooter>
      <div className={`udm ${selected ? 'udm--thread-open' : ''}`}>
        <aside className="udm-list" aria-label="Conversations">
          <div className="udm-glow" aria-hidden="true" />

          <header className="udm-list__head">
            <button type="button" className="udm-round" onClick={() => navigate(-1)} aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div className="udm-list__titlerow">
              <div className="udm-list__titles">
                <h1 className="udm-list__title">Messages</h1>
                <span className="udm-list__sub">
                  {loading ? ' ' : unreadThreads > 0 ? `${unreadThreads} unread` : 'All caught up'}
                </span>
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
            {loading && <div className="udm-list__hint">Loading…</div>}

            {!loading && conversations.length === 0 && !draft && (
              <div className="udm-list__empty">
                <MessageCircle size={30} aria-hidden="true" />
                <p className="udm-list__empty-lead">No conversations yet</p>
                <p className="udm-list__empty-sub">Message an artist or a listener — start with the New button.</p>
              </div>
            )}

            {!loading && filter && visible.length === 0 && (
              <div className="udm-list__hint">No conversations match &ldquo;{filter.trim()}&rdquo;.</div>
            )}

            {visible.map((c) => {
              const unread = c.unreadCount > 0;
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`udm-conv${c.id === selectedId ? ' active' : ''}${unread ? ' unread' : ''}`}
                  onClick={() => openExisting(c)}
                  aria-label={`${c.otherUsername || 'Unknown'}${unread ? `, ${c.unreadCount} unread` : ''}`}
                >
                  <Avatar name={c.otherUsername} photoUrl={c.otherPhotoUrl} />
                  <span className="udm-conv__body">
                    <span className="udm-conv__name">{c.otherUsername || 'Unknown'}</span>
                    <Preview text={c.lastMessagePreview} />
                  </span>
                  <span className="udm-conv__side">
                    <span className="udm-conv__time">{relativeTime(c.lastMessageAt)}</span>
                    {unread
                      ? <span className="udm-badge">{c.unreadCount}</span>
                      : <span className="udm-conv__spacer" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
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
              onBack={() => { setSelectedId(null); setDraft(null); }}
              onActivity={() => loadConversations()}
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
    </Layout>
  );
}
