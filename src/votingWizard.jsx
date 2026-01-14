import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // Import Framer Motion
import { apiCall } from './components/axiosInstance';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import './votingWizard.scss';

// --- ANIMATION VARIANTS ---
const modalVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 500 } },
  exit: { opacity: 0, scale: 0.8 }
};

const iconVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.8, ease: "easeInOut" } }
};

const VotingWizard = ({ show, onClose, onVoteSuccess, nominee, userId, filters }) => {
  const [step, setStep] = useState(1);
  const [currentFilters, setCurrentFilters] = useState({
    selectedGenre: filters?.selectedGenre || 'rap-hiphop',
    selectedType: filters?.selectedType || 'artist',
    selectedInterval: filters?.selectedInterval || 'daily',
    selectedJurisdiction: filters?.selectedJurisdiction || 'uptown-harlem'
  });
  const [artistNameForward, setArtistNameForward] = useState('');
  const [artistNameBackward, setArtistNameBackward] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New State for Result Handling
  // status: 'idle', 'success', 'duplicate', 'ineligible', 'network'
  const [voteResult, setVoteResult] = useState({ status: 'idle', message: '', details: '' });

  const selectedNominee = nominee;
  const reversedNomineeName = selectedNominee ? selectedNominee.name.split('').reverse().join('') : '';

  const handleNext = () => {
    setVoteResult({ status: 'idle', message: '' });
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleConfirmVote = async (e) => {
    e.preventDefault();
    setVoteResult({ status: 'idle', message: '' });

    // Validate names (keeping your original validation)
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

      await apiCall({
        method: 'post',
        url: '/v1/vote/submit',
        data: voteData,
      });

      // 1. SUCCESS SCENARIO
      setVoteResult({ status: 'success', message: 'Vote Cast Successfully!' });
      
      // Delay closing/callback slightly so user sees the animation
      setTimeout(() => {
         // Optional: Clear form here if you want reuse without closing
         // onVoteSuccess(selectedNominee.id); 
      }, 2500);
} catch (err) {
      console.error('Vote submission failed:', err);

      // --- FIX 1: HANDLE PLAIN TEXT RESPONSES ---
      // Your Java controller returns plain strings (e.g. .body("Message")), 
      // not JSON objects. We need to handle both just in case.
      let errorMessage = '';
      if (err.response && err.response.data) {
          errorMessage = typeof err.response.data === 'string' 
              ? err.response.data 
              : err.response.data.message || JSON.stringify(err.response.data);
      } else {
          errorMessage = err.message || 'Unknown error';
      }
      
      // Normalize to lowercase for easier matching
      const lowerMsg = errorMessage.toLowerCase();
      const status = err.response?.status;

      // --- FIX 2: MATCH EXACT JAVA KEYWORDS ---
      
      // SCENARIO A: DUPLICATE VOTE
      // Java sends 409 CONFLICT with text containing "already cast"
      if (status === 409 || lowerMsg.includes('already cast')) {
        setVoteResult({ 
          status: 'duplicate', 
          message: 'Already Voted', 
          details: 'You have already cast a vote in this category for this interval.' 
        });
      } 
      
      // SCENARIO B: INELIGIBLE / DISABLED
      // Java sends 403 FORBIDDEN with text "not eligible" or "voting is not enabled"
      else if (status === 403 || lowerMsg.includes('not eligible') || lowerMsg.includes('not enabled')) {
        setVoteResult({ 
          status: 'ineligible', 
          message: 'Vote Rejected', 
          details: errorMessage // Show the exact reason from backend (e.g. "Voting is not enabled for...")
        });
      } 
      
      // SCENARIO C: BAD REQUEST / MISSING DATA
      else if (status === 400) {
         setVoteResult({ 
          status: 'error', 
          message: 'Invalid Request', 
          details: errorMessage // Shows "Genre is required", etc.
        });
      }
      
      // SCENARIO D: NETWORK / SERVER ERROR
      else {
        setVoteResult({ 
          status: 'network', 
          message: 'Connection Failed', 
          details: 'We could not reach the server. Please try again later.' 
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- NEW RENDERER FOR RESULTS ---
  const renderResult = () => {
    const { status, message, details } = voteResult;
    
    // Define UI properties based on status
    let iconColor = "#4CAF50"; // Default Green
    let IconPath = null;
    
    switch(status) {
      case 'success':
        iconColor = "#4CAF50"; // Green
        IconPath = <motion.path d="M20 6L9 17l-5-5" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={iconVariants} initial="hidden" animate="visible" />;
        break;
      case 'duplicate':
        iconColor = "#FFC107"; // Amber
        // Calendar/Clock icon style
        IconPath = <motion.path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={iconVariants} initial="hidden" animate="visible" />;
        break;
      case 'ineligible':
        iconColor = "#FF5722"; // Deep Orange
        // Lock/Ban icon style
        IconPath = (
            <motion.g variants={iconVariants} initial="hidden" animate="visible">
                <circle cx="12" cy="12" r="10" stroke={iconColor} strokeWidth="2" />
                <path d="M4.93 4.93l14.14 14.14" stroke={iconColor} strokeWidth="2" />
            </motion.g>
        );
        break;
      case 'network':
      case 'error':
        iconColor = "#F44336"; // Red
        // X icon
        IconPath = <motion.path d="M18 6L6 18M6 6l12 12" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={iconVariants} initial="hidden" animate="visible" />;
        break;
      default:
        return null;
    }

    return (
      <div className="step-content result-view">
        <div className="icon-container">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                {IconPath}
            </svg>
        </div>
        <h2 className="success-header" style={{ color: iconColor }}>{message}</h2>
        <p className="wizard-intro">{details}</p>
        {status === 'success' && (
             <p className="success-nominee">You voted for <strong>{selectedNominee.name}</strong></p>
        )}
        
        <div className="button-group-result">
            {status === 'success' ? (
                <button className="next-button" style={{textAlign: 'center', alignSelf: 'center', justifyContent: 'center', alignContent: 'center', justifySelf: 'center'}} onClick={() => onVoteSuccess(selectedNominee.id)}>Done</button>
            ) : (
                <button className="back-button" onClick={() => setVoteResult({ status: 'idle' })}>Try Again</button>
            )}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    // If we have a result status (not idle), show the Result View instead of the form steps
    if (voteResult.status !== 'idle') {
        return renderResult();
    }

    // ... Existing Step Switch Logic (Case 1, 2, 3) ...
    // Note: I removed the error display from Case 3 because errors are now handled by renderResult
    if (!selectedNominee) return null;

    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Confirm Your Vote For:</h2>
            <h2 className='nominee-name'>{selectedNominee.name}</h2>
            <p className="wizard-intro">
              Please review your selections below.
            </p>
            
            <div className="filter-selection-grid">
              
              {/* --- 🔒 LOCKED FIELD: GENRE --- */}
              <label>Genre</label>
              <div className="locked-input">
                {/* Display a nice readable label instead of the raw value */}
                {currentFilters.selectedGenre === 'rap-hiphop' ? 'Rap/Hip-Hop' : 
                 currentFilters.selectedGenre === 'rock' ? 'Rock' : 
                 currentFilters.selectedGenre === 'pop' ? 'Pop' : currentFilters.selectedGenre}
              </div>

              {/* --- 🔒 LOCKED FIELD: CATEGORY --- */}
              <label>Category</label>
              <div className="locked-input">
                 {/* Capitalize the first letter for looks */}
                 {currentFilters.selectedType.charAt(0).toUpperCase() + currentFilters.selectedType.slice(1)}
              </div>

              {/* --- 🔓 ACTIVE FIELD: INTERVAL --- */}
              <label>Interval</label>
              <select 
                value={currentFilters.selectedInterval} 
                onChange={(e) => setCurrentFilters({...currentFilters, selectedInterval: e.target.value})} 
                className="input-field"
              >
                <option value="daily">Day</option>
                <option value="weekly">Week</option>
                <option value="monthly">Month</option>
                <option value="quarterly">Quarter</option>
                <option value="annual">Year</option>
              </select>

              {/* --- 🔓 ACTIVE FIELD: JURISDICTION --- */}
              <label>Jurisdiction</label>
              <select 
                value={currentFilters.selectedJurisdiction} 
                onChange={(e) => setCurrentFilters({...currentFilters, selectedJurisdiction: e.target.value})} 
                className="input-field"
              >
                <option value="uptown-harlem">Uptown Harlem</option>
                <option value="downtown-harlem">Downtown Harlem</option>
                <option value="harlem-wide">Harlem-Wide</option>
              </select>
            </div>
          </div>
        );
      case 2:
        return (
             // ... (Your existing Case 2 JSX) ...
             <div className="step-content">
             <h2>Final Confirmation</h2>
             <p className="wizard-intro">You are about to cast your vote for:</p>
             <div className="confirmation-summary">
               <strong>{selectedNominee.name}</strong> as{' '}
               <strong>{currentFilters.selectedType} of the {currentFilters.selectedInterval}</strong>
               <br/>
               in <strong>{currentFilters.selectedGenre}</strong> and{' '}
               <strong>{currentFilters.selectedJurisdiction}</strong>
             </div>
             <p className="warning-message">This vote cannot be undone.</p>
           </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h2>Secure Your Vote</h2>
            <p className="wizard-intro">
              To prevent errors, please confirm your vote by typing the name forward and backward.
            </p>
            {/* Note: Standard error display removed here, handled by Result View */}
            <form onSubmit={handleConfirmVote}>
              <div className="form-group">
                <label htmlFor="forward-name">Name (Forward)</label>
                <input
                  type="text"
                  id="forward-name"
                  value={artistNameForward}
                  onChange={(e) => setArtistNameForward(e.target.value)}
                  placeholder={selectedNominee.name}
                  disabled={submitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="backward-name">Name (Backward)</label>
                <input
                  type="text"
                  id="backward-name"
                  value={artistNameBackward}
                  onChange={(e) => setArtistNameBackward(e.target.value)}
                  placeholder={reversedNomineeName}
                  disabled={submitting}
                />
              </div>
              <button 
                type="submit" 
                className="submit-vote-button"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Confirm Vote'}
              </button>
            </form>
          </div>
        );
      default: 
        return null;
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div className="voting-wizard-overlay" onClick={onClose}>
        {/* AnimatePresence allows for exit animations when the modal closes */}
        <AnimatePresence>
            <motion.div 
                className="voting-wizard" 
                onClick={e => e.stopPropagation()}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <button className="close-button" onClick={onClose}>&times;</button>
                
                {renderStep()}

                {/* Only show Back/Next buttons if we are NOT in result mode */}
                {voteResult.status === 'idle' && (
                    <div className="button-group">
                    {step > 1 && (
                        <button 
                        onClick={() => setStep(step - 1)} 
                        className="back-button"
                        disabled={submitting}
                        >
                        Back
                        </button>
                    )}
                    {step < 3 && (
                        <button 
                        onClick={handleNext} 
                        className="next-button"
                        >
                        Next
                        </button>
                    )}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    </div>
  );
};

export default VotingWizard;