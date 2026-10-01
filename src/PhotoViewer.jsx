// =============================================================================
// PhotoViewer — full-screen viewer for a profile's photo grid (ProfilePhotos).
//
// Interactions (modeled on Instagram's post view):
//   • swipe left/right — the photo follows your finger; resists at either end
//     (no wrap-around), commits past SWIPE_NAV px
//   • swipe down — drags the photo and fades the backdrop; closes past SWIPE_CLOSE
//   • double-tap / double-click — likes (never unlikes) with a heart burst
//   • heart button — like / unlike; like count; posted date
//   • owner only — delete, behind a confirmation sheet
//   • desktop — chevrons + ←/→ keys; Esc and clicking the dark area close
//   • guests — liking opens the existing AuthGateSheet instead
//
// State lives in ProfilePhotos (the photo list, likes, the ?photo= URL param).
// This component only renders and reports intent through callbacks.
// Esc + focus trap + focus restore come from useModalA11y.
// =============================================================================

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { buildUrl } from "./utils/buildUrl";
import useModalA11y from "./hooks/useModalA11y";
import AuthGateSheet, { useAuthGate } from "./AuthGateSheet";
import "./PhotoViewer.scss";

const SWIPE_NAV = 60;          // px sideways to change photo
const SWIPE_CLOSE = 110;       // px downward to close
const AXIS_LOCK = 8;           // px before we decide a drag is sideways or vertical
const DOUBLE_TAP_MS = 300;
const TOUCH_CLICK_GUARD_MS = 800; // ignore synthetic clicks/dblclicks right after a touch

export const likeLabel = (count, isSelf) => {
  const n = Number(count) || 0;
  if (n === 0) return isSelf ? "No likes yet" : "Be the first to like this";
  return `${n.toLocaleString()} ${n === 1 ? "like" : "likes"}`;
};

export const postedDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" });
};

