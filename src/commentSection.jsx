// src/commentSection.jsx
// ─────────────────────────────────────────────────────────────
// Comments for songs and videos, modeled on YouTube's comment section
// (years of real-world use behind every pattern), in the Unis look:
//
//   • Thumbs-up like with a live count beside it. Unis has no dislikes.
//     Likes are optimistic and "latest tap wins", so fast double taps
//     never leave the count out of sync with the server.
//   • A comment-bubble reply button on every comment AND reply. Threads
//     stay one level deep (help center: comments-replies): replying to a
//     reply posts under the original comment, starting with @username.
//   • Long comments fold to four lines with Read more.
//   • Top / Newest sort. Liking never reorders the list under your thumb;
//     the order only changes when you pick a sort or the list reloads.
//   • Custom Glow icons (src/icons/UnisIcons.jsx) that follow the theme.
//   • Deleting asks first in an in-app dialog; failures show a toast.
//
// Desktop/tablet (>768px) renders an embedded panel. Phones get a
// collapsed preview card that opens a bottom sheet — only one of the two
// is ever mounted, so there is exactly one composer and one reply box.
//
// Supports both songs and videos. Pass either `songId` (+ optional
// `songArtistId`) or `videoId` (+ optional `artistId`).
// ─────────────────────────────────────────────────────────────
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  useId,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
import VerificationGate from './verificationGate';
import { COMMENT_MAX_LENGTH } from './data/helpContent';
import {
  LikeIcon,
  CommentIcon,
  TrashIcon,
  ChevronDownIcon,
  InfoIcon,
  MoreIcon,
  CloseIcon,
  SendIcon,
} from './icons/UnisIcons';
import './commentSection.scss';

const MOBILE_QUERY = '(max-width: 768px)';
const TOAST_MS = 3600;

// ── Formatting ───────────────────────────────────────────────

/** YouTube-style counts: 7, 999, 1.2K, 15K, 1.2M. Zero shows nothing. */
function formatCount(n) {
  const value = Number(n) || 0;
  if (value <= 0) return '';
  if (value < 1000) return String(value);
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: value < 10000 ? 1 : 0,
  }).format(value);
}

const TIME_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "just now", "5 minutes ago", "2 weeks ago", "1 year ago". */
function timeAgo(dateString) {
  const then = new Date(dateString).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  for (const [unit, size] of TIME_UNITS) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

function fullDate(dateString) {
  const d = new Date(dateString);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : '';
}

/** "Top": likes plus replies, newest first on ties. Returns ids only. */
function rankIds(list, mode) {
  const cloned = [...list];
  if (mode === 'newest') {
    cloned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    const score = (c) => (Number(c.likeCount) || 0) + (c.replies?.length || Number(c.replyCount) || 0);
    cloned.sort((a, b) => {
      const diff = score(b) - score(a);
      return diff !== 0 ? diff : new Date(b.createdAt) - new Date(a.createdAt);
    });
  }
  return cloned.map((c) => c.commentId);
}

/** Server message for a 4xx (e.g. the comment limit), otherwise the fallback. */
function errorText(error, fallback) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const message = data && (data.message || data.error);
  return status && status < 500 && typeof message === 'string' && message ? message : fallback;
}

function growTextarea(event) {
  const el = event.target;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
}

function resetTextarea(el) {
  if (el) el.style.height = '';
}

// ── Small building blocks ────────────────────────────────────

function useIsMobile() {
  const read = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_QUERY).matches;

  const [isMobile, setIsMobile] = useState(read);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

