import React, { useState, useEffect, useRef } from 'react';
import { apiCall } from './components/axiosInstance';
import { MessageCircle, Send, Reply, Trash2, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import './commentSection.scss';

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
  
  const textareaRef = useRef(null);
  const replyInputRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  useEffect(() => {
    if (songId) {
      fetchComments();
      fetchCommentCount();
    }
  }, [songId]);

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

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await apiCall({
        method: 'get',
        url: `/v1/comments/song/${songId}`
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
        url: `/v1/comments/song/${songId}/count`
      });
      setCommentCount(response.data);
    } catch (error) {
      console.error('Failed to fetch comment count:', error);
    }
  };

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
          content: newComment.trim()
        }
      });
      
      // Add new comment to the top of the list
      setComments(prev => [response.data, ...prev]);
      setNewComment('');
      setCommentCount(prev => ({
        totalCount: prev.totalCount + 1,
        topLevelCount: prev.topLevelCount + 1
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
          content: replyContent.trim()
        }
      });

      // Add reply to the parent comment
      setComments(prev => prev.map(comment => {
        if (comment.commentId === parentCommentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), response.data],
            replyCount: (comment.replyCount || 0) + 1
          };
        }
        return comment;
      }));

      // Auto-expand replies for this comment
      setExpandedReplies(prev => ({ ...prev, [parentCommentId]: true }));
      
      setReplyContent('');
      setReplyingTo(null);
      setCommentCount(prev => ({
        ...prev,
        totalCount: prev.totalCount + 1
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
        url: `/v1/comments/${commentId}?userId=${userId}`
      });

      if (isReply && parentId) {
        // Remove reply from parent
        setComments(prev => prev.map(comment => {
          if (comment.commentId === parentId) {
            return {
              ...comment,
              replies: comment.replies.filter(r => r.commentId !== commentId),
              replyCount: Math.max(0, (comment.replyCount || 1) - 1)
            };
          }
          return comment;
        }));
      } else {
        // Remove top-level comment
        setComments(prev => prev.filter(c => c.commentId !== commentId));
        setCommentCount(prev => ({
          totalCount: Math.max(0, prev.totalCount - 1),
          topLevelCount: Math.max(0, prev.topLevelCount - 1)
        }));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment.');
    }
  };

  const toggleReplies = (commentId) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
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

  const renderComment = (comment, isReply = false, parentId = null) => {
    const showReplies = expandedReplies[comment.commentId];
    const hasReplies = comment.replies && comment.replies.length > 0;

    return (
      <div 
        key={comment.commentId} 
        className={`comment-item ${isReply ? 'reply' : ''}`}
      >
        <div className="comment-content">
          {/* Avatar */}
          <div className="avatar-container">
            {comment.userPhotoUrl ? (
              <img 
                src={comment.userPhotoUrl.startsWith('http') ? comment.userPhotoUrl : `${API_BASE_URL}${comment.userPhotoUrl}`}
                alt={comment.username}
                className="user-avatar"
              />
            ) : (
              <div className="user-avatar placeholder">
                {comment.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

          {/* Comment Body */}
          <div className="comment-body">
            <div className="comment-header">
              <div className="user-info">
                <span className="username">{comment.username}</span>
                {comment.userJurisdictionName && (
                  <span className="user-jurisdiction">{comment.userJurisdictionName}</span>
                )}
              </div>
              <span className="timestamp">{formatTimeAgo(comment.createdAt)}</span>              
              
              {/* Actions Menu */}
              {canDelete(comment) && (
                <div className="comment-menu">
                  <button 
                    className="menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === comment.commentId ? null : comment.commentId);
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {activeMenu === comment.commentId && (
                    <div className="menu-dropdown">
                      <button 
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

            {/* Reply Button (only for top-level comments) */}
            {!isReply && userId && (
              <button 
                className="reply-trigger"
                onClick={() => setReplyingTo(replyingTo === comment.commentId ? null : comment.commentId)}
              >
                <Reply size={14} />
                Reply
              </button>
            )}

            {/* Reply Input */}
            {replyingTo === comment.commentId && (
              <div className="reply-input-container">
                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Reply to ${comment.username}...`}
                  className="reply-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitReply(comment.commentId);
                    }
                  }}
                />
                <button 
                  onClick={() => handleSubmitReply(comment.commentId)}
                  disabled={!replyContent.trim() || submitting}
                  className="reply-submit"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Replies Section */}
        {hasReplies && !isReply && (
          <div className="replies-section">
            <button 
              className="toggle-replies"
              onClick={() => toggleReplies(comment.commentId)}
            >
              {showReplies ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showReplies ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
            </button>
            
            {showReplies && (
              <div className="replies-list">
                {comment.replies.map(reply => renderComment(reply, true, comment.commentId))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="comments-section-premium">
      {/* Header */}
      <div className="comments-header">
        <h2>
          <MessageCircle size={24} />
          Comments
          {commentCount.totalCount > 0 && (
            <span className="comment-count">{commentCount.totalCount}</span>
          )}
        </h2>
      </div>

      {/* New Comment Form */}
      {userId ? (
        <form onSubmit={handleSubmitComment} className="new-comment-form">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts on this track..."
              rows={1}
              className="comment-textarea"
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
              }}
            />
            <button 
              type="submit" 
              disabled={!newComment.trim() || submitting}
              className="submit-button"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      ) : (
        <div className="login-prompt">
          <p>Log in to join the conversation</p>
        </div>
      )}

      {/* Comments List */}
      <div className="comments-list-premium">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={48} strokeWidth={1} />
            <p>No comments yet</p>
            <span>Be the first to share your thoughts</span>
          </div>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </div>
    </section>
  );
};

export default CommentSection;