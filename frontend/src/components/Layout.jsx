import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import api from '../services/api';

export default function Layout({ children, onLogout, appStatus, onStatusRefresh }) {
  const [stats, setStats] = useState({ total: 0, running: 0 });

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 10000);
    return () => clearInterval(t);
  }, []);

  async function loadStats() {
    try {
      const { data } = await api.get('/servers/stats');
      setStats(data);
    } catch {}
  }

  const logoPath = appStatus?.logoPath;
  const appName  = appStatus?.appName || 'Game Server Manager';
  const initial  = appName.charAt(0).toUpperCase();

  return (
    <div className="app-wrapper">
      {/* ── Top header ── */}
      <header className="gsm-header">
        <div className="header-brand">
          {logoPath ? (
            <img src={logoPath} alt="logo" className="header-logo" />
          ) : (
            <div className="header-logo-placeholder">{initial}</div>
          )}
          <span className="header-title">{appName}</span>
        </div>

        <div className="header-right">
          <span className="header-user">
            <div className="header-user-icon">A</div>
            <span>Admin</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onLogout} title="Sign out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <Sidebar serverCount={stats.total} runningCount={stats.running} />

      {/* ── Main content ── */}
      <main className="gsm-main">
        {children}
      </main>
    </div>
  );
}
