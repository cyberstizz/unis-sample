// src/MessageThread.jsx
// Thread — FOMO-inspired restyle (Oct 2026 mockup).
//   • header: avatar, name + artist check, home-jurisdiction chip, ⋯ menu
//   • time pills between sittings, grouped bubbles, theme-colour "mine"
//   • shared songs render as real track cards (art, artist, today's rank, play)
//   • support renders as the green card with the amount and the note
//   • "Seen" under your latest message once they've read it
//   • floating glass composer: + share a song · message · $ support · send
// Plays go through requestPlay → PlayChoiceModal; the Player counts them.
import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import { PlayerContext } from './context/playercontext';
import { fetchStandings } from './utils/standings';
import SupportSheet from './SupportSheet';
import MessagePickerSheet from './MessagePickerSheet';

const GROUP_GAP_MS = 5 * 60 * 1000;   // bubbles closer than this stack together
const SITTING_GAP_MS = 60 * 60 * 1000; // a gap longer than this gets a time pill

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function pillLabel(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `Today ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

function money(cents) {
  const value = (Number(cents) || 0) / 100;
  const [whole, frac] = value.toFixed(2).split('.');
  return { whole: `$${Number(whole).toLocaleString('en-US')}`, frac: `.${frac}` };
}

const Avatar = ({ name, photoUrl, size = 28, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (photoUrl && !failed) {
    return (
      <img
        className={`udm-avatar ${className}`}
        style={{ width: size, height: size }}
        src={buildUrl(photoUrl)}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className={`udm-avatar udm-mono ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
};

const VerifiedCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" role="img" aria-label="Artist" className="udm-check">
    <path d="M12 1.8l2.6 1.9 3.2-.2 1 3.1 2.8 1.6-.6 3.1 1.6 2.8-2.2 2.3-.1 3.2-3.1.7-1.9 2.6-3-1.1-3 1.1-1.9-2.6-3.1-.7-.1-3.2L1.3 14l1.6-2.8-.6-3.1 2.8-1.6 1-3.1 3.2.2z" />
    <path d="M8 12.4l2.7 2.7L16.2 9.6" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DollarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3.2c0 4.3 9 2.3 9 6.6 0 1.9-2 3.2-4.5 3.2s-4.5-1.3-4.5-3" />
  </svg>
);

// ── Shared-song card ─────────────────────────────────────────────────────────
const TrackCard = ({ song, rank, onPlay, onOpen }) => {
  if (!song) {
    return (
      <div className="udm-track udm-track--loading">
        <span className="udm-track__art udm-track__art--blank" aria-hidden="true" />
        <span className="udm-track__meta"><span className="udm-track__title">Shared a song</span></span>
      </div>
    );
  }
  const art = song.artworkUrl ? buildUrl(song.artworkUrl) : null;
  return (
    <div className="udm-track">
      <button type="button" className="udm-track__open" onClick={onOpen} aria-label={`Open ${song.title}`}>
        {art
          ? <img className="udm-track__art" src={art} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          : <span className="udm-track__art udm-track__art--blank" aria-hidden="true" />}
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
      </button>
    </div>
  );
};

