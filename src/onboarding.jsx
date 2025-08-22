// src/components/Onboarding.js
import React, { useState } from 'react';
import './Onboarding.scss';
import unisLogo from './assets/unisLogo.jpg';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    inviteCode: '',
    role: '',
    email: '',
    password: '',
    address: '',
    supportedArtistId: null,
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    // Placeholder for validation/API (focus on UI)
    setError(''); // Clear errors for demo
    if (step < 5) setStep(step + 1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>Welcome to Unis!</h2>
            <p>Enter your invite code to join the Harlem music revolution.</p>
            <input name="inviteCode" onChange={handleChange} placeholder="Invite Code" className="input-field" />
          </div>
        );
      case 2:
        return (
          <div className="step-content">
            <h2>Choose Your Role</h2>
            <div className="role-selection">
              <label className="role-card">
                <input type="radio" name="role" value="listener" onChange={handleChange} />
                Listener
              </label>
              <label className="role-card">
                <input type="radio" name="role" value="artist" onChange={handleChange} />
                Artist
              </label>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h2>Sign Up</h2>
            <input name="email" onChange={handleChange} placeholder="Email" className="input-field" />
            <input name="password" type="password" onChange={handleChange} placeholder="Password" className="input-field" />
            <input name="address" onChange={handleChange} placeholder="Your Harlem Address" className="input-field" />
          </div>
        );
      case 4:
        if (formData.role === 'artist') { setStep(5); return null; }
        return (
          <div className="step-content">
            <h2>Support an Artist</h2>
            <p className="callout">50% of your revenue supports them—change monthly!</p>
            <select name="supportedArtistId" onChange={handleChange} className="input-field">
              <option value="">Search Artists...</option>
              {/* Dynamic options */}
            </select>
          </div>
        );
      case 5:
        return (
          <div className="step-content">
            <h2>Confirm & Join</h2>
            <p>Ready to empower Harlem's music? Role: {formData.role || 'N/A'}</p>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="onboarding-container">
      <img src={unisLogo} alt="UNIS Logo" className="logo" />
      <div className="progress-bar">
        {[1, 2, 3, 4, 5].map((s) => <div key={s} className={`progress-dot ${s <= step ? 'active' : ''}`} />)}
      </div>
      {error && <p className="error-message">{error}</p>}
      {renderStep()}
      <div className="button-group">
        {step > 1 && <button onClick={() => setStep(step - 1)} className="back-button">Back</button>}
        <button onClick={handleNext} className="next-button">Next</button>
      </div>
      <footer className="footer">Privacy Policy</footer>
    </div>
  );
};

export default Onboarding;