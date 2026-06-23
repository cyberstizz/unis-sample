// src/MessagePage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { useMessagingSocket } from './useMessagingSocket';
import MessageThread from './MessageThread';
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
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Let the sidebar badge know unread counts may have changed.
function pingUnread() {
  window.dispatchEvent(new Event('unis:messages-updated'));
}

export default function MessagesPage() {
  const { user } = useAuth();
  const currentUserId = user?.userId;
  const location = useLocation();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [loading, setLoading] = useState(true);

  // recipientId passed by the profile "Message" button → open that thread
  const openWith = location.state?.openWith || null;
  const openWithHandled = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiCall({ url: '/v1/conversations', useCache: false });
      setConversations(res.data || []);
      return res.data || [];
    } catch (_) {
      setConversations([]);
      return [];
    } finally {
      setLoading(false);
      pingUnread();
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const openConversation = useCallback((conv) => {
    setSelectedId(conv.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)));
    pingUnread();
  }, []);

  // Resolve the profile-button hand-off: select the matching conversation, or
  // create it then select. Runs once after the first inbox load.
  useEffect(() => {
    if (!openWith || loading || openWithHandled.current) return;
    openWithHandled.current = true;

    const existing = conversations.find((c) => c.otherUserId === openWith);
    if (existing) {
      openConversation(existing);
    } else {
      (async () => {
        try {
          await apiCall({ method: 'post', url: '/v1/messages/start', data: { recipientId: openWith } });
          const list = await loadConversations();
          const conv = list.find((c) => c.otherUserId === openWith);
          if (conv) openConversation(conv);
        } catch (_) { /* gate/error already surfaced on the profile button */ }
      })();
    }
    // Clear the nav state so a refresh/back doesn't re-trigger.
    navigate(location.pathname, { replace: true, state: {} });
  }, [openWith, loading, conversations, openConversation, loadConversations, navigate, location.pathname]);

  // Inbound real-time message → refresh inbox, fan to the open thread
  const onSocketMessage = useCallback((message) => {
    setIncoming(message);
    loadConversations();
  }, [loadConversations]);

  const { connected } = useMessagingSocket(onSocketMessage);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  const totalUnread = conversations.reduce((n, c) => n + (c.unreadCount || 0), 0);

  return (
    <div className={`udm ${selected ? 'udm--thread-open' : ''}`}>
      <aside className="udm-list">
        <header className="udm-list__head">
          <h1 className="udm-list__title">Messages</h1>
          <span className={`udm-dot ${connected ? 'on' : 'off'}`} title={connected ? 'Live' : 'Offline'} />
          {totalUnread > 0 && <span className="udm-list__count">{totalUnread}</span>}
        </header>

        <div className="udm-list__scroll">
          {loading && <div className="udm-list__hint">Loading…</div>}

          {!loading && conversations.length === 0 && (
            <div className="udm-list__empty">
              <MessageCircle size={28} aria-hidden="true" />
              <p className="udm-list__empty-lead">No conversations yet</p>
              <p className="udm-list__empty-sub">
                Reach out to an artist from their profile to start one.
              </p>
            </div>
          )}

          {conversations.map((c) => (
            <button
              key={c.id}
              className={`udm-conv ${c.id === selectedId ? 'active' : ''} ${c.unreadCount ? 'unread' : ''}`}
              onClick={() => openConversation(c)}
            >
              <div className="udm-avatar" aria-hidden="true">
                {c.otherPhotoUrl ? <img src={c.otherPhotoUrl} alt="" /> : <span>{initials(c.otherUsername)}</span>}
              </div>
              <div className="udm-conv__body">
                <div className="udm-conv__top">
                  <span className="udm-conv__name">{c.otherUsername || 'Unknown'}</span>
                  <span className="udm-conv__time">{relativeTime(c.lastMessageAt)}</span>
                </div>
                <div className="udm-conv__preview-row">
                  <span className="udm-conv__preview">{c.lastMessagePreview || 'No messages yet'}</span>
                  {c.unreadCount > 0 && <span className="udm-conv__badge">{c.unreadCount}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="udm-main">
        {selected ? (
          <MessageThread
            key={selected.id}
            conversation={selected}
            currentUserId={currentUserId}
            incomingMessage={incoming}
            onBack={() => setSelectedId(null)}
            onActivity={() => loadConversations()}
          />
        ) : (
          <div className="udm-main__placeholder">
            <MessageCircle size={36} aria-hidden="true" />
            <p>Select a conversation</p>
          </div>
        )}
      </section>
    </div>
  );
}