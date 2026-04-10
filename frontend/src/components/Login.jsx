import { useState } from 'react';
import api from '../services/api';

export default function Login({ onLogin, appStatus }) {
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      onLogin(data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-header">
          {appStatus?.logoPath ? (
            <img src={appStatus.logoPath} alt="logo" className="auth-logo" />
          ) : (
            <div className="auth-logo-placeholder">G</div>
          )}
          <div className="auth-app-name">{appStatus?.appName || 'Game Server Manager'}</div>
          <div className="auth-subtitle">Administrator Login</div>
        </div>

        <form className="auth-body" onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-control"
              type="text"
              placeholder="admin"
              value={form.username}
              onChange={set('username')}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
            />
          </div>

          <button className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <><span className="steam-spinner" style={{width:16,height:16,borderWidth:2}} /> Signing in…</> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
