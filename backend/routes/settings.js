'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../services/database');
const authMw  = require('../middleware/auth');

const router   = express.Router();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const UPL_DIR  = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPL_DIR)) fs.mkdirSync(UPL_DIR, { recursive: true });

// All routes require auth
router.use(authMw);

// ─── Logo upload ──────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPL_DIR),
  filename:    (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('Only image files are allowed'),
       allowed.includes(ext));
  }
});

// ─── GET /api/settings ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const all = db.getAllSettings();
  delete all.admin_password_hash;
  delete all.jwt_secret;
  res.json(all);
});

// ─── PUT /api/settings ────────────────────────────────────────────────────────
router.put('/', (req, res) => {
  const PROTECTED = new Set(['admin_password_hash', 'jwt_secret', 'setup_complete']);
  for (const [k, v] of Object.entries(req.body)) {
    if (!PROTECTED.has(k)) db.setSetting(k, v);
  }
  const all = db.getAllSettings();
  delete all.admin_password_hash;
  delete all.jwt_secret;
  res.json(all);
});

// ─── POST /api/settings/logo ──────────────────────────────────────────────────
router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const logoPath = `/uploads/${req.file.filename}`;
  db.setSetting('logo_path', logoPath);
  res.json({ logo_path: logoPath });
});

// ─── POST /api/settings/test-connection ───────────────────────────────────────
router.post('/test-connection', async (req, res) => {
  const { db_type, db_host, db_port, db_name, db_user, db_password } = req.body;

  try {
    if (db_type === 'mysql') {
      const mysql = require('mysql2/promise');
      const conn  = await mysql.createConnection({
        host:           db_host,
        port:           parseInt(db_port, 10) || 3306,
        database:       db_name,
        user:           db_user,
        password:       db_password,
        connectTimeout: 6000
      });
      await conn.ping();
      await conn.end();
      res.json({ success: true, message: 'MySQL connection successful' });

    } else if (db_type === 'postgresql') {
      const { Client } = require('pg');
      const client     = new Client({
        host:                    db_host,
        port:                    parseInt(db_port, 10) || 5432,
        database:                db_name,
        user:                    db_user,
        password:                db_password,
        connectionTimeoutMillis: 6000
      });
      await client.connect();
      await client.end();
      res.json({ success: true, message: 'PostgreSQL connection successful' });

    } else {
      res.status(400).json({ error: 'Select a valid database type first' });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: `Connection failed: ${err.message}` });
  }
});

module.exports = router;
