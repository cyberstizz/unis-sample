// src/pages/Login.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import unisLogo from '../assets/unisNoBackground.svg';
import spaceVideo from '../assets/space-bg.mp4';
import CreateAccountWizard from '../createAccountWizard'; 
import './Login.scss';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login({ email, password });
    if (result.success) {
      navigate('/');
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

      <div className="login-overlay" />

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

        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="create-account-btn"
          disabled={loading}
        >
          Don't have an account? Create one
        </button>
      </div>

      {/* THIS IS THE ONLY CHANGE — pass "show" prop, remove extra wrapper */}
      <CreateAccountWizard
        show={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          setShowWizard(false);
          navigate('/feed');
        }}
      />
    </div>
  );
};

export default Login;