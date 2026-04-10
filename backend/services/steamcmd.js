'use strict';

const { spawn } = require('child_process');
const fs        = require('fs');
const db        = require('./database');

const active = new Map(); // key: `install-${serverId}`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emit(io, serverId, type, data) {
  io.to(`server-${serverId}`).emit('console', { type, data });
}

// ─── Install / Update via SteamCMD ────────────────────────────────────────────
function installServer(serverId, appId, installDir, io, opts = {}) {
  const steamcmdPath = db.getSetting('steamcmd_path') || '/opt/steamcmd/steamcmd.sh';

  if (!fs.existsSync(steamcmdPath)) {
    emit(io, serverId, 'error',
      `SteamCMD not found at: ${steamcmdPath}\nUpdate the path in Settings → Steam.`);
    db.updateServer(serverId, { status: 'error' });
    return null;
  }

  if (!fs.existsSync(installDir)) {
    try { fs.mkdirSync(installDir, { recursive: true }); }
    catch (e) {
      emit(io, serverId, 'error', `Cannot create directory: ${installDir}\n${e.message}`);
      db.updateServer(serverId, { status: 'error' });
      return null;
    }
  }

  // Build SteamCMD argument list
  const args = ['+force_install_dir', installDir, '+login', opts.username || 'anonymous'];
  if (opts.password) args.push(opts.password);
  if (opts.steamGuard) args.push(opts.steamGuard);
  args.push('+app_update', appId, 'validate', '+quit');

  const proc = spawn(steamcmdPath, args);
  active.set(`install-${serverId}`, proc);

  emit(io, serverId, 'info',
    `--- SteamCMD: Installing App ${appId} to ${installDir} ---\n`);

  proc.stdout.on('data', d => emit(io, serverId, 'stdout', d.toString()));
  proc.stderr.on('data', d => emit(io, serverId, 'stderr', d.toString()));

  proc.on('close', code => {
    active.delete(`install-${serverId}`);
    const ok = code === 0;
    db.updateServer(serverId, { status: ok ? 'stopped' : 'error' });
    emit(io, serverId, ok ? 'success' : 'error',
      `\n--- Installation ${ok ? 'completed successfully ✓' : `failed (exit code ${code})`} ---\n`);
    io.to(`server-${serverId}`).emit('install-complete', { serverId, success: ok });
  });

  proc.on('error', err => {
    active.delete(`install-${serverId}`);
    db.updateServer(serverId, { status: 'error' });
    emit(io, serverId, 'error', `Spawn error: ${err.message}`);
  });

  return proc;
}

function cancelInstall(serverId) {
  const proc = active.get(`install-${serverId}`);
  if (!proc) return false;
  proc.kill('SIGTERM');
  active.delete(`install-${serverId}`);
  return true;
}

function isInstalling(serverId) {
  return active.has(`install-${serverId}`);
}

module.exports = { installServer, cancelInstall, isInstalling };
