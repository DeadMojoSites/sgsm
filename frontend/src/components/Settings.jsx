import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';

const TABS = ['General', 'Steam / SteamCMD', 'Database', 'File Locations', 'API Keys', 'Security', 'Updates'];

export default function Settings({ onSettingsSaved }) {
  const [tab,      setTab]      = useState(0);
  const [settings, setSettings] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const { data } = await api.get('/settings');
      setSettings(data);
    } catch { showToast('Failed to load settings', 'error'); }
    finally  { setLoading(false); }
  }

  const set = field => e => setSettings(s => ({ ...s, [field]: e.target.value }));

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveSettings(partial) {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', partial || settings);
      setSettings(data);
      showToast('Settings saved successfully');
      onSettingsSaved?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed', 'error');
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="steam-spinner" style={{ margin: '0 auto 12px' }} />
        <p>Loading settings…</p>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure all aspects of your Game Server Manager</p>
        </div>
      </div>

      <div className="card">
        <div className="tabs" style={{ padding: '0 20px' }}>
          {TABS.map((t, i) => (
            <button key={i} className={`tab-btn ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 24px 28px' }}>
          {tab === 0 && <GeneralTab    settings={settings} set={set} save={saveSettings} saving={saving} showToast={showToast} reload={loadSettings} />}
          {tab === 1 && <SteamTab      settings={settings} set={set} save={saveSettings} saving={saving} />}
          {tab === 2 && <DatabaseTab   settings={settings} set={set} save={saveSettings} saving={saving} showToast={showToast} />}
          {tab === 3 && <FilesTab      settings={settings} set={set} save={saveSettings} saving={saving} />}
          {tab === 4 && <ApiKeysTab    settings={settings} set={set} save={saveSettings} saving={saving} />}
          {tab === 5 && <SecurityTab   showToast={showToast} />}
          {tab === 6 && <UpdatesTab    settings={settings} set={set} save={saveSettings} saving={saving} showToast={showToast} />}
        </div>
      </div>
    </>
  );
}

/* ── General ─────────────────────────────────────────────────────────────────── */
function GeneralTab({ settings, set, save, saving, showToast, reload }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function uploadLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('logo', file);
    try {
      await api.post('/settings/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Logo uploaded');
      reload();
    } catch { showToast('Logo upload failed', 'error'); }
    finally  { setUploading(false); }
  }

  return (
    <div className="tab-content">
      <div className="settings-section-title">Appearance</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="form-group">
          <label className="form-label">Application Name</label>
          <input className="form-control" value={settings.app_name || ''} onChange={set('app_name')} />
          <span className="form-hint">Shown in the browser title and top header.</span>
        </div>

        <div className="form-group">
          <label className="form-label">Custom Logo</label>
          <div className="logo-upload-area" onClick={() => fileRef.current?.click()}>
            <input type="file" ref={fileRef} accept="image/*" onChange={uploadLogo} style={{ display: 'none' }} />
            {settings.logo_path ? (
              <img src={settings.logo_path} alt="logo" className="logo-preview" />
            ) : (
              <div style={{ fontSize: 32, marginBottom: 8, opacity: .4 }}>🖼</div>
            )}
            <div className="logo-upload-hint">
              {uploading ? 'Uploading…' : 'Click to upload (PNG, JPG, SVG · max 5 MB)'}
            </div>
          </div>
          {settings.logo_path && (
            <button className="btn btn-ghost btn-sm mt-2" onClick={async () => {
              await api.put('/settings', { logo_path: '' });
              reload();
            }}>Remove logo</button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={() => save({ app_name: settings.app_name })} disabled={saving}>
          {saving ? 'Saving…' : 'Save General Settings'}
        </button>
      </div>
    </div>
  );
}

/* ── Steam / SteamCMD ────────────────────────────────────────────────────────── */
function SteamTab({ settings, set, save, saving }) {
  return (
    <div className="tab-content">
      <div className="settings-section-title">SteamCMD Configuration</div>

      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        SteamCMD is pre-installed in the Docker image at <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,.2)', padding: '1px 5px', borderRadius: 3 }}>/opt/steamcmd/steamcmd.sh</code>. Only change if you have a custom setup.
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">SteamCMD Executable Path</label>
        <input className="form-control" value={settings.steamcmd_path || ''} onChange={set('steamcmd_path')} />
        <span className="form-hint">Full path to steamcmd.sh inside the container.</span>
      </div>

      <div className="settings-section-title" style={{ marginTop: 24 }}>Default Directories</div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Default Game Servers Root</label>
        <input className="form-control" value={settings.servers_path || ''} onChange={set('servers_path')} />
        <span className="form-hint">When adding a new server, the install path will be pre-filled using this root.</span>
      </div>

      <button className="btn btn-primary" onClick={() => save({
        steamcmd_path: settings.steamcmd_path,
        servers_path:  settings.servers_path
      })} disabled={saving}>
        {saving ? 'Saving…' : 'Save Steam Settings'}
      </button>
    </div>
  );
}

/* ── Database ────────────────────────────────────────────────────────────────── */
function DatabaseTab({ settings, set, save, saving, showToast }) {
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/settings/test-connection', {
        db_type:     settings.db_type,
        db_host:     settings.db_host,
        db_port:     settings.db_port,
        db_name:     settings.db_name,
        db_user:     settings.db_user,
        db_password: settings.db_password
      });
      setTestResult({ success: data.success, msg: data.message });
      showToast(data.message, data.success ? 'success' : 'error');
    } catch (err) {
      const msg = err.response?.data?.message || 'Connection test failed';
      setTestResult({ success: false, msg });
      showToast(msg, 'error');
    } finally { setTesting(false); }
  }

  return (
    <div className="tab-content">
      <div className="settings-section-title">External Database Connection</div>
      <p className="form-hint" style={{ marginBottom: 20 }}>
        Connect an external MySQL or PostgreSQL database for your game server's persistent data (e.g. player records, economy systems). The Game Server Manager itself uses an embedded SQLite database for its own config.
      </p>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Database Type</label>
        <select className="form-control" value={settings.db_type || 'none'} onChange={set('db_type')}>
          <option value="none">None (not configured)</option>
          <option value="mysql">MySQL / MariaDB</option>
          <option value="postgresql">PostgreSQL</option>
        </select>
      </div>

      {settings.db_type && settings.db_type !== 'none' && (
        <>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Host</label>
              <input className="form-control" placeholder="localhost or IP address" value={settings.db_host || ''} onChange={set('db_host')} />
            </div>
            <div className="form-group">
              <label className="form-label">Port</label>
              <input className="form-control" type="number" placeholder={settings.db_type === 'mysql' ? '3306' : '5432'}
                value={settings.db_port || ''} onChange={set('db_port')} />
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Database Name</label>
              <input className="form-control" placeholder="gameservers" value={settings.db_name || ''} onChange={set('db_name')} />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-control" placeholder="gsm" value={settings.db_user || ''} onChange={set('db_user')} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Password</label>
            <input className="form-control" type="password" placeholder="••••••••" value={settings.db_password || ''} onChange={set('db_password')} />
          </div>

          {testResult && (
            <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {testResult.msg}
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={testConnection} disabled={testing}>
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={() => save({
          db_type: settings.db_type, db_host: settings.db_host,
          db_port: settings.db_port, db_name: settings.db_name,
          db_user: settings.db_user, db_password: settings.db_password
        })} disabled={saving}>
          {saving ? 'Saving…' : 'Save Database Settings'}
        </button>
      </div>
    </div>
  );
}

/* ── File Locations ──────────────────────────────────────────────────────────── */
function FilesTab({ settings, set, save, saving }) {
  return (
    <div className="tab-content">
      <div className="settings-section-title">Path Configuration</div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Game Servers Root Directory</label>
        <input className="form-control" value={settings.servers_path || ''} onChange={set('servers_path')} />
        <span className="form-hint">Default root directory for installing game servers (Docker volume: <code style={{ fontFamily: 'monospace' }}>gsm_servers</code> → <code style={{ fontFamily: 'monospace' }}>/opt/servers</code>)</span>
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">SteamCMD Path</label>
        <input className="form-control" value={settings.steamcmd_path || ''} onChange={set('steamcmd_path')} />
        <span className="form-hint">Docker volume: <code style={{ fontFamily: 'monospace' }}>gsm_steamcmd</code> → <code style={{ fontFamily: 'monospace' }}>/opt/steamcmd</code></span>
      </div>

      <div className="form-group" style={{ marginBottom: 24 }}>
        <label className="form-label">Data / Config Directory (read-only)</label>
        <input className="form-control" value="/app/data" disabled style={{ opacity: .5 }} />
        <span className="form-hint">Application config and uploads. Docker volume: <code style={{ fontFamily: 'monospace' }}>gsm_data</code> → <code style={{ fontFamily: 'monospace' }}>/app/data</code> (managed automatically)</span>
      </div>

      <button className="btn btn-primary" onClick={() => save({
        servers_path:  settings.servers_path,
        steamcmd_path: settings.steamcmd_path
      })} disabled={saving}>
        {saving ? 'Saving…' : 'Save File Locations'}
      </button>
    </div>
  );
}

/* ── API Keys ─────────────────────────────────────────────────────────────────── */
function ApiKeysTab({ settings, set, save, saving }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="tab-content">
      <div className="settings-section-title">Steam API</div>

      <div className="form-group" style={{ marginBottom: 24 }}>
        <label className="form-label">Steam Web API Key</label>
        <div className="flex gap-2">
          <input
            className="form-control"
            type={showKey ? 'text' : 'password'}
            placeholder="Enter your Steam Web API key"
            value={settings.steam_api_key || ''}
            onChange={set('steam_api_key')}
          />
          <button className="btn btn-ghost btn-icon" type="button" onClick={() => setShowKey(v => !v)} title={showKey ? 'Hide' : 'Show'}>
            {showKey
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>
        <span className="form-hint">
          Get your key at <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener">steamcommunity.com/dev/apikey</a>.
          Used for fetching game info and server details.
        </span>
      </div>

      <div className="settings-section-title">Custom API Keys</div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Custom API Key 1</label>
        <input className="form-control" type="password" placeholder="Optional – for third-party integrations"
          value={settings.custom_api_key_1 || ''} onChange={set('custom_api_key_1')} />
        <span className="form-hint">Label / Purpose</span>
        <input className="form-control mt-2" type="text" placeholder="e.g. Discord Bot Token"
          value={settings.custom_api_label_1 || ''} onChange={set('custom_api_label_1')} />
      </div>
      <div className="form-group" style={{ marginBottom: 24 }}>
        <label className="form-label">Custom API Key 2</label>
        <input className="form-control" type="password" placeholder="Optional"
          value={settings.custom_api_key_2 || ''} onChange={set('custom_api_key_2')} />
        <input className="form-control mt-2" type="text" placeholder="Label"
          value={settings.custom_api_label_2 || ''} onChange={set('custom_api_label_2')} />
      </div>

      <button className="btn btn-primary" onClick={() => save({
        steam_api_key:     settings.steam_api_key,
        custom_api_key_1:  settings.custom_api_key_1,
        custom_api_label_1:settings.custom_api_label_1,
        custom_api_key_2:  settings.custom_api_key_2,
        custom_api_label_2:settings.custom_api_label_2
      })} disabled={saving}>
        {saving ? 'Saving…' : 'Save API Keys'}
      </button>
    </div>
  );
}

/* ── Security ─────────────────────────────────────────────────────────────────── */
function SecurityTab({ showToast }) {
  const [form,    setForm]    = useState({ currentPassword: '', newPassword: '', confirmPass: '' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  async function changePassword(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (form.newPassword !== form.confirmPass) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword
      });
      showToast('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPass: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  }

  return (
    <div className="tab-content">
      <div className="settings-section-title">Change Password</div>
      <form onSubmit={changePassword} style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Current Password</label>
          <input className="form-control" type="password" value={form.currentPassword} onChange={set('currentPassword')} required />
        </div>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input className="form-control" type="password" placeholder="Minimum 8 characters" value={form.newPassword} onChange={set('newPassword')} required />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm New Password</label>
          <input className="form-control" type="password" value={form.confirmPass} onChange={set('confirmPass')} required />
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Updating…' : 'Change Password'}
        </button>
      </form>

      <div className="settings-section-title" style={{ marginTop: 32 }}>Security Notes</div>
      <div className="alert alert-warning" style={{ maxWidth: 600 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div>
          <strong>Recommendations:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 1.8 }}>
            <li>Run this container behind a reverse proxy (nginx/Caddy) with HTTPS.</li>
            <li>Do not expose port 8080 directly to the internet without TLS.</li>
            <li>Use Docker secrets or environment variables for sensitive credentials rather than storing plain text.</li>
            <li>Regularly back up the <code style={{ fontFamily: 'monospace' }}>gsm_data</code> volume.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Updates ──────────────────────────────────────────────────────────────────── */
function UpdatesTab({ settings, set, save, saving, showToast }) {
  const [info,       setInfo]       = useState(null);
  const [checking,   setChecking]   = useState(false);
  const [updating,   setUpdating]   = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [lines,      setLines]      = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchInfo();
    const socket = getSocket();
    socket.on('update-console', ({ type, data }) => {
      setLines(prev => [
        ...prev,
        ...data.split('\n').filter(l => l !== '').map(text => ({ type, text }))
      ]);
    });
    socket.on('update-complete', () => {
      setUpdating(false);
      showToast('Update complete! Click Restart to apply.', 'success');
      fetchInfo();
    });
    return () => {
      socket.off('update-console');
      socket.off('update-complete');
    };
  }, []);

  // Auto-scroll console
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  async function fetchInfo() {
    setChecking(true);
    try {
      const { data } = await api.get('/update/info');
      setInfo(data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not fetch version info', 'error');
    } finally { setChecking(false); }
  }

  async function runUpdate() {
    setLines([]);
    setUpdating(true);
    try {
      await api.post('/update/run');
    } catch (err) {
      showToast(err.response?.data?.error || 'Update failed to start', 'error');
      setUpdating(false);
    }
  }

  async function restartServer() {
    setRestarting(true);
    try {
      await api.post('/update/restart');
      showToast('Server is restarting… reconnect in a few seconds.', 'info');
      setTimeout(() => window.location.reload(), 5000);
    } catch {
      // Expected — server killed itself
      showToast('Server is restarting… reconnect in a few seconds.', 'info');
      setTimeout(() => window.location.reload(), 5000);
    }
  }

  const LINE_COLORS = {
    stdout: 'console-line-stdout', stderr: 'console-line-stderr',
    info:   'console-line-info',   success: 'console-line-success',
    error:  'console-line-error'
  };

  return (
    <div className="tab-content">
      <div className="settings-section-title">Application Version</div>

      {info && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
            <InfoRow label="Branch"         value={info.branch} />
            <InfoRow label="Current Commit" value={<code style={{ fontFamily:'monospace', fontSize:'.8rem' }}>{info.short}</code>} />
            <InfoRow label="Commit Message" value={info.message} />
            <InfoRow label="Date"           value={new Date(info.date).toLocaleString()} />
            <InfoRow label="Remote Origin"  value={
              <a href={info.remote.replace(/\.git$/, '')} target="_blank" rel="noopener" style={{ wordBreak:'break-all' }}>
                {info.remote}
              </a>
            } />
            <InfoRow label="Updates Available" value={
              <span style={{ color: info.behindCount > 0 ? 'var(--green-bright)' : 'var(--text-muted)' }}>
                {checking ? '…' : info.behindCount > 0 ? `${info.behindCount} commit(s) behind` : 'Up to date ✓'}
              </span>
            } />
          </div>
        </div>
      )}

      <div className="settings-section-title">Repository</div>
      <div className="form-group" style={{ marginBottom: 20, maxWidth: 520 }}>
        <label className="form-label">Override Remote URL</label>
        <input className="form-control" type="text"
          placeholder="https://github.com/MBrown22073/sgsm.git"
          value={settings.update_repo_url || ''}
          onChange={set('update_repo_url')} />
        <span className="form-hint">Leave blank to use the current git remote. Set this if you forked the repo or need to override the pull URL.</span>
      </div>
      <div style={{ display:'flex', gap: 10, marginBottom: 24 }}>
        <button className="btn btn-secondary" onClick={() => save({ update_repo_url: settings.update_repo_url })} disabled={saving}>
          Save URL
        </button>
        <button className="btn btn-ghost" onClick={fetchInfo} disabled={checking}>
          {checking ? 'Checking…' : 'Check for Updates'}
        </button>
      </div>

      <div className="settings-section-title">Run Update</div>
      <div className="alert alert-warning" style={{ marginBottom: 16, maxWidth: 600 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        This will: <strong>git pull</strong> → <strong>npm install</strong> (backend) → <strong>npm run build</strong> (frontend). A restart is required afterwards to apply changes.
      </div>

      <div style={{ display:'flex', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={runUpdate} disabled={updating || restarting}>
          {updating
            ? <><span className="steam-spinner" style={{width:14,height:14,borderWidth:2}} /> Updating…</>
            : <>⬇ Pull &amp; Build Update</>}
        </button>
        <button className="btn btn-warning" onClick={restartServer} disabled={updating || restarting}>
          {restarting ? 'Restarting…' : '↺ Restart Server'}
        </button>
        {lines.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setLines([])}>Clear Log</button>
        )}
      </div>

      {lines.length > 0 && (
        <>
          <div className="console-toolbar">
            <span className="console-label">Update log ({lines.length} lines)</span>
          </div>
          <div className="console-wrapper" style={{ minHeight: 200, maxHeight: 380 }}>
            {lines.map((line, i) => (
              <div key={i} className={LINE_COLORS[line.type] || 'console-line-stdout'}>
                {line.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 3, fontWeight: 600 }}>{label}</div>
      <div style={{ color: 'var(--text-bright)', fontSize: '.85rem' }}>{value}</div>
    </div>
  );
}
