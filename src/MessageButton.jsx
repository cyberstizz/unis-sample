// src/MessageButton.jsx
//
// Drop onto an artist profile. Opens a direct thread with the profile owner.
// Hidden on your own profile.
//
// v2: forwards recipientName + recipientPhotoUrl into the compose state.
// MessagePage falls back to "Member" / no avatar when these are missing, so
// callers should always pass them (see artistpage.jsx).
//
// v3: styles moved to messageButton.scss (they used to load only with the
// Messages page) and the class renamed from udm-msg-btn to unis-dm-cta.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import './messageButton.scss';

export default function MessageButton({
  recipientId,
  recipientName,
  recipientPhotoUrl = null,
  className = '',
}) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  if (!recipientId || (user && user.userId === recipientId)) return null;

  const onClick = () => {
    if (isGuest) { navigate('/login'); return; }
    navigate('/messages', {
      state: {
        compose: {
          userId: recipientId,
          username: recipientName,
          photoUrl: recipientPhotoUrl,
        },
      },
    });
  };

  return (
    <button type="button" className={`unis-dm-cta ${className}`.trim()} onClick={onClick}>
      <MessageCircle size={18} aria-hidden="true" />
      <span>Message</span>
    </button>
  );
}