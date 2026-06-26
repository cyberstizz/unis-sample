// src/MessageThread.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Music, Zap, Play, ArrowUp } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import SupportSheet from './SupportSheet';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MessageThread({
  conversation,
  currentUserId,
  incomingMessage,
  onBack,
  onActivity,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);
  const scrollRef = useRef(null);

  const otherId = conversation.otherUserId;
  const otherName = conversation.otherUsername || 'Unknown';
  const isDraft = !!conversation._draft;

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  const appendDeduped = useCallback((msg) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev.filter((m) => !m._temp), msg];
    });
    scrollToBottom();
  }, [scrollToBottom]);

  // Load thread. A draft conversation has no row yet — show an empty, ready
  // composer instead of fetching (which would 404).
  useEffect(() => {
    let alive = true;
    if (isDraft) {
      setMessages([]);
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    setError(null);
    apiCall({ url: `/v1/conversations/${conversation.id}/messages`, useCache: false })
      .then((res) => {
        if (!alive) return;
        setMessages(res.data || []);
        scrollToBottom(false);
      })
      .catch(() => alive && setError('Could not load this conversation.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [conversation.id, isDraft, scrollToBottom]);

  // Live messages for this thread (deduped by id)
  useEffect(() => {
    if (!incomingMessage || incomingMessage.conversationId !== conversation.id) return;
    appendDeduped(incomingMessage);
    if (incomingMessage.senderId !== currentUserId) {
      apiCall({ method: 'post', url: `/v1/conversations/${conversation.id}/read` }).catch(() => {});
    }
  }, [incomingMessage, conversation.id, currentUserId, appendDeduped]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);

    const temp = {
      id: `temp-${Date.now()}`,
      _temp: true,
      conversationId: conversation.id,
      senderId: currentUserId,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    scrollToBottom();

    try {
      const res = await apiCall({
        method: 'post',
        url: '/v1/messages',
        data: { recipientId: otherId, body, source: 'dm' },
      });
      const saved = res.data;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== temp.id);
        if (withoutTemp.some((m) => m.id === saved.id)) return withoutTemp;
        return [...withoutTemp, saved];
      });
      onActivity?.(saved);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(body);
      setError(e?.response?.data?.error || 'Message failed to send.');
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversation.id, currentUserId, otherId, onActivity, scrollToBottom]);

  // Support sent from inside the thread → post a DM carrying the supportPaymentId
  const handleSupportSent = useCallback(async ({ supportId, note }) => {
    try {
      const res = await apiCall({
        method: 'post',
        url: '/v1/messages',
        data: { recipientId: otherId, body: note || '', supportPaymentId: supportId, source: 'dm' },
      });
      appendDeduped(res.data);
      onActivity?.(res.data);
    } catch (_) { /* support recorded; bubble will appear on next load */ }
  }, [otherId, appendDeduped, onActivity]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="udm-thread">
      <header className="udm-thread__head">
        <button className="udm-back" onClick={onBack} aria-label="Back to messages">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <div className="udm-avatar" aria-hidden="true">
          {conversation.otherPhotoUrl
            ? <img src={buildUrl(conversation.otherPhotoUrl)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            : <span>{initials(otherName)}</span>}
        </div>
        <div className="udm-thread__who">
          <span className="udm-thread__name">{otherName}</span>
        </div>
      </header>

      <div className="udm-thread__scroll" ref={scrollRef}>
        {loading && <div className="udm-thread__hint">Loading…</div>}
        {!loading && messages.length === 0 && (
          <div className="udm-thread__empty">
            <p>Say something to <strong>{otherName}</strong>.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const isSupport = m.supportPaymentId != null;
          const isTrack = m.sharedSongId != null && !isSupport;
          const cls = `udm-row ${mine ? 'mine' : 'theirs'}`;

          if (isSupport) {
            return (
              <div className={cls} key={m.id}>
                <div className="udm-support">
                  <div className="udm-support__top">
                    <Zap size={16} aria-hidden="true" />
                    <span>{mine ? 'You sent support' : `${otherName} sent support`}</span>
                  </div>
                  {m.body && <div className="udm-support__note">“{m.body}”</div>}
                </div>
                <span className="udm-time">{timeLabel(m.createdAt)}</span>
              </div>
            );
          }

          if (isTrack) {
            return (
              <div className={cls} key={m.id}>
                <div className="udm-track">
                  <div className="udm-track__icon"><Music size={20} aria-hidden="true" /></div>
                  <div className="udm-track__meta">
                    <span className="udm-track__title">Shared a track</span>
                    <span className="udm-track__sub">Tap to listen</span>
                  </div>
                  <Play size={20} className="udm-track__play" aria-hidden="true" />
                </div>
                {m.body && <div className="udm-bubble">{m.body}</div>}
                <span className="udm-time">{timeLabel(m.createdAt)}</span>
              </div>
            );
          }

          return (
            <div className={cls} key={m.id}>
              <div className="udm-bubble">{m.body}</div>
              <span className="udm-time">{timeLabel(m.createdAt)}</span>
            </div>
          );
        })}
      </div>

      {error && <div className="udm-thread__error">{error}</div>}

      <div className="udm-composer">
        <button className="udm-composer__icon" aria-label="Share a track" title="Share a track">
          <Music size={20} aria-hidden="true" />
        </button>
        <button
          className="udm-composer__icon udm-composer__support"
          aria-label="Send support"
          title="Send support"
          onClick={() => setSupportOpen(true)}
        >
          <Zap size={20} aria-hidden="true" />
        </button>
        <textarea
          className="udm-composer__input"
          placeholder={`Message ${otherName}…`}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className="udm-composer__send"
          onClick={send}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      </div>

      <SupportSheet
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        artistId={otherId}
        artistName={otherName}
        source="dm"
        onSuccess={handleSupportSent}
      />
    </div>
  );
}