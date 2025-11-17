import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import unisLogo from '../assets/unisNoBackground.svg';
import spaceVideo from '../assets/space-bg.mp4';   
import CreateAccountWizard from '../CreateAccountWizard';  // Ensure imported
import './Login.scss';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [showWizard, setShowWizard] = useState(false);  // NEW: Wizard state (if not already)
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login({ email, password });
    if (result.success) {
      navigate('/');  // Or /feed
    } else {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      <video
        className="login-bg-video"
        autoPlay
        loop
        muted
        playsInline
        src={spaceVideo}
      />

      {/* ---- 2. Dark overlay (optional, improves contrast) ---- */}
      <div className="login-overlay" />

      {/* ---- 3. Centered login card ---- */}
      <div className="login-card">
        <img src={unisLogo} alt="UNIS" className="login-logo" />

        <h2 className="login-title">Welcome back</h2>

        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        {/* FIXED: type="button" prevents form submit; styled to match your design */}
        <button 
          type="button"  // NEW: Prevents submit
          onClick={() => setShowWizard(true)} 
          className="create-account-btn"
          disabled={loading}  // Optional: Disable during login
        >
          Don't have an account? Create one
        </button>
      </div>

      {/* FIXED: Move overlay here (outside form/card) for full-screen on top of bg */}
      {showWizard && (
        <div className="wizard-overlay">
          <CreateAccountWizard 
            onClose={() => setShowWizard(false)} 
            onSuccess={() => {
              setShowWizard(false);
              // Optional: Auto-login if wizard returns token, then navigate
              navigate('/feed');
            }} 
          />
        </div>
      )}
    </div>
  );
};

export default Login;