/** Photo, or a theme-tinted initial when there's no photo (or it fails to load). */
function Avatar({ name, photoUrl, size = 'md' }) {
  const src = buildUrl(photoUrl);
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [src]);

  if (src && !broken) {
    return (
      <img
        className={`cmt-avatar cmt-avatar--${size}`}
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={`cmt-avatar cmt-avatar--${size} cmt-avatar--initial`} aria-hidden="true">
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** Comment body: folds past four lines, highlights a leading @mention. */
function CommentText({ text }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return undefined;
    const measure = () => setOverflows(el.scrollHeight - el.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  const content = text || '';
  const mention = content.match(/^@\S+/);

  return (
    <>
      <p ref={ref} className={`cmt-comment__text ${expanded ? '' : 'is-clamped'}`}>
        {mention ? (
          <>
            <span className="cmt-mention">{mention[0]}</span>
            {content.slice(mention[0].length)}
          </>
        ) : (
          content
        )}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          className="cmt-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </>
  );
}

/** YouTube-style "Delete comment?" dialog. Focuses Cancel, Esc closes. */
function ConfirmDelete({ ownComment, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    cancelRef.current?.focus();
    // Capture phase so Esc closes only this dialog, not the sheet behind it.
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div
      className="cmt-confirm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="cmt-confirm__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <h3 id={titleId} className="cmt-confirm__title">Delete comment?</h3>
        <p id={textId} className="cmt-confirm__text">
          {ownComment
            ? 'Delete your comment permanently?'
            : 'Remove this comment from your release for everyone?'}
        </p>
        <div className="cmt-confirm__actions">
          <button ref={cancelRef} type="button" className="cmt-btn cmt-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="cmt-btn cmt-btn--danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comment section ──────────────────────────────────────────

const CommentSection = ({ songId, videoId, userId, songArtistId, artistId }) => {
  // ── Media identity: exactly one of songId / videoId is expected ──
  const mediaType = videoId ? 'video' : 'song';
  const mediaId = videoId || songId;
  const mediaArtistId = songArtistId ?? artistId ?? null;
  const mediaNoun = mediaType === 'video' ? 'video' : 'track';

  const { user: viewer } = useAuth();
  const { triggerGate, gateProps } = useAuthGate();
  const isMobile = useIsMobile();
  const sheetTitleId = useId();

  const [comments, setComments] = useState([]);
  const [order, setOrder] = useState([]); // top-level ids in display order
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sortMode, setSortMode] = useState('top');
  const [commentCount, setCommentCount] = useState({ totalCount: 0, topLevelCount: 0 });
  const [commentLimit, setCommentLimit] = useState({
    count: 0,
    limit: 3,
    remaining: 3,
    limitReached: false,
  });

  const [newComment, setNewComment] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // replyTarget: { parentId, anchorId, username } — parentId is the thread
  // the reply is posted under; anchorId is where the reply box renders.
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [expandedReplies, setExpandedReplies] = useState({});

  const [activeMenu, setActiveMenu] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [justLiked, setJustLiked] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const composerRef = useRef(null);
  const replyInputRef = useRef(null);
  const sheetPanelRef = useRef(null);
  const previewRef = useRef(null);
  const sheetBodyRef = useRef(null);
  const sortModeRef = useRef(sortMode);
  const toastTimer = useRef(null);
  const mountedRef = useRef(true);
  // commentId → { want, server, serverCount, busy } — see toggleLike.
  const likeSync = useRef(new Map());

  sortModeRef.current = sortMode;
  const overlayOpen = !!pendingDelete || gateProps.isOpen;
  const overlayOpenRef = useRef(overlayOpen);
  overlayOpenRef.current = overlayOpen;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // Closing hands focus back to the card that opened the sheet.
  const closeSheet = useCallback(() => {
    const panel = sheetPanelRef.current;
    if (panel && panel.contains(document.activeElement)) {
      previewRef.current?.focus?.({ preventScroll: true });
    }
    setIsSheetOpen(false);
  }, []);

  const fetchUserCommentCount = useCallback(async () => {
    if (!userId || !mediaId) return;
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/comments/${mediaType}/${mediaId}/user-count`,
      });
      if (mountedRef.current && response?.data) setCommentLimit(response.data);
    } catch (error) {
      // Silent failure — don't block commenting if this check fails
      console.warn('Failed to fetch comment limit:', error);
    }
  }, [mediaType, mediaId, userId]);

  // ── Load comments, the total, and this viewer's comment allowance ──
  useEffect(() => {
    if (!mediaId) return undefined;
    let cancelled = false;

    likeSync.current = new Map();
    setComments([]);
    setOrder([]);
    setCommentCount({ totalCount: 0, topLevelCount: 0 });
    setExpandedReplies({});
    setLoading(true);
    setLoadError(false);
    setReplyTarget(null);
    setActiveMenu(null);

    (async () => {
      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/comments/${mediaType}/${mediaId}`,
        });
        if (cancelled) return;
        const list = Array.isArray(response?.data) ? response.data : [];
        setComments(list);
        setOrder(rankIds(list, sortModeRef.current));
      } catch (error) {
        console.error('Failed to fetch comments:', error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    (async () => {
      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/comments/${mediaType}/${mediaId}/count`,
        });
        if (!cancelled && response?.data) setCommentCount(response.data);
      } catch (error) {
        console.error('Failed to fetch comment count:', error);
      }
    })();

    fetchUserCommentCount();

    return () => {
      cancelled = true;
    };
  }, [mediaType, mediaId, userId, reloadKey, fetchUserCommentCount]);

  // ── Phone ↔ desktop: never leave a sheet open on a wide screen ──
  useEffect(() => {
    if (!isMobile) setIsSheetOpen(false);
  }, [isMobile]);

  // ── Close the ⋯ menu on outside click / Esc ──
  useEffect(() => {
    if (!activeMenu) return undefined;
    const close = () => setActiveMenu(null);
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('click', close);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [activeMenu]);

  // ── Mobile sheet: scroll lock + Esc + focus the dialog (not the input —
  //    popping the keyboard would hide the comments people came to read) ──
  useEffect(() => {
    if (!isSheetOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event) => {
      if (event.key === 'Escape' && !overlayOpenRef.current) closeSheet();
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => sheetPanelRef.current?.focus?.(), 220);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [isSheetOpen, closeSheet]);

  // ── Focus the reply box when it opens, caret after any @mention ──
  useEffect(() => {
    if (!replyTarget) return;
    const el = replyInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange?.(end, end);
  }, [replyTarget]);

  const displayed = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.commentId, c]));
    return order.map((id) => byId.get(id)).filter(Boolean);
  }, [comments, order]);

  const previewComment = displayed[0];
  const totalCount = Number(commentCount.totalCount) || 0;

  const changeSort = (mode) => {
    if (mode === sortMode) return;
    setSortMode(mode);
    setOrder(rankIds(comments, mode));
  };

  // ── Likes ──────────────────────────────────────────────────

  const applyLike = useCallback((commentId, liked, count) => {
    const patch = (c) => (c.commentId === commentId ? { ...c, likedByMe: liked, likeCount: count } : c);
    setComments((prev) =>
      prev.map((c) => {
        if (c.commentId === commentId) return patch(c);
        if (c.replies?.some((r) => r.commentId === commentId)) {
          return { ...c, replies: c.replies.map(patch) };
        }
        return c;
      })
    );
  }, []);

  // Sends requests until the server matches the latest tap. One request in
  // flight per comment; taps made meanwhile just move `want`.
  const flushLike = useCallback(
    async (commentId) => {
      const s = likeSync.current.get(commentId);
      if (!s || s.busy) return;
      s.busy = true;
      try {
        while (s.want !== s.server) {
          const target = s.want;
          const response = await apiCall({
            method: target ? 'post' : 'delete',
            url: `/v1/comments/${commentId}/like`,
          });
          s.server = target;
          const n = Number(response?.data?.likeCount);
          s.serverCount = Number.isFinite(n) ? n : Math.max(0, s.serverCount + (target ? 1 : -1));
        }
        if (mountedRef.current && likeSync.current.get(commentId) === s) {
          applyLike(commentId, s.server, s.serverCount);
        }
      } catch (error) {
        console.error('Failed to update comment like:', error);
        s.want = s.server;
        if (mountedRef.current && likeSync.current.get(commentId) === s) {
          applyLike(commentId, s.server, s.serverCount);
          showToast(errorText(error, "Couldn't save your like. Try again."));
        }
      } finally {
        s.busy = false;
      }
    },
    [applyLike, showToast]
  );

  const toggleLike = (comment) => {
    if (!userId) {
      triggerGate('generic');
      return;
    }
    const id = comment.commentId;
    let s = likeSync.current.get(id);
    if (!s) {
      const liked = !!comment.likedByMe;
      s = {
        want: liked,
        server: liked,
        serverCount: Math.max(0, Number(comment.likeCount) || 0),
        busy: false,
      };
      likeSync.current.set(id, s);
    }
    s.want = !s.want;
    const delta = s.want === s.server ? 0 : s.want ? 1 : -1;
    applyLike(id, s.want, Math.max(0, s.serverCount + delta));
    setJustLiked(s.want ? id : null);
    flushLike(id);
  };

  // ── Posting ────────────────────────────────────────────────

  const handleSubmitComment = async (event) => {
    event?.preventDefault?.();
    const content = newComment.trim();
    if (!content || !userId || submitting) return;

    setSubmitting(true);
    try {
      const response = await apiCall({
        method: 'post',
        url: '/v1/comments',
        data: { ...(videoId ? { videoId } : { songId }), content },
      });
      const created = response.data;

      // Your new comment goes to the top, whatever the sort (like YouTube).
      setComments((prev) => [created, ...prev]);
      setOrder((prev) => [created.commentId, ...prev.filter((id) => id !== created.commentId)]);
      setNewComment('');
      setComposerFocused(false);
      resetTextarea(composerRef.current);
      composerRef.current?.blur?.();
      sheetBodyRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });

      setCommentCount((prev) => ({
        totalCount: (Number(prev.totalCount) || 0) + 1,
        topLevelCount: (Number(prev.topLevelCount) || 0) + 1,
      }));
      setCommentLimit((prev) => ({
        ...prev,
        count: prev.count + 1,
        remaining: Math.max(0, prev.remaining - 1),
        limitReached: prev.count + 1 >= prev.limit,
      }));
    } catch (error) {
      console.error('Failed to post comment:', error);
      showToast(errorText(error, "Couldn't post your comment. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openReply = (target, anchor) => {
    if (!userId) {
      triggerGate('generic');
      return;
    }
    const isSame =
      replyTarget && replyTarget.anchorId === anchor.commentId && replyTarget.parentId === target.commentId;
    if (isSame) {
      setReplyTarget(null);
      return;
    }
    // Replying to a reply: same thread, opened with an @mention.
    setReplyContent(anchor.commentId !== target.commentId && anchor.username ? `@${anchor.username} ` : '');
    setReplyTarget({ parentId: target.commentId, anchorId: anchor.commentId, username: anchor.username });
  };

  const closeReply = () => {
    setReplyTarget(null);
    setReplyContent('');
  };

  const handleSubmitReply = async () => {
    const content = replyContent.trim();
    if (!replyTarget || !content || !userId || submitting) return;
    const { parentId } = replyTarget;

    setSubmitting(true);
    try {
      const response = await apiCall({
        method: 'post',
        url: '/v1/comments',
        data: { ...(videoId ? { videoId } : { songId }), parentCommentId: parentId, content },
      });

      setComments((prev) =>
        prev.map((comment) =>
          comment.commentId === parentId
            ? {
                ...comment,
                replies: [...(comment.replies || []), response.data],
                replyCount: (Number(comment.replyCount) || 0) + 1,
              }
            : comment
        )
      );
      setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));
      closeReply();

      setCommentCount((prev) => ({ ...prev, totalCount: (Number(prev.totalCount) || 0) + 1 }));
      setCommentLimit((prev) => ({
        ...prev,
        count: prev.count + 1,
        remaining: Math.max(0, prev.remaining - 1),
        limitReached: prev.count + 1 >= prev.limit,
      }));
    } catch (error) {
      console.error('Failed to post reply:', error);
      showToast(errorText(error, "Couldn't post your reply. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Deleting ───────────────────────────────────────────────

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const { commentId, parentId } = target;

    try {
      await apiCall({ method: 'delete', url: `/v1/comments/${commentId}` });

      if (parentId) {
        setComments((prev) =>
          prev.map((comment) =>
            comment.commentId === parentId
              ? {
                  ...comment,
                  replies: (comment.replies || []).filter((reply) => reply.commentId !== commentId),
                  replyCount: Math.max(0, (Number(comment.replyCount) || 1) - 1),
                }
              : comment
          )
        );
        setCommentCount((prev) => ({ ...prev, totalCount: Math.max(0, (Number(prev.totalCount) || 0) - 1) }));
      } else {
        setComments((prev) => prev.filter((comment) => comment.commentId !== commentId));
        setOrder((prev) => prev.filter((id) => id !== commentId));
        setCommentCount((prev) => ({
          totalCount: Math.max(0, (Number(prev.totalCount) || 0) - 1),
          topLevelCount: Math.max(0, (Number(prev.topLevelCount) || 0) - 1),
        }));
      }
      if (replyTarget && (replyTarget.anchorId === commentId || replyTarget.parentId === commentId)) {
        closeReply();
      }
      // Deleting your own comment frees one of your slots on this track.
      if (target.ownComment) fetchUserCommentCount();
      showToast('Comment deleted');
    } catch (error) {
      console.error('Failed to delete comment:', error);
      showToast(errorText(error, "Couldn't delete that comment. Try again."));
    }
  };

  const canDelete = (comment) => !!userId && (comment.userId === userId || mediaArtistId === userId);

  const toggleReplies = (commentId) => {
    setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // ── Rendering ──────────────────────────────────────────────

  const viewerAvatar = (size) =>
    userId ? (
      <Avatar name={viewer?.username} photoUrl={viewer?.photoUrl} size={size} />
    ) : (
      <span className={`cmt-avatar cmt-avatar--${size} cmt-avatar--ghost`} aria-hidden="true">
        <CommentIcon size={size === 'md' ? 18 : 14} />
      </span>
    );

  const remainingHint =
    userId && commentLimit.remaining > 0 && commentLimit.remaining <= 2
      ? `${commentLimit.remaining} ${commentLimit.remaining === 1 ? 'comment' : 'comments'} left on this ${mediaNoun}`
      : null;

  const renderComposer = (variant) => {
    if (!userId) {
      return (
        <button
          type="button"
          className={`cmt-composer-guest cmt-composer-guest--${variant}`}
          onClick={() => triggerGate('generic')}
        >
          {viewerAvatar(variant === 'panel' ? 'md' : 'sm')}
          <span className="cmt-composer-guest__text">Log in to join the conversation</span>
        </button>
      );
    }

    if (commentLimit.limitReached) {
      return (
        <div className={`cmt-limit cmt-limit--${variant}`}>
          <p>
            You've used all {commentLimit.limit} comments on this {mediaNoun}. You can still reply when
            someone responds to your comments.
          </p>
        </div>
      );
    }

    const canSubmit = !!newComment.trim() && !submitting;

    if (variant === 'sheet') {
      return (
        <VerificationGate compact title="Verify your phone to comment">
          <form onSubmit={handleSubmitComment} className="cmt-composer cmt-composer--sheet">
            {viewerAvatar('sm')}
            <div className="cmt-composer__pill">
              <textarea
                ref={composerRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onInput={growTextarea}
                placeholder="Add a comment..."
                aria-label="Add a comment"
                rows={1}
                maxLength={COMMENT_MAX_LENGTH}
                className="cmt-composer__input"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="cmt-composer__send"
                aria-label="Post comment"
                title="Post comment"
              >
                <SendIcon size={18} tone="on" />
              </button>
            </div>
          </form>
          {remainingHint && <p className="cmt-composer__hint cmt-composer__hint--sheet">{remainingHint}</p>}
        </VerificationGate>
      );
    }

    const expanded = composerFocused || newComment.length > 0;

    return (
      <VerificationGate compact title="Verify your phone to comment">
        <form onSubmit={handleSubmitComment} className="cmt-composer cmt-composer--panel">
          {viewerAvatar('md')}
          <div className={`cmt-composer__field ${expanded ? 'is-expanded' : ''}`}>
            <textarea
              ref={composerRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onInput={growTextarea}
              onFocus={() => setComposerFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment(e);
              }}
              placeholder="Add a comment..."
              aria-label="Add a comment"
              rows={1}
              maxLength={COMMENT_MAX_LENGTH}
              className="cmt-composer__input"
            />
            <span className="cmt-composer__line" aria-hidden="true" />
            {expanded && (
              <div className="cmt-composer__footer">
                <span className="cmt-composer__hint">{remainingHint}</span>
                <div className="cmt-composer__actions">
                  <button
                    type="button"
                    className="cmt-btn cmt-btn--ghost"
                    onClick={() => {
                      setNewComment('');
                      setComposerFocused(false);
                      resetTextarea(composerRef.current);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="cmt-btn cmt-btn--primary" disabled={!canSubmit}>
                    Comment
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </VerificationGate>
    );
  };

  const renderReplyBox = () => {
    const canSubmit = !!replyContent.trim() && !submitting;
    return (
      <div className="cmt-reply-box">
        <VerificationGate compact title="Verify your phone to reply">
          <div className="cmt-reply-box__row">
            {viewerAvatar('xs')}
            <div className="cmt-reply-box__field">
              <textarea
                ref={replyInputRef}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onInput={growTextarea}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
                placeholder={`Reply to ${replyTarget?.username || 'this comment'}...`}
                aria-label={`Reply to ${replyTarget?.username || 'this comment'}`}
                rows={1}
                maxLength={COMMENT_MAX_LENGTH}
                className="cmt-reply-box__input"
              />
              <span className="cmt-composer__line" aria-hidden="true" />
              <div className="cmt-reply-box__actions">
                <button type="button" className="cmt-btn cmt-btn--ghost cmt-btn--sm" onClick={closeReply}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cmt-btn cmt-btn--primary cmt-btn--sm"
                  onClick={handleSubmitReply}
                  disabled={!canSubmit}
                >
                  Reply
                </button>
              </div>
            </div>
          </div>
        </VerificationGate>
      </div>
    );
  };

  const renderComment = (comment, thread = null) => {
    const isReply = !!thread;
    const owner = thread || comment; // whose thread a reply lands in
    const canReply = !!userId && (!commentLimit.limitReached || owner.userId === userId);
    const showReplyButton = !userId || canReply;
    const liked = !!comment.likedByMe;
    const likeCount = Math.max(0, Number(comment.likeCount) || 0);
    const replies = !isReply ? comment.replies || [] : [];
    const repliesOpen = !!expandedReplies[comment.commentId];
    const menuOpen = activeMenu === comment.commentId;

    return (
      <article
        key={comment.commentId}
        className={`cmt-comment ${isReply ? 'cmt-comment--reply' : ''}`}
        aria-label={`Comment by ${comment.username || 'a listener'}`}
      >
        <Avatar name={comment.username} photoUrl={comment.userPhotoUrl} size={isReply ? 'sm' : 'md'} />

        <div className="cmt-comment__body">
          <header className="cmt-comment__meta">
            <span className="cmt-comment__author">{comment.username}</span>
            {comment.userJurisdictionName && (
              <span className="cmt-comment__place">{comment.userJurisdictionName}</span>
            )}
            <time className="cmt-comment__time" dateTime={comment.createdAt} title={fullDate(comment.createdAt)}>
              {timeAgo(comment.createdAt)}
            </time>
          </header>

          <CommentText text={comment.content} />

          <div className="cmt-actions">
            <button
              type="button"
              className={`cmt-like ${liked ? 'is-liked' : ''} ${justLiked === comment.commentId ? 'is-pop' : ''}`}
              aria-pressed={liked}
              aria-label={`Like comment by ${comment.username || 'a listener'}${
                likeCount ? `, ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : ''
              }`}
              onClick={() => toggleLike(comment)}
            >
              <span
                className="cmt-like__icon"
                onAnimationEnd={() => setJustLiked((id) => (id === comment.commentId ? null : id))}
              >
                <LikeIcon size={18} active={liked} />
              </span>
              {likeCount > 0 && <span className="cmt-like__count">{formatCount(likeCount)}</span>}
            </button>

            {showReplyButton && (
              <button
                type="button"
                className={`cmt-reply-btn ${replyTarget?.anchorId === comment.commentId ? 'is-active' : ''}`}
                aria-label={`Reply to ${comment.username || 'this comment'}`}
                onClick={() => openReply(owner, comment)}
              >
                <CommentIcon size={18} active={replyTarget?.anchorId === comment.commentId} />
                {!isMobile && <span className="cmt-reply-btn__label">Reply</span>}
              </button>
            )}
          </div>

          {replyTarget?.anchorId === comment.commentId && renderReplyBox()}

          {replies.length > 0 && (
            <div className="cmt-thread">
              <button
                type="button"
                className={`cmt-thread__toggle ${repliesOpen ? 'is-open' : ''}`}
                aria-expanded={repliesOpen}
                onClick={() => toggleReplies(comment.commentId)}
              >
                <ChevronDownIcon size={18} className="cmt-thread__chevron" />
                <span>
                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </span>
              </button>

              {repliesOpen && (
                <div className="cmt-thread__list">{replies.map((reply) => renderComment(reply, comment))}</div>
              )}
            </div>
          )}
        </div>

        {canDelete(comment) && (
          <div className={`cmt-comment__menu ${menuOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="cmt-icon-btn cmt-icon-btn--sm"
              aria-label="Comment options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenu(menuOpen ? null : comment.commentId);
              }}
            >
              <MoreIcon size={18} className="cmt-kebab" />
            </button>

            {menuOpen && (
              <div className="cmt-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  role="menuitem"
                  className="cmt-menu__item cmt-menu__item--danger"
                  onClick={() => {
                    setActiveMenu(null);
                    setPendingDelete({
                      commentId: comment.commentId,
                      parentId: isReply ? thread.commentId : null,
                      ownComment: comment.userId === userId,
                    });
                  }}
                >
                  <TrashIcon size={17} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="cmt-skeleton" role="status">
          <span className="cmt-sr-only">Loading comments...</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="cmt-skeleton__row" aria-hidden="true">
              <span className="cmt-skeleton__avatar" />
              <span className="cmt-skeleton__lines">
                <span />
                <span />
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="cmt-state">
          <p className="cmt-state__title">Couldn't load comments</p>
          <button type="button" className="cmt-btn cmt-btn--ghost" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      );
    }

    if (displayed.length === 0) {
      return (
        <div className="cmt-state">
          <span className="cmt-state__icon" aria-hidden="true">
            <CommentIcon size={26} />
          </span>
          <p className="cmt-state__title">No comments yet</p>
          <span className="cmt-state__text">Be the first to share your thoughts</span>
        </div>
      );
    }

    return displayed.map((comment) => renderComment(comment));
  };

  const renderSortChips = () => (
    <div className="cmt-chips" role="group" aria-label="Sort comments">
      {[
        ['top', 'Top'],
        ['newest', 'Newest'],
      ].map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          className={`cmt-chip ${sortMode === mode ? 'is-active' : ''}`}
          aria-pressed={sortMode === mode}
          onClick={() => changeSort(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const renderMobilePreview = () => (
    <button
      ref={previewRef}
      type="button"
      className="cmt-preview"
      onClick={() => setIsSheetOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={isSheetOpen}
    >
      <span className="cmt-preview__head">
        <span className="cmt-preview__title">Comments</span>
        {totalCount > 0 && <span className="cmt-preview__count">{formatCount(totalCount)}</span>}
        <ChevronDownIcon size={18} className="cmt-preview__chevron" />
      </span>

      <span className="cmt-preview__body">
        {previewComment ? (
          <>
            <Avatar name={previewComment.username} photoUrl={previewComment.userPhotoUrl} size="xs" />
            <span className="cmt-preview__text">{previewComment.content}</span>
          </>
        ) : (
          <>
            {viewerAvatar('xs')}
            <span className="cmt-preview__placeholder">
              {loading ? 'Loading comments...' : 'Add a comment...'}
            </span>
          </>
        )}
      </span>
    </button>
  );

  // Portals go INTO #root, not <body>: the colour theme lives on #root
  // ([data-theme]), so anything outside it falls back to default blue.
  // Placed as direct children of #root they still sit above the player
  // and layout (see `#root > .cmt-sheet` in the stylesheet). Falls back to
  // <body> only when #root is missing (an isolated test render).
  const portalTarget =
    typeof document !== 'undefined' ? document.getElementById('root') || document.body : null;

  return (
    <section className="cmt" aria-label="Comments">
      {isMobile ? (
        renderMobilePreview()
      ) : (
        <div className="cmt-panel">
          <header className="cmt-head">
            <h2 className="cmt-head__title">
              Comments
              {totalCount > 0 && <span className="cmt-head__count">{totalCount.toLocaleString()}</span>}
            </h2>
            {renderSortChips()}
          </header>

          {renderComposer('panel')}

          <div className="cmt-list">{renderList()}</div>
        </div>
      )}

      {isMobile &&
        portalTarget &&
        createPortal(
          <div className={`cmt-sheet ${isSheetOpen ? 'is-open' : ''}`} aria-hidden={!isSheetOpen} inert={!isSheetOpen}>
            <div className="cmt-sheet__scrim" onClick={closeSheet} />

            <div
              ref={sheetPanelRef}
              className="cmt-sheet__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
              tabIndex={-1}
            >
              <div className="cmt-sheet__grab" aria-hidden="true" />

              <div className="cmt-sheet__head">
                <h2 id={sheetTitleId} className="cmt-sheet__title">
                  Comments
                  {totalCount > 0 && <span className="cmt-sheet__count">{formatCount(totalCount)}</span>}
                </h2>

                <div className="cmt-sheet__tools">
                  <Link
                    to="/help#comments"
                    className="cmt-icon-btn"
                    aria-label="How comments work"
                    title="How comments work"
                    onClick={closeSheet}
                  >
                    <InfoIcon size={20} />
                  </Link>
                  <button
                    type="button"
                    className="cmt-icon-btn"
                    aria-label="Close comments"
                    onClick={closeSheet}
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>
              </div>

              <div className="cmt-sheet__sort">{renderSortChips()}</div>

              <div ref={sheetBodyRef} className="cmt-sheet__body">
                <div className="cmt-list">{renderList()}</div>
              </div>

              <div className="cmt-sheet__composer">{renderComposer('sheet')}</div>
            </div>
          </div>,
          portalTarget
        )}

      {/* Dialogs, the sign-in sheet and the toast sit above everything,
          including the player and the comments sheet. */}
      {portalTarget &&
        createPortal(
          <div className="cmt-overlay">
            {pendingDelete && (
              <ConfirmDelete
                ownComment={pendingDelete.ownComment}
                onCancel={cancelDelete}
                onConfirm={confirmDelete}
              />
            )}
            <div className={`cmt-toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
              {toast}
            </div>
            <AuthGateSheet {...gateProps} />
          </div>,
          portalTarget
        )}
    </section>
  );
};

export default CommentSection;
