import { useState, useEffect } from 'react';
import api from '../services/api';

const EMPTY = {
  name: '', app_id: '', install_dir: '',
  launch_executable: '', launch_args: '',
  port: '', max_players: '', notes: ''
};

export default function AddServerModal({ server, onClose, onSaved }) {
  const [form,      setForm]      = useState(server ? { ...server, port: server.port || '', max_players: server.max_players || '' } : EMPTY);
  const [templates, setTemplates] = useState([]);
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [serversPath, setServersPath] = useState('/opt/servers');
  const isEdit = !!server;

  useEffect(() => {
    api.get('/servers/templates').then(r => setTemplates(r.data)).catch(() => {});
    api.get('/settings').then(r => setServersPath(r.data.servers_path || '/opt/servers')).catch(() => {});
  }, []);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  function applyTemplate(tpl) {
    setForm(f => ({
      ...f,
      name:              tpl.name,
      app_id:            tpl.app_id,
      install_dir:       `${serversPath}/${tpl.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      launch_executable: tpl.launch_executable,
      launch_args:       tpl.launch_args,
      port:              tpl.port || '',
      max_players:       tpl.max_players || ''
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim())       return setError('Server name is required');
    if (!form.app_id.trim())     return setError('Steam App ID is required');
    if (!/^\d+$/.test(form.app_id.trim())) return setError('App ID must be numeric');
    if (!form.install_dir.trim()) return setError('Install directory is required');

    setSaving(true);
    try {
      const payload = {
        ...form,
        port:        form.port        ? parseInt(form.port, 10)        : null,
        max_players: form.max_players ? parseInt(form.max_players, 10) : 0
      };
      if (isEdit) {
        await api.put(`/servers/${server.id}`, payload);
      } else {
        await api.post('/servers', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <span className="modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/></svg>
            {isEdit ? 'Edit Server' : 'Add Game Server'}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* Quick-start templates */}
            {!isEdit && (
              <div>
                <div className="settings-section-title">Quick Start Templates</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {templates.map(t => (
                    <button key={t.app_id} type="button" className="btn btn-ghost btn-sm"
                      onClick={() => applyTemplate(t)}
                      style={{ fontSize: '.75rem' }}>
                      {t.name}
                    </button>
                  ))}
                </div>
                <p className="form-hint mt-2">Click a template to pre-fill values. You can edit them below.</p>
              </div>
            )}

            <div className="divider" />
            <div className="settings-section-title">Server Details</div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Server Name <span className="required">*</span></label>
                <input className="form-control" type="text" placeholder="My Valheim Server" value={form.name} onChange={set('name')} autoFocus={!templates.length} />
              </div>
              <div className="form-group">
                <label className="form-label">Steam App ID <span className="required">*</span></label>
                <input className="form-control" type="text" placeholder="e.g. 896660" value={form.app_id} onChange={set('app_id')} />
                <span className="form-hint">Find on <a href="https://store.steampowered.com" target="_blank" rel="noopener">store.steampowered.com</a></span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Install Directory <span className="required">*</span></label>
              <input className="form-control" type="text" placeholder={`${serversPath}/my-server`} value={form.install_dir} onChange={set('install_dir')} />
              <span className="form-hint">Absolute path inside the container where SteamCMD will install the server.</span>
            </div>

            <div className="divider" />
            <div className="settings-section-title">Launch Configuration</div>

            <div className="form-group">
              <label className="form-label">Launch Executable</label>
              <input className="form-control" type="text" placeholder="./server.x86_64 or ./srcds_run" value={form.launch_executable} onChange={set('launch_executable')} />
              <span className="form-hint">Relative to install directory. Required to use Start/Stop controls.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Launch Arguments</label>
              <input className="form-control" type="text" placeholder="-port 27015 +maxplayers 16 +map de_dust2" value={form.launch_args} onChange={set('launch_args')} />
              <span className="form-hint">Space-separated arguments appended when starting the server.</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Game Port</label>
                <input className="form-control" type="number" placeholder="27015" min="1" max="65535" value={form.port} onChange={set('port')} />
              </div>
              <div className="form-group">
                <label className="form-label">Max Players</label>
                <input className="form-control" type="number" placeholder="16" min="0" value={form.max_players} onChange={set('max_players')} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" placeholder="Optional notes about this server…" rows={3} value={form.notes} onChange={set('notes')} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
