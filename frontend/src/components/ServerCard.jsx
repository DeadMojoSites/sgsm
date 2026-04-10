import { StatusBadge } from './Dashboard';

export default function ServerCard({
  server, onStart, onStop, onRestart, onInstall, onUpdate, onConsole, onEdit, onDelete
}) {
  const isRunning    = server.is_running;
  const isInstalling = server.is_installing;
  const status       = isRunning ? 'running' : isInstalling ? 'installing' : server.status;

  return (
    <div className="server-card">
      <div className={`server-card-banner ${status}`} />
      <div className="server-card-body">
        <div className="server-card-header-row">
          <div>
            <div className="server-name">{server.name}</div>
            <div className="server-appid">AppID: {server.app_id}</div>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="server-info-row">
          {server.port && (
            <span className="server-info-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12H2M22 12l-4-4M22 12l-4 4"/></svg>
              Port {server.port}
            </span>
          )}
          {server.max_players > 0 && (
            <span className="server-info-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {server.max_players} slots
            </span>
          )}
          {server.install_dir && (
            <span className="server-info-chip" title={server.install_dir} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              {server.install_dir.split('/').pop() || server.install_dir}
            </span>
          )}
        </div>

        {isInstalling && (
          <div style={{ marginTop: 10 }}>
            <div className="console-label" style={{ marginBottom: 4 }}>Installing…</div>
            <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: '100%' }} /></div>
          </div>
        )}

        {server.notes && (
          <p style={{ fontSize: '.76rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>{server.notes}</p>
        )}
      </div>

      <div className="server-card-actions">
        {/* Primary action */}
        {!isRunning && !isInstalling && (
          <button className="btn btn-success btn-sm" onClick={onStart} title="Start server">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Start
          </button>
        )}
        {isRunning && (
          <>
            <button className="btn btn-danger btn-sm" onClick={onStop} title="Stop server">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
              Stop
            </button>
            <button className="btn btn-warning btn-sm" onClick={onRestart} title="Restart server">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Restart
            </button>
          </>
        )}

        {/* Install / Update */}
        {!isRunning && !isInstalling && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={onInstall} title="Install / reinstall via SteamCMD">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Install
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onUpdate} title="Update via SteamCMD">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Update
            </button>
          </>
        )}
        {isInstalling && (
          <button className="btn btn-danger btn-sm" onClick={() =>
            fetch(`/api/servers/${server.id}/cancel-install`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('gsm_token')}` } })
          }>Cancel</button>
        )}

        {/* Console */}
        <button className="btn btn-ghost btn-sm" onClick={onConsole} title="View console">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          Console
        </button>

        {/* Edit / Delete – spacer then right-aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title="Edit server">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} title="Delete server" style={{ color: 'var(--red)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
