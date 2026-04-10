import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';
import api from '../services/api';

export default function ConsoleModal({ server, onClose }) {
  const [lines,    setLines]    = useState([]);
  const [command,  setCommand]  = useState('');
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const socket    = getSocket();

  const addLine = useCallback((type, data) => {
    const chunks = data.split('\n');
    setLines(prev => [...prev, ...chunks.filter(c => c !== '').map(text => ({ type, text }))]);
  }, []);

  useEffect(() => {
    setLines([{ type: 'info', text: `--- Console: ${server.name} (App ${server.app_id}) ---` }]);

    socket.emit('join-console', server.id);
    setConnected(true);

    socket.on('console', ({ type, data }) => addLine(type, data));
    socket.on('install-complete', ({ success }) => {
      addLine(success ? 'success' : 'error',
        success ? '--- Installation finished ✓ ---' : '--- Installation failed ---');
    });
    socket.on('server-status-changed', ({ status }) => {
      addLine('info', `--- Server status changed: ${status} ---`);
    });

    return () => {
      socket.emit('leave-console', server.id);
      socket.off('console');
      socket.off('install-complete');
      socket.off('server-status-changed');
    };
  }, [server.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  async function sendCommand(e) {
    e.preventDefault();
    if (!command.trim()) return;
    try {
      await api.post(`/servers/${server.id}/command`, { command: command.trim() });
      addLine('info', `> ${command.trim()}`);
      setCommand('');
    } catch (err) {
      addLine('error', `Failed to send command: ${err.response?.data?.error || err.message}`);
    }
  }

  function clearConsole() { setLines([]); }

  function copyAll() {
    const text = lines.map(l => l.text).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const LINE_COLORS = {
    stdout:  'console-line-stdout',
    stderr:  'console-line-stderr',
    info:    'console-line-info',
    success: 'console-line-success',
    error:   'console-line-error'
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-console" style={{ width: '100%' }}>
        <div className="modal-header">
          <span className="modal-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Console — {server.name}
            <span style={{ marginLeft: 8, opacity: .6, fontSize: '.78rem', fontWeight: 400 }}>App {server.app_id}</span>
          </span>
          <div className="flex items-center gap-2">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.76rem', color: connected ? 'var(--green-bright)' : 'var(--red)' }}>
              <span className={`dot ${connected ? '' : ''}`} style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--green-bright)' : 'var(--red)', display: 'inline-block' }} />
              {connected ? 'Live' : 'Disconnected'}
            </span>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '16px 22px', gap: 8 }}>
          <div className="console-toolbar">
            <span className="console-label">Output ({lines.length} lines)</span>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={copyAll}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearConsole}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                Clear
              </button>
            </div>
          </div>

          <div className="console-wrapper">
            {lines.map((line, i) => (
              <div key={i} className={LINE_COLORS[line.type] || 'console-line-stdout'}>
                {line.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Command input */}
          <form className="console-input-row" onSubmit={sendCommand}>
            <span style={{ color: 'var(--green-bright)', fontFamily: 'monospace', fontSize: '.82rem', lineHeight: '34px', paddingLeft: 4 }}>$</span>
            <input
              className="console-input"
              type="text"
              placeholder="Enter server command…"
              value={command}
              onChange={e => setCommand(e.target.value)}
              disabled={!server.is_running}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={!command.trim() || !server.is_running}>
              Send
            </button>
          </form>
          {!server.is_running && (
            <p className="form-hint" style={{ marginTop: 2 }}>Commands can only be sent while the server is running.</p>
          )}
        </div>
      </div>
    </div>
  );
}