export default function MessageThread({
  conversation,
  currentUserId,
  incomingMessage,
  onBack,
  onActivity,
}) {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext) || {};

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [profile, setProfile] = useState(null);
  const [songs, setSongs] = useState({});       // songId → song
  const [ranks, setRanks] = useState({});       // songId → { rank, movement, place }
  const [amounts, setAmounts] = useState({});   // supportPaymentId → cents
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  const otherId = conversation.otherUserId;
  const otherName = conversation.otherUsername || 'Unknown';
  const otherPhoto = conversation.otherPhotoUrl || profile?.photoUrl || null;
  const isDraft = !!conversation._draft;
  const isArtist = String(profile?.role || '').toLowerCase() === 'artist';
  const place = profile?.jurisdiction?.name || null;

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  const appendDeduped = useCallback((msg) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    scrollToBottom();
  }, [scrollToBottom]);

  // Who we're talking to (role → artist check, home jurisdiction → chip).
  useEffect(() => {
    let alive = true;
    apiCall({ url: `/v1/users/profile/${otherId}` })
      .then((res) => { if (alive) setProfile(res.data || null); })
      .catch((err) => console.error('[Messages] profile load failed (header shows name only):', err?.message || err));
    return () => { alive = false; };
  }, [otherId]);

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
      .catch((err) => {
        console.error('[Messages] thread load failed:', err?.message || err);
        if (alive) setError('Could not load this conversation.');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [conversation.id, isDraft, scrollToBottom]);

  // Live messages for this thread (deduped by id)
  useEffect(() => {
    if (!incomingMessage || incomingMessage.conversationId !== conversation.id) return;
    appendDeduped(incomingMessage);
    if (incomingMessage.senderId !== currentUserId) {
      apiCall({ method: 'post', url: `/v1/conversations/${conversation.id}/read` })
        .catch((err) => console.error('[Messages] mark-read failed:', err?.message || err));
    }
  }, [incomingMessage, conversation.id, currentUserId, appendDeduped]);

  // Each lookup below runs once per id for the life of the thread.
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const requestedSongs = useRef(new Set());
  const requestedAmounts = useRef(new Set());

  // Shared songs: details (cached per song) + today's rank where it lives.
  const songIds = useMemo(
    () => [...new Set(messages.filter((m) => m.sharedSongId && m.supportPaymentId == null).map((m) => String(m.sharedSongId)))],
    [messages],
  );
  useEffect(() => {
    const missing = songIds.filter((id) => !requestedSongs.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => requestedSongs.current.add(id));

    Promise.allSettled(missing.map((id) => apiCall({ url: `/v1/media/song/${id}` }))).then((results) => {
      if (!mounted.current) return;
      const next = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[missing[i]] = r.value.data;
        else {
          next[missing[i]] = null;
          console.error('[Messages] shared song load failed:', r.reason?.message || r.reason);
        }
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
            if (!mounted.current || board.state !== 'LIVE') return;
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

  // Support amounts: one read of what I've sent and received, matched by id.
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
      if (!mounted.current) return;
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

  // Close the ⋯ menu on outside click.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) { setMenuOpen(false); setConfirmBlock(false); } };
    const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(false); setConfirmBlock(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // Grow the composer with its text (up to the CSS max-height).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const post = useCallback(async (data) => {
    const res = await apiCall({ method: 'post', url: '/v1/messages', data: { recipientId: otherId, source: 'dm', ...data } });
    return res.data;
  }, [otherId]);

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
      const saved = await post({ body });
      // Swap only THIS temp for the saved row (a socket echo may have landed first).
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== temp.id);
        return withoutTemp.some((m) => m.id === saved.id) ? withoutTemp : [...withoutTemp, saved];
      });
      onActivity?.(saved);
    } catch (e) {
      console.error('[Messages] send failed:', e?.message || e);
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(body);
      setError(e?.response?.data?.error || 'Message failed to send.');
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversation.id, currentUserId, post, onActivity, scrollToBottom]);

  // Share a song picked in the sheet.
  const shareSong = useCallback(async (result) => {
    setShareOpen(false);
    setError(null);
    try {
      const saved = await post({ sharedSongId: result.id, body: '' });
      appendDeduped(saved);
      onActivity?.(saved);
    } catch (e) {
      console.error('[Messages] share song failed:', e?.message || e);
      setError(e?.response?.data?.error || 'Could not share that song.');
    }
  }, [post, appendDeduped, onActivity]);

  // Support sent from inside the thread → post a DM carrying the supportPaymentId
  const handleSupportSent = useCallback(async ({ supportId, note, amount }) => {
    try {
      const saved = await post({ body: note || '', supportPaymentId: supportId });
      if (amount != null) setAmounts((prev) => ({ ...prev, [String(supportId)]: amount }));
      appendDeduped(saved);
      onActivity?.(saved);
    } catch (e) {
      // Support itself was recorded; the bubble appears on the next load.
      console.error('[Messages] support message post failed:', e?.message || e);
    }
  }, [post, appendDeduped, onActivity]);

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

  const block = async () => {
    try {
      await apiCall({ method: 'post', url: `/v1/users/${otherId}/block` });
      setMenuOpen(false);
      onActivity?.();
      onBack?.();
    } catch (e) {
      console.error('[Messages] block failed:', e?.message || e);
      setError(e?.response?.data?.error || `Could not block ${otherName}.`);
      setMenuOpen(false);
      setConfirmBlock(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Lay the thread out: time pills between sittings, bubbles grouped by sender.
  const rows = useMemo(() => {
    const out = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const t = new Date(m.createdAt).getTime();
      const pill = !prev
        || !sameDay(new Date(prev.createdAt), new Date(m.createdAt))
        || t - new Date(prev.createdAt).getTime() > SITTING_GAP_MS;
      if (pill) out.push({ kind: 'pill', id: `pill-${m.id}`, label: pillLabel(m.createdAt) });

      const joinsPrev = prev && !pill && prev.senderId === m.senderId
        && t - new Date(prev.createdAt).getTime() < GROUP_GAP_MS;
      const joinsNext = next && next.senderId === m.senderId
        && new Date(next.createdAt).getTime() - t < GROUP_GAP_MS
        && sameDay(new Date(next.createdAt), new Date(m.createdAt));
      out.push({ kind: 'msg', id: m.id, m, first: !joinsPrev, last: !joinsNext });
    });
    return out;
  }, [messages]);

  const lastMsg = messages[messages.length - 1];
  const showSeen = lastMsg && lastMsg.senderId === currentUserId && lastMsg.read && !lastMsg._temp;

  return (
    <div className="udm-thread">
      <div className="udm-glow udm-glow--left" aria-hidden="true" />

      <header className="udm-thread__head">
        <button type="button" className="udm-round udm-back" onClick={onBack} aria-label="Back to messages">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button type="button" className="udm-thread__who" onClick={openProfile} aria-label={`View ${otherName}'s profile`}>
          <Avatar name={otherName} photoUrl={otherPhoto} size={46} />
          <span className="udm-thread__names">
            <span className="udm-thread__name">
              {otherName}
              {isArtist && <VerifiedCheck />}
            </span>
            {place && (
              <span className="udm-chip">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.3" />
                </svg>
                {place}
              </span>
            )}
          </span>
        </button>
        <div className="udm-menu" ref={menuRef}>
          <button
            type="button"
            className="udm-round"
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen((o) => !o); setConfirmBlock(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div className="udm-menu__panel" role="menu">
              {confirmBlock ? (
                <div className="udm-menu__confirm">
                  <p>Block {otherName}? They won&rsquo;t be able to message you.</p>
                  <div>
                    <button type="button" className="udm-menu__btn" onClick={() => setConfirmBlock(false)}>Cancel</button>
                    <button type="button" className="udm-menu__btn udm-menu__btn--danger" onClick={block}>Block</button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" role="menuitem" className="udm-menu__item" onClick={openProfile}>View profile</button>
                  <button type="button" role="menuitem" className="udm-menu__item udm-menu__item--danger" onClick={() => setConfirmBlock(true)}>
                    Block {otherName}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="udm-thread__scroll" ref={scrollRef}>
        {loading && <div className="udm-thread__hint">Loading…</div>}
        {!loading && messages.length === 0 && (
          <div className="udm-thread__empty">
            <Avatar name={otherName} photoUrl={otherPhoto} size={72} />
            <p>Say something to <strong>{otherName}</strong>.</p>
          </div>
        )}

        {rows.map((row) => {
          if (row.kind === 'pill') {
            return <div key={row.id} className="udm-pill">{row.label}</div>;
          }
          const { m, first, last } = row;
          const mine = m.senderId === currentUserId;
          const isSupport = m.supportPaymentId != null;
          const isTrack = m.sharedSongId != null && !isSupport;
          const shape = `${first ? 'is-first' : ''} ${last ? 'is-last' : ''}`;

          let content;
          if (isSupport) {
            const cents = amounts[String(m.supportPaymentId)];
            const amt = cents != null ? money(cents) : null;
            content = (
              <div className={`udm-support ${shape}`}>
                <span className="udm-support__top">
                  <DollarIcon size={14} />
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
                  onOpen={() => song && navigate(`/song/${song.songId}`)}
                />
                {m.body && <div className={`udm-bubble ${shape}`}>{m.body}</div>}
              </>
            );
          } else {
            content = <div className={`udm-bubble ${shape}${m._temp ? ' is-pending' : ''}`}>{m.body}</div>;
          }

          return (
            <div key={m.id} className={`udm-row ${mine ? 'mine' : 'theirs'}${first ? ' is-first' : ''}`}>
              {!mine && (
                <span className="udm-row__face">
                  {last ? <Avatar name={otherName} photoUrl={otherPhoto} size={28} /> : null}
                </span>
              )}
              <div className="udm-row__stack">{content}</div>
            </div>
          );
        })}

        {showSeen && (
          <div className="udm-seen">
            Seen
            <Avatar name={otherName} photoUrl={otherPhoto} size={16} />
          </div>
        )}
      </div>

      {error && <div className="udm-thread__error" role="alert">{error}</div>}

      <div className="udm-composer">
        <div className="udm-composer__bar">
          <button type="button" className="udm-composer__icon" aria-label="Share a song" onClick={() => setShareOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <label className="udm-sr" htmlFor={`udm-input-${otherId}`}>Message {otherName}</label>
          <textarea
            id={`udm-input-${otherId}`}
            ref={inputRef}
            className="udm-composer__input"
            placeholder={`Message ${otherName}…`}
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="udm-composer__icon udm-composer__support"
            aria-label="Send support"
            onClick={() => setSupportOpen(true)}
          >
            <DollarIcon />
          </button>
          <button
            type="button"
            className="udm-composer__send"
            onClick={send}
            disabled={!draft.trim() || sending}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </button>
        </div>
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
