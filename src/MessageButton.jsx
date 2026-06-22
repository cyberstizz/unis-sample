// Drop onto an artist/listener profile. Starts (or reuses) a conversation with
// the profile owner, then routes to /messages. Hide it on your own profile.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';

export default function MessageButton({ recipientId, className = '' }) {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!recipientId || (user && user.userId === recipientId)) return null;

  const start = async () => {
    if (isGuest) { navigate('/login'); return; }
    setBusy(true);
    setError(null);
    try {
      await apiCall({ method: 'post', url: '/v1/messages/start', data: { recipientId } });
      navigate('/messages', { state: { openWith: recipientId } });
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not start a conversation.');
      setBusy(false);
    }
  };

  return (
    <button
      className={`udm-msg-btn ${className}`}
      onClick={start}
      disabled={busy}
      title={error || 'Message'}
    >
      <MessageCircle size={18} aria-hidden="true" />
      <span>{busy ? 'Opening…' : 'Message'}</span>
    </button>
  );
}