import { useState } from 'react';
import api from '../services/api';

const STEPS = ['Account', 'App Settings', 'Steam CMD'];

export default function Setup({ onComplete }) {
  const [step, setStep]   = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm]   = useState({
    username:      '',
    password:      '',
    confirmPass:   '',
    app_name:      'Game Server Manager',
    steamcmd_path: '/opt/steamcmd/steamcmd.sh',
    servers_path:  '/opt/servers',
    steam_api_key: ''
  });

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  function validateStep() {
    if (step === 0) {
      if (!form.username.trim()) return 'Username is required';
      if (form.password.length < 8) return 'Password must be at least 8 characters';
      if (form.password !== form.confirmPass) return 'Passwords do not match';
    }
    if (step === 1) {
      if (!form.app_name.trim()) return 'App name is required';
    }
    return null;
  }

  function nextStep() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  }

  async function handleFinish() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      // Create account
      const { data } = await api.post('/auth/setup', {
        username: form.username,
        password: form.password,
        app_name: form.app_name
      });
      // Save steam settings
      await api.put('/settings', {
        steamcmd_path: form.steamcmd_path,
        servers_path:  form.servers_path,
        steam_api_key: form.steam_api_key
      }, { headers: { Authorization: `Bearer ${data.token}` } });
      onComplete(data.token);
    } catch (err2) {
      setError(err2.response?.data?.error || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box setup-box">
        <div className="auth-header">
          <div className="auth-logo-placeholder">G</div>
          <div className="auth-app-name">Game Server Manager</div>
          <div className="auth-subtitle">First-time Setup</div>
        </div>

        {/* Step indicators */}
        <div className="setup-steps">
          {STEPS.map((label, i) => (
            <div key={i} className={`setup-step ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
              <div className="step-circle">
                {i < step ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : i + 1}
              </div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="auth-body">
          {error && (
            <div className="alert alert-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Step 0: Admin account */}
          {step === 0 && (
            <>
              <div className="alert alert-info">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Create your administrator account to get started.
              </div>
              <div className="form-group">
                <label className="form-label">Username <span className="required">*</span></label>
                <input className="form-control" type="text" placeholder="admin" value={form.username} onChange={set('username')} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Password <span className="required">*</span></label>
                <input className="form-control" type="password" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password <span className="required">*</span></label>
                <input className="form-control" type="password" placeholder="Re-enter password" value={form.confirmPass} onChange={set('confirmPass')} />
              </div>
            </>
          )}

          {/* Step 1: App settings */}
          {step === 1 && (
            <>
              <div className="form-group">
                <label className="form-label">Application Name <span className="required">*</span></label>
                <input className="form-control" type="text" value={form.app_name} onChange={set('app_name')} autoFocus />
                <span className="form-hint">Displayed in the browser title and header.</span>
              </div>
            </>
          )}

          {/* Step 2: SteamCMD */}
          {step === 2 && (
            <>
              <div className="alert alert-info">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                These can be changed later in Settings. Defaults are correct for the Docker image.
              </div>
              <div className="form-group">
                <label className="form-label">SteamCMD Executable Path</label>
                <input className="form-control" type="text" value={form.steamcmd_path} onChange={set('steamcmd_path')} autoFocus />
                <span className="form-hint">Path inside the container to steamcmd.sh</span>
              </div>
              <div className="form-group">
                <label className="form-label">Game Servers Root Directory</label>
                <input className="form-control" type="text" value={form.servers_path} onChange={set('servers_path')} />
                <span className="form-hint">Default directory where game servers will be installed.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Steam Web API Key</label>
                <input className="form-control" type="text" placeholder="Optional – from steamcommunity.com/dev/apikey" value={form.steam_api_key} onChange={set('steam_api_key')} />
              </div>
            </>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-2 justify-between mt-2">
            {step > 0 ? (
              <button className="btn btn-ghost" onClick={() => { setError(''); setStep(s => s - 1); }}>
                ← Back
              </button>
            ) : <span />}

            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={nextStep}>
                Next →
              </button>
            ) : (
              <button className="btn btn-success" disabled={loading} onClick={handleFinish}>
                {loading ? 'Setting up…' : 'Finish Setup ✓'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
