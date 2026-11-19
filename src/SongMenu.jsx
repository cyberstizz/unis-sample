// ─────────────────────────────────────────────────────────────────────────────
// SongMenu — the "⋮" menu on song cards (feed first; any list can use it).
//
//   Play next        → after the song that's playing   (playNext)
//   Add to queue     → at the end of the queue          (playLater)
//   Save to playlist → the existing PlaylistWizard
//   Download         → the existing DownloadModal (free, owned or buy)
//   Share            → the phone's share sheet, or copy the link
//
// Desktop: a popover anchored to the ⋮ button, or to the cursor on right-click.
// Phone (≤ 640px): a bottom sheet with the song at the top.
// The surface is painted in the listener's theme colour.
//
// Why these choices (competitor + user research, Nov 2026):
//   - Spotify users have asked for years for "Play next" next to "Add to
//     queue"; YouTube Music, Apple Music and Tidal all offer both.
//   - The most common complaint about song menus is a ⋮ that's too small to
//     hit, so the song plays instead. The button here has a 40px target and
//     never shares space with the play button.
//   - Spotify listeners fall back on long-press to reach the menu, so
//     long-press (touch) and right-click (mouse) open it too.
//   - YouTube Music cut its menu down because it had grown cluttered, so this
//     one only carries the five actions people use most.
//
// One SongMenu is rendered per page; cards call onMenu(song, anchor) to open it.
// The parent renders it only while { song, anchor } is set, with a fresh `key`
// per opening, and clears it in onClose, which fires once the whole flow is
// over (including the playlist or download window, if one opened).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlayerContext } from './context/playercontext';
import { useFeedback } from './context/FeedbackContext';
import PlaylistWizard from './playlistWizard';
import DownloadModal from './DownloadModal';
import './songMenu.scss';

const PHONE_QUERY = '(max-width: 640px)';
const LONG_PRESS_MS = 480;
const MOVE_TOLERANCE = 10;
const MENU_WIDTH = 248;
const EDGE = 8;

const isPhone = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(PHONE_QUERY).matches
    : false;

const quoted = (title) => (title ? `“${title}”` : 'Song');

/** Demo cards (shown only when the feed can't load) have nothing real behind them. */
export const hasSongMenu = (song) => Boolean(song?.id) && !String(song.id).startsWith('dummy');

// ── Icons (stroke, currentColor) ────────────────────────────────────────────
const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const IconPlayNext = () => (
  <Svg>
    <path d="M4 5.5l6 4-6 4z" fill="currentColor" stroke="none" />
    <path d="M13 7h7M13 12h7M4 17.5h16" />
  </Svg>
);
const IconQueue = () => (
  <Svg>
    <path d="M4 6h12M4 11h12M4 16h7" />
    <path d="M18 14v6M15 17h6" />
  </Svg>
);
const IconPlaylist = () => (
  <Svg>
    <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" />
  </Svg>
);
const IconDownload = () => (
  <Svg>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Svg>
);
const IconShare = () => (
  <Svg>
    <path d="M14 5l6 6-6 6" />
    <path d="M20 11H11a7 7 0 0 0-7 7v1" />
  </Svg>
);

/** The ⋮ glyph for card buttons. */
export const KebabIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <circle cx="12" cy="5" r="1.9" fill="currentColor" />
    <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    <circle cx="12" cy="19" r="1.9" fill="currentColor" />
  </svg>
);

// ── Trigger helpers for cards ───────────────────────────────────────────────

/** Anchor from the ⋮ button that was pressed. */
export const anchorFromEvent = (e) => {
  const el = e?.currentTarget;
  const r = el?.getBoundingClientRect?.();
  return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, trigger: el } : null;
};

/**
 * Right-click and long-press on a whole card open the menu.
 * Spread the result onto the card's root element. A long-press swallows the
 * click that follows it, so the card doesn't also open the song page.
 */
export function useSongMenuGestures(song, onMenu) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  const enabled = Boolean(onMenu) && hasSongMenu(song);
  if (!enabled) return {};

  const pointAnchor = (x, y, trigger) => ({ left: x, right: x, top: y, bottom: y, trigger });

  return {
    onContextMenu: (e) => {
      e.preventDefault();
      clear();
      onMenu(song, pointAnchor(e.clientX, e.clientY, e.currentTarget));
    },
    onPointerDown: (e) => {
      fired.current = false;
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY };
      const target = e.currentTarget;
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* not supported */ } }
        onMenu(song, pointAnchor(start.current.x, start.current.y, target));
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      if (!timer.current || !start.current) return;
      if (Math.abs(e.clientX - start.current.x) > MOVE_TOLERANCE
        || Math.abs(e.clientY - start.current.y) > MOVE_TOLERANCE) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClickCapture: (e) => {
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}

