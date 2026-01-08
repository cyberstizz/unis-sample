import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ChevronRight, ChevronLeft, Check, AlertCircle, 
  User, Mail, Lock, MapPin, Music, Headphones, Mic2,
  Upload, Image, FileAudio, Search, Play, Pause, Square,
  Loader2, CheckCircle2, XCircle, Info, Gift, Users,
  Sparkles, Heart
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { JURISDICTION_IDS, GENRE_IDS } from './utils/idMappings';
import './createAccountWizard.scss';
import UnisLogo from './assets/unisLogoThree.svg';


    const WelcomeIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="welcomeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="50%" stopColor="#4a90d9" />
            <stop offset="100%" stopColor="#6bb3f0" />
          </linearGradient>
          <linearGradient id="welcomeAccent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        {/* Figure with arms open welcoming - dynamic pose */}
        <ellipse cx="100" cy="52" rx="24" ry="26" fill="url(#welcomeGradient)"/>
        {/* Body leaning forward welcomingly */}
        <path d="M70 75 Q65 95 70 130 Q75 160 90 175 L110 175 Q125 160 130 130 Q135 95 130 75 Q115 65 100 65 Q85 65 70 75Z" fill="url(#welcomeGradient)"/>
        {/* Left arm reaching out */}
        <path d="M70 80 Q45 70 25 85 Q20 90 25 95 Q30 100 40 95 Q55 88 68 95" fill="url(#welcomeGradient)"/>
        {/* Right arm reaching out */}
        <path d="M130 80 Q155 70 175 85 Q180 90 175 95 Q170 100 160 95 Q145 88 132 95" fill="url(#welcomeGradient)"/>
        {/* Envelope/invitation symbol */}
        <rect x="85" y="110" width="30" height="20" rx="2" fill="url(#welcomeAccent)" opacity="0.9"/>
        <path d="M85 112 L100 125 L115 112" stroke="white" strokeWidth="2" fill="none"/>
        {/* Sparkles around */}
        <circle cx="45" cy="55" r="4" fill="white" opacity="0.8"/>
        <circle cx="155" cy="60" r="3" fill="white" opacity="0.7"/>
        <circle cx="35" cy="130" r="3" fill="white" opacity="0.6"/>
        <circle cx="165" cy="125" r="4" fill="white" opacity="0.7"/>
        {/* Small stars */}
        <path d="M50 40 L52 45 L57 45 L53 48 L55 53 L50 50 L45 53 L47 48 L43 45 L48 45Z" fill="white" opacity="0.6"/>
        <path d="M160 40 L161 43 L164 43 L162 45 L163 48 L160 46 L157 48 L158 45 L156 43 L159 43Z" fill="white" opacity="0.5"/>
      </svg>
    );

    const BasicInfoIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="basicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="100%" stopColor="#4a90d9" />
          </linearGradient>
          <linearGradient id="screenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0a1628" />
          </linearGradient>
        </defs>
        {/* Person sitting and typing - side profile */}
        <ellipse cx="85" cy="55" rx="22" ry="24" fill="url(#basicGradient)"/>
        {/* Body sitting */}
        <path d="M60 75 Q55 90 58 115 L62 145 Q65 155 80 158 L95 158 Q100 155 100 145 L100 115 Q100 90 95 75 Q90 70 85 70 Q70 70 60 75Z" fill="url(#basicGradient)"/>
        {/* Arm reaching to keyboard */}
        <path d="M95 90 Q110 95 125 100 Q130 102 130 108 Q128 112 122 110 Q108 105 95 102" fill="url(#basicGradient)"/>
        {/* Other arm */}
        <path d="M60 90 Q50 100 55 115 Q58 120 65 115 Q70 105 68 95" fill="url(#basicGradient)"/>
        {/* Laptop/screen */}
        <rect x="110" y="85" width="55" height="40" rx="3" fill="url(#screenGradient)" stroke="#4a90d9" strokeWidth="2"/>
        {/* Screen content - form fields */}
        <rect x="118" y="93" width="40" height="6" rx="1" fill="#4a90d9" opacity="0.5"/>
        <rect x="118" y="103" width="40" height="6" rx="1" fill="#4a90d9" opacity="0.5"/>
        <rect x="118" y="113" width="25" height="6" rx="1" fill="#22c55e" opacity="0.7"/>
        {/* Keyboard */}
        <rect x="110" y="128" width="55" height="8" rx="2" fill="#4a90d9" opacity="0.3"/>
        {/* Cursor blink effect */}
        <rect x="145" y="94" width="2" height="4" fill="white" opacity="0.8"/>
      </svg>
    );

    const LocationIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="locationGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="50%" stopColor="#4a90d9" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="pinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        {/* Figure looking at map/searching */}
        <ellipse cx="70" cy="70" rx="22" ry="24" fill="url(#locationGradient)"/>
        {/* Body leaning forward looking */}
        <path d="M48 90 Q42 110 48 140 Q52 165 65 175 L85 175 Q95 165 98 140 Q102 110 95 90 Q85 82 70 82 Q55 82 48 90Z" fill="url(#locationGradient)"/>
        {/* Arm pointing */}
        <path d="M95 100 Q115 90 135 85 Q142 83 145 88 Q145 93 140 95 Q120 100 100 108" fill="url(#locationGradient)"/>
        {/* Other arm on hip */}
        <path d="M48 100 Q38 110 40 130 Q42 135 48 132 Q52 120 50 105" fill="url(#locationGradient)"/>
        {/* Location pin - large and prominent */}
        <path d="M155 50 C140 50 130 62 130 78 C130 100 155 130 155 130 C155 130 180 100 180 78 C180 62 170 50 155 50Z" fill="url(#pinGradient)"/>
        <circle cx="155" cy="75" r="12" fill="white" opacity="0.9"/>
        <circle cx="155" cy="75" r="6" fill="#14b8a6"/>
        {/* Radiating circles from pin */}
        <circle cx="155" cy="90" r="30" stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.3"/>
        <circle cx="155" cy="90" r="45" stroke="#22c55e" strokeWidth="1" fill="none" opacity="0.2"/>
        {/* Map grid lines */}
        <path d="M20 160 Q60 155 100 160 Q140 165 180 160" stroke="white" strokeWidth="1" opacity="0.2"/>
        <path d="M30 175 Q70 170 110 175 Q150 180 190 175" stroke="white" strokeWidth="1" opacity="0.15"/>
      </svg>
    );

    const RoleSelectionIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="listenerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="100%" stopColor="#4a90d9" />
          </linearGradient>
          <linearGradient id="artistGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6bb3f0" />
            <stop offset="100%" stopColor="#163387" />
          </linearGradient>
        </defs>
        {/* Listener figure - grooving with headphones */}
        <ellipse cx="55" cy="55" rx="18" ry="20" fill="url(#listenerGradient)"/>
        <path d="M37 72 Q32 90 35 120 Q38 145 50 155 L65 155 Q75 145 77 120 Q80 90 73 72 Q65 65 55 65 Q45 65 37 72Z" fill="url(#listenerGradient)"/>
        {/* Headphones */}
        <path d="M37 50 Q35 35 55 32 Q75 35 73 50" stroke="#4a90d9" strokeWidth="4" fill="none"/>
        <ellipse cx="35" cy="52" rx="6" ry="8" fill="#4a90d9"/>
        <ellipse cx="75" cy="52" rx="6" ry="8" fill="#4a90d9"/>
        {/* Listener arm up vibing */}
        <path d="M37 85 Q25 75 20 60 Q18 55 22 52 Q28 52 30 58 Q35 72 40 80" fill="url(#listenerGradient)"/>
        
        {/* Artist figure - singing into mic */}
        <ellipse cx="145" cy="55" rx="18" ry="20" fill="url(#artistGradient)"/>
        <path d="M127 72 Q122 90 125 120 Q128 145 140 155 L155 155 Q165 145 167 120 Q170 90 163 72 Q155 65 145 65 Q135 65 127 72Z" fill="url(#artistGradient)"/>
        {/* Arm holding microphone */}
        <path d="M163 85 Q175 75 178 65 Q180 58 175 55 Q170 55 168 62 Q165 72 160 80" fill="url(#artistGradient)"/>
        {/* Microphone */}
        <ellipse cx="180" cy="50" rx="8" ry="10" fill="#22c55e"/>
        <rect x="177" y="58" width="6" height="15" fill="#14b8a6"/>
        <line x1="180" y1="73" x2="180" y2="80" stroke="#14b8a6" strokeWidth="2"/>
        
        {/* Sound waves from artist */}
        <path d="M165 45 Q172 45 175 40" stroke="white" strokeWidth="2" fill="none" opacity="0.6"/>
        <path d="M168 42 Q177 42 182 35" stroke="white" strokeWidth="2" fill="none" opacity="0.4"/>
        
        {/* Music notes floating between */}
        <text x="95" y="85" fontSize="20" fill="url(#glowGradient)" opacity="0.8">♪</text>
        <text x="105" y="105" fontSize="16" fill="url(#glowGradient)" opacity="0.6">♫</text>
        <text x="90" y="120" fontSize="14" fill="url(#glowGradient)" opacity="0.5">♪</text>
        
        {/* Dividing line/energy */}
        <line x1="100" y1="40" x2="100" y2="170" stroke="white" strokeWidth="1" opacity="0.2" strokeDasharray="5,5"/>
      </svg>
    );

    const ArtistProfileIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="artistProfileGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="50%" stopColor="#4a90d9" />
            <stop offset="100%" stopColor="#6bb3f0" />
          </linearGradient>
          <linearGradient id="cameraGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        {/* Artist striking a pose - confident stance */}
        <ellipse cx="100" cy="50" rx="24" ry="26" fill="url(#artistProfileGradient)"/>
        {/* Body - confident pose */}
        <path d="M72 72 Q65 95 68 130 Q72 160 88 175 L112 175 Q128 160 132 130 Q135 95 128 72 Q118 62 100 62 Q82 62 72 72Z" fill="url(#artistProfileGradient)"/>
        {/* Arm on hip */}
        <path d="M72 85 Q55 95 50 115 Q48 125 55 128 Q62 125 65 115 Q68 100 72 92" fill="url(#artistProfileGradient)"/>
        {/* Other arm up - peace sign or wave */}
        <path d="M128 85 Q145 70 155 55 Q158 48 152 45 Q146 48 142 58 Q135 72 128 82" fill="url(#artistProfileGradient)"/>
        
        {/* Camera/photo frame - being photographed */}
        <rect x="20" y="100" width="35" height="28" rx="4" fill="url(#cameraGradient)"/>
        <circle cx="37" cy="112" r="8" fill="white" opacity="0.9"/>
        <circle cx="37" cy="112" r="4" fill="#163387"/>
        <rect x="45" y="105" width="6" height="4" rx="1" fill="white" opacity="0.7"/>
        
        {/* Flash/sparkle effect */}
        <circle cx="55" cy="90" r="15" fill="white" opacity="0.3"/>
        <circle cx="55" cy="90" r="8" fill="white" opacity="0.5"/>
        
        {/* Star quality sparkles */}
        <path d="M160 80 L163 88 L171 88 L165 93 L167 101 L160 96 L153 101 L155 93 L149 88 L157 88Z" fill="white" opacity="0.7"/>
        <circle cx="175" cy="60" r="3" fill="white" opacity="0.6"/>
        <circle cx="25" cy="70" r="4" fill="white" opacity="0.5"/>
      </svg>
    );

    const SongUploadIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="uploadGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="50%" stopColor="#4a90d9" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#6bb3f0" />
          </linearGradient>
        </defs>
        {/* Figure in dynamic singing/performing pose */}
        <ellipse cx="100" cy="45" rx="22" ry="24" fill="url(#uploadGradient)"/>
        {/* Body - leaning back, feeling the music */}
        <path d="M75 65 Q68 85 72 115 Q76 150 92 170 L108 170 Q124 150 128 115 Q132 85 125 65 Q115 58 100 58 Q85 58 75 65Z" fill="url(#uploadGradient)"/>
        {/* Arms up celebrating/performing */}
        <path d="M75 75 Q55 55 45 35 Q42 28 48 25 Q55 28 58 38 Q65 55 75 72" fill="url(#uploadGradient)"/>
        <path d="M125 75 Q145 55 155 35 Q158 28 152 25 Q145 28 142 38 Q135 55 125 72" fill="url(#uploadGradient)"/>
        
        {/* Sound waves emanating */}
        <path d="M30 90 Q25 100 30 110 Q35 120 30 130" stroke="url(#waveGradient)" strokeWidth="3" fill="none" opacity="0.7"/>
        <path d="M20 85 Q12 100 20 115 Q28 130 20 145" stroke="url(#waveGradient)" strokeWidth="3" fill="none" opacity="0.5"/>
        <path d="M170 90 Q175 100 170 110 Q165 120 170 130" stroke="url(#waveGradient)" strokeWidth="3" fill="none" opacity="0.7"/>
        <path d="M180 85 Q188 100 180 115 Q172 130 180 145" stroke="url(#waveGradient)" strokeWidth="3" fill="none" opacity="0.5"/>
        
        {/* Upload arrow */}
        <path d="M100 175 L100 155" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"/>
        <path d="M90 165 L100 152 L110 165" stroke="#22c55e" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        
        {/* Music notes rising */}
        <text x="55" y="55" fontSize="18" fill="white" opacity="0.8">♪</text>
        <text x="140" y="50" fontSize="16" fill="white" opacity="0.7">♫</text>
        <text x="45" y="35" fontSize="14" fill="white" opacity="0.5">♪</text>
        <text x="150" y="30" fontSize="12" fill="white" opacity="0.4">♪</text>
      </svg>
    );

    const SupportArtistIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="supportGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="100%" stopColor="#4a90d9" />
          </linearGradient>
          <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        
        {/* Center artist - star of the show */}
        <ellipse cx="100" cy="65" rx="20" ry="22" fill="url(#starGradient)"/>
        <path d="M80 85 Q75 100 78 125 Q82 150 95 162 L105 162 Q118 150 122 125 Q125 100 120 85 Q112 78 100 78 Q88 78 80 85Z" fill="url(#starGradient)"/>
        {/* Star above head */}
        <path d="M100 28 L104 40 L117 40 L107 48 L111 60 L100 52 L89 60 L93 48 L83 40 L96 40Z" fill="white" opacity="0.9"/>
        
        {/* Left supporter - reaching toward center */}
        <ellipse cx="40" cy="90" rx="16" ry="18" fill="url(#supportGradient)"/>
        <path d="M25 105 Q20 118 24 140 Q28 158 38 168 L48 168 Q58 158 60 140 Q63 118 58 105 Q52 98 40 98 Q30 98 25 105Z" fill="url(#supportGradient)"/>
        <path d="M58 110 Q70 100 82 95" stroke="url(#supportGradient)" strokeWidth="8" strokeLinecap="round"/>
        
        {/* Right supporter - reaching toward center */}
        <ellipse cx="160" cy="90" rx="16" ry="18" fill="url(#supportGradient)"/>
        <path d="M145 105 Q140 118 144 140 Q148 158 158 168 L168 168 Q178 158 180 140 Q183 118 178 105 Q172 98 160 98 Q150 98 145 105Z" fill="url(#supportGradient)"/>
        <path d="M142 110 Q130 100 118 95" stroke="url(#supportGradient)" strokeWidth="8" strokeLinecap="round"/>
        
        {/* Hearts floating */}
        <path d="M70 70 C70 62 78 62 78 70 C78 62 86 62 86 70 C86 80 78 88 78 88 C78 88 70 80 70 70Z" fill="url(#heartGradient)" opacity="0.8"/>
        <path d="M114 70 C114 64 120 64 120 70 C120 64 126 64 126 70 C126 78 120 84 120 84 C120 84 114 78 114 70Z" fill="url(#heartGradient)" opacity="0.8"/>
        
        {/* Connection lines */}
        <path d="M55 130 Q100 115 145 130" stroke="white" strokeWidth="2" fill="none" opacity="0.3" strokeDasharray="5,5"/>
      </svg>
    );

    const ReviewIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="celebrateGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#163387" />
            <stop offset="30%" stopColor="#4a90d9" />
            <stop offset="60%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        
        {/* Figure jumping in celebration */}
        <ellipse cx="100" cy="50" rx="22" ry="24" fill="url(#celebrateGradient)"/>
        {/* Body - dynamic jumping pose */}
        <path d="M78 70 Q72 88 76 110 Q80 135 92 148 L108 148 Q120 135 124 110 Q128 88 122 70 Q114 62 100 62 Q86 62 78 70Z" fill="url(#celebrateGradient)"/>
        {/* Arms up in victory */}
        <path d="M78 80 Q55 55 40 40 Q35 35 40 30 Q48 32 52 40 Q65 58 78 75" fill="url(#celebrateGradient)"/>
        <path d="M122 80 Q145 55 160 40 Q165 35 160 30 Q152 32 148 40 Q135 58 122 75" fill="url(#celebrateGradient)"/>
        {/* Legs in jump */}
        <path d="M88 148 Q75 165 70 180" stroke="url(#celebrateGradient)" strokeWidth="12" strokeLinecap="round"/>
        <path d="M112 148 Q125 165 130 180" stroke="url(#celebrateGradient)" strokeWidth="12" strokeLinecap="round"/>
        
        {/* Big checkmark circle */}
        <circle cx="100" cy="105" r="20" fill="url(#checkGradient)" opacity="0.9"/>
        <path d="M90 105 L97 112 L112 97" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        
        {/* Confetti/celebration elements */}
        <rect x="30" y="60" width="8" height="8" rx="1" fill="#22c55e" opacity="0.8" transform="rotate(30 34 64)"/>
        <rect x="165" y="55" width="6" height="6" rx="1" fill="#4a90d9" opacity="0.8" transform="rotate(-20 168 58)"/>
        <rect x="45" y="35" width="5" height="5" rx="1" fill="#14b8a6" opacity="0.7" transform="rotate(45 47 37)"/>
        <rect x="150" y="30" width="7" height="7" rx="1" fill="#6bb3f0" opacity="0.7" transform="rotate(-30 153 33)"/>
        
        <circle cx="25" y="80" r="4" fill="#ec4899" opacity="0.7"/>
        <circle cx="178" cy="75" r="3" fill="#f97316" opacity="0.7"/>
        <circle cx="55" cy="25" r="3" fill="#22c55e" opacity="0.6"/>
        <circle cx="140" cy="20" r="4" fill="#4a90d9" opacity="0.6"/>
        
        {/* Sparkle bursts */}
        <path d="M35 45 L37 50 L42 50 L38 53 L40 58 L35 55 L30 58 L32 53 L28 50 L33 50Z" fill="white" opacity="0.8"/>
        <path d="M170 45 L172 49 L176 49 L173 52 L174 56 L170 53 L166 56 L167 52 L164 49 L168 49Z" fill="white" opacity="0.7"/>
      </svg>
    );

    const ListenerProfileIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Person with camera taking selfie - use same gradient style as existing */}
        {/* Copy gradient defs from existing illustrations */}
        {/* Add figure with phone/camera, flash effect, stars */}
      </svg>
    );

    // NEW: Listener Bio Illustration
    const ListenerBioIllustration = () => (
      <svg className="illustration-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Person thinking/writing with notepad */}
        {/* Thought bubbles with music notes */}
      </svg>
    );

    // ============================================
    // Don't forget to also copy the STEP_ILLUSTRATIONS map:
    // ============================================

    const STEP_ILLUSTRATIONS = {
      welcome: WelcomeIllustration,
      basicInfo: BasicInfoIllustration,
      location: LocationIllustration,
      role: RoleSelectionIllustration,
      listenerProfile: ListenerProfileIllustration,
      listenerBio: ListenerBioIllustration, 
      artistProfile: ArtistProfileIllustration,
      songUpload: SongUploadIllustration,
      supportArtist: SupportArtistIllustration,
      review: ReviewIllustration,
    };

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};


const CreateAccountWizard = ({ show, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [stepDirection, setStepDirection] = useState('forward');
  
  const [formData, setFormData] = useState({
    referralCode: '',
    referrerUsername: '',
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    jurisdictionId: '',
    jurisdictionName: '',
    role: '',
    listenerPhotoFile: null,
    listenerPhotoPreview: null,
    bio: '',
    artistPhotoFile: null,
    artistPhotoPreview: null,
    genreId: '',
    songTitle: '',
    songFile: null,
    songFileName: '',
    songArtworkFile: null,
    songArtworkPreview: null,
    supportedArtistId: null,
    supportedArtistName: '',
    agreedToTerms: false,
    agreedToArtistTerms: false,
    address: '',
    detectingLocation: false,
    detectedCoords: null,
  });
  
  const [validation, setValidation] = useState({
    referralCode: { checking: false, valid: null, message: '' },
    username: { checking: false, valid: null, message: '' },
    email: { checking: false, valid: null, message: '' },
    password: { valid: null, message: '' },
    passwordConfirm: { valid: null, message: '' },
  });
  
  const [artists, setArtists] = useState([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [artistSearch, setArtistSearch] = useState('');
  const [artistFilter, setArtistFilter] = useState('all');
  
  const [playingArtistId, setPlayingArtistId] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Step configuration
  const getSteps = () => {
    const baseSteps = [
      { id: 'welcome', title: 'Welcome', illustration: 'welcome' },
      { id: 'basicInfo', title: 'Your Details', illustration: 'basicInfo' },
      { id: 'location', title: 'Your Hood', illustration: 'location' },
      { id: 'role', title: 'Your Vibe', illustration: 'role' },
    ];
    
    if (formData.role === 'artist') {
      return [
        ...baseSteps,
        { id: 'artistProfile', title: 'Artist Profile', illustration: 'artistProfile' },
        { id: 'songUpload', title: 'Your Debut', illustration: 'songUpload' },
        { id: 'supportArtist', title: 'Show Love', illustration: 'supportArtist' },
        { id: 'review', title: 'Ready!', illustration: 'review' },
      ];
    }
    
    return [
      ...baseSteps,
      { id: 'listenerProfile', title: 'Your Photo', illustration: 'listenerProfile' },  // NEW
      { id: 'listenerBio', title: 'Your Story', illustration: 'listenerBio' },  
      { id: 'supportArtist', title: 'Show Love', illustration: 'supportArtist' },
      { id: 'review', title: 'Ready!', illustration: 'review' },
    ];
  };
  
  const steps = getSteps();
  const totalSteps = steps.length;
  const currentStepData = steps[currentStep - 1];


  const handleListenerPhotoChange = (e) => {
  const file = e.target.files?.[0];
  if (file) {
      updateForm('listenerPhotoFile', file);
      const reader = new FileReader();
      reader.onload = () => updateForm('listenerPhotoPreview', reader.result);
      reader.readAsDataURL(file);
    }
  };
  
  const updateForm = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  const updateValidation = (key, data) => {
    setValidation(prev => ({ ...prev, [key]: { ...prev[key], ...data } }));
  };
  
  // Validation functions
  const validateReferralCode = useCallback(
    debounce(async (code) => {
      if (!code || code.length < 3) {
        updateValidation('referralCode', { checking: false, valid: null, message: '' });
        return;
      }
      
      updateValidation('referralCode', { checking: true, valid: null, message: '' });
      
      try {
        const response = await apiCall({
          url: `/v1/users/validate-referral/${encodeURIComponent(code)}`,
          method: 'get',
        });
        
        if (response.data?.valid) {
          updateValidation('referralCode', {
            checking: false,
            valid: true,
            message: `Referred by ${response.data.referrerUsername}`,
          });
          updateForm('referrerUsername', response.data.referrerUsername);
        } else {
          updateValidation('referralCode', {
            checking: false,
            valid: false,
            message: 'Invalid referral code',
          });
        }
      } catch (err) {
        // For demo: accept UNIS-LAUNCH-2024 as valid
        if (code === 'UNIS-LAUNCH-2024') {
          updateValidation('referralCode', {
            checking: false,
            valid: true,
            message: 'Welcome early adopter!',
          });
          updateForm('referrerUsername', 'Unis');
        } else {
          updateValidation('referralCode', {
            checking: false,
            valid: false,
            message: 'Could not verify code',
          });
        }
      }
    }, 500),
    []
  );
  
  const validateUsername = useCallback(
    debounce(async (username) => {
      if (!username || username.length < 3) {
        updateValidation('username', {
          checking: false,
          valid: null,
          message: username ? 'Username must be at least 3 characters' : '',
        });
        return;
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        updateValidation('username', {
          checking: false,
          valid: false,
          message: 'Only letters, numbers, and underscores',
        });
        return;
      }
      
      updateValidation('username', { checking: true, valid: null, message: '' });
      
      try {
        const response = await apiCall({
          url: `/v1/users/check-username?username=${encodeURIComponent(username)}`,
          method: 'get',
        });
        
        updateValidation('username', {
          checking: false,
          valid: response.data?.available !== false,
          message: response.data?.available === false ? 'Username taken' : 'Username available!',
        });
      } catch (err) {
        updateValidation('username', { checking: false, valid: true, message: '' });
      }
    }, 500),
    []
  );
  
  const validateEmail = useCallback(
    debounce(async (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!email) {
        updateValidation('email', { checking: false, valid: null, message: '' });
        return;
      }
      
      if (!emailRegex.test(email)) {
        updateValidation('email', {
          checking: false,
          valid: false,
          message: 'Please enter a valid email',
        });
        return;
      }
      
      updateValidation('email', { checking: true, valid: null, message: '' });
      
      try {
        const response = await apiCall({
          url: `/v1/users/check-email?email=${encodeURIComponent(email)}`,
          method: 'get',
        });
        
        updateValidation('email', {
          checking: false,
          valid: response.data?.available !== false,
          message: response.data?.available === false ? 'Email already registered' : '',
        });
      } catch (err) {
        updateValidation('email', { checking: false, valid: true, message: '' });
      }
    }, 500),
    []
  );
  
  const validatePassword = (password) => {
    if (!password) {
      updateValidation('password', { valid: null, message: '' });
      return;
    }
    
    if (password.length < 8) {
      updateValidation('password', { valid: false, message: 'At least 8 characters required' });
      return;
    }
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (hasUpper && hasLower && hasNumber) {
      updateValidation('password', { valid: true, message: 'Strong password!' });
    } else {
      updateValidation('password', { valid: true, message: 'Add uppercase, lowercase, and numbers for strength' });
    }
    
    if (formData.passwordConfirm) {
      validatePasswordConfirm(formData.passwordConfirm, password);
    }
  };
  
  const validatePasswordConfirm = (confirm, password = formData.password) => {
    if (!confirm) {
      updateValidation('passwordConfirm', { valid: null, message: '' });
      return;
    }
    
    if (confirm !== password) {
      updateValidation('passwordConfirm', { valid: false, message: 'Passwords do not match' });
    } else {
      updateValidation('passwordConfirm', { valid: true, message: 'Passwords match!' });
    }
  };
  
  // Load artists
  useEffect(() => {
    if (currentStepData?.id === 'supportArtist' && artists.length === 0) {
      loadArtists();
    }
  }, [currentStepData?.id]);
  
  const loadArtists = async () => {
    setArtistsLoading(true);
    try {
      const response = await apiCall({ url: '/v1/users/artists/active' });
      setArtists(response.data || []);
    } catch (err) {
      setError('Could not load artists');
    } finally {
      setArtistsLoading(false);
    }
  };
  
  const filteredArtists = artists.filter(artist => {
    const matchesSearch = !artistSearch || 
      artist.username?.toLowerCase().includes(artistSearch.toLowerCase());
    const matchesFilter = artistFilter === 'all' || 
      artist.jurisdiction?.jurisdictionId === artistFilter;
    return matchesSearch && matchesFilter;
  });
  
  // Audio player
  const playArtistPreview = async (artist) => {
      if (!artist.defaultSongId) return;
      
      if (playingArtistId === artist.userId) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setPlayingArtistId(null);
        setAudioProgress(0);
        return;
      }
      
      try {
        const response = await apiCall({ url: `/v1/users/${artist.userId}/default-song` });
        
        if (response.data?.fileUrl && audioRef.current) {
          // Prepend base URL if it's a relative path
          const audioUrl = response.data.fileUrl.startsWith('http') 
            ? response.data.fileUrl 
            : `http://localhost:8080${response.data.fileUrl}`;
          
          audioRef.current.src = audioUrl;
          audioRef.current.play().catch(err => {
            console.error('Audio playback failed:', err);
            setError('Could not play audio preview');
          });
          setPlayingArtistId(artist.userId);
        }
      } catch (err) {
        console.error('Could not load preview:', err);
      }
    };
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateProgress = () => {
      if (audio.duration) setAudioProgress((audio.currentTime / audio.duration) * 100);
    };
    
    const handleEnded = () => {
      setPlayingArtistId(null);
      setAudioProgress(0);
    };
    
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  // File handlers
  const handleArtistPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      updateForm('artistPhotoFile', file);
      const reader = new FileReader();
      reader.onload = () => updateForm('artistPhotoPreview', reader.result);
      reader.readAsDataURL(file);
    }
  };
  
  const handleSongFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      updateForm('songFile', file);
      updateForm('songFileName', file.name);
    }
  };
  
  const handleSongArtworkChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      updateForm('songArtworkFile', file);
      const reader = new FileReader();
      reader.onload = () => updateForm('songArtworkPreview', reader.result);
      reader.readAsDataURL(file);
    }
  };
  
  // Step validation
  const canProceed = () => {
    switch (currentStepData?.id) {
      case 'welcome':
        return validation.referralCode.valid === true;
      case 'basicInfo':
        return (
          formData.username.length >= 3 &&
          validation.username.valid !== false &&
          validation.email.valid !== false &&
          formData.email &&
          formData.password.length >= 8 &&
          formData.passwordConfirm === formData.password
        );
      case 'location':
        return !!formData.jurisdictionId;
      case 'role':
        return !!formData.role;
      case 'artistProfile':
        return formData.artistPhotoFile && formData.genreId;
      case 'songUpload':
        return formData.songTitle.trim() && formData.songFile && formData.songArtworkFile;
      case 'listenerProfile':
        return !!formData.listenerPhotoFile;
      case 'listenerBio':
        return formData.bio.trim().length >= 10;
      case 'supportArtist':
        return !!formData.supportedArtistId;
      case 'review':
        return formData.role === 'artist' 
          ? formData.agreedToTerms && formData.agreedToArtistTerms
          : formData.agreedToTerms;
      default:
        return true;
    }
  };
  
  // Navigation
  const goNext = () => {
    if (currentStep < totalSteps) {
      setStepDirection('forward');
      setCurrentStep(prev => prev + 1);
      setError('');
    }
  };
  
  const goBack = () => {
    if (currentStep > 1) {
      setStepDirection('back');
      setCurrentStep(prev => prev - 1);
      setError('');
    }
  };
  
  // Submit
const handleSubmit = async () => {
      setLoading(true);
      setError('');
      
      try {
        let photoUrl = null;
        
        // UPDATED: Handle photo upload for BOTH artists and listeners
        const photoFile = formData.role === 'artist' 
          ? formData.artistPhotoFile 
          : formData.listenerPhotoFile;
          
        if (photoFile) {
          const photoFormData = new FormData();
          photoFormData.append('photo', photoFile);
          
          const photoResponse = await apiCall({
            url: '/v1/users/profile/photo',
            method: 'patch',
            data: photoFormData,
          });
          photoUrl = photoResponse.data?.photoUrl;
        }
        
        const registerPayload = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          jurisdictionId: formData.jurisdictionId,
          supportedArtistId: formData.supportedArtistId,
          referralCode: formData.referralCode,
          bio: formData.bio || null,  // Now both listeners and artists have bio
          genreId: formData.role === 'artist' ? formData.genreId : null,
          photoUrl: photoUrl,
        };
        
        const registerResponse = await apiCall({
          url: '/v1/users/register',
          method: 'post',
          data: registerPayload,
        });
        
        const newUser = registerResponse.data;
        
        // Only upload song if user is an artist
        if (formData.role === 'artist' && formData.songFile) {
          const songData = {
            title: formData.songTitle,
            artistId: newUser.userId,
            genreId: formData.genreId,
            jurisdictionId: formData.jurisdictionId,
          };

          const songFormData = new FormData();
          songFormData.append('song', JSON.stringify(songData));
          songFormData.append('file', formData.songFile);
          if (formData.songArtworkFile) {
            songFormData.append('artwork', formData.songArtworkFile);
          }

          await apiCall({
            url: '/v1/media/song',
            method: 'post',
            data: songFormData,
          });
        }
        
        setSuccess(true);
        setTimeout(() => onSuccess?.(newUser), 2000);
        
      } catch (err) {
        setError(err.response?.data?.message || 'Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };
  
  if (!show) return null;
  
  const IllustrationComponent = STEP_ILLUSTRATIONS[currentStepData?.illustration] || WelcomeIllustration;
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStepData?.id) {
      case 'welcome':
  return (
    <>
      <div className="step-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          Welcome to 
          <img 
            src={UnisLogo} 
            alt="Unis" 
            style={{ 
              height: '85px', 
              width: 'auto', 
              verticalAlign: 'middle',
              marginBottom: '-12px'
            }}
          />
        </h2>
        <p>Enter your referral code to join the community.</p>
      </div>
            
            <div className="form-group">
              <label>Referral Code</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="e.g. HARLEM-JOHN-X7K2"
                  value={formData.referralCode}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    updateForm('referralCode', value);
                    validateReferralCode(value);
                  }}
                  className={
                    validation.referralCode.valid === true ? 'has-success' :
                    validation.referralCode.valid === false ? 'has-error' : ''
                  }
                />
                <Gift className="input-icon" size={20} />
                {validation.referralCode.checking && <Loader2 className="validation-icon loading" size={20} />}
                {validation.referralCode.valid === true && <CheckCircle2 className="validation-icon valid" size={20} />}
                {validation.referralCode.valid === false && <XCircle className="validation-icon invalid" size={20} />}
              </div>
              {validation.referralCode.message && (
                <div className={`helper-text ${validation.referralCode.valid ? 'success' : 'error'}`}>
                  {validation.referralCode.message}
                </div>
              )}
            </div>
            
            <div className="wizard-alert alert-info">
              <Info size={20} />
              <div className="alert-content">
                <div className="alert-title">Don't have a code?</div>
                <div className="alert-message">
                  During launch, use <strong>UNIS-LAUNCH-2024</strong>
                </div>
              </div>
            </div>
          </>
        );
      
      case 'basicInfo':
        return (
          <>
            <div className="step-header">
              <h2>Create Your Account</h2>
              <p>Set up your Unis identity.</p>
            </div>
            
            <div className="form-group">
              <label>Username</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="Your unique username"
                  value={formData.username}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    updateForm('username', value);
                    validateUsername(value);
                  }}
                  className={validation.username.valid === true ? 'has-success' : validation.username.valid === false ? 'has-error' : ''}
                />
                <User className="input-icon" size={20} />
                {validation.username.checking && <Loader2 className="validation-icon loading" size={20} />}
                {validation.username.valid === true && <CheckCircle2 className="validation-icon valid" size={20} />}
                {validation.username.valid === false && <XCircle className="validation-icon invalid" size={20} />}
              </div>
              {validation.username.message && <div className="helper-text">{validation.username.message}</div>}
            </div>
            
            <div className="form-group">
              <label>Email</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => {
                    updateForm('email', e.target.value);
                    validateEmail(e.target.value);
                  }}
                  className={validation.email.valid === true ? 'has-success' : validation.email.valid === false ? 'has-error' : ''}
                />
                <Mail className="input-icon" size={20} />
                {validation.email.checking && <Loader2 className="validation-icon loading" size={20} />}
                {validation.email.valid === true && <CheckCircle2 className="validation-icon valid" size={20} />}
                {validation.email.valid === false && <XCircle className="validation-icon invalid" size={20} />}
              </div>
              {validation.email.message && <div className="error-message"><AlertCircle size={14} />{validation.email.message}</div>}
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={(e) => {
                    updateForm('password', e.target.value);
                    validatePassword(e.target.value);
                  }}
                />
                <Lock className="input-icon" size={20} />
              </div>
              {validation.password.message && <div className="helper-text">{validation.password.message}</div>}
            </div>
            
            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.passwordConfirm}
                  onChange={(e) => {
                    updateForm('passwordConfirm', e.target.value);
                    validatePasswordConfirm(e.target.value);
                  }}
                  className={validation.passwordConfirm.valid === true ? 'has-success' : validation.passwordConfirm.valid === false ? 'has-error' : ''}
                />
                <Lock className="input-icon" size={20} />
                {validation.passwordConfirm.valid === true && <CheckCircle2 className="validation-icon valid" size={20} />}
                {validation.passwordConfirm.valid === false && <XCircle className="validation-icon invalid" size={20} />}
              </div>
              {validation.passwordConfirm.message && <div className={validation.passwordConfirm.valid ? 'helper-text' : 'error-message'}>{validation.passwordConfirm.message}</div>}
            </div>
          </>
        );
      
      case 'location':
        return (
          <>
            <div className="step-header">
              <h2>Where Are You From?</h2>
              <p>Enter your address to find your jurisdiction. This is permanent!</p>
            </div>
            
            <div className="form-group">
              <label>Your Address</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="123 W 125th St, New York, NY"
                  value={formData.address || ''}
                  onChange={(e) => updateForm('address', e.target.value)}
                />
                <MapPin className="input-icon" size={20} />
              </div>
              <div className="helper-text">Enter your street address in Harlem</div>
            </div>
            
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: 20 }}
              onClick={async () => {
                    if (!formData.address) return;
                    
                    setError('');
                    updateForm('detectingLocation', true);
                    
                    try {
                      // Geocode address using Nominatim
                      const geoResponse = await fetch(
                        `https://nominatim.openstreetmap.org/search?` +
                        `q=${encodeURIComponent(formData.address)}&format=json&limit=1`,
                        { headers: { 'User-Agent': 'UnisMusic/1.0' } }
                      );
                      const geoData = await geoResponse.json();
                      
                      if (!geoData || geoData.length === 0) {
                        setError('Address not found. Please try a more specific address.');
                        updateForm('detectingLocation', false);
                        return;
                      }
                      
                      const lat = parseFloat(geoData[0].lat);
                      const lon = parseFloat(geoData[0].lon);
                      
                      // Harlem boundaries (approximate)
                      const HARLEM_BOUNDS = {
                        north: 40.8282,  // ~155th St
                        south: 40.7967,  // ~110th St  
                        east: -73.9262,  // East edge
                        west: -73.9595,  // West edge
                      };
                      
                      // 130th Street dividing line
                      const DIVIDING_LINE = 40.8095;
                      
                      // Check if in Harlem
                      if (lat < HARLEM_BOUNDS.south || lat > HARLEM_BOUNDS.north ||
                          lon < HARLEM_BOUNDS.west || lon > HARLEM_BOUNDS.east) {
                        setError('Your address is not in Harlem. Unis is currently only available in Harlem, NY.');
                        updateForm('detectingLocation', false);
                        return;
                      }
                      
                      // Determine Uptown vs Downtown
                      if (lat >= DIVIDING_LINE) {
                        updateForm('jurisdictionId', JURISDICTION_IDS['uptown-harlem']);
                        updateForm('jurisdictionName', 'Uptown Harlem');
                      } else {
                        updateForm('jurisdictionId', JURISDICTION_IDS['downtown-harlem']);
                        updateForm('jurisdictionName', 'Downtown Harlem');
                      }
                      
                      updateForm('detectedCoords', { lat, lon });
                      
                    } catch (err) {
                      setError('Could not verify location. Please try again.');
                    } finally {
                      updateForm('detectingLocation', false);
                    }
                  }}
              disabled={!formData.address || formData.detectingLocation}
            >
              {formData.detectingLocation ? (
                <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Detecting...</>
              ) : (
                <><MapPin size={20} /> Find My Jurisdiction</>
              )}
            </button>
            
            {formData.jurisdictionId && (
              <div className="wizard-alert alert-success">
                <CheckCircle2 size={20} />
                <div className="alert-content">
                  <div className="alert-title">Found: {formData.jurisdictionName}</div>
                  <div className="alert-message">You'll represent this jurisdiction in all competitions. This cannot be changed!</div>
                </div>
              </div>
            )}
            
            <div className="form-group" style={{ marginTop: 20 }}>
              <label>Or Select Manually</label>
              <select
                value={formData.jurisdictionId}
                onChange={(e) => {
                  updateForm('jurisdictionId', e.target.value);
                  updateForm('jurisdictionName', e.target.options[e.target.selectedIndex].text);
                }}
              >
                <option value="">Choose your area...</option>
                <option value={JURISDICTION_IDS['uptown-harlem']}>Uptown Harlem</option>
                <option value={JURISDICTION_IDS['downtown-harlem']}>Downtown Harlem</option>
              </select>
            </div>
          </>
        );
      
      case 'role':
        return (
          <>
            <div className="step-header">
              <h2>How Will You Use Unis?</h2>
              <p>Choose your path. You can upgrade later.</p>
            </div>
            
            <div className="role-selection">
              <div className={`role-card ${formData.role === 'listener' ? 'selected' : ''}`} onClick={() => updateForm('role', 'listener')}>
                <Headphones className="role-icon" size={48} />
                <div className="role-title">Listener</div>
                <div className="role-description">Discover music, vote daily, earn from referrals</div>
              </div>
              
              <div className={`role-card ${formData.role === 'artist' ? 'selected' : ''}`} onClick={() => updateForm('role', 'artist')}>
                <Mic2 className="role-icon" size={48} />
                <div className="role-title">Artist</div>
                <div className="role-description">Upload music, compete for awards, earn 50% revenue</div>
              </div>
            </div>
            
            {formData.role && (
              <div className="wizard-alert alert-success">
                <Sparkles size={20} />
                <div className="alert-content">
                  <div className="alert-title">{formData.role === 'artist' ? "Let's Make History" : "Let's Discover Music"}</div>
                  <div className="alert-message">
                    {formData.role === 'artist' 
                      ? "Upload your music and compete in awards!"
                      : "Discover local talent and shape who gets recognized!"
                    }
                  </div>
                </div>
              </div>
            )}
          </>
        );
      
      case 'artistProfile':
        return (
          <>
            <div className="step-header">
              <h2>Your Artist Profile</h2>
              <p>Set up your artist identity.</p>
            </div>
            
            <div className="file-upload">
              <label>Profile Photo</label>
              <div className={`upload-zone ${formData.artistPhotoFile ? 'has-file' : ''}`}>
                <input type="file" accept="image/*" onChange={handleArtistPhotoChange} />
                {formData.artistPhotoPreview ? (
                  <div className="file-preview">
                    <img src={formData.artistPhotoPreview} alt="Preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                    <div className="file-info">
                      <div className="file-name">{formData.artistPhotoFile?.name}</div>
                      <div className="file-size">{formatFileSize(formData.artistPhotoFile?.size || 0)}</div>
                    </div>
                    <button type="button" className="remove-file" onClick={(e) => { e.stopPropagation(); updateForm('artistPhotoFile', null); updateForm('artistPhotoPreview', null); }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Image className="upload-icon" size={48} />
                    <div className="upload-text"><strong>Click to upload</strong></div>
                    <div className="upload-hint">PNG, JPG up to 5MB</div>
                  </>
                )}
              </div>
            </div>
            
            <div className="form-group">
              <label>Primary Genre</label>
              <select value={formData.genreId} onChange={(e) => updateForm('genreId', e.target.value)}>
                <option value="">Select genre...</option>
                {Object.entries(GENRE_IDS).map(([key, id]) => (
                  <option key={id} value={id}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Bio (Optional)</label>
              <textarea placeholder="Tell fans about yourself..." value={formData.bio} onChange={(e) => updateForm('bio', e.target.value)} maxLength={500} />
              <div className="helper-text">{formData.bio.length}/500</div>
            </div>
          </>
        );
      
      case 'songUpload':
        return (
          <>
            <div className="step-header">
              <h2>Your Debut Track</h2>
              <p>Upload your first song to Unis.</p>
            </div>
            
            <div className="form-group">
              <label>Song Title</label>
              <div className="input-wrapper">
                <input type="text" placeholder="Track name" value={formData.songTitle} onChange={(e) => updateForm('songTitle', e.target.value)} />
                <Music className="input-icon" size={20} />
              </div>
            </div>
            
            <div className="file-upload">
              <label>Audio File</label>
              <div className={`upload-zone ${formData.songFile ? 'has-file' : ''}`}>
                <input type="file" accept="audio/*" onChange={handleSongFileChange} />
                {formData.songFile ? (
                  <div className="file-preview">
                    <FileAudio className="file-icon" size={40} />
                    <div className="file-info">
                      <div className="file-name">{formData.songFileName}</div>
                      <div className="file-size">{formatFileSize(formData.songFile?.size || 0)}</div>
                    </div>
                    <button type="button" className="remove-file" onClick={(e) => { e.stopPropagation(); updateForm('songFile', null); updateForm('songFileName', ''); }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <FileAudio className="upload-icon" size={48} />
                    <div className="upload-text"><strong>Click to upload</strong></div>
                    <div className="upload-hint">MP3, WAV, FLAC up to 50MB</div>
                  </>
                )}
              </div>
            </div>
            
            <div className="file-upload">
              <label>Song Artwork</label>
              <div className={`upload-zone ${formData.songArtworkFile ? 'has-file' : ''}`}>
                <input type="file" accept="image/*" onChange={handleSongArtworkChange} />
                {formData.songArtworkPreview ? (
                  <div className="file-preview">
                    <img src={formData.songArtworkPreview} alt="Artwork" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                    <div className="file-info">
                      <div className="file-name">{formData.songArtworkFile?.name}</div>
                      <div className="file-size">{formatFileSize(formData.songArtworkFile?.size || 0)}</div>
                    </div>
                    <button type="button" className="remove-file" onClick={(e) => { e.stopPropagation(); updateForm('songArtworkFile', null); updateForm('songArtworkPreview', null); }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Image className="upload-icon" size={48} />
                    <div className="upload-text"><strong>Click to upload</strong> cover art</div>
                    <div className="upload-hint">Square, at least 500x500px</div>
                  </>
                )}
              </div>
            </div>
          </>
        );

         // NEW: Listener Profile Photo Step
    case 'listenerProfile':
      return (
        <>
          <div className="step-header">
            <h2>Show Your Face</h2>
            <p>Let the community know who you are.</p>
          </div>
          
          <div className="file-upload">
            <label>Profile Photo</label>
            <div className={`upload-zone ${formData.listenerPhotoFile ? 'has-file' : ''}`}>
              <input type="file" accept="image/*" onChange={handleListenerPhotoChange} />
              {formData.listenerPhotoPreview ? (
                <div className="file-preview">
                  <img 
                    src={formData.listenerPhotoPreview} 
                    alt="Preview" 
                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} 
                  />
                  <div className="file-info">
                    <div className="file-name">{formData.listenerPhotoFile?.name}</div>
                    <div className="file-size">{formatFileSize(formData.listenerPhotoFile?.size || 0)}</div>
                  </div>
                  <button 
                    type="button" 
                    className="remove-file" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      updateForm('listenerPhotoFile', null); 
                      updateForm('listenerPhotoPreview', null); 
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Image className="upload-icon" size={48} />
                  <div className="upload-text"><strong>Click to upload</strong> your photo</div>
                  <div className="upload-hint">PNG, JPG up to 5MB</div>
                </>
              )}
            </div>
          </div>
          
          <div className="wizard-alert alert-info">
            <Sparkles size={20} />
            <div className="alert-content">
              <div className="alert-title">Make it memorable!</div>
              <div className="alert-message">
                Your profile photo helps artists and other listeners recognize you in the community.
              </div>
            </div>
          </div>
        </>
      );
    
    // NEW: Listener Bio Step
    case 'listenerBio':
      return (
        <>
          <div className="step-header">
            <h2>Tell Your Story</h2>
            <p>What brings you to Unis? What music moves you?</p>
          </div>
          
          <div className="form-group">
            <label>Your Bio</label>
            <textarea 
              placeholder="I'm a Harlem native who loves discovering new talent. Hip-hop runs through my veins, but I'm always open to vibes..."
              value={formData.bio} 
              onChange={(e) => updateForm('bio', e.target.value)} 
              maxLength={500}
              rows={8}
              style={{ minHeight: '150px' }}
            />
            <div className="helper-text">
              {formData.bio.length}/500 characters
              {formData.bio.length < 10 && ' (minimum 10)'}
            </div>
          </div>
          
          <div className="wizard-alert alert-success">
            <Heart size={20} />
            <div className="alert-content">
              <div className="alert-title">Be authentic!</div>
              <div className="alert-message">
                Share your music taste, favorite artists, or what you're looking for. This helps build connections.
              </div>
            </div>
          </div>
        </>
      );
      
      case 'supportArtist':
        return (
          <>
            <div className="step-header">
              <h2>Support an Artist</h2>
              <p>They'll receive 15% of ad revenue from your activity.</p>
            </div>
            
            <div className="artist-selection">
              <div className="artist-search">
                <input type="text" placeholder="Search artists..." value={artistSearch} onChange={(e) => setArtistSearch(e.target.value)} />
                <Search className="search-icon" size={20} />
              </div>
              
              <div className="artist-filters">
                <button className={`filter-chip ${artistFilter === 'all' ? 'active' : ''}`} onClick={() => setArtistFilter('all')}>All</button>
                <button className={`filter-chip ${artistFilter === JURISDICTION_IDS['uptown-harlem'] ? 'active' : ''}`} onClick={() => setArtistFilter(JURISDICTION_IDS['uptown-harlem'])}>Uptown</button>
                <button className={`filter-chip ${artistFilter === JURISDICTION_IDS['downtown-harlem'] ? 'active' : ''}`} onClick={() => setArtistFilter(JURISDICTION_IDS['downtown-harlem'])}>Downtown</button>
              </div>
              
              {artistsLoading ? (
                <div className="no-artists"><Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} /><p>Loading...</p></div>
              ) : filteredArtists.length === 0 ? (
                <div className="no-artists"><Users size={48} /><p>No artists found</p></div>
              ) : (
                <div className="artists-grid">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.userId}
                      className={`artist-card ${formData.supportedArtistId === artist.userId ? 'selected' : ''} ${playingArtistId === artist.userId ? 'playing' : ''}`}
                      onClick={() => { updateForm('supportedArtistId', artist.userId); updateForm('supportedArtistName', artist.username); }}
                    >
                      {artist.photoUrl ? (
                        <img 
                          src={artist.photoUrl.startsWith('http') ? artist.photoUrl : `http://localhost:8080${artist.photoUrl}`} 
                          alt={artist.username} 
                          className="artist-photo" 
                        />
                      ) : (
                        <div className="artist-photo" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: 24,
                          fontWeight: 'bold',
                          color: 'white'
                        }}>
                          {artist.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="artist-info">
                        <div className="artist-name">{artist.username}</div>
                        <div className="artist-meta">
                          {artist.jurisdiction?.name && <span className="jurisdiction-badge">{artist.jurisdiction.name}</span>}
                        </div>
                        {artist.defaultSong?.title && <div className="song-title">♪ {artist.defaultSong.title}</div>}
                      </div>
                      Play
                      <button
                        type="button"
                        className="play-button"
                        onClick={(e) => { e.stopPropagation(); playArtistPreview(artist); }}
                        disabled={!artist.defaultSongId}
                      >
                        {playingArtistId === artist.userId ? (
                            <Pause size={20} color="blue" style={{ display: 'block' }} />
                          ) : (
                            <Play size={20} color="white" style={{ display: 'block' }} />
                          )}
                        </button>
                      
                      <div className={`select-indicator ${formData.supportedArtistId === artist.userId ? 'checked' : ''}`}>
                        {formData.supportedArtistId === artist.userId && <Check size={14} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <audio ref={audioRef} />
            
            {playingArtistId && (
              <div className="mini-player">
                <div className="player-info">
                  <div className="track-details">
                    <div className="track-artist">{artists.find(a => a.userId === playingArtistId)?.username}</div>
                  </div>
                </div>
                <div className="player-controls">
                  <button className="play-pause" onClick={() => audioRef.current?.paused ? audioRef.current.play() : audioRef.current?.pause()}>
                    {audioRef.current?.paused ? <Play size={16} /> : <Pause size={16} />}
                  </button>
                  <button onClick={() => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; setPlayingArtistId(null); setAudioProgress(0); }}>
                    <Square size={16} />
                  </button>
                </div>
                <div className="progress-bar-mini"><div className="progress" style={{ width: `${audioProgress}%` }} /></div>
              </div>
            )}
          </>
        );
      
      case 'review':
        if (success) {
          return (
            <div className="review-section">
              <div className="success-animation">
                <div className="checkmark-circle"><Check size={40} /></div>
                <h3>Welcome to Unis!</h3>
                <p>Your account has been created.</p>
              </div>
            </div>
          );
        }
        
        return (
          <>
            <div className="step-header">
              <h2>Review & Confirm</h2>
              <p>Accept the terms to create your account.</p>
            </div>
            
            <div className="review-section">
              <div className="review-card">
                <h4>Account Details</h4>
                <div className="review-item"><span className="item-label">Username</span><span className="item-value">@{formData.username}</span></div>
                <div className="review-item"><span className="item-label">Email</span><span className="item-value">{formData.email}</span></div>
                <div className="review-item"><span className="item-label">Type</span><span className="item-value" style={{ textTransform: 'capitalize' }}>{formData.role}</span></div>
                <div className="review-item"><span className="item-label">Jurisdiction</span><span className="item-value">{formData.jurisdictionName}</span></div>
              </div>
              
              {formData.role === 'artist' && (
                <div className="review-card">
                  <h4>Artist Details</h4>
                  <div className="review-item"><span className="item-label">Debut Song</span><span className="item-value">{formData.songTitle}</span></div>
                  <div className="review-item"><span className="item-label">Genre</span><span className="item-value">{Object.entries(GENRE_IDS).find(([k, v]) => v === formData.genreId)?.[0]}</span></div>
                </div>
              )}
              
              <div className="review-card">
                <h4>Supporting</h4>
                <div className="review-item">
                  <span className="item-label">Artist</span>
                  <span className="item-value">
                    <Music size={16} style={{ color: '#22c55e' }} />
                    {formData.supportedArtistName}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="agreement-section">
              <h4>Terms of Service</h4>
              <ol>
                <li>You must be at least 13 years old.</li>
                <li>One account per person.</li>
                <li>No hate speech or copyrighted content.</li>
                <li>Your jurisdiction is permanent.</li>
              </ol>
            </div>
            
            <div className="checkbox-group" onClick={() => updateForm('agreedToTerms', !formData.agreedToTerms)}>
              <div className={`checkbox-custom ${formData.agreedToTerms ? 'checked' : ''}`}>{formData.agreedToTerms && <Check size={14} />}</div>
              <span className="checkbox-label">I agree to the Terms of Service and Privacy Policy</span>
            </div>
            
            {formData.role === 'artist' && (
              <>
                <div className="agreement-section" style={{ marginTop: 16 }}>
                  <h4>Artist Upload Agreement</h4>
                  <ol>
                    <li>You own 100% of master and publishing rights.</li>
                    <li>You grant Unis a non-exclusive license.</li>
                    <li>You'll receive 50% of net ad revenue.</li>
                    <li>Terminable with 30 days notice.</li>
                  </ol>
                </div>
                
                <div className="checkbox-group" onClick={() => updateForm('agreedToArtistTerms', !formData.agreedToArtistTerms)}>
                  <div className={`checkbox-custom ${formData.agreedToArtistTerms ? 'checked' : ''}`}>{formData.agreedToArtistTerms && <Check size={14} />}</div>
                  <span className="checkbox-label">I agree to the Artist Upload Agreement</span>
                </div>
              </>
            )}
          </>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        <button className="wizard-close" onClick={onClose}><X size={24} /></button>
        
        <div className="wizard-illustration" data-step={currentStep}>
          <IllustrationComponent />
        </div>
        
        <div className="wizard-content">
          <div className="wizard-progress">
            {steps.map((step, index) => (
              <div key={step.id} className={`progress-step ${index + 1 < currentStep ? 'completed' : index + 1 === currentStep ? 'active' : ''}`} />
            ))}
            <span className="progress-text">{currentStep} of {totalSteps}</span>
          </div>
          
          {error && (
            <div className="wizard-alert alert-error">
              <AlertCircle size={20} />
              <div className="alert-content">
                <div className="alert-title">Oops!</div>
                <div className="alert-message">{error}</div>
              </div>
            </div>
          )}
          
          <div className="step-wrapper" key={currentStep} style={{ animation: `${stepDirection === 'forward' ? 'slideInRight' : 'slideInLeft'} 0.3s ease-out` }}>
            {renderStepContent()}
          </div>
        </div>
        
        {!success && (
          <div className="wizard-navigation">
            {currentStep > 1 && (
              <button className="btn btn-secondary" onClick={goBack}>
                <ChevronLeft size={20} />Back
              </button>
            )}
            
            {currentStep < totalSteps ? (
              <button className="btn btn-primary" onClick={goNext} disabled={!canProceed()}>
                Continue<ChevronRight size={20} />
              </button>
            ) : (
              <button className={`btn btn-primary ${loading ? 'loading' : ''}`} onClick={handleSubmit} disabled={!canProceed() || loading}>
                {loading ? 'Creating...' : 'Create Account'}{!loading && <Sparkles size={20} />}
              </button>
            )}
          </div>
        )}
      </div>
      
      {success && (
        <div className="confetti-container">
          {[...Array(50)].map((_, i) => <div key={i} className="confetti-piece" />)}
        </div>
      )}
    </div>
  );
};

export default CreateAccountWizard;