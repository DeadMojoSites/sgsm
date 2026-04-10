'use strict';

const express  = require('express');
const { spawn, execSync } = require('child_process');
const path     = require('path');
const db       = require('../services/database');
const authMw   = require('../middleware/auth');

const router   = express.Router();
const APP_ROOT = path.join(__dirname, '../../');

router.use(authMw);

// ─── GET /api/update/info ─────────────────────────────────────────────────────
// Returns current commit hash, branch, and repo remote URL
router.get('/info', (req, res) => {
  try {
    const commit  = execSync('git rev-parse HEAD',              { cwd: APP_ROOT }).toString().trim();
    const short   = execSync('git rev-parse --short HEAD',      { cwd: APP_ROOT }).toString().trim();
    const branch  = execSync('git rev-parse --abbrev-ref HEAD', { cwd: APP_ROOT }).toString().trim();
    const message = execSync('git log -1 --pretty=%s',          { cwd: APP_ROOT }).toString().trim();
    const date    = execSync('git log -1 --pretty=%ci',         { cwd: APP_ROOT }).toString().trim();
    let remote = '';
    try {
      remote = execSync('git remote get-url origin', { cwd: APP_ROOT }).toString().trim();
    } catch {}

    // Check if there are upstream commits available
    let behindCount = 0;
    try {
      execSync('git fetch --quiet', { cwd: APP_ROOT, timeout: 10000 });
      const behind = execSync('git rev-list HEAD..@{u} --count', { cwd: APP_ROOT }).toString().trim();
      behindCount = parseInt(behind, 10) || 0;
    } catch {}

    res.json({ commit, short, branch, message, date, remote, behindCount,
               repoUrl: db.getSetting('update_repo_url') || remote });
  } catch (err) {
    res.status(500).json({ error: `Git not available: ${err.message}` });
  }
});

// ─── POST /api/update/run ─────────────────────────────────────────────────────
// Streams git pull + npm install output over Socket.io room "update-console"
router.post('/run', (req, res) => {
  const io = req.app.get('io');

  function emit(type, data) {
    io.emit('update-console', { type, data });
  }

  res.json({ message: 'Update started' });

  // Allow response to flush before heavy work starts
  setImmediate(async () => {
    emit('info', '─── Pulling latest changes from GitHub ───\n');

    // Optionally override remote URL from settings
    const savedUrl = db.getSetting('update_repo_url');
    if (savedUrl) {
      try {
        execSync(`git remote set-url origin ${savedUrl}`, { cwd: APP_ROOT });
        emit('info', `Remote set to: ${savedUrl}\n`);
      } catch (e) {
        emit('error', `Failed to set remote URL: ${e.message}\n`);
      }
    }

    // ── git pull ──────────────────────────────────────────────────────────────
    await runProcess('git', ['pull'], APP_ROOT, emit);

    emit('info', '\n─── Installing/updating backend dependencies ───\n');
    await runProcess('npm', ['install', '--prefer-offline'],
                     path.join(APP_ROOT, 'backend'), emit);

    emit('info', '\n─── Building frontend ───\n');
    await runProcess('npm', ['run', 'build'],
                     path.join(APP_ROOT, 'frontend'), emit);

    emit('success', '\n─── Update complete! Restart the server to apply changes. ───\n');
    io.emit('update-complete');
  });
});

// ─── POST /api/update/restart ─────────────────────────────────────────────────
// Exits the process so a process manager (Docker, PM2, systemd) will restart it
router.post('/restart', (req, res) => {
  res.json({ message: 'Restarting…' });
  setTimeout(() => process.exit(0), 500);
});

// ─── Helper: spawn a process and stream output ────────────────────────────────
function runProcess(cmd, args, cwd, emit) {
  return new Promise(resolve => {
    // On Windows use 'npm.cmd' etc.
    const isWin  = process.platform === 'win32';
    const binary = isWin && cmd === 'npm' ? 'npm.cmd' : cmd;
    const binary2 = isWin && cmd === 'git' ? 'git' : binary;

    const proc = spawn(binary2, args, { cwd, shell: isWin });

    proc.stdout.on('data', d => emit('stdout', d.toString()));
    proc.stderr.on('data', d => emit('stderr', d.toString()));
    proc.on('close', code => {
      if (code !== 0) emit('error', `\nProcess exited with code ${code}\n`);
      resolve(code);
    });
    proc.on('error', err => {
      emit('error', `Failed to start process: ${err.message}\n`);
      resolve(1);
    });
  });
}

module.exports = router;
