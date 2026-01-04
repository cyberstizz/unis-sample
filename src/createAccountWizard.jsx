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


const WelcomeIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="60" r="30" fill="white" opacity="0.9"/>
    <ellipse cx="100" cy="140" rx="45" ry="50" fill="white" opacity="0.9"/>
    <path d="M55 100 Q30 90 15 110" stroke="white" strokeWidth="12" strokeLinecap="round" opacity="0.9"/>
    <path d="M145 100 Q170 90 185 110" stroke="white" strokeWidth="12" strokeLinecap="round" opacity="0.9"/>
    <rect x="80" y="120" width="40" height="35" rx="4" fill="rgba(0,0,0,0.2)"/>
    <path d="M100 120 V155 M80 135 H120" stroke="white" strokeWidth="3"/>
    <path d="M90 120 Q100 105 110 120" stroke="white" strokeWidth="3" fill="none"/>
    <circle cx="30" cy="50" r="4" fill="white" opacity="0.6"/>
    <circle cx="170" cy="70" r="3" fill="white" opacity="0.5"/>
  </svg>
);

const BasicInfoIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="55" r="28" fill="white" opacity="0.9"/>
    <ellipse cx="100" cy="130" rx="40" ry="45" fill="white" opacity="0.9"/>
    <path d="M60 115 Q40 130 45 150" stroke="white" strokeWidth="10" strokeLinecap="round" opacity="0.9"/>
    <path d="M140 115 Q160 130 155 150" stroke="white" strokeWidth="10" strokeLinecap="round" opacity="0.9"/>
    <rect x="35" y="155" width="130" height="25" rx="6" fill="rgba(0,0,0,0.2)"/>
    <rect x="45" y="162" width="15" height="10" rx="2" fill="white" opacity="0.5"/>
    <rect x="65" y="162" width="15" height="10" rx="2" fill="white" opacity="0.5"/>
    <rect x="85" y="162" width="30" height="10" rx="2" fill="white" opacity="0.7"/>
    <circle cx="90" cy="50" r="4" fill="rgba(0,0,0,0.3)"/>
    <circle cx="110" cy="50" r="4" fill="rgba(0,0,0,0.3)"/>
  </svg>
);

const LocationIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="100" r="70" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="2" strokeDasharray="8 4"/>
    <circle cx="100" cy="100" r="45" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="2" strokeDasharray="8 4"/>
    <path d="M100 30 C70 30 50 55 50 85 C50 120 100 170 100 170 C100 170 150 120 150 85 C150 55 130 30 100 30Z" fill="white" opacity="0.9"/>
    <circle cx="100" cy="70" r="15" fill="rgba(0,0,0,0.2)"/>
    <ellipse cx="100" cy="105" rx="18" ry="20" fill="rgba(0,0,0,0.2)"/>
  </svg>
);

const RoleSelectionIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="60" cy="60" r="22" fill="white" opacity="0.9"/>
    <ellipse cx="60" cy="120" rx="28" ry="35" fill="white" opacity="0.9"/>
    <path d="M38 50 Q30 45 30 60 Q30 75 40 70" stroke="white" strokeWidth="6" fill="none" opacity="0.9"/>
    <path d="M82 50 Q90 45 90 60 Q90 75 80 70" stroke="white" strokeWidth="6" fill="none" opacity="0.9"/>
    <circle cx="140" cy="60" r="22" fill="white" opacity="0.9"/>
    <ellipse cx="140" cy="120" rx="28" ry="35" fill="white" opacity="0.9"/>
    <rect x="155" y="45" width="8" height="25" rx="4" fill="rgba(0,0,0,0.3)"/>
    <circle cx="159" cy="42" r="10" fill="rgba(0,0,0,0.2)"/>
    <circle cx="100" cy="110" r="4" fill="white" opacity="0.4"/>
  </svg>
);

const ArtistProfileIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="55" r="30" fill="white" opacity="0.9"/>
    <ellipse cx="100" cy="130" rx="42" ry="48" fill="white" opacity="0.9"/>
    <ellipse cx="100" cy="35" rx="35" ry="12" fill="rgba(0,0,0,0.2)"/>
    <path d="M70 35 Q100 10 130 35" fill="rgba(0,0,0,0.2)"/>
    <path d="M145 100 Q170 90 175 75" stroke="white" strokeWidth="10" strokeLinecap="round" opacity="0.9"/>
    <circle cx="35" cy="80" r="15" fill="white" opacity="0.4"/>
    <circle cx="25" cy="120" r="10" fill="white" opacity="0.3"/>
    <polygon points="165,140 168,148 177,148 170,153 173,162 165,157 157,162 160,153 153,148 162,148" fill="white" opacity="0.5"/>
  </svg>
);

const SongUploadIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="65" r="28" fill="white" opacity="0.9"/>
    <ellipse cx="100" cy="140" rx="38" ry="45" fill="white" opacity="0.9"/>
    <path d="M62 110 Q45 80 55 55" stroke="white" strokeWidth="10" strokeLinecap="round" opacity="0.9"/>
    <path d="M138 110 Q155 80 145 55" stroke="white" strokeWidth="10" strokeLinecap="round" opacity="0.9"/>
    <path d="M75 45 L75 25 L85 20 L85 40 Q85 48 77 48 Q70 48 70 40 Q70 33 77 33 Q82 33 85 38" stroke="white" strokeWidth="2" fill="white" opacity="0.7"/>
    <path d="M50 100 Q40 90 50 80" stroke="white" strokeWidth="3" fill="none" opacity="0.4"/>
    <path d="M150 100 Q160 90 150 80" stroke="white" strokeWidth="3" fill="none" opacity="0.4"/>
  </svg>
);

const SupportArtistIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="55" r="25" fill="white" opacity="0.95"/>
    <ellipse cx="100" cy="115" rx="30" ry="35" fill="white" opacity="0.95"/>
    <polygon points="100,15 103,22 111,22 105,27 107,35 100,31 93,35 95,27 89,22 97,22" fill="white" opacity="0.8"/>
    <circle cx="40" cy="85" r="18" fill="white" opacity="0.6"/>
    <ellipse cx="40" cy="130" rx="22" ry="28" fill="white" opacity="0.6"/>
    <circle cx="160" cy="85" r="18" fill="white" opacity="0.6"/>
    <ellipse cx="160" cy="130" rx="22" ry="28" fill="white" opacity="0.6"/>
    <path d="M70 90 L60 80 Q55 70 65 70 Q70 70 70 78 Q70 70 75 70 Q85 70 80 80 L70 90Z" fill="white" opacity="0.7"/>
    <path d="M130 90 L120 80 Q115 70 125 70 Q130 70 130 78 Q130 70 135 70 Q145 70 140 80 L130 90Z" fill="white" opacity="0.7"/>
  </svg>
);

const ReviewIllustration = () => (
  <svg className="illustration-svg" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="55" r="28" fill="white" opacity="0.9"/>
    <ellipse cx="100" cy="130" rx="38" ry="45" fill="white" opacity="0.9"/>
    <path d="M62 110 Q40 70 30 40" stroke="white" strokeWidth="10" strokeLinecap="round" opacity="0.9"/>
    <path d="M138 110 Q160 70 170 40" stroke="white" strokeWidth="10" strokeLinecap="round" opacity="0.9"/>
    <rect x="25" y="30" width="8" height="8" fill="white" opacity="0.6" transform="rotate(45 29 34)"/>
    <circle cx="45" cy="60" r="4" fill="white" opacity="0.5"/>
    <circle cx="155" cy="55" r="5" fill="white" opacity="0.4"/>
    <circle cx="100" cy="175" r="15" fill="rgba(0,0,0,0.2)"/>
    <path d="M92 175 L98 181 L110 169" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const STEP_ILLUSTRATIONS = {
  welcome: WelcomeIllustration,
  basicInfo: BasicInfoIllustration,
  location: LocationIllustration,
  role: RoleSelectionIllustration,
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
        audioRef.current.src = response.data.fileUrl;
        audioRef.current.play();
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
      if (formData.role === 'artist' && formData.artistPhotoFile) {
        const photoFormData = new FormData();
        photoFormData.append('photo', formData.artistPhotoFile);
        
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
        bio: formData.bio || null,
        genreId: formData.role === 'artist' ? formData.genreId : null,
      };
      
      const registerResponse = await apiCall({
        url: '/v1/users/register',
        method: 'post',
        data: registerPayload,
      });
      
      const newUser = registerResponse.data;
      
      if (formData.role === 'artist' && formData.songFile) {
        const songFormData = new FormData();
        songFormData.append('file', formData.songFile);
        songFormData.append('title', formData.songTitle);
        songFormData.append('genreId', formData.genreId);
        songFormData.append('jurisdictionId', formData.jurisdictionId);
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
              <h2>Welcome to Unis</h2>
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
              <h2>Where You From?</h2>
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
                        <img src={artist.photoUrl} alt={artist.username} className="artist-photo" />
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
                        {playingArtistId === artist.userId ? <Pause size={20} /> : <Play size={20} />}
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