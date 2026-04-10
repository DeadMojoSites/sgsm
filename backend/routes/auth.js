'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../services/database');
const authMw   = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/auth/status ─────────────────────────────────────────────────────
// Public: returns whether first-run setup is complete
router.get('/status', (req, res) => {
  res.json({
    setupComplete: db.getSetting('setup_complete') === 'true',
    appName:       db.getSetting('app_name') || 'Game Server Manager',
    logoPath:      db.getSetting('logo_path') || ''
  });
});

// ─── POST /api/auth/setup ─────────────────────────────────────────────────────
// Public: first-run only
router.post('/setup', (req, res) => {
  if (db.getSetting('setup_complete') === 'true') {
    return res.status(400).json({ error: 'Setup already complete' });
  }

  const { username, password, app_name } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  db.setSetting('admin_username',    username.trim());
  db.setSetting('admin_password_hash', bcrypt.hashSync(password, 12));
  db.setSetting('app_name',          (app_name || 'Game Server Manager').trim());
  db.setSetting('setup_complete',    'true');

  const token = jwt.sign(
    { username: username.trim(), role: 'admin' },
    db.getSetting('jwt_secret'),
    { expiresIn: '24h' }
  );
  res.json({ token, username: username.trim() });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const storedUser = db.getSetting('admin_username');
  const storedHash = db.getSetting('admin_password_hash');

  if (!storedUser || !storedHash) {
    return res.status(401).json({ error: 'No admin account configured' });
  }

  // Use constant-time comparison for username + bcrypt for password
  const usernameMatch = username === storedUser;
  const passwordMatch = bcrypt.compareSync(password, storedHash);

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { username: storedUser, role: 'admin' },
    db.getSetting('jwt_secret'),
    { expiresIn: '24h' }
  );
  res.json({ token, username: storedUser });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', authMw, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both fields are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const stored = db.getSetting('admin_password_hash');
  if (!bcrypt.compareSync(currentPassword, stored)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.setSetting('admin_password_hash', bcrypt.hashSync(newPassword, 12));
  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
