// src/SupportButton.jsx
//
// Drop onto an artist profile. Opens the SupportSheet. Hidden on your own
// profile (you can't support yourself).

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import SupportSheet from './SupportSheet';

export default function SupportButton({ artistId, artistName, className = '' }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!artistId || (user && user.userId === artistId)) return null;

  const onClick = () => {
    if (isGuest) { navigate('/login'); return; }
    setOpen(true);
  };

  return (
    <>
      <button className={`usp-trigger ${className}`} onClick={onClick}>
        <Zap size={18} aria-hidden="true" />
        <span>Support</span>
      </button>
      <SupportSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        artistId={artistId}
        artistName={artistName}
        source="profile"
      />
    </>
  );
}