const HeartIcon = ({ filled, gradientId, size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {filled && (
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--unis-primary-2)" }} />
          <stop offset="1" style={{ stopColor: "var(--unis-primary)" }} />
        </linearGradient>
      </defs>
    )}
    <path
      d="M12 20.4s-8.4-5.5-8.4-11.2A4.7 4.7 0 0112 6.5a4.7 4.7 0 018.4 2.7c0 5.7-8.4 11.2-8.4 11.2z"
      fill={filled ? `url(#${gradientId})` : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  </svg>
);

const PhotoViewer = ({
  photos,          // newest-first list, same order as the grid
  index,           // which photo is open
  ownerName,
  ownerAvatar,     // already passed through buildUrl, or null
  isSelf,
  signedIn,
  notice,          // transient message from the parent (e.g. a like that didn't save)
  onClose,
  onIndexChange,   // (nextIndex) => void
  onSetLiked,      // (photoId, liked) => void — parent handles optimism + retries
  onDelete,        // (photoId) => Promise — rejects on failure
}) => {
  const modalRef = useRef(null);
  const confirmCancelRef = useRef(null);
  const gesture = useRef(null);
  const lastTap = useRef(0);
  const lastTouchAt = useRef(0);
  const gradientId = `pvheart${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const burstGradientId = `${gradientId}b`;

  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [enterFrom, setEnterFrom] = useState(null); // 'next' | 'prev' | null
  const [burst, setBurst] = useState(0);            // bump to replay the heart burst
  const [pop, setPop] = useState(0);                // bump to replay the button pop
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const { triggerGate, gateProps } = useAuthGate();

  const photo = photos[index];
  const count = photos.length;
  const last = count - 1;

  // Esc peels back one layer at a time: gate sheet → confirm sheet → viewer.
  // Held in a ref so useModalA11y's effect (which depends on onClose) doesn't
  // re-run — and yank focus — every time a sheet opens.
  const escRef = useRef(null);
  escRef.current = () => {
    if (gateProps.isOpen) { gateProps.onClose(); return; }
    if (confirming) { if (!deleting) setConfirming(false); return; }
    onClose();
  };
  const handleEsc = useCallback(() => escRef.current?.(), []);
  useModalA11y({ active: true, onClose: handleEsc, modalRef });

  const go = useCallback((next) => {
    if (next < 0 || next > last || next === index) return;
    setEnterFrom(next > index ? "next" : "prev");
    setConfirming(false);
    setDeleteError(null);
    onIndexChange(next);
  }, [index, last, onIndexChange]);

  // Arrow keys + body scroll lock while open
  useEffect(() => {
    const onKey = (e) => {
      if (gateProps.isOpen || confirming) return;
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, gateProps.isOpen, confirming]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Warm the neighbours so swiping feels instant
  useEffect(() => {
    [photos[index - 1], photos[index + 1]].forEach((p) => {
      const url = p && buildUrl(p.photoUrl);
      if (url) { const img = new Image(); img.src = url; }
    });
  }, [photos, index]);

  useEffect(() => {
    if (confirming) confirmCancelRef.current?.focus();
  }, [confirming]);

  if (!photo) return null;

  // ---------------------------------------------------------------- likes
  const toggleLike = () => {
    if (!signedIn) { triggerGate("profile"); return; }
    if (!photo.likedByMe) setPop((n) => n + 1);
    onSetLiked(photo.photoId, !photo.likedByMe);
  };

  const likeFromDoubleTap = () => {
    if (!signedIn) { triggerGate("profile"); return; }
    setBurst((n) => n + 1);
    if (!photo.likedByMe) {
      setPop((n) => n + 1);
      onSetLiked(photo.photoId, true);
    }
  };

  // --------------------------------------------------------------- gestures
  const onTouchStart = (e) => {
    lastTouchAt.current = Date.now();
    if (e.touches.length !== 1) { gesture.current = null; return; }
    const t = e.touches[0];
    gesture.current = { x: t.clientX, y: t.clientY, axis: null };
  };

  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : dy > 0 ? "y" : "none";
    }
    if (g.axis === "x") {
      const pastEdge = (dx > 0 && index === 0) || (dx < 0 && index === last);
      setDrag({ x: pastEdge ? dx * 0.3 : dx, y: 0, active: true });
    } else if (g.axis === "y") {
      setDrag({ x: 0, y: Math.max(0, dy), active: true });
    }
  };

  const onTouchEnd = (e) => {
    lastTouchAt.current = Date.now();
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;

    if (!g.axis) {
      // A tap. Two within DOUBLE_TAP_MS = like (taps on buttons don't count).
      if (e.target.closest?.("button")) return;
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        likeFromDoubleTap();
      } else {
        lastTap.current = now;
      }
      return;
    }

    setDrag({ x: 0, y: 0, active: false });
    if (g.axis === "x") {
      if (dx <= -SWIPE_NAV) go(index + 1);
      else if (dx >= SWIPE_NAV) go(index - 1);
    } else if (g.axis === "y" && dy >= SWIPE_CLOSE) {
      onClose();
    }
  };

  const touchedRecently = () => Date.now() - lastTouchAt.current < TOUCH_CLICK_GUARD_MS;

  // Clicking the dark area around the photo closes on desktop. On phones the
  // first tap of a double-tap would land here, so touches never close.
  const onStageClick = (e) => {
    if (touchedRecently()) return;
    if (e.target === e.currentTarget) onClose();
  };
  const onStageDoubleClick = (e) => {
    if (touchedRecently()) return; // touch double-taps are handled in onTouchEnd
    if (e.target.closest?.("button")) return; // fast clicks on the chevrons aren't a like
    likeFromDoubleTap();
  };

  // ----------------------------------------------------------------- delete
  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(photo.photoId);
      setConfirming(false);
    } catch (err) {
      setDeleteError(err?.response?.data?.error || "Couldn't delete this photo. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  // ------------------------------------------------------------------ render
  const src = buildUrl(photo.photoUrl);
  const dragFade = drag.y > 0 ? Math.max(0.25, 1 - drag.y / 420) : 1;
  const slideStyle = {
    transform: `translate3d(${drag.x}px, ${drag.y}px, 0) scale(${drag.y > 0 ? Math.max(0.82, 1 - drag.y / 1600) : 1})`,
  };
  const date = postedDate(photo.createdAt);

  return createPortal(
    <div
      className="pv"
      role="dialog"
      aria-modal="true"
      aria-label={`${ownerName}'s photos`}
      ref={modalRef}
      tabIndex={-1}
    >
      <div className="pv__backdrop" style={{ opacity: dragFade }} aria-hidden="true" />
      {src && (
        <div
          className="pv__ambient"
          style={{ backgroundImage: `url("${src}")`, opacity: 0.3 * dragFade }}
          aria-hidden="true"
        />
      )}

      <header className="pv__top" style={{ opacity: drag.y > 0 ? dragFade : 1 }}>
        <div className="pv__who">
          <span className="pv__ava">
            {ownerAvatar ? <img src={ownerAvatar} alt="" /> : (ownerName || "?").charAt(0).toUpperCase()}
          </span>
          <span className="pv__who-text">
            <span className="pv__name">{ownerName}</span>
            <span className="pv__count" aria-live="polite">{index + 1} of {count}</span>
          </span>
        </div>
        <div className="pv__tools">
          {isSelf && (
            <button
              type="button"
              className="pv__icon-btn"
              onClick={() => { setDeleteError(null); setConfirming(true); }}
              aria-label="Delete photo"
            >
              <Trash2 size={19} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="pv__icon-btn" onClick={onClose} aria-label="Close photo viewer">
            <X size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className="pv__stage"
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { gesture.current = null; setDrag({ x: 0, y: 0, active: false }); }}
      >
        <div
          className={`pv__slide${drag.active ? " is-dragging" : ""}`}
          style={slideStyle}
          onClick={onStageClick}
        >
          <img
            key={photo.photoId}
            className={`pv__img${enterFrom ? ` pv__img--from-${enterFrom}` : ""}`}
            src={src || undefined}
            alt={`Photo ${index + 1} of ${count} by ${ownerName}`}
            draggable={false}
          />
        </div>

        {burst > 0 && (
          <span key={burst} className="pv__burst" aria-hidden="true">
            <HeartIcon filled gradientId={burstGradientId} size={112} />
          </span>
        )}

        {index > 0 && (
          <button
            type="button"
            className="pv__nav pv__nav--prev"
            onClick={(e) => { e.stopPropagation(); go(index - 1); }}
            aria-label="Previous photo"
          >
            <ChevronLeft size={26} aria-hidden="true" />
          </button>
        )}
        {index < last && (
          <button
            type="button"
            className="pv__nav pv__nav--next"
            onClick={(e) => { e.stopPropagation(); go(index + 1); }}
            aria-label="Next photo"
          >
            <ChevronRight size={26} aria-hidden="true" />
          </button>
        )}
      </div>

      <footer className="pv__bar" style={{ opacity: drag.y > 0 ? dragFade : 1 }}>
        <button
          type="button"
          className={`pv__like${photo.likedByMe ? " is-liked" : ""}`}
          onClick={toggleLike}
          aria-pressed={Boolean(photo.likedByMe)}
          aria-label={photo.likedByMe ? "Unlike photo" : "Like photo"}
        >
          <span key={pop} className={pop > 0 && photo.likedByMe ? "pv__like-pop" : undefined}>
            <HeartIcon filled={Boolean(photo.likedByMe)} gradientId={gradientId} />
          </span>
        </button>
        <span className="pv__likes">{likeLabel(photo.likeCount, isSelf)}</span>
        {date && <time className="pv__date" dateTime={photo.createdAt}>{date}</time>}
      </footer>

      {notice && <p className="pv__notice" role="status">{notice}</p>}

      {confirming && (
        <div className="pv__confirm" role="alertdialog" aria-labelledby="pv-confirm-title" aria-describedby="pv-confirm-sub">
          <p id="pv-confirm-title" className="pv__confirm-title">Delete this photo?</p>
          <p id="pv-confirm-sub" className="pv__confirm-sub">It's removed from your profile, along with its likes.</p>
          {deleteError && <p className="pv__confirm-error" role="alert">{deleteError}</p>}
          <div className="pv__confirm-actions">
            <button type="button" className="pv__confirm-delete" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              ref={confirmCancelRef}
              className="pv__confirm-cancel"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inside the dialog so the focus trap covers it */}
      <AuthGateSheet {...gateProps} />
    </div>,
    document.body
  );
};

export default PhotoViewer;
