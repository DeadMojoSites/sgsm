import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Dashboard() {
  const [stats,   setStats]   = useState({ total: 0, running: 0, stopped: 0, installing: 0 });
  const [servers, setServers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const [{ data: s }, { data: sv }] = await Promise.all([
        api.get('/servers/stats'),
        api.get('/servers')
      ]);
      setStats(s);
      setServers(sv.slice(0, 5)); // recent 5
    } catch {}
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your game servers</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/servers')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Server
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Servers"  value={stats.total}      color="blue"   icon="🎮" />
        <StatCard label="Running"        value={stats.running}    color="green"  icon="▶" />
        <StatCard label="Stopped"        value={stats.stopped}    color="red"    icon="■" />
        <StatCard label="Installing"     value={stats.installing} color="orange" icon="⬇" />
      </div>

      {/* Recent servers */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Servers</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/servers')}>
            View All →
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {servers.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">🎮</div>
              <h3>No servers yet</h3>
              <p>Click "Add Server" to install your first game server via SteamCMD.</p>
              <button className="btn btn-primary" onClick={() => navigate('/servers')}>
                Get Started
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name','App ID','Status','Port','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {servers.map(server => (
                  <tr key={server.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-bright)', fontWeight: 500 }}>{server.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '.8rem' }}>{server.app_id}</td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={server.is_running ? 'running' : server.is_installing ? 'installing' : server.status} /></td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '.82rem' }}>{server.port || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/servers')}>Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick tips */}
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        <TipCard icon="🔧" title="Configure SteamCMD" desc="Make sure the SteamCMD path is set correctly in Settings → Steam." action={() => navigate('/settings')} actionLabel="Open Settings" />
        <TipCard icon="🗄️" title="External Database" desc="Connect to MySQL or PostgreSQL for your game server's data in Settings → Database." action={() => navigate('/settings')} actionLabel="Configure DB" />
        <TipCard icon="📡" title="Port Forwarding" desc="Ensure your host's firewall and router forward the game server ports to this container." action={null} actionLabel={null} />
      </div>
    </>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function TipCard({ icon, title, desc, action, actionLabel }) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
        <div style={{ fontWeight: 600, color: 'var(--text-bright)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: action ? 12 : 0 }}>{desc}</div>
        {action && <button className="btn btn-ghost btn-sm" onClick={action}>{actionLabel}</button>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = status || 'stopped';
  const labels = { running: 'Running', stopped: 'Stopped', installing: 'Installing', updating: 'Updating', error: 'Error', crashed: 'Crashed' };
  return (
    <span className={`status-badge ${s}`}>
      <span className="dot" />
      {labels[s] || s}
    </span>
  );
}
