'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH  = path.join(DATA_DIR, 'gsm.db');

let db;

// ─── Init ─────────────────────────────────────────────────────────────────────
function initialize() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS servers (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL,
      app_id             TEXT    NOT NULL,
      install_dir        TEXT    NOT NULL,
      launch_executable  TEXT    NOT NULL DEFAULT '',
      launch_args        TEXT    NOT NULL DEFAULT '',
      status             TEXT    NOT NULL DEFAULT 'stopped',
      port               INTEGER,
      max_players        INTEGER NOT NULL DEFAULT 0,
      notes              TEXT    NOT NULL DEFAULT '',
      pid                INTEGER,
      created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert defaults (will not overwrite existing values)
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const defaults = {
    app_name:       'Game Server Manager',
    steamcmd_path:  '/opt/steamcmd/steamcmd.sh',
    servers_path:   '/opt/servers',
    steam_api_key:  '',
    db_type:        'none',
    db_host:        '',
    db_port:        '',
    db_name:        '',
    db_user:        '',
    db_password:    '',
    logo_path:      '',
    setup_complete: 'false',
    jwt_secret:     crypto.randomBytes(64).toString('hex'),
    update_repo_url: ''
  };

  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);

  console.log(`[DB] SQLite database ready at ${DB_PATH}`);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function getSetting(key) {
  if (!db) return null;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value ?? ''));
}
function getAllSettings() {
  const rows   = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const r of rows) result[r.key] = r.value;
  return result;
}

// ─── Servers ──────────────────────────────────────────────────────────────────
function getServer(id) {
  return db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
}
function getServers() {
  return db.prepare('SELECT * FROM servers ORDER BY created_at DESC').all();
}
function createServer(data) {
  const r = db.prepare(`
    INSERT INTO servers (name, app_id, install_dir, launch_executable, launch_args, port, max_players, notes)
    VALUES (@name, @app_id, @install_dir, @launch_executable, @launch_args, @port, @max_players, @notes)
  `).run({
    name:              data.name,
    app_id:            data.app_id,
    install_dir:       data.install_dir,
    launch_executable: data.launch_executable || '',
    launch_args:       data.launch_args       || '',
    port:              data.port              || null,
    max_players:       data.max_players       || 0,
    notes:             data.notes             || ''
  });
  return getServer(r.lastInsertRowid);
}
function updateServer(id, data) {
  const ALLOWED = ['name','app_id','install_dir','launch_executable','launch_args',
                   'status','port','max_players','notes','pid'];
  const cols = [], vals = [];
  for (const f of ALLOWED) {
    if (data[f] !== undefined) { cols.push(`${f} = ?`); vals.push(data[f] ?? null); }
  }
  if (!cols.length) return getServer(id);
  cols.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  db.prepare(`UPDATE servers SET ${cols.join(', ')} WHERE id = ?`).run(...vals);
  return getServer(id);
}
function deleteServer(id) {
  db.prepare('DELETE FROM servers WHERE id = ?').run(id);
}

module.exports = { initialize, getSetting, setSetting, getAllSettings,
                   getServer, getServers, createServer, updateServer, deleteServer };
