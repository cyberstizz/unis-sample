// src/components/VotingWizard.js
import React, { useState } from 'react';
import './votingWizard.scss';

const VotingWizard = ({ show, onClose, onVoteSuccess, nominee, filters }) => {
  const [step, setStep] = useState(1);
  const [currentFilters, setCurrentFilters] = useState(filters);
  const [artistNameForward, setArtistNameForward] = useState('');
  const [artistNameBackward, setArtistNameBackward] = useState('');
  const [error, setError] = useState('');

  // Use the 'nominee' prop directly as the source of truth
  const selectedNominee = nominee;
  const reversedNomineeName = selectedNominee ? selectedNominee.name.split('').reverse().join('') : '';

  const handleNext = () => {
    setError('');
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleConfirmVote = (e) => {
    e.preventDefault();
    setError('');

    if (artistNameForward.toLowerCase() !== selectedNominee.name.toLowerCase()) {
      setError('The artist\'s name entered forward does not match.');
      return;
    }

    if (artistNameBackward.toLowerCase() !== reversedNomineeName.toLowerCase()) {
      setError('The artist\'s name entered backward does not match.');
      return;
    }

    onVoteSuccess(selectedNominee.id);
  };

  const renderStep = () => {
    // A simple guard clause to prevent rendering until the nominee prop is defined
    if (!selectedNominee) {
      return null;
    }

    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Confirm Your Vote</h2>
            <p className="wizard-intro">Please review your selections below. You can make changes before you confirm.</p>
            
            <div className="filter-selection-grid">
              <label>Genre</label>
              <select value={currentFilters.selectedGenre} onChange={(e) => setCurrentFilters({...currentFilters, selectedGenre: e.target.value})} className="input-field">
                <option value="rap-hiphop">Rap/Hip-Hop</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>

              <label>Category</label>
              <select value={currentFilters.selectedType} onChange={(e) => setCurrentFilters({...currentFilters, selectedType: e.target.value})} className="input-field">
                <option value="artist">Artist</option>
                <option value="song">Song</option>
              </select>

              <label>Interval</label>
              <select value={currentFilters.selectedInterval} onChange={(e) => setCurrentFilters({...currentFilters, selectedInterval: e.target.value})} className="input-field">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="midterm">Midterm</option>
                <option value="annual">Annual</option>
              </select>

              <label>Jurisdiction</label>
              <select value={currentFilters.selectedJurisdiction} onChange={(e) => setCurrentFilters({...currentFilters, selectedJurisdiction: e.target.value})} className="input-field">
                <option value="uptown-harlem">Uptown Harlem</option>
                <option value="downtown-harlem">Downtown Harlem</option>
                <option value="harlem-wide">Harlem-wide</option>
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
              <strong>{selectedNominee.name}</strong> as **{currentFilters.selectedType} of the {currentFilters.selectedInterval}**
              <br/> in **{currentFilters.selectedGenre}** and **{currentFilters.selectedJurisdiction}**
            </div>
            <p className="warning-message">This vote cannot be undone.</p>
          </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h2>Secure Your Vote</h2>
            <p className="wizard-intro">To prevent errors, please confirm your vote by typing the name of the nominee forward and backward.</p>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleConfirmVote}>
              <div className="form-group">
                <label htmlFor="forward-name">Nominee Name (Forward)</label>
                <input
                  type="text"
                  id="forward-name"
                  value={artistNameForward}
                  onChange={(e) => setArtistNameForward(e.target.value)}
                  placeholder={selectedNominee.name}
                />
              </div>
              <div className="form-group">
                <label htmlFor="backward-name">Nominee Name (Backward)</label>
                <input
                  type="text"
                  id="backward-name"
                  value={artistNameBackward}
                  onChange={(e) => setArtistNameBackward(e.target.value)}
                  placeholder={reversedNomineeName}
                />
              </div>
              <button type="submit" className="submit-vote-button">Confirm Vote</button>
            </form>
          </div>
        );
      default: return null;
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
          {step > 1 && <button onClick={() => setStep(step - 1)} className="back-button">Back</button>}
          {step < 3 && <button onClick={handleNext} className="next-button">Next</button>}
        </div>
      </div>
    </div>
  );
};

export default VotingWizard;