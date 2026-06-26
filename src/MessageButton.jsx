// src/MessageButton.jsx
//
// Drop onto an artist profile. Opens a direct thread with the profile owner.
// Hidden on your own profile.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from './context/AuthContext';

export default function MessageButton({ recipientId, recipientName, className = '' }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  if (!recipientId || (user && user.userId === recipientId)) return null;

  const onClick = () => {
    if (isGuest) { navigate('/login'); return; }
    navigate('/messages', {
      state: { compose: { userId: recipientId, username: recipientName } },
    });
  };

  return (
    <button className={`udm-msg-btn ${className}`} onClick={onClick}>
      <MessageCircle size={18} aria-hidden="true" />
      <span>Message</span>
    </button>
  );
}