// ── The menu ────────────────────────────────────────────────────────────────

/**
 * Props
 *   song              the feed item (id, title, artist, artworkUrl/artwork, url, type)
 *   anchor            { left, right, top, bottom, trigger } — where it was opened
 *   onClose           called once the menu (and any window it opened) is done
 *   onPlayNow(song)   used when nothing is queued yet, so "Play next" just plays
 *   isGuest           guests are asked to sign up for playlists and downloads
 *   onRequireAccount  opens the sign-up prompt
 */
export default function SongMenu({
  song,
  anchor,
  onClose,
  onPlayNow,
  isGuest = false,
  onRequireAccount,
}) {
  const player = useContext(PlayerContext) || {};
  const { queue = [], playNext, playLater } = player;
  const feedback = useFeedback();

  const [view, setView] = useState('menu'); // menu | playlist | download
  const [phone] = useState(isPhone);
  const [pos, setPos] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef(null);
  const closedRef = useRef(false);

  const open = Boolean(song);
  const isSong = (song?.type || 'song') === 'song';

  const finish = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose?.();
  }, [onClose]);

  // Close the menu. From a choice or Escape, focus goes back to the ⋮ that
  // opened it; from a click elsewhere it stays where they clicked.
  const dismiss = useCallback((refocus = true) => {
    const trigger = refocus ? anchor?.trigger : null;
    if (phone) {
      setLeaving(true);
      setTimeout(finish, 180);
    } else {
      finish();
    }
    if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
      try { trigger.focus({ preventScroll: true }); } catch { /* detached */ }
    }
  }, [anchor, phone, finish]);

  // Popover placement: under the ⋮ (right edges aligned), flipped above when
  // there's no room, and kept inside the window.
  useLayoutEffect(() => {
    if (!open || view !== 'menu' || phone || !panelRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = panelRef.current.offsetHeight || 0;
    const a = anchor || { left: vw / 2, right: vw / 2, top: vh / 2, bottom: vh / 2 };
    const fromPoint = a.left === a.right;
    let left = fromPoint ? a.left : a.right - MENU_WIDTH;
    if (left + MENU_WIDTH > vw - EDGE) left = vw - EDGE - MENU_WIDTH;
    left = Math.max(EDGE, left);
    let top = a.bottom + (fromPoint ? 2 : 6);
    if (top + h > vh - EDGE) top = Math.max(EDGE, a.top - h - (fromPoint ? 2 : 6));
    setPos({ left, top, above: top < a.top });
  }, [open, view, phone, anchor]);

  // Keyboard focus starts on the first action.
  useEffect(() => {
    if (!open || view !== 'menu') return;
    if (!phone && !pos) return;
    const first = panelRef.current?.querySelector('[role="menuitem"]');
    if (first) first.focus({ preventScroll: true });
  }, [open, view, phone, pos]);

  // Outside click, Escape, scroll and resize close the popover.
  useEffect(() => {
    if (!open || view !== 'menu') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
    };
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)
        && !(anchor?.trigger && anchor.trigger.contains?.(e.target))) {
        dismiss(false);
      }
    };
    const onScroll = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (!phone) finish();
    };
    const onResize = () => { if (!phone) finish(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, view, phone, anchor, dismiss, finish]);

  // The page behind a phone sheet shouldn't scroll.
  useEffect(() => {
    if (!open || view !== 'menu' || !phone) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, view, phone]);

  if (!open) return null;

  // ── Actions ──
  const handlePlayNext = () => {
    if (!queue.length) {
      onPlayNow?.(song);
      feedback.success(`Playing ${quoted(song.title)}`);
    } else {
      playNext?.(song); // the player confirms with a toast
    }
    dismiss();
  };

  const handleAddToQueue = () => {
    if (!queue.length) {
      onPlayNow?.(song);
      feedback.success(`Playing ${quoted(song.title)}`);
    } else {
      playLater?.(song); // the player confirms with a toast
    }
    dismiss();
  };

  const handlePlaylist = () => {
    if (isGuest) { finish(); onRequireAccount?.(); return; }
    setView('playlist');
  };

  const handleDownload = () => {
    if (isGuest) { finish(); onRequireAccount?.(); return; }
    setView('download');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/${isSong ? 'song' : 'video'}/${song.id}`;
    const artistName = song.artistData?.username || song.artist || '';
    const text = artistName ? `${song.title} by ${artistName} on Unis` : `${song.title} on Unis`;
    dismiss();

    if (navigator.share) {
      try {
        await navigator.share({ title: song.title, text, url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // they closed the share sheet
        console.warn('[SongMenu] share sheet failed, copying instead:', err?.message);
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      feedback.success('Link copied');
    } catch (err) {
      console.warn('[SongMenu] clipboard blocked:', err?.message);
      feedback.info(`Copy this link: ${url}`);
    }
  };

  // Arrow keys move between actions (menu pattern).
  const onMenuKeyDown = (e) => {
    const items = Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]') || []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = items[(i + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    else if (e.key === 'Tab') { e.preventDefault(); dismiss(); return; }
    if (next) { e.preventDefault(); next.focus(); }
  };

  // ── Child windows (the menu itself is gone by now) ──
  if (view === 'playlist') {
    return <PlaylistWizard open selectedTrack={song} onClose={finish} />;
  }

  if (view === 'download') {
    const artistName = song.artistData?.username || song.artist || 'Unknown Artist';
    return (
      <DownloadModal
        isOpen
        onClose={finish}
        song={{
          id: song.id,
          title: song.title || 'Untitled',
          artist: artistName,
          artworkUrl: song.artworkUrl || song.artwork,
          fileName: `${artistName} - ${song.title || 'Track'}.mp3`,
        }}
      />
    );
  }

  const artwork = song.artworkUrl || song.artwork;
  const artistName = song.artistData?.username || song.artist || '';

  const items = [
    { key: 'next', label: 'Play next', icon: <IconPlayNext />, onClick: handlePlayNext },
    { key: 'queue', label: 'Add to queue', icon: <IconQueue />, onClick: handleAddToQueue },
    'divider',
    isSong && { key: 'playlist', label: 'Save to playlist', icon: <IconPlaylist />, onClick: handlePlaylist },
    isSong && { key: 'download', label: 'Download', icon: <IconDownload />, onClick: handleDownload },
    { key: 'share', label: 'Share', icon: <IconShare />, onClick: handleShare },
  ].filter(Boolean);

  const list = (
    <div
      className="song-menu__list"
      role="menu"
      aria-label={`Options for ${song.title || 'this song'}`}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item, i) => (item === 'divider' ? (
        <div key={`d${i}`} className="song-menu__divider" role="separator" />
      ) : (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={`song-menu__item song-menu__item--${item.key}`}
          onClick={(e) => { e.stopPropagation(); item.onClick(); }}
        >
          <span className="song-menu__icon">{item.icon}</span>
          <span className="song-menu__label">{item.label}</span>
        </button>
      )))}
    </div>
  );

  const root = document.getElementById('root') || document.body;

  if (phone) {
    return createPortal(
      <div className={`song-menu-sheet ${leaving ? 'is-leaving' : ''}`}>
        <div className="song-menu-sheet__backdrop" onClick={() => dismiss(false)} aria-hidden="true" />
        <div className="song-menu song-menu--sheet" ref={panelRef} onClick={(e) => e.stopPropagation()}>
          <div className="song-menu__grab" aria-hidden="true" />
          <div className="song-menu__head">
            {artwork && (
              <img className="song-menu__art" src={artwork} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
            )}
            <div className="song-menu__meta">
              <div className="song-menu__title">{song.title}</div>
              {artistName && <div className="song-menu__artist">{artistName}</div>}
            </div>
          </div>
          {list}
          <button type="button" className="song-menu__cancel" onClick={() => dismiss()}>Cancel</button>
        </div>
      </div>,
      root,
    );
  }

  return createPortal(
    <div
      className={`song-menu song-menu--popover ${pos?.above ? 'is-above' : ''}`}
      ref={panelRef}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0, visibility: 'hidden' }}
      onClick={(e) => e.stopPropagation()}
    >
      {list}
    </div>,
    root,
  );
}
