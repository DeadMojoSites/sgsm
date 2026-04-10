import { useState, useEffect, useCallback } from 'react';
import ServerCard     from './ServerCard';
import AddServerModal from './AddServerModal';
import ConsoleModal   from './ConsoleModal';
import api            from '../services/api';

export default function ServerList() {
  const [servers,     setServers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('');
  const [showAdd,     setShowAdd]     = useState(false);
  const [editServer,  setEditServer]  = useState(null);
  const [consoleServer, setConsoleServer] = useState(null);
  const [toast,       setToast]       = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/servers');
      setServers(data);
    } catch {
      showToast('Failed to load servers', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function doAction(serverId, action) {
    try {
      await api.post(`/servers/${serverId}/${action}`);
      showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} signal sent`, 'success');
      setTimeout(load, 1500);
    } catch (err) {
      showToast(err.response?.data?.error || `Failed to ${action}`, 'error');
    }
  }

  async function handleInstall(serverId) {
    try {
      await api.post(`/servers/${serverId}/install`);
      showToast('Installation started – open console to watch progress', 'info');
      setConsoleServer(servers.find(s => s.id === serverId));
      setTimeout(load, 1000);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to start installation', 'error');
    }
  }

  async function handleDelete(serverId) {
    if (!window.confirm('Delete this server? This only removes the record – installed files remain on disk.')) return;
    try {
      await api.delete(`/servers/${serverId}`);
      showToast('Server removed', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
    }
  }

  const filtered = servers.filter(s =>
    !filter || s.name.toLowerCase().includes(filter.toLowerCase()) ||
               s.app_id.includes(filter)
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Game Servers</h1>
          <p className="page-subtitle">{servers.length} server{servers.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="search-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search servers…" value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => { setEditServer(null); setShowAdd(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Server
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="steam-spinner" style={{ margin: '0 auto 12px' }} /><p>Loading servers…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎮</div>
          <h3>{filter ? 'No matching servers' : 'No servers configured'}</h3>
          <p>{filter ? 'Try a different search.' : 'Add your first game server and install it via SteamCMD.'}</p>
          {!filter && (
            <button className="btn btn-primary" onClick={() => { setEditServer(null); setShowAdd(true); }}>
              Add First Server
            </button>
          )}
        </div>
      ) : (
        <div className="server-grid">
          {filtered.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              onStart={()    => doAction(server.id, 'start')}
              onStop={()     => doAction(server.id, 'stop')}
              onRestart={()  => doAction(server.id, 'restart')}
              onInstall={()  => handleInstall(server.id)}
              onUpdate={()   => doAction(server.id, 'update')}
              onConsole={()  => setConsoleServer(server)}
              onEdit={()     => { setEditServer(server); setShowAdd(true); }}
              onDelete={()   => handleDelete(server.id)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddServerModal
          server={editServer}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); showToast(editServer ? 'Server updated' : 'Server added', 'success'); }}
        />
      )}

      {consoleServer && (
        <ConsoleModal
          server={consoleServer}
          onClose={() => setConsoleServer(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            {toast.type === 'error'   && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
            {toast.type === 'info'    && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
            {toast.msg}
          </div>
        </div>
      )}
    </>
  );
}
