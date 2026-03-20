import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) { setError('Please enter username and password.'); return; }
    setLoading(true); setError('');
    const result = await login(username, password);
    setLoading(false);
    if (result.success) { navigate('/dashboard'); }
    else { setError(result.error); }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-box" />
          <div className="login-company">Invoicing App</div>
          <div className="login-subtitle">Sign in to your account</div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username or Mobile</label>
            <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username or mobile" />
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Password</label>
            <input className="form-input" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: 30, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
          <button type="submit" className="btn btn-black" style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Login →'}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          <strong>Demo Credentials:</strong><br />
          Owner: admin / admin123<br />
          Accountant: priya / accountant123
        </div>
      </div>
    </div>
  );
}
