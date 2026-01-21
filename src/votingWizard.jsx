import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; 
import { apiCall } from './components/axiosInstance';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import confetti from 'canvas-confetti'; 
import './votingWizard.scss';
import unisLogo from './assets/unisLogoThree.svg';

// --- ANIMATION VARIANTS ---
const modalVariants = { 
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 500 } },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } }
};

const iconVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.8, ease: "easeInOut" } }
};

const VotingWizard = ({ show, onClose, onVoteSuccess, nominee, userId, filters }) => {
  const [step, setStep] = useState(1);
  const [currentFilters, setCurrentFilters] = useState({
    selectedGenre: nominee?.genreKey || filters?.selectedGenre || 'rap-hiphop',
    selectedType: nominee?.type || filters?.selectedType || 'artist',
    selectedInterval: filters?.selectedInterval || 'daily',
    selectedJurisdiction: '' // Will set to nominee's home below
  });
  const [artistNameForward, setArtistNameForward] = useState('');
  const [artistNameBackward, setArtistNameBackward] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [eligibleJurisdictionIds, setEligibleJurisdictionIds] = useState([]);
  const [isFetchingJurisdictions, setIsFetchingJurisdictions] = useState(false);

  // status: 'idle', 'success', 'duplicate', 'ineligible', 'network', 'error'
  const [voteResult, setVoteResult] = useState({ status: 'idle', message: '', details: '' });

  const selectedNominee = nominee;
  
  // Memoized reversed name for accuracy in Step 3
  const reversedNomineeName = useMemo(() => 
    selectedNominee ? selectedNominee.name.split('').reverse().join('') : '', 
    [selectedNominee]
  );

  // Helper to get key from ID
  const getKeyFromId = (id) => Object.keys(JURISDICTION_IDS).find(key => JURISDICTION_IDS[key] === id);

  // --- RESET STATE ON OPEN + DEFAULT TO NOMINEE'S HOME JURISDICTION ---
  useEffect(() => {
    if (show) {
      setStep(1);
      setVoteResult({ status: 'idle', message: '', details: '' });
      setArtistNameForward('');
      setArtistNameBackward('');
      setSubmitting(false);
      setEligibleJurisdictionIds([]);
      const homeKey = getKeyFromId(nominee?.jurisdiction?.jurisdictionId);
      setCurrentFilters(prev => ({ 
        ...prev, 
        selectedJurisdiction: homeKey || filters?.selectedJurisdiction || 'harlem' 
      }));
    }
  }, [show, nominee, filters]);

  // --- FETCH ELIGIBLE JURISDICTIONS (BREADCRUMB) ---
  useEffect(() => {
    if (!show || !nominee) return;

    const fetchEligibleJurisdictions = async () => {
      setIsFetchingJurisdictions(true);
      
      // Get jurisdiction ID - handle both object and string cases
      let nomineeJurisdictionId = null;
      
      if (nominee.jurisdiction) {
        if (typeof nominee.jurisdiction === 'object' && nominee.jurisdiction.jurisdictionId) {
          // Case 1: Full jurisdiction object (ideal)
          nomineeJurisdictionId = nominee.jurisdiction.jurisdictionId;
        } else if (typeof nominee.jurisdiction === 'string') {
          // Case 2: Just a jurisdiction name string - look up the ID
          const jurisdictionName = nominee.jurisdiction.toLowerCase().replace(/\s+/g, '-');
          nomineeJurisdictionId = JURISDICTION_IDS[jurisdictionName];
        }
      }
      
      // If we don't have jurisdiction from nominee, fetch it from backend
      if (!nomineeJurisdictionId && nominee.id && nominee.type) {
        try {
          console.log('Jurisdiction missing from nominee, fetching from backend...');
          const endpoint = nominee.type === 'artist' 
            ? `/v1/users/${nominee.id}`
            : `/v1/media/song/${nominee.id}`;
          
          const response = await apiCall({ method: 'get', url: endpoint });
          const fetchedJurisdiction = response.data.jurisdiction;
          
          if (fetchedJurisdiction?.jurisdictionId) {
            nomineeJurisdictionId = fetchedJurisdiction.jurisdictionId;
            console.log('Fetched jurisdiction from backend:', fetchedJurisdiction.name);
          }
        } catch (err) {
          console.error('Failed to fetch nominee details for jurisdiction:', err);
        }
      }
      
      // If we still don't have an ID, use fallback hardcoded logic
      if (!nomineeJurisdictionId) {
        console.warn('Could not determine nominee jurisdiction ID, using hardcoded fallback');
        setEligibleJurisdictionIds(Object.values(JURISDICTION_IDS));
        setIsFetchingJurisdictions(false);
        return;
      }

      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${nomineeJurisdictionId}/breadcrumb`
        });
        
        // Extract jurisdiction IDs from breadcrumb response
        const eligibleIds = response.data
          .filter(j => j.votingEnabled !== false)
          .map(j => j.jurisdictionId);
        
        setEligibleJurisdictionIds(eligibleIds);
        
        // Auto-correct if current selection is invalid for this nominee
        const currentId = JURISDICTION_IDS[currentFilters.selectedJurisdiction];
        if (currentId && !eligibleIds.includes(currentId)) {
          const homeKey = getKeyFromId(nomineeJurisdictionId);
          if (homeKey) {
            setCurrentFilters(prev => ({ ...prev, selectedJurisdiction: homeKey }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch eligible jurisdictions:', err);
        
        // Fallback: Use nominee's home jurisdiction + parent (Harlem) for the 3 active jurisdictions
        const homeKey = getKeyFromId(nomineeJurisdictionId);
        let fallbackEligibleIds = [];
        
        if (homeKey === 'downtown-harlem' || homeKey === 'uptown-harlem') {
          fallbackEligibleIds = [
            JURISDICTION_IDS[homeKey], 
            JURISDICTION_IDS['harlem']
          ];
        } else if (homeKey === 'harlem') {
          fallbackEligibleIds = [JURISDICTION_IDS['harlem']];
        } else {
          // Unknown jurisdiction - show all
          fallbackEligibleIds = Object.values(JURISDICTION_IDS);
        }
        
        setEligibleJurisdictionIds(fallbackEligibleIds);
      } finally {
        setIsFetchingJurisdictions(false);
      }
    };
    
    fetchEligibleJurisdictions();
  }, [show, nominee]);

  // Helper to check if a jurisdiction option should be rendered
  const isJurisdictionEligible = (optionKey) => {
    // If we haven't fetched yet, don't show anything (prevents flash of wrong options)
    if (isFetchingJurisdictions) return false;
    
    // If fetch completed but got no results, fallback to showing all (shouldn't happen but safe)
    if (!isFetchingJurisdictions && eligibleJurisdictionIds.length === 0) {
      console.warn('No eligible jurisdictions found, showing all as fallback');
      return true;
    }
    
    const jurisdictionId = JURISDICTION_IDS[optionKey];
    const isEligible = eligibleJurisdictionIds.includes(jurisdictionId);
    
    return isEligible;
  };

  // --- FIREWORKS ON SUCCESS ---
  useEffect(() => {
    if (voteResult.status === 'success') {
      triggerFireworks();
    }
  }, [voteResult.status]);

  const triggerFireworks = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const unisColors = ['#163387', '#C0C0C0', '#918f8f', '#000000', '#ffffff'];

    const defaults = { 
      startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999, colors: unisColors 
    };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const handleNext = () => {
    setVoteResult({ status: 'idle', message: '' });
    if (step < 3) setStep(step + 1);
  };

  // Sync filters if nominee changes (genre/type only, jurisdiction handled above)
  useEffect(() => {
    if (nominee) {
      setCurrentFilters(prev => ({
        ...prev,
        selectedGenre: nominee.genreKey || filters?.selectedGenre || 'rap-hiphop',
        selectedType: nominee.type || filters?.selectedType || 'artist',
        selectedInterval: prev.selectedInterval || filters?.selectedInterval || 'daily',
      }));
    }
  }, [nominee, filters]);

  const handleConfirmVote = async (e) => {
    e.preventDefault();
    setVoteResult({ status: 'idle', message: '' });

    if (artistNameForward.toLowerCase() !== selectedNominee.name.toLowerCase()) {
      setVoteResult({ status: 'error', message: 'Name Forward Invalid', details: 'The name entered forward does not match.' });
      return;
    }
    if (artistNameBackward.toLowerCase() !== reversedNomineeName.toLowerCase()) {
      setVoteResult({ status: 'error', message: 'Name Backward Invalid', details: 'The name entered backward does not match.' });
      return;
    }

    setSubmitting(true);

    try {
      const genreIdToSend = GENRE_IDS[currentFilters.selectedGenre];
      const voteData = {
        userId: userId,
        targetType: currentFilters.selectedType,
        targetId: selectedNominee.id,
        genreId: genreIdToSend,
        jurisdictionId: JURISDICTION_IDS[currentFilters.selectedJurisdiction],
        intervalId: INTERVAL_IDS[currentFilters.selectedInterval],
        voteDate: new Date().toISOString().split('T')[0],
      };


      console.log('=== VOTE DATA BEING SENT ===');
      console.log('Nominee jurisdiction ID:', nominee?.jurisdiction?.jurisdictionId);
      console.log('Selected jurisdiction key:', currentFilters.selectedJurisdiction);
      console.log('Mapped jurisdiction UUID:', JURISDICTION_IDS[currentFilters.selectedJurisdiction]);
      console.log('Full voteData:', voteData);

      await apiCall({ method: 'post', url: '/v1/vote/submit', data: voteData });
      setVoteResult({ status: 'success', message: 'Vote Recorded' });

    } catch (err) {
      console.error('Vote submission failed:', err);
      let errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      const status = err.response?.status;

      if (status === 409) {
        setVoteResult({ status: 'duplicate', message: 'Already Voted', details: 'You have already cast a vote in this category for this interval.' });
      } else if (status === 403) {
        setVoteResult({ status: 'ineligible', message: 'Vote Rejected', details: errorMessage });
      } else {
        setVoteResult({ status: 'network', message: 'Connection Failed', details: 'We could not reach the server.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- REFINED RENDERER FOR RESULTS ---
  const renderResult = () => {
    const { status, message, details } = voteResult;
    
    let iconColor = "#4CAF50"; 
    let IconPath = null;
    
    switch(status) {
      case 'success':
        iconColor = "#163387";
        IconPath = <motion.path d="M20 6L9 17l-5-5" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={iconVariants} initial="hidden" animate="visible" />;
        break;
      case 'duplicate':
        iconColor = "#FFC107"; 
        IconPath = <motion.path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={iconVariants} initial="hidden" animate="visible" />;
        break;
      case 'ineligible':
        iconColor = "#FF5722"; 
        IconPath = (
            <motion.g variants={iconVariants} initial="hidden" animate="visible">
                <circle cx="12" cy="12" r="10" stroke={iconColor} strokeWidth="2" />
                <path d="M4.93 4.93l14.14 14.14" stroke={iconColor} strokeWidth="2" />
            </motion.g>
        );
        break;
      default:
        iconColor = "#F44336"; 
        IconPath = <motion.path d="M18 6L6 18M6 6l12 12" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={iconVariants} initial="hidden" animate="visible" />;
    }

    const formatText = (str) => str ? str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

    return (
      <div className="step-content result-view">
        <img src={unisLogo} alt="Unis Logo" className="unis-logo-result"/>
        
        <div className="icon-container" style={{borderColor: status === 'success' ? '#163387' : iconColor}}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {IconPath}
            </svg>
        </div>

        <h2 className="result-header" style={{ color: status === 'success' ? '#163387' : iconColor }}>{message}</h2>
        
        {status === 'success' ? (
            <div className="vote-receipt">
                <p className="receipt-label">CONFIRMED NOMINEE</p>
                <h3 className="receipt-name">{selectedNominee.name}</h3>
                
                <div className="receipt-divider"></div>
                
                <div className="receipt-meta-grid">
                    <div className="meta-item">
                        <span className="meta-label">Type</span>
                        <span className="meta-value">{formatText(currentFilters.selectedType)}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Interval</span>
                        <span className="meta-value">{formatText(currentFilters.selectedInterval)}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Jurisdiction</span>
                        <span className="meta-value">{formatText(currentFilters.selectedJurisdiction)}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Genre</span>
                        <span className="meta-value">{formatText(currentFilters.selectedGenre)}</span>
                    </div>
                </div>
            </div>
        ) : (
            <p className="error-details">{details}</p>
        )}
        
        <div className="button-group-result">
            {status === 'success' ? (
                <button className="done-button" onClick={() => onVoteSuccess(selectedNominee.id)}>Close</button>
            ) : (
                <button className="back-button" onClick={() => setVoteResult({ status: 'idle' })}>Try Again</button>
            )}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    if (voteResult.status !== 'idle') return renderResult();
    if (!selectedNominee) return null;

    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Confirm Your Vote For:</h2>
            <h2 className='nominee-name'>{selectedNominee.name}</h2>
            <p className="wizard-intro">Please review your selections below.</p>
            <div className="filter-selection-grid">
              <label>Genre</label>
              <div className="locked-input">{currentFilters.selectedGenre.replace(/-/g, ' ').toUpperCase()}</div>
              <label>Category</label>
              <div className="locked-input">{currentFilters.selectedType.toUpperCase()}</div>
              <label>Interval</label>
              <select value={currentFilters.selectedInterval} onChange={(e) => setCurrentFilters({...currentFilters, selectedInterval: e.target.value})} className="input-field">
                <option value="daily">Day</option>
                <option value="weekly">Week</option>
                <option value="monthly">Month</option>
                <option value="quarterly">Quarter</option>
                <option value="annual">Year</option>
              </select>
              <label>Jurisdiction</label>
              <select 
                value={currentFilters.selectedJurisdiction} 
                onChange={(e) => setCurrentFilters({...currentFilters, selectedJurisdiction: e.target.value})} 
                className="input-field"
                disabled={isFetchingJurisdictions}
              >
                {isFetchingJurisdictions ? (
                  <option>Loading jurisdictions...</option>
                ) : (
                  // FIXED: Filter first, then map to avoid rendering false values
                  Object.keys(JURISDICTION_IDS)
                    .filter(key => isJurisdictionEligible(key))
                    .map(key => (
                      <option key={key} value={key}>
                        {key.replace(/-/g, ' ').toUpperCase()}
                      </option>
                    ))
                )}
              </select>
            </div>
          </div>
        );
      case 2:
        return (
             <div className="step-content">
             <h2>Final Confirmation</h2>
             <p className="wizard-intro">You are about to cast your vote for:</p>
             <div className="confirmation-summary">
               <strong>{selectedNominee.name}</strong> as <strong>{currentFilters.selectedType}</strong><br/>
               of the <strong>{currentFilters.selectedInterval}</strong><br/>
               in <strong>{currentFilters.selectedGenre}</strong>
             </div>
             <p className="warning-message">This vote cannot be undone.</p>
           </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h2>Secure Your Vote</h2>
            <p className="wizard-intro">To prevent errors, please confirm by typing the name forward and backward.</p>
            <form onSubmit={handleConfirmVote}>
              <div className="form-group">
                <label>Name (Forward) — <strong>{selectedNominee.name}</strong></label>
                <input 
                  type="text" 
                  value={artistNameForward} 
                  onChange={(e) => setArtistNameForward(e.target.value)} 
                  placeholder="Type the name forward..." 
                  disabled={submitting} 
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>(Backward) — <span style={{color: "blue" }}>{reversedNomineeName}</span></label>
                <input 
                  type="text" 
                  value={artistNameBackward} 
                  onChange={(e) => setArtistNameBackward(e.target.value)} 
                  placeholder="Type the name backward..."
                  disabled={submitting} 
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="submit-vote-button" disabled={submitting}>{submitting ? 'Submitting...' : 'Confirm Vote'}</button>
            </form>
          </div>
        );
      default: return null;
    }
  };

  if (!show) return null;

  return (
    <div className="voting-wizard-overlay" onClick={onClose}>
        <AnimatePresence>
            <motion.div 
                className={`voting-wizard ${voteResult.status === 'success' ? 'success-glow' : ''}`}
                onClick={e => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <button className="close-button" onClick={onClose}>&times;</button>
                {renderStep()}
                {voteResult.status === 'idle' && (
                    <div className="button-group">
                    {step > 1 && <button onClick={() => setStep(step - 1)} className="back-button" disabled={submitting}>Back</button>}
                    {step < 3 && <button onClick={handleNext} className="next-button">Next</button>}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    </div>
  );
};

export default VotingWizard;