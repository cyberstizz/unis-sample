import React, { useState } from 'react';
import { apiCall } from './components/axiosInstance';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import './votingWizard.scss';

const VotingWizard = ({ show, onClose, onVoteSuccess, nominee, userId, filters }) => {
  const [step, setStep] = useState(1);
  const [currentFilters, setCurrentFilters] = useState(filters);
  const [artistNameForward, setArtistNameForward] = useState('');
  const [artistNameBackward, setArtistNameBackward] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedNominee = nominee;
  const reversedNomineeName = selectedNominee ? selectedNominee.name.split('').reverse().join('') : '';

  const handleNext = () => {
    setError('');
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleConfirmVote = async (e) => {
    e.preventDefault();
    setError('');

    // Validate names
    if (artistNameForward.toLowerCase() !== selectedNominee.name.toLowerCase()) {
      setError('The name entered forward does not match.');
      return;
    }

    if (artistNameBackward.toLowerCase() !== reversedNomineeName.toLowerCase()) {
      setError('The name entered backward does not match.');
      return;
    }

    setSubmitting(true);

    try {
      // Submit vote to backend
      const voteData = {
        userId: userId,
        targetType: currentFilters.selectedType,
        targetId: selectedNominee.id,
        genreId: GENRE_IDS[currentFilters.selectedGenre],
        jurisdictionId: JURISDICTION_IDS[currentFilters.selectedJurisdiction],
        intervalId: INTERVAL_IDS[currentFilters.selectedInterval],
        voteDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      };

      await apiCall({
        method: 'post',
        url: '/v1/vote/submit',
        data: voteData,
      });

      // Reset form
      setArtistNameForward('');
      setArtistNameBackward('');
      setStep(1);
      
      onVoteSuccess(selectedNominee.id);
    } catch (err) {
      console.error('Vote submission failed:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message.includes('already exists')) {
        setError('You have already voted in this category today.');
      } else {
        setError('Failed to submit vote. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (!selectedNominee) {
      return null;
    }

    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Confirm Your Vote For:</h2>
            <h2 className='nominee-name'>{selectedNominee.name}</h2>
            <p className="wizard-intro">
              Please review your selections below. You can make changes before you confirm.
            </p>
            
            <div className="filter-selection-grid">
              <label>Genre</label>
              <select 
                value={currentFilters.selectedGenre} 
                onChange={(e) => setCurrentFilters({...currentFilters, selectedGenre: e.target.value})} 
                className="input-field"
              >
                <option value="rap-hiphop">Rap/Hip-Hop</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>

              <label>Category</label>
              <select 
                value={currentFilters.selectedType} 
                onChange={(e) => setCurrentFilters({...currentFilters, selectedType: e.target.value})} 
                className="input-field"
              >
                <option value="artist">Artist</option>
                <option value="song">Song</option>
              </select>

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
            {error && <p className="error-message">{error}</p>}
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
      <div className="voting-wizard" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        {renderStep()}
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
      </div>
    </div>
  );
};

export default VotingWizard;