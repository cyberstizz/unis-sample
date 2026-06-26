// src/MessagePage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { useMessagingSocket } from './useMessagingSocket';
import Layout from './layout';
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
  const [draft, setDraft] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [loading, setLoading] = useState(true);

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
    } catch (_) {
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

  // Hand-off: open the target user's thread immediately. If no conversation
  // exists yet, open a draft thread — the first message creates it. This never
  // silently fails the way the old "navigate then auto-find" path could.
  useEffect(() => {
    if (!compose || loading || composeHandled.current) return;
    composeHandled.current = true;

    const targetId = compose.userId;
    const existing = conversations.find((c) => c.otherUserId === targetId);
    if (existing) {
      openExisting(existing);
    } else {
      setSelectedId(null);
      setDraft({
        id: `draft-${targetId}`,
        otherUserId: targetId,
        otherUsername: compose.username || 'Member',
        otherPhotoUrl: compose.photoUrl || null,
        _draft: true,
        lastMessageAt: null,
        lastMessagePreview: '',
        unreadCount: 0,
      });
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [compose, loading, conversations, openExisting, navigate, location.pathname]);

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

  const { connected } = useMessagingSocket(onSocketMessage);

  const realSelected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );
  const selected = realSelected || draft;

  const totalUnread = conversations.reduce((n, c) => n + (c.unreadCount || 0), 0);

  return (
    <Layout hideFooter>
      <div className={`udm ${selected ? 'udm--thread-open' : ''}`}>
        <aside className="udm-list">
          <header className="udm-list__head">
            <button className="udm-list__back" onClick={() => navigate(-1)} aria-label="Back">
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="udm-list__title">Messages</h1>
            <span className={`udm-dot ${connected ? 'on' : 'off'}`} title={connected ? 'Live' : 'Offline'} />
            {totalUnread > 0 && <span className="udm-list__count">{totalUnread}</span>}
          </header>

          <div className="udm-list__scroll">
            {loading && <div className="udm-list__hint">Loading…</div>}

            {!loading && conversations.length === 0 && !draft && (
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
                onClick={() => openExisting(c)}
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
              <p>Select a conversation</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}