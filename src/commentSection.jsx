import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiCall } from './components/axiosInstance';
import {
  MessageCircle,
  Send,
  Reply,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import './commentSection.scss';
import VerificationGate from './VerificationGate';


const CommentSection = ({ songId, userId, songArtistId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [commentCount, setCommentCount] = useState({ totalCount: 0, topLevelCount: 0 });
  const [activeMenu, setActiveMenu] = useState(null);
  const [commentLimit, setCommentLimit] = useState({
    count: 0,
    limit: 3,
    remaining: 3,
    limitReached: false,
  });

  // New UX state
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [sortMode, setSortMode] = useState('top');

  const textareaRef = useRef(null);
  const sheetTextareaRef = useRef(null);
  const replyInputRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  useEffect(() => {
    if (songId) {
      fetchComments();
      fetchCommentCount();
      if (userId) fetchUserCommentCount();
    }
  }, [songId, userId]);

  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyingTo]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Mobile sheet scroll lock + Escape behavior
  useEffect(() => {
    if (!isMobileSheetOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileSheetOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileSheetOpen]);

  // Optional: focus composer shortly after sheet opens
  useEffect(() => {
    if (!isMobileSheetOpen) return;

    const timer = window.setTimeout(() => {
      sheetTextareaRef.current?.focus?.();
    }, 260);

    return () => window.clearTimeout(timer);
  }, [isMobileSheetOpen]);

  const fetchUserCommentCount = async () => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/comments/song/${songId}/user-count`,
      });
      setCommentLimit(response.data);
    } catch (error) {
      // Silent failure — don't block commenting if this check fails
      console.warn('Failed to fetch comment limit:', error);
    }
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await apiCall({
        method: 'get',
        url: `/v1/comments/song/${songId}`,
      });
      setComments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentCount = async () => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/comments/song/${songId}/count`,
      });
      setCommentCount(response.data);
    } catch (error) {
      console.error('Failed to fetch comment count:', error);
    }
  };

  const sortedComments = useMemo(() => {
    const cloned = [...comments];

    if (sortMode === 'newest') {
      return cloned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // "Top" is future-friendly. If your backend later returns likes/upvotes/reply weight,
    // this will automatically start to feel more meaningful.
    return cloned.sort((a, b) => {
      const aScore = (a.likeCount || a.likes || 0) + (a.replyCount || a.replies?.length || 0);
      const bScore = (b.likeCount || b.likes || 0) + (b.replyCount || b.replies?.length || 0);

      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [comments, sortMode]);

  const previewComment = sortedComments[0];

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim() || !userId || submitting) return;

    setSubmitting(true);

    try {
      const response = await apiCall({
        method: 'post',
        url: '/v1/comments',
        data: {
          songId,
          userId,
          content: newComment.trim(),
        },
      });

      setComments((prev) => [response.data, ...prev]);
      setNewComment('');

      setCommentCount((prev) => ({
        totalCount: prev.totalCount + 1,
        topLevelCount: prev.topLevelCount + 1,
      }));

      setCommentLimit((prev) => ({
        ...prev,
        count: prev.count + 1,
        remaining: Math.max(0, prev.remaining - 1),
        limitReached: prev.count + 1 >= prev.limit,
      }));
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentCommentId) => {
    if (!replyContent.trim() || !userId || submitting) return;

    setSubmitting(true);

    try {
      const response = await apiCall({
        method: 'post',
        url: '/v1/comments',
        data: {
          songId,
          userId,
          parentCommentId,
          content: replyContent.trim(),
        },
      });

      setComments((prev) =>
        prev.map((comment) => {
          if (comment.commentId === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), response.data],
              replyCount: (comment.replyCount || 0) + 1,
            };
          }
          return comment;
        })
      );

      setExpandedReplies((prev) => ({ ...prev, [parentCommentId]: true }));
      setReplyContent('');
      setReplyingTo(null);

      setCommentCount((prev) => ({
        ...prev,
        totalCount: prev.totalCount + 1,
      }));

      setCommentLimit((prev) => ({
        ...prev,
        count: prev.count + 1,
        remaining: Math.max(0, prev.remaining - 1),
        limitReached: prev.count + 1 >= prev.limit,
      }));
    } catch (error) {
      console.error('Failed to post reply:', error);
      alert('Failed to post reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId, isReply = false, parentId = null) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await apiCall({
        method: 'delete',
        url: `/v1/comments/${commentId}?userId=${userId}`,
      });

      if (isReply && parentId) {
        setComments((prev) =>
          prev.map((comment) => {
            if (comment.commentId === parentId) {
              return {
                ...comment,
                replies: comment.replies.filter((reply) => reply.commentId !== commentId),
                replyCount: Math.max(0, (comment.replyCount || 1) - 1),
              };
            }
            return comment;
          })
        );
      } else {
        setComments((prev) => prev.filter((comment) => comment.commentId !== commentId));

        setCommentCount((prev) => ({
          totalCount: Math.max(0, prev.totalCount - 1),
          topLevelCount: Math.max(0, prev.topLevelCount - 1),
        }));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment.');
    }
  };

  const toggleReplies = (commentId) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
  };

  const canDelete = (comment) => {
    return userId && (comment.userId === userId || songArtistId === userId);
  };

  const getAvatarUrl = (photoUrl) => {
    if (!photoUrl) return null;
    return photoUrl.startsWith('http') ? photoUrl : `${API_BASE_URL}${photoUrl}`;
  };

  const autoGrowTextarea = (event) => {
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 150)}px`;
  };

  const renderUserAvatar = (comment, sizeClass = '') => {
    const avatarUrl = getAvatarUrl(comment.userPhotoUrl);

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={comment.username}
          className={`user-avatar ${sizeClass}`}
        />
      );
    }

    return (
      <div className={`user-avatar placeholder ${sizeClass}`}>
        {comment.username?.charAt(0).toUpperCase() || '?'}
      </div>
    );
  };

  const renderComposer = ({ variant = 'desktop' } = {}) => {
    const textareaReference = variant === 'sheet' ? sheetTextareaRef : textareaRef;

    if (!userId) {
      return (
        <div className="login-prompt">
          <p>Log in to join the conversation</p>
        </div>
      );
    }

    if (commentLimit.limitReached) {
      return (
        <div className="comment-limit-reached">
          <p>
            You've used all {commentLimit.limit} comments on this track. You can still reply when someone responds to your comments.
          </p>
        </div>
      );
    }

    return (
      <VerificationGate compact title="Verify your phone to comment">
      <form onSubmit={handleSubmitComment} className={`new-comment-form new-comment-form--${variant}`}>
        <div className="input-wrapper">
          <textarea
            ref={textareaReference}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            rows={1}
            className="comment-textarea"
            onInput={autoGrowTextarea}
          />

          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="submit-button"
            aria-label="Post comment"
            title="Post comment"
          >
            <Send size={17} />
          </button>
        </div>

        {commentLimit.remaining <= 2 && commentLimit.remaining > 0 && (
          <div className="comment-limit-hint">
            {commentLimit.remaining} {commentLimit.remaining === 1 ? 'comment' : 'comments'} remaining on this track
          </div>
        )}
      </form>
      </VerificationGate>
    );
  };

  const renderComment = (comment, isReply = false, parentId = null) => {
    const showReplies = expandedReplies[comment.commentId];
    const hasReplies = comment.replies && comment.replies.length > 0;

    return (
      <div
        key={comment.commentId}
        className={`comment-item ${isReply ? 'reply' : ''}`}
      >
        <div className="comment-content">
          <div className="avatar-container">
            {renderUserAvatar(comment)}
          </div>

          <div className="comment-body">
            <div className="comment-header">
              <div className="user-info">
                <span className="username">{comment.username}</span>

                {comment.userJurisdictionName && (
                  <span className="user-jurisdiction">{comment.userJurisdictionName}</span>
                )}
              </div>

              <span className="timestamp">{formatTimeAgo(comment.createdAt)}</span>

              {canDelete(comment) && (
                <div className="comment-menu">
                  <button
                    type="button"
                    className="menu-trigger"
                    aria-label="Comment options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === comment.commentId ? null : comment.commentId);
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {activeMenu === comment.commentId && (
                    <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.commentId, isReply, parentId)}
                        className="menu-item delete"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="comment-text">{comment.content}</p>

            {!isReply && userId && (!commentLimit.limitReached || comment.userId === userId) && (
              <button
                type="button"
                className="reply-trigger"
                onClick={() => setReplyingTo(replyingTo === comment.commentId ? null : comment.commentId)}
              >
                <Reply size={14} />
                Reply
              </button>
            )}

            {replyingTo === comment.commentId && (
              <div className="reply-input-container">
                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Reply to ${comment.username}...`}
                  className="reply-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitReply(comment.commentId);
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => handleSubmitReply(comment.commentId)}
                  disabled={!replyContent.trim() || submitting}
                  className="reply-submit"
                  aria-label="Post reply"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {hasReplies && !isReply && (
          <div className="replies-section">
            <button
              type="button"
              className="toggle-replies"
              onClick={() => toggleReplies(comment.commentId)}
            >
              {showReplies ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showReplies ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
            </button>

            {showReplies && (
              <div className="replies-list">
                {comment.replies.map((reply) => renderComment(reply, true, comment.commentId))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCommentList = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading comments...</p>
        </div>
      );
    }

    if (sortedComments.length === 0) {
      return (
        <div className="empty-state">
          <MessageCircle size={48} strokeWidth={1} />
          <p>Comment to earn points</p>
          <span>share your thoughts</span>
        </div>
      );
    }

    return sortedComments.map((comment) => renderComment(comment));
  };

  const renderSortTabs = () => {
    return (
      <div className="comments-sort-tabs" role="tablist" aria-label="Comment sort order">
        <button
          type="button"
          className={`comments-sort-tab ${sortMode === 'top' ? 'active' : ''}`}
          onClick={() => setSortMode('top')}
          role="tab"
          aria-selected={sortMode === 'top'}
        >
          Top
        </button>

        <button
          type="button"
          className={`comments-sort-tab ${sortMode === 'newest' ? 'active' : ''}`}
          onClick={() => setSortMode('newest')}
          role="tab"
          aria-selected={sortMode === 'newest'}
        >
          Newest
        </button>
      </div>
    );
  };

  const renderMobilePreview = () => {
    return (
      <button
        type="button"
        className="comments-mobile-preview"
        onClick={() => setIsMobileSheetOpen(true)}
        aria-label="Open comments"
      >
        <div className="comments-mobile-preview__header">
          <div className="comments-mobile-preview__title">
            <span>Comments</span>

            {commentCount.totalCount > 0 && (
              <span className="comments-mobile-preview__count">{commentCount.totalCount}</span>
            )}
          </div>

          <MoreHorizontal size={20} />
        </div>

        <div className="comments-mobile-preview__body">
          {previewComment ? (
            <>
              <div className="comments-mobile-preview__avatar">
                {renderUserAvatar(previewComment, 'preview-avatar')}
              </div>

              <div className="comments-mobile-preview__text">
                <span className="comments-mobile-preview__username">
                  {previewComment.username}
                </span>
                <span className="comments-mobile-preview__snippet">
                  {previewComment.content}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="comments-mobile-preview__placeholder-icon">
                <MessageCircle size={18} />
              </div>

              <div className="comments-mobile-preview__text">
                <span className="comments-mobile-preview__snippet">
                  Comment to earn points
                </span>
              </div>
            </>
          )}
        </div>
      </button>
    );
  };

  return (
    <section className="comments-section-premium">
      {/* Mobile collapsed YouTube-style preview */}
      {renderMobilePreview()}

      {/* Desktop/tablet embedded panel */}
      <div className="comments-desktop-panel">
        <div className="comments-header">
          <h2>
            <MessageCircle size={24} />
            Comments

            {commentCount.totalCount > 0 && (
              <span className="comment-count">{commentCount.totalCount}</span>
            )}
          </h2>

          {renderSortTabs()}
        </div>

        {renderComposer({ variant: 'desktop' })}

        <div className="comments-list-premium">
          {renderCommentList()}
        </div>
      </div>

      {/* Mobile full-screen / bottom-sheet panel */}
      <div
        className={`comments-mobile-sheet ${isMobileSheetOpen ? 'is-open' : ''}`}
        aria-hidden={!isMobileSheetOpen}
      >
        <div
          className="comments-mobile-sheet__scrim"
          onClick={() => setIsMobileSheetOpen(false)}
        />

        <div
          className="comments-mobile-sheet__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comments-mobile-sheet-title"
        >
          <div className="comments-mobile-sheet__handle" />

          <div className="comments-mobile-sheet__header">
            <div>
              <h2 id="comments-mobile-sheet-title">
                Comments

                {commentCount.totalCount > 0 && (
                  <span>{commentCount.totalCount}</span>
                )}
              </h2>
            </div>

            <div className="comments-mobile-sheet__actions">
              <button
                type="button"
                className="comments-mobile-sheet__icon"
                aria-label="Comment info"
              >
                <Info size={21} />
              </button>

              <button
                type="button"
                className="comments-mobile-sheet__icon"
                aria-label="Close comments"
                onClick={() => setIsMobileSheetOpen(false)}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="comments-mobile-sheet__sort-row">
            {renderSortTabs()}

            <div className="comments-mobile-sheet__sort-icon" aria-hidden="true">
              <SlidersHorizontal size={16} />
            </div>
          </div>

          <div className="comments-mobile-sheet__body">
            <div className="comments-list-premium">
              {renderCommentList()}
            </div>
          </div>

          <div className="comments-mobile-sheet__composer">
            {renderComposer({ variant: 'sheet' })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommentSection;