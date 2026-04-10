'use strict';

const { spawn } = require('child_process');
const db        = require('./database');

const running = new Map(); // serverId → child process
let io;

function initialize(ioInstance) {
  io = ioInstance;
  // Mark all previous processes as stopped on startup
  const servers = db.getServers();
  for (const s of servers) {
    if (!['stopped', 'error'].includes(s.status)) {
      db.updateServer(s.id, { status: 'stopped', pid: null });
    }
  }
}

function emit(serverId, type, data) {
  if (io) io.to(`server-${serverId}`).emit('console', { type, data });
}

function startServer(serverId) {
  const server = db.getServer(serverId);
  if (!server)                   throw new Error('Server not found');
  if (running.has(serverId))     throw new Error('Server is already running');
  if (!server.launch_executable) throw new Error('No launch executable configured for this server');

  const args = server.launch_args
    ? server.launch_args.trim().split(/\s+/)
    : [];

  const proc = spawn(server.launch_executable, args, {
    cwd:   server.install_dir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  running.set(serverId, proc);
  db.updateServer(serverId, { status: 'running', pid: proc.pid });
  emit(serverId, 'info', `--- Server starting (PID ${proc.pid}) ---\n`);

  proc.stdout.on('data', d => emit(serverId, 'stdout', d.toString()));
  proc.stderr.on('data', d => emit(serverId, 'stderr', d.toString()));

  proc.on('close', code => {
    running.delete(serverId);
    const status = code === 0 ? 'stopped' : 'crashed';
    db.updateServer(serverId, { status, pid: null });
    emit(serverId, code === 0 ? 'info' : 'error',
      `\n--- Server ${status} (exit ${code}) ---\n`);
    if (io) io.to(`server-${serverId}`).emit('server-status-changed', { serverId, status });
  });

  proc.on('error', err => {
    running.delete(serverId);
    db.updateServer(serverId, { status: 'error', pid: null });
    emit(serverId, 'error', `Process error: ${err.message}`);
    if (io) io.to(`server-${serverId}`).emit('server-status-changed', { serverId, status: 'error' });
  });

  return { pid: proc.pid };
}

function stopServer(serverId) {
  const proc = running.get(serverId);
  if (!proc) throw new Error('Server is not running');

  proc.kill('SIGTERM');
  // Force-kill after 8 s if still alive
  setTimeout(() => {
    if (running.has(serverId)) proc.kill('SIGKILL');
  }, 8000);
}

function sendCommand(serverId, command) {
  const proc = running.get(serverId);
  if (!proc || !proc.stdin) throw new Error('Server is not running or does not accept stdin');
  proc.stdin.write(`${command}\n`);
}

function isRunning(serverId) {
  return running.has(serverId);
}

function getRunningIds() {
  return [...running.keys()];
}

module.exports = { initialize, startServer, stopServer, sendCommand, isRunning, getRunningIds };
