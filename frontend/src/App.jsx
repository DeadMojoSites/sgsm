import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login     from './components/Login';
import Setup     from './components/Setup';
import Layout    from './components/Layout';
import Dashboard from './components/Dashboard';
import ServerList from './components/ServerList';
import Settings  from './components/Settings';
import { disconnectSocket } from './services/socket';

export default function App() {
  const [appStatus, setAppStatus] = useState(null); // null = loading
  const [token, setToken]         = useState(() => localStorage.getItem('gsm_token'));

  useEffect(() => { fetchStatus(); }, []);

  async function fetchStatus() {
    try {
      const res  = await fetch('/api/auth/status');
      const data = await res.json();
      setAppStatus(data);
      // update page title
      if (data.appName) document.title = data.appName;
    } catch {
      setAppStatus({ setupComplete: false, appName: 'Game Server Manager', logoPath: '' });
    }
  }

  const handleLogin = newToken => {
    localStorage.setItem('gsm_token', newToken);
    setToken(newToken);
    fetchStatus();
  };

  const handleLogout = () => {
    localStorage.removeItem('gsm_token');
    disconnectSocket();
    setToken(null);
  };

  if (!appStatus) {
    return (
      <div className="loading-screen">
        <div className="steam-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!appStatus.setupComplete) {
    return <Setup onComplete={handleLogin} />;
  }

  if (!token) {
    return <Login onLogin={handleLogin} appStatus={appStatus} />;
  }

  return (
    <BrowserRouter>
      <Layout onLogout={handleLogout} appStatus={appStatus} onStatusRefresh={fetchStatus}>
        <Routes>
          <Route path="/"          element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/servers"   element={<ServerList />} />
          <Route path="/settings"  element={<Settings onSettingsSaved={fetchStatus} />} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
