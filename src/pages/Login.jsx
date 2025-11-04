import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; 
import { useNavigate } from 'react-router-dom';
import './Login.scss';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); 
  const [loading, setLoading] = useState(false);  
  const navigate = useNavigate();
  const { login } = useAuth();  

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login({ email, password });  
    if (result.success) {
      
      const successMsg = document.createElement('div');
      successMsg.textContent = 'Login successful! Welcome back.';
      successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 10px 20px; border-radius: 4px; z-index: 1001;';
      document.body.appendChild(successMsg);
      setTimeout(() => document.body.removeChild(successMsg), 3000);
      navigate('/');  
    } else {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}  
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}  g
        />
        <button type="submit" disabled={loading}>  
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {error && <p className="error">{error}</p>} 
    </div>
  );
};

export default Login;