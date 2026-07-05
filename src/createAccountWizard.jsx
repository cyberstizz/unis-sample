import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ChevronRight, ChevronDown, ChevronLeft, Check, AlertCircle, 
  User, Mail, Lock, MapPin, Music, Headphones, Mic2,
  Upload, Image, FileAudio, Search, Play, Pause, Square,
  Loader2, CheckCircle2, XCircle, Info, Gift, Users,
  Sparkles, Heart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { JURISDICTION_IDS, GENRE_IDS } from './utils/idMappings';
import useModalA11y from './hooks/useModalA11y'; // ★ a11y: Escape close, focus trap, focus restore
import buildUrl from './utils/buildUrl';         // ★ canonical media URL builder (R2→CDN rewrite)
import './createAccountWizard.scss';
import UnisLogo from './assets/unisLogoThree.svg';


// ============================================
// File Validation Config
// ============================================

const FILE_LIMITS = {
  photo: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    sizeLabel: '5MB',
    typeLabel: 'PNG, JPG, or WebP',
  },
  audio: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav', 'audio/x-flac', 'audio/ogg', 'audio/aac', 'audio/x-m4a', 'audio/mp4'],
    allowedExtensions: ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'],
    sizeLabel: '50MB',
    typeLabel: 'MP3, WAV, or FLAC',
  },
};

/**
 * Validates a file against size and type constraints.
 * Returns { valid: true } or { valid: false, error: string }
 */
const validateFile = (file, limitKey) => {
  const limits = FILE_LIMITS[limitKey];
  if (!limits) return { valid: true };

  // Type check — use MIME type first, fall back to extension
  const mimeOk = file.type && limits.allowedTypes.includes(file.type.toLowerCase());
  const extOk = limits.allowedExtensions.some(ext =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (!mimeOk && !extOk) {
    return {
      valid: false,
      error: `Unsupported file type. Please choose a ${limits.typeLabel} file.`,
    };
  }

  // Size check
  if (file.size > limits.maxSize) {
    const actualSize = formatFileSize(file.size);
    return {
      valid: false,
      error: `This file is ${actualSize} — please choose one under ${limits.sizeLabel}.`,
    };
  }

  return { valid: true };
};


// ============================================
// Submit Phase Labels
// ============================================

const SUBMIT_PHASE_MESSAGES = {
  'uploading-photo': 'Uploading your photo…',
  'creating-account': 'Creating your account…',
  'logging-in': 'Setting things up…',
  'uploading-song': 'Uploading your debut track…',
};


// ============================================
// (Removed) Per-step SVG illustration components + STEP_ILLUSTRATIONS map.
// They were never rendered — the wizard uses Lucide STEP_ICONS below via <StepIcon>.
// ~253 lines of dead code removed in the secured/accessible pass.
// ============================================

    // ★ Premium step icons — replace the per-step gradient-blob illustrations
const STEP_ICONS = {
  welcome: Gift,
  basicInfo: User,
  location: MapPin,
  role: Sparkles,
  artistProfile: Mic2,
  songUpload: Music,
  listenerProfile: Image,
  listenerBio: Headphones,
  supportArtist: Heart,
  review: CheckCircle2,
};

  // ★ mirrors VALID_THEMES + theme.scss primaries
  const THEME_OPTIONS = [
    { id: 'blue',   label: 'Blue',   color: '#163387' },
    { id: 'orange', label: 'Orange', color: '#C44B0A' },
    { id: 'red',    label: 'Red',    color: '#B51C24' },
    { id: 'green',  label: 'Green',  color: '#0F7A3E' },
    { id: 'purple', label: 'Purple', color: '#4A1A8C' },
    { id: 'yellow', label: 'Yellow', color: '#C49A0A' },
    { id: 'dianna', label: 'Dianna', color: '#C8A84B' },
  ];

// ============================================
// Utilities
// ============================================

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


// ============================================
// Component
// ============================================

const CreateAccountWizard = ({ show, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [stepDirection, setStepDirection] = useState('forward');
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    referralCode: '',
    referrerUsername: '',
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    dateOfBirth: '',              
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
    showWaitlistPrompt: false,
    gender: '',              
    themePreference: 'blue', 
  });
  
  const [validation, setValidation] = useState({
    referralCode: { checking: false, valid: null, message: '' },
    username: { checking: false, valid: null, message: '' },
    email: { checking: false, valid: null, message: '' },
    password: { valid: null, message: '' },
    passwordConfirm: { valid: null, message: '' },
  });

  // ========== NEW: File error state (inline per upload zone) ==========
  const [fileErrors, setFileErrors] = useState({
    listenerPhoto: '',
    artistPhoto: '',
    songFile: '',
    songArtwork: '',
  });

  const setFileError = (key, message) => {
    setFileErrors(prev => ({ ...prev, [key]: message }));
  };

  const clearFileError = (key) => {
    setFileErrors(prev => ({ ...prev, [key]: '' }));
  };
  
  // ========== NEW: Submit phase tracking ==========
  const [submitPhase, setSubmitPhase] = useState(null);
  const [partialSuccess, setPartialSuccess] = useState(false);
  // partialSuccess = account created but song upload failed
  
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
  const [songIsrc, setSongIsrc] = useState('');
  const contentRef = useRef(null);                           
  const [showScrollCue, setShowScrollCue] = useState(false);  

  const [verificationSent, setVerificationSent] = useState(false);  
  const [verificationEmail, setVerificationEmail] = useState(''); 

  // ★ a11y: modal shell ref + Escape/focus-trap/focus-restore hook.
  // Guarded by `show` so the trap is only active while the wizard is open.
  const modalRef = useRef(null);
  useModalA11y({ active: show, onClose, modalRef });
  const titleId = 'create-account-wizard-title'; // ★ aria-labelledby target

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
      { id: 'listenerProfile', title: 'Your Photo', illustration: 'listenerProfile' },
      { id: 'listenerBio', title: 'Your Story', illustration: 'listenerBio' },  
      { id: 'supportArtist', title: 'Show Love', illustration: 'supportArtist' },
      { id: 'review', title: 'Ready!', illustration: 'review' },
    ];
  };
  
  const steps = getSteps();
  const totalSteps = steps.length;
  const currentStepData = steps[currentStep - 1];
  
  const updateForm = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  const updateValidation = (key, data) => {
    setValidation(prev => ({ ...prev, [key]: { ...prev[key], ...data } }));
  };


  // ============================================
  // File Handlers — Layer 1: Validate at selection
  // ============================================

  const handleListenerPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearFileError('listenerPhoto');
    const result = validateFile(file, 'photo');

    if (!result.valid) {
      setFileError('listenerPhoto', result.error);
      // Reset the input so the same file can be re-selected after fixing
      e.target.value = '';
      return;
    }

    updateForm('listenerPhotoFile', file);
    const reader = new FileReader();
    reader.onload = () => updateForm('listenerPhotoPreview', reader.result);
    reader.readAsDataURL(file);
  };

  const handleArtistPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearFileError('artistPhoto');
    const result = validateFile(file, 'photo');

    if (!result.valid) {
      setFileError('artistPhoto', result.error);
      e.target.value = '';
      return;
    }

    updateForm('artistPhotoFile', file);
    const reader = new FileReader();
    reader.onload = () => updateForm('artistPhotoPreview', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSongFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearFileError('songFile');
    const result = validateFile(file, 'audio');

    if (!result.valid) {
      setFileError('songFile', result.error);
      e.target.value = '';
      return;
    }

    updateForm('songFile', file);
    updateForm('songFileName', file.name);
  };

  const handleSongArtworkChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearFileError('songArtwork');
    const result = validateFile(file, 'photo');

    if (!result.valid) {
      setFileError('songArtwork', result.error);
      e.target.value = '';
      return;
    }

    updateForm('songArtworkFile', file);
    const reader = new FileReader();
    reader.onload = () => updateForm('songArtworkPreview', reader.result);
    reader.readAsDataURL(file);
  };

  
  // ============================================
  // Validation functions
  // ============================================

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
          useCache: false, // ★ availability is liveness-sensitive — never serve a stale result
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
        if (code === 'UNIS-LAUNCH-2024') {
          console.warn('[wizard] referral endpoint failed; applied launch-code fallback', err);
          updateValidation('referralCode', {
            checking: false,
            valid: true,
            message: 'Welcome early adopter!',
          });
          updateForm('referrerUsername', 'Unis');
        } else {
          console.error('[wizard] referral validation failed:', err);
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
          useCache: false, // ★ availability is liveness-sensitive
        });
        
        updateValidation('username', {
          checking: false,
          valid: response.data?.available !== false,
          message: response.data?.available === false ? 'Username taken' : 'Username available!',
        });
      } catch (err) {
        // Fail open (don't block signup on a check outage); register 409 is the backstop.
        console.error('[wizard] username availability check failed:', err);
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
          useCache: false, // ★ availability is liveness-sensitive
        });
        
        updateValidation('email', {
          checking: false,
          valid: response.data?.available !== false,
          message: response.data?.available === false ? 'Email already registered' : '',
        });
      } catch (err) {
        // Fail open; register 409 is the backstop.
        console.error('[wizard] email availability check failed:', err);
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
      console.error('[wizard] failed to load active artists:', err);
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
          const audioUrl = buildUrl(response.data.fileUrl); // ★ canonical URL builder (R2 rewrite + safe-encode)
          
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
  
  
  // ============================================
  // Step validation — fixed: single basicInfo case with DOB
  // ============================================

  const canProceed = () => {
    switch (currentStepData?.id) {
      case 'welcome':
        return validation.referralCode.valid === true;

      case 'basicInfo': {
        let dobValid = false;
        if (formData.dateOfBirth) {
          const dob = new Date(formData.dateOfBirth);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const monthDiff = today.getMonth() - dob.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
          }
          dobValid = age >= 13 && dob <= today;
        }

        return (
          formData.username.length >= 3 &&
          validation.username.valid !== false &&
          validation.email.valid !== false &&
          formData.email &&
          formData.password.length >= 8 &&
          formData.passwordConfirm === formData.password &&
          dobValid
        );
      }

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


  // ★ Scroll affordance — cue appears whenever a step overflows below the fold
  const updateScrollCue = () => {
    const el = contentRef.current;
    if (!el) return;
    setShowScrollCue(el.scrollHeight - el.clientHeight - el.scrollTop > 12);
  };

  useEffect(() => {
    const el = contentRef.current;
    if (el) el.scrollTop = 0;              
    const id = requestAnimationFrame(updateScrollCue);
    return () => cancelAnimationFrame(id);
  }, [currentStep]);


  // ============================================
  // Submit — Layer 2 & 3: phased progress + specific errors
  // ============================================

const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSubmitPhase(null);
    setPartialSuccess(false);

    try {
      let photoUrl = null;

      // ---- Phase 1: Photo upload (anonymous endpoint) ----
      const photoFile = formData.role === 'artist'
        ? formData.artistPhotoFile
        : formData.listenerPhotoFile;

      if (photoFile) {
        setSubmitPhase('uploading-photo');
        try {
          const photoFormData = new FormData();
          photoFormData.append('photo', photoFile);
          const photoResponse = await apiCall({
            url: '/v1/users/profile/photo',
            method: 'patch',
            data: photoFormData,
          });
          photoUrl = photoResponse.data?.photoUrl;
        } catch (photoErr) {
          const status = photoErr.response?.status;
          const serverMsg = photoErr.response?.data?.message || '';
          console.error('[wizard] photo upload failed:', { status, serverMsg, err: photoErr });
          let userMessage;
          if (status === 413 || serverMsg.toLowerCase().includes('size') || serverMsg.toLowerCase().includes('large')) {
            userMessage = `Your photo couldn't be uploaded — it's too large. Please go back to the photo step and choose a file under ${FILE_LIMITS.photo.sizeLabel}.`;
          } else if (status === 415 || serverMsg.toLowerCase().includes('type') || serverMsg.toLowerCase().includes('format')) {
            userMessage = `Your photo format isn't supported. Please go back and choose a ${FILE_LIMITS.photo.typeLabel} file.`;
          } else if (status === 408 || photoErr.code === 'ECONNABORTED') {
            userMessage = 'The photo upload timed out — your connection may be slow. Please try again or choose a smaller image.';
          } else {
            userMessage = `Your photo couldn't be uploaded (${serverMsg || 'server error'}). Please go back and try a different image, or try again in a moment.`;
          }
          setError(userMessage);
          setSubmitPhase(null);
          setLoading(false);
          return;
        }
      }

      // ---- Phase 2: Account registration (creates an UNVERIFIED account) ----
      setSubmitPhase('creating-account');

      const registerPayload = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        jurisdictionId: formData.jurisdictionId,
        supportedArtistId: formData.supportedArtistId,
        referralCode: formData.referralCode,
        bio: formData.bio || null,
        genreId: formData.role === 'artist' ? formData.genreId : null,
        photoUrl: photoUrl,
        dateOfBirth: formData.dateOfBirth || null,
        gender: formData.gender || null,                      // ★ now collected
        themePreference: formData.themePreference || 'blue',  // ★ honors the picker
      };

      let reg;
      try {
        const registerResponse = await apiCall({
          url: '/v1/users/register',
          method: 'post',
          data: registerPayload,
        });
        reg = registerResponse.data; // { userId, role, signupToken, emailVerificationSent }
      } catch (regErr) {
        const serverMsg = regErr.response?.data?.message || '';
        const status = regErr.response?.status;
        console.error('[wizard] registration failed:', { status, serverMsg, err: regErr });
        let userMessage;
        if (status === 409 || serverMsg.toLowerCase().includes('already') || serverMsg.toLowerCase().includes('taken') || serverMsg.toLowerCase().includes('exists')) {
          userMessage = 'An account with this email or username already exists. Please go back and use different credentials.';
        } else if (serverMsg) {
          userMessage = `Account creation failed: ${serverMsg}`;
        } else {
          userMessage = 'Account creation failed due to a server error. Please try again in a moment.';
        }
        setError(userMessage);
        setSubmitPhase(null);
        setLoading(false);
        return;
      }

      // ---- Phase 3: Artist debut song (token-authorized, NO login) ----
      if (formData.role === 'artist' && formData.songFile) {
        if (!reg.signupToken) {
          console.warn('[wizard] account created but no signupToken returned; deferring debut-song upload to dashboard', { userId: reg.userId });
          setPartialSuccess(true);
          setVerificationEmail(formData.email);
          setError("Your account was created, but we couldn't prepare the song upload. You can add your debut track from your dashboard after verifying your email.");
          setSubmitPhase(null);
          setLoading(false);
          return;
        }

        setSubmitPhase('uploading-song');
        try {
          const songData = {
            title: formData.songTitle,
            genreId: formData.genreId,
            jurisdictionId: formData.jurisdictionId,
            isrc: songIsrc || null,
          };
          const songFormData = new FormData();
          songFormData.append('song', JSON.stringify(songData));
          songFormData.append('file', formData.songFile);
          if (formData.songArtworkFile) {
            songFormData.append('artwork', formData.songArtworkFile);
          }

          await apiCall({
            url: `/v1/media/signup-song?signupToken=${encodeURIComponent(reg.signupToken)}`,
            method: 'post',
            data: songFormData,
          });
        } catch (songErr) {
          const serverMsg = songErr.response?.data?.message || '';
          const status = songErr.response?.status;
          console.error('[wizard] debut-song upload failed (account already created):', { status, serverMsg, err: songErr });
          setPartialSuccess(true);
          setVerificationEmail(formData.email);
          let detail;
          if (status === 413 || serverMsg.toLowerCase().includes('size') || serverMsg.toLowerCase().includes('large')) {
            detail = 'The audio file was too large.';
          } else if (serverMsg) {
            detail = serverMsg;
          } else {
            detail = 'a server error occurred';
          }
          setError(`Your account was created! However, your song couldn't be uploaded (${detail}). You can upload it from your dashboard after verifying your email.`);
          setSubmitPhase(null);
          setLoading(false);
          return;
        }
      }

      // ---- All phases succeeded — account created, verification email sent ----
      console.info('[wizard] account created (unverified); verification email sent', { role: reg.role, userId: reg.userId, songUploaded: formData.role === 'artist' && !!formData.songFile });
      setVerificationEmail(formData.email);   // ★
      setVerificationSent(true);              // ★
      setSubmitPhase(null);
      setSuccess(true);
      // No auto-login: the user must verify before they can sign in.
    } catch (err) {
      console.error('[wizard] unexpected submit failure:', err);
      setSubmitPhase(null);
      setError(err.response?.data?.message || 'Something unexpected went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
      
  if (!show) return null;
  
  const StepIcon = STEP_ICONS[currentStepData?.id] || Gift; // ★  

  // ============================================
  // Render helpers
  // ============================================

  /**
   * Inline file error banner — rendered inside upload zones when validation fails.
   */
  const renderFileError = (errorKey) => {
    const msg = fileErrors[errorKey];
    if (!msg) return null;
    return (
      <div className="wizard-alert alert-error" style={{ marginTop: 12 }}>
        <AlertCircle size={18} />
        <div className="alert-content">
          <div className="alert-message">{msg}</div>
        </div>
      </div>
    );
  };

  /**
   * Submit progress indicator — shown in the navigation area during submission.
   */
  const renderSubmitProgress = () => {
    if (!submitPhase) return null;
    const message = SUBMIT_PHASE_MESSAGES[submitPhase] || 'Working…';
    return (
      <div className="wizard-alert alert-info" style={{ marginTop: 12 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        <div className="alert-content">
          <div className="alert-title">{message}</div>
          <div className="alert-message">Please don't close this window.</div>
        </div>
      </div>
    );
  };


  // ============================================
  // Step content renderer
  // ============================================

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
              <label htmlFor="wizard-referral">Referral Code</label>{/* ★ a11y: label association */}
              <div className="input-wrapper">
                <input
                  id="wizard-referral"
                  type="text"
                  placeholder="e.g. HARLEM-JOHN-X7K2"
                  value={formData.referralCode}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    updateForm('referralCode', value);
                    validateReferralCode(value);
                  }}
                  aria-invalid={validation.referralCode.valid === false}
                  aria-describedby={validation.referralCode.message ? 'wizard-referral-msg' : undefined}
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
                <div id="wizard-referral-msg" className={`helper-text ${validation.referralCode.valid ? 'success' : 'error'}`}>
                  {validation.referralCode.message}
                </div>
              )}
            </div>
            
            <div className="wizard-alert alert-info">
              <Info size={20} />
              <div className="alert-content">
                <div className="alert-title">Don't have a code?</div>
                <div className="alert-message">
                  <strong>Find a Unis User and ask them for their referral code</strong>
                </div>
              </div>
            </div>
            <div 
              role="button"
              tabIndex={0}
              aria-label="Join the national waitlist"
              style={{
                marginTop: '16px',
                padding: '14px 18px',
                background: 'var(--unis-primary-subtle)',
                border: '1px solid color-mix(in srgb, var(--unis-primary) 25%, transparent)',
                borderRadius: '12px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => { onClose(); navigate('/waitlist'); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); navigate('/waitlist'); } }}
            >
              <span style={{ color: 'var(--unis-text-2)', fontSize: '14px' }}>
                Not from Harlem?{' '}
              </span>
              <span style={{ color: 'var(--unis-primary-2)', fontSize: '14px', fontWeight: '600' }}>
                Join the national waitlist
              </span>
              <span style={{ color: 'var(--unis-text-2)', fontSize: '14px' }}>
                {' '}and help unlock Unis in your area.
              </span>
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
              <label htmlFor="wizard-username">Username</label>{/* ★ a11y */}
              <div className="input-wrapper">
                <input
                  id="wizard-username"
                  type="text"
                  placeholder="Your unique username"
                  value={formData.username}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    updateForm('username', value);
                    validateUsername(value);
                  }}
                  aria-invalid={validation.username.valid === false}
                  aria-describedby={validation.username.message ? 'wizard-username-msg' : undefined}
                  className={validation.username.valid === true ? 'has-success' : validation.username.valid === false ? 'has-error' : ''}
                />
                <User className="input-icon" size={20} />
                {validation.username.checking && <Loader2 className="validation-icon loading" size={20} />}
                {validation.username.valid === true && <CheckCircle2 className="validation-icon valid" size={20} />}
                {validation.username.valid === false && <XCircle className="validation-icon invalid" size={20} />}
              </div>
              {validation.username.message && <div id="wizard-username-msg" className="helper-text">{validation.username.message}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="wizard-email">Email</label>{/* ★ a11y */}
              <div className="input-wrapper">
                <input
                  id="wizard-email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => {
                    updateForm('email', e.target.value);
                    validateEmail(e.target.value);
                  }}
                  aria-invalid={validation.email.valid === false}
                  aria-describedby={validation.email.message ? 'wizard-email-msg' : undefined}
                  className={validation.email.valid === true ? 'has-success' : validation.email.valid === false ? 'has-error' : ''}
                />
                <Mail className="input-icon" size={20} />
                {validation.email.checking && <Loader2 className="validation-icon loading" size={20} />}
                {validation.email.valid === true && <CheckCircle2 className="validation-icon valid" size={20} />}
                {validation.email.valid === false && <XCircle className="validation-icon invalid" size={20} />}
              </div>
              {validation.email.message && <div id="wizard-email-msg" className="error-message"><AlertCircle size={14} />{validation.email.message}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="wizard-password">Password</label>{/* ★ a11y */}
              <div className="input-wrapper">
                <input
                  id="wizard-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={(e) => {
                    updateForm('password', e.target.value);
                    validatePassword(e.target.value);
                  }}
                  aria-describedby={validation.password.message ? 'wizard-password-msg' : undefined}
                />
                <Lock className="input-icon" size={20} />
              </div>
              {validation.password.message && <div id="wizard-password-msg" className="helper-text">{validation.password.message}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="wizard-password-confirm">Confirm Password</label>{/* ★ a11y */}
              <div className="input-wrapper">
                <input
                  id="wizard-password-confirm"
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.passwordConfirm}
                  onChange={(e) => {
                    updateForm('passwordConfirm', e.target.value);
                    validatePasswordConfirm(e.target.value);
                  }}
                  aria-invalid={validation.passwordConfirm.valid === false}
                  aria-describedby={validation.passwordConfirm.message ? 'wizard-password-confirm-msg' : undefined}
                  className={validation.passwordConfirm.valid === true ? 'has-success' : validation.passwordConfirm.valid === false ? 'has-error' : ''}
                />
                <Lock className="input-icon" size={20} />
                {validation.passwordConfirm.valid === true && <CheckCircle2 className="validation-icon valid" size={20} />}
                {validation.passwordConfirm.valid === false && <XCircle className="validation-icon invalid" size={20} />}
              </div>
              {validation.passwordConfirm.message && <div id="wizard-password-confirm-msg" className={validation.passwordConfirm.valid ? 'helper-text' : 'error-message'}>{validation.passwordConfirm.message}</div>}
            </div>

             <div className="form-group">
              <label htmlFor="wizard-dob">Date of Birth</label>
              <div className="input-wrapper">
                <input
                  id="wizard-dob"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => {
                    updateForm('dateOfBirth', e.target.value);
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  min="1900-01-01"
                  className={
                    formData.dateOfBirth
                      ? (() => {
                          const dob = new Date(formData.dateOfBirth);
                          const today = new Date();
                          let age = today.getFullYear() - dob.getFullYear();
                          const m = today.getMonth() - dob.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                          return age >= 13 ? 'has-success' : 'has-error';
                        })()
                      : ''
                  }
                  style={{
                    colorScheme: 'dark',
                  }}
                />
              </div>
              {formData.dateOfBirth && (() => {
                const dob = new Date(formData.dateOfBirth);
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
 
                if (age < 13) {
                  return (
                    <div className="error-message">
                      <AlertCircle size={14} />
                      You must be at least 13 years old to join Unis.
                    </div>
                  );
                }
                if (age < 18) {
                  return (
                    <div className="helper-text" style={{ color: '#f59e0b' /* amber: no warning/status token in design system */ }}>
                      Under 18: Explicit content will be disabled on your account.
                    </div>
                  );
                }
                return null;
              })()}
              <div className="helper-text">
                Your date of birth is private and never shown publicly. Used for age verification only.
              </div>
            </div>

            {/* ★ Gender — feeds the artist demographics filter */}
            <div className="form-group">
              <label htmlFor="wizard-gender">Gender (optional)</label>
              <select id="wizard-gender" value={formData.gender} onChange={(e) => updateForm('gender', e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
              </select>
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
              <label htmlFor="wizard-address">Your Address</label>
              <div className="input-wrapper">
                <input
                  id="wizard-address"
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
                      
                      const HARLEM_BOUNDS = {
                        north: 40.8282,
                        south: 40.7967,
                        east: -73.9262,
                        west: -73.9595,
                      };
                      
                      const DIVIDING_LINE = 40.8095;
                      
                      if (lat < HARLEM_BOUNDS.south || lat > HARLEM_BOUNDS.north ||
                          lon < HARLEM_BOUNDS.west || lon > HARLEM_BOUNDS.east) {
                        updateForm('detectingLocation', false);
                        updateForm('showWaitlistPrompt', true);
                        return;
                      }
                      
                      if (lat >= DIVIDING_LINE) {
                        updateForm('jurisdictionId', JURISDICTION_IDS['uptown-harlem']);
                        updateForm('jurisdictionName', 'Uptown Harlem');
                      } else {
                        updateForm('jurisdictionId', JURISDICTION_IDS['downtown-harlem']);
                        updateForm('jurisdictionName', 'Downtown Harlem');
                      }
                      
                      updateForm('detectedCoords', { lat, lon });
                      
                    } catch (err) {
                      console.error('[wizard] geocode/jurisdiction lookup failed:', err);
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

            {formData.showWaitlistPrompt && (
              <div style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--unis-primary) 15%, transparent), color-mix(in srgb, var(--unis-primary) 5%, transparent))',
                borderRadius: '14px',
                padding: '24px',
                border: '1px solid var(--unis-primary-glow)',
                marginBottom: '20px',
                textAlign: 'center',
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" stroke="var(--unis-primary)" strokeWidth="2" fill="color-mix(in srgb, var(--unis-primary) 15%, transparent)" />
                    <path d="M24 14v10l6 3" stroke="var(--unis-primary)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 style={{ color: 'var(--unis-text)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                  Unis isn't in your area yet
                </h3>
                <p style={{ color: 'var(--unis-text-2)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                  But it can be. Join the national waitlist, get your referral code, 
                  and help unlock Unis in your region. When enough people sign up 
                  from your area, it activates.
                </p>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'var(--unis-primary)',
                    color: 'var(--unis-text)',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: '12px',
                  }}
                  onClick={() => { onClose(); navigate('/waitlist'); }}
                >
                  Join the Waitlist
                </button>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'transparent',
                    color: 'var(--unis-text-2)',
                    border: '1px solid var(--unis-border-hi)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onClick={() => {
                    updateForm('showWaitlistPrompt', false);
                    setError('');
                  }}
                >
                  I do live in Harlem — let me try again
                </button>
              </div>
            )}
            
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
              <label htmlFor="wizard-jurisdiction">Or Select Manually</label>
              <select
                id="wizard-jurisdiction"
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
            
            <div className="role-selection" role="radiogroup" aria-label="How will you use Unis?">{/* ★ a11y */}
              <div
                className={`role-card ${formData.role === 'listener' ? 'selected' : ''}`}
                role="radio"
                aria-checked={formData.role === 'listener'}
                tabIndex={0}
                onClick={() => updateForm('role', 'listener')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateForm('role', 'listener'); } }}
              >
                <Headphones className="role-icon" size={48} />
                <div className="role-title">Listener</div>
                <div className="role-description">Discover music, vote daily, earn from referrals</div>
              </div>
              
              <div
                className={`role-card ${formData.role === 'artist' ? 'selected' : ''}`}
                role="radio"
                aria-checked={formData.role === 'artist'}
                tabIndex={0}
                onClick={() => updateForm('role', 'artist')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateForm('role', 'artist'); } }}
              >
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

                        {/* ★ Theme picker — sets the user's palette from signup */}
            <div className="form-group">
              <label id="wizard-theme-label">Pick your theme</label>
              <div className="theme-swatches" role="group" aria-labelledby="wizard-theme-label">{/* ★ a11y */}
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-swatch ${formData.themePreference === t.id ? 'selected' : ''}`}
                    style={{ '--sw': t.color }}
                    onClick={() => updateForm('themePreference', t.id)}
                    title={t.label}
                    aria-label={t.label}
                  >
                    {formData.themePreference === t.id && <Check size={16} />}
                  </button>
                ))}
              </div>
            </div>

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
              <label htmlFor="wizard-artist-photo">Profile Photo</label>
              <div className={`upload-zone ${formData.artistPhotoFile ? 'has-file' : ''} ${fileErrors.artistPhoto ? 'has-error' : ''}`}>
                <input id="wizard-artist-photo" type="file" accept="image/*" onChange={handleArtistPhotoChange} />
                {formData.artistPhotoPreview ? (
                  <div className="file-preview">
                    <img src={formData.artistPhotoPreview} alt="Preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                    <div className="file-info">
                      <div className="file-name">{formData.artistPhotoFile?.name}</div>
                      <div className="file-size">{formatFileSize(formData.artistPhotoFile?.size || 0)}</div>
                    </div>
                    <button type="button" className="remove-file" onClick={(e) => { e.stopPropagation(); updateForm('artistPhotoFile', null); updateForm('artistPhotoPreview', null); clearFileError('artistPhoto'); }}>
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
              {renderFileError('artistPhoto')}
            </div>
            
            <div className="form-group">
              <label htmlFor="wizard-genre">Primary Genre</label>
              <select id="wizard-genre" value={formData.genreId} onChange={(e) => updateForm('genreId', e.target.value)}>
                <option value="">Select genre...</option>
                {Object.entries(GENRE_IDS).map(([key, id]) => (
                  <option key={id} value={id}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="wizard-bio">Bio (Optional)</label>
              <textarea id="wizard-bio" placeholder="Tell fans about yourself..." value={formData.bio} onChange={(e) => updateForm('bio', e.target.value)} maxLength={500} />
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
              <label htmlFor="wizard-song-title">Song Title</label>
              <div className="input-wrapper">
                <input id="wizard-song-title" type="text" placeholder="Track name" value={formData.songTitle} onChange={(e) => updateForm('songTitle', e.target.value)} />
                <Music className="input-icon" size={20} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="wizard-isrc">ISRC (Optional)</label>
              <input
                id="wizard-isrc"
                type="text"
                value={songIsrc}
                onChange={(e) => setSongIsrc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g., USRC17607839"
                maxLength={15}
              />
              <small>You can add this later from your dashboard.</small>
            </div>
            
            <div className="file-upload">
              <label htmlFor="wizard-song-file">Audio File</label>
              <div className={`upload-zone ${formData.songFile ? 'has-file' : ''} ${fileErrors.songFile ? 'has-error' : ''}`}>
                <input id="wizard-song-file" type="file" accept="audio/*" onChange={handleSongFileChange} />
                {formData.songFile ? (
                  <div className="file-preview">
                    <FileAudio className="file-icon" size={40} />
                    <div className="file-info">
                      <div className="file-name">{formData.songFileName}</div>
                      <div className="file-size">{formatFileSize(formData.songFile?.size || 0)}</div>
                    </div>
                    <button type="button" className="remove-file" onClick={(e) => { e.stopPropagation(); updateForm('songFile', null); updateForm('songFileName', ''); clearFileError('songFile'); }}>
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
              {renderFileError('songFile')}
            </div>
            
            <div className="file-upload">
              <label htmlFor="wizard-song-artwork">Song Artwork</label>
              <div className={`upload-zone ${formData.songArtworkFile ? 'has-file' : ''} ${fileErrors.songArtwork ? 'has-error' : ''}`}>
                <input id="wizard-song-artwork" type="file" accept="image/*" onChange={handleSongArtworkChange} />
                {formData.songArtworkPreview ? (
                  <div className="file-preview">
                    <img src={formData.songArtworkPreview} alt="Artwork" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                    <div className="file-info">
                      <div className="file-name">{formData.songArtworkFile?.name}</div>
                      <div className="file-size">{formatFileSize(formData.songArtworkFile?.size || 0)}</div>
                    </div>
                    <button type="button" className="remove-file" onClick={(e) => { e.stopPropagation(); updateForm('songArtworkFile', null); updateForm('songArtworkPreview', null); clearFileError('songArtwork'); }}>
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
              {renderFileError('songArtwork')}
            </div>
          </>
        );

    case 'listenerProfile':
      return (
        <>
          <div className="step-header">
            <h2>Show Your Face</h2>
            <p>Let the community know who you are.</p>
          </div>
          
          <div className="file-upload">
            <label htmlFor="wizard-listener-photo">Profile Photo</label>
            <div className={`upload-zone ${formData.listenerPhotoFile ? 'has-file' : ''} ${fileErrors.listenerPhoto ? 'has-error' : ''}`}>
              <input id="wizard-listener-photo" type="file" accept="image/*" onChange={handleListenerPhotoChange} />
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
                      clearFileError('listenerPhoto');
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
            {renderFileError('listenerPhoto')}
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
    
    case 'listenerBio':
      return (
        <>
          <div className="step-header">
            <h2>Tell Your Story</h2>
            <p>What brings you to Unis? What music moves you?</p>
          </div>
          
          <div className="form-group">
            <label htmlFor="wizard-listener-bio">Your Bio</label>
            <textarea 
              id="wizard-listener-bio"
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
                      role="button"
                      tabIndex={0}
                      aria-pressed={formData.supportedArtistId === artist.userId}
                      aria-label={`Support ${artist.username}`}
                      onClick={() => { updateForm('supportedArtistId', artist.userId); updateForm('supportedArtistName', artist.username); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateForm('supportedArtistId', artist.userId); updateForm('supportedArtistName', artist.username); } }}
                    >
                      {artist.photoUrl ? (
                        <img 
                          src={buildUrl(artist.photoUrl)}
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
                      
                      <button
                        type="button"
                        className="play-button"
                        onClick={(e) => { e.stopPropagation(); playArtistPreview(artist); }}
                        disabled={!artist.defaultSongId}
                      >
                        {playingArtistId === artist.userId ? (
                            <Pause size={20} color="var(--unis-primary)" style={{ display: 'block' }} />
                          ) : (
                            <Play size={20} color="var(--unis-text)" style={{ display: 'block' }} />
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
                <div className="checkmark-circle"><Mail size={40} /></div>
                <h3>Check your email</h3>
                <p style={{ marginBottom: 8 }}>
                  Your account is created. We sent a confirmation link to <strong>{verificationEmail}</strong>.
                </p>
                <p style={{ opacity: 0.7, fontSize: 14 }}>
                  Click the link to verify it's you, then log in.
                  {formData.role === 'artist' && ' Your debut track is attached and goes live once you verify.'}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 20, width: '100%' }}
                  onClick={() => { onClose(); navigate('/login'); }}
                >
                  Go to Login
                </button>
              </div>
            </div>
          );
        }

        // Partial success — account created, song failed
        if (partialSuccess) {
          return (
            <div className="review-section">
              <div className="success-animation">
                <div className="checkmark-circle" style={{ background: '#f59e0b' /* amber: no warning/status token */ }}><Check size={40} /></div>
                <h3>Account Created!</h3>
                <p style={{ marginBottom: 12 }}>You're in — but there was a hiccup with your song upload.</p>
                {error && (
                  <div className="wizard-alert alert-error" style={{ textAlign: 'left' }}>
                    <AlertCircle size={18} />
                    <div className="alert-content">
                      <div className="alert-message">{error}</div>
                    </div>
                  </div>
                )}
                <p style={{ opacity: 0.7, fontSize: 14, marginTop: 12 }}>
                  Check your email to verify your account, then log in to add your track.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 16, width: '100%' }}
                  onClick={() => { onClose(); navigate('/login'); }}
                >
                  Go to Login
                </button>
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
                 <div className="review-item">
                  <span className="item-label">Age</span>
                  <span className="item-value">
                    {formData.dateOfBirth
                      ? (() => {
                          const dob = new Date(formData.dateOfBirth);
                          const today = new Date();
                          let age = today.getFullYear() - dob.getFullYear();
                          const m = today.getMonth() - dob.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                          return `${age} years old${age < 18 ? ' (minor — explicit content disabled)' : ''}`;
                        })()
                      : 'Not provided'}
                  </span>
                </div>
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
                    <Music size={16} style={{ color: '#22c55e' /* success green: no positive/status token */ }} />
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
            
            <div
              className="checkbox-group"
              role="checkbox"
              aria-checked={formData.agreedToTerms}
              tabIndex={0}
              onClick={() => updateForm('agreedToTerms', !formData.agreedToTerms)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateForm('agreedToTerms', !formData.agreedToTerms); } }}
            >
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
                
                <div
                  className="checkbox-group"
                  role="checkbox"
                  aria-checked={formData.agreedToArtistTerms}
                  tabIndex={0}
                  onClick={() => updateForm('agreedToArtistTerms', !formData.agreedToArtistTerms)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateForm('agreedToArtistTerms', !formData.agreedToArtistTerms); } }}
                >
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
  

  // ============================================
  // Main render
  // ============================================

  return (
    <div className="wizard-overlay">
      <div
        className="wizard-container"
        ref={modalRef}                 /* ★ a11y: focus trap / restore target */
        role="dialog"                  /* ★ a11y: announce as a dialog */
        aria-modal="true"              /* ★ a11y: content behind is inert */
        aria-labelledby={titleId}      /* ★ a11y: names the dialog */
        tabIndex={-1}                  /* ★ a11y: container can receive focus as a fallback */
      >
      {/* ★ a11y: visually-hidden accessible name; updates with the active step */}
      <h2
        id={titleId}
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      >
        Account sign-up wizard — {currentStepData?.title || 'Welcome'} step
      </h2>
      <button className="wizard-close" onClick={onClose} aria-label="Close">{/* ★ uses existing .wizard-close + Lucide X */}
        <X size={10} />
      </button>
      
        <div className="wizard-illustration">{/* ★ fixed brand backdrop, no data-step */}
          <div className="wizard-step-icon">
            <StepIcon size={40} strokeWidth={1.5} />
          </div>
        </div>        
        <div className="wizard-content" ref={contentRef} onScroll={updateScrollCue}>
          <div
            className="wizard-progress"
            role="progressbar"               /* ★ a11y */
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Step ${currentStep} of ${totalSteps}: ${currentStepData?.title || ''}`}
          >
            {steps.map((step, index) => (
              <div key={step.id} className={`progress-step ${index + 1 < currentStep ? 'completed' : index + 1 === currentStep ? 'active' : ''}`} />
            ))}
            <span className="progress-text">{currentStep} of {totalSteps}</span>
          </div>
          
          {error && !partialSuccess && (
            <div className="wizard-alert alert-error" role="alert">{/* ★ a11y: announce errors */}
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

          {/* ★ Scroll cue — fades out automatically at the bottom */}
          <div className={`scroll-cue ${showScrollCue ? 'visible' : ''}`}>
            <span className="scroll-cue-pill">
              More below
              <span className="chev"><ChevronDown size={14} /></span>
            </span>
          </div>

        </div>
        
        {!success && !partialSuccess && (
          <div className="wizard-navigation">
            {currentStep > 1 && !loading && (
              <button className="btn btn-secondary" onClick={goBack}>
                <ChevronLeft size={20} />Back
              </button>
            )}
            
            {/* Submit phase progress indicator */}
            {renderSubmitProgress()}
            
            {currentStep < totalSteps ? (
              <button className="btn btn-primary" onClick={goNext} disabled={!canProceed()}>
                Continue<ChevronRight size={20} />
              </button>
            ) : (
              <button className={`btn btn-primary ${loading ? 'loading' : ''}`} onClick={handleSubmit} disabled={!canProceed() || loading}>
                {loading 
                  ? (SUBMIT_PHASE_MESSAGES[submitPhase] || 'Creating…')
                  : 'Create Account'
                }
                {!loading && <Sparkles size={20} />}
              </button>
            )}

            {/* Error echo near submit button so user doesn't miss it */}
            {error && !loading && currentStepData?.id === 'review' && (
              <div className="wizard-alert alert-error" style={{ marginTop: 8, width: '100%' }}>
                <AlertCircle size={16} />
                <div className="alert-content">
                  <div className="alert-message" style={{ fontSize: 13 }}>{error}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {(success || partialSuccess) && (
        <div className="confetti-container">
          {[...Array(50)].map((_, i) => <div key={i} className="confetti-piece" />)}
        </div>
      )}
    </div>
  );
};

export default CreateAccountWizard;