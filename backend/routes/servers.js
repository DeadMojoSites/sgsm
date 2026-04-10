'use strict';

const express       = require('express');
const db            = require('../services/database');
const steamcmd      = require('../services/steamcmd');
const serverManager = require('../services/serverManager');
const authMw        = require('../middleware/auth');

const router = express.Router();
router.use(authMw);

// Predefined popular server templates
const TEMPLATES = [
  { name: 'Counter-Strike 2',       app_id: '730',    launch_executable: './game/bin/linuxsteamrt64/cs2',    launch_args: '-dedicated +map de_dust2 +maxplayers 10', port: 27015, max_players: 10  },
  { name: 'Counter-Strike: GO',     app_id: '740',    launch_executable: './srcds_run',                      launch_args: '-game csgo +maxplayers 10 +map de_dust2',  port: 27015, max_players: 10  },
  { name: 'Valheim',                app_id: '896660', launch_executable: './valheim_server.x86_64',           launch_args: "-name 'Valheim' -port 2456 -world 'World' -password 'changeme'", port: 2456, max_players: 10 },
  { name: 'Rust',                   app_id: '258550', launch_executable: './RustDedicated',                  launch_args: '-batchmode +server.port 28015 +server.hostname "Rust Server"',   port: 28015, max_players: 50 },
  { name: 'ARK: Survival Evolved',  app_id: '376030', launch_executable: './ShooterGameServer',              launch_args: 'TheIsland?SessionName=ARK?Port=7777?QueryPort=27015 -server -log', port: 7777, max_players: 70 },
  { name: 'Garry\'s Mod',           app_id: '4020',   launch_executable: './srcds_run',                      launch_args: '-game garrysmod +maxplayers 16 +map gm_flatgrass',                port: 27015, max_players: 16 },
  { name: 'Team Fortress 2',        app_id: '232250', launch_executable: './srcds_run',                      launch_args: '-game tf +maxplayers 24 +map ctf_2fort',                         port: 27015, max_players: 24 },
  { name: 'Left 4 Dead 2',          app_id: '222860', launch_executable: './srcds_run',                      launch_args: '-game left4dead2 +map l4d2_c1m1_hotel +maxplayers 8',             port: 27015, max_players: 8  },
  { name: '7 Days to Die',          app_id: '294420', launch_executable: './7DaysToDieServer.x86_64',        launch_args: '-configfile=serverconfig.xml -dedicated -nographics',             port: 26900, max_players: 8  },
  { name: 'Project Zomboid',        app_id: '380870', launch_executable: './start-server.sh',                launch_args: '',                                                                port: 16261, max_players: 32 },
  { name: 'Terraria (TShock)',      app_id: '105600', launch_executable: './TerrariaServer',                 launch_args: '-port 7777 -maxplayers 8',                                        port: 7777,  max_players: 8  },
  { name: 'DayZ',                   app_id: '223350', launch_executable: './DayZServer',                     launch_args: '-config=serverDZ.cfg -port=2302 -BEpath=battleye',                port: 2302,  max_players: 60 },
  { name: 'Satisfactory',           app_id: '1690800',launch_executable: './FactoryServer.sh',               launch_args: '-multihome=0.0.0.0',                                              port: 7777,  max_players: 4  },
  { name: 'Palworld',               app_id: '2394010',launch_executable: './PalServer.sh',                   launch_args: 'EpicApp=PalServer',                                               port: 8211,  max_players: 32 },
  { name: 'Enshrouded',             app_id: '2278520',launch_executable: './enshrouded_server',              launch_args: '',                                                                port: 15636, max_players: 16 },
];

// ─── GET /api/servers/templates ───────────────────────────────────────────────
router.get('/templates', (req, res) => {
  res.json(TEMPLATES);
});

// ─── GET /api/servers/stats ───────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const servers = db.getServers();
  res.json({
    total:      servers.length,
    running:    servers.filter(s => serverManager.isRunning(s.id)).length,
    installing: servers.filter(s => steamcmd.isInstalling(s.id)).length,
    stopped:    servers.filter(s => !serverManager.isRunning(s.id) && !steamcmd.isInstalling(s.id)).length
  });
});

// ─── GET /api/servers ─────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const servers = db.getServers().map(s => ({
    ...s,
    is_running:    serverManager.isRunning(s.id),
    is_installing: steamcmd.isInstalling(s.id)
  }));
  res.json(servers);
});

// ─── POST /api/servers ────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, app_id, install_dir, launch_executable, launch_args, port, max_players, notes } = req.body;
  if (!name?.trim() || !app_id?.trim() || !install_dir?.trim()) {
    return res.status(400).json({ error: 'Name, App ID, and Install Directory are required' });
  }
  if (!/^\d+$/.test(app_id.trim())) {
    return res.status(400).json({ error: 'App ID must be numeric' });
  }
  const server = db.createServer({ name, app_id, install_dir, launch_executable, launch_args, port, max_players, notes });
  res.status(201).json(server);
});

// ─── GET /api/servers/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const server = db.getServer(parseInt(req.params.id, 10));
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json({
    ...server,
    is_running:    serverManager.isRunning(server.id),
    is_installing: steamcmd.isInstalling(server.id)
  });
});

// ─── PUT /api/servers/:id ─────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.getServer(id)) return res.status(404).json({ error: 'Server not found' });
  res.json(db.updateServer(id, req.body));
});

// ─── DELETE /api/servers/:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.getServer(id)) return res.status(404).json({ error: 'Server not found' });
  if (serverManager.isRunning(id)) {
    return res.status(400).json({ error: 'Stop the server before deleting it' });
  }
  db.deleteServer(id);
  res.json({ message: 'Server deleted' });
});

// ─── POST /api/servers/:id/install ────────────────────────────────────────────
router.post('/:id/install', (req, res) => {
  const id     = parseInt(req.params.id, 10);
  const server = db.getServer(id);
  if (!server)                    return res.status(404).json({ error: 'Server not found' });
  if (steamcmd.isInstalling(id))  return res.status(400).json({ error: 'Already installing' });
  if (serverManager.isRunning(id)) return res.status(400).json({ error: 'Stop the server first' });

  db.updateServer(id, { status: 'installing' });
  steamcmd.installServer(id, server.app_id, server.install_dir, req.app.get('io'), {
    username:   req.body.steam_username  || 'anonymous',
    password:   req.body.steam_password  || '',
    steamGuard: req.body.steam_guard     || ''
  });
  res.json({ message: 'Installation started' });
});

// ─── POST /api/servers/:id/cancel-install ────────────────────────────────────
router.post('/:id/cancel-install', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (steamcmd.cancelInstall(id)) {
    db.updateServer(id, { status: 'stopped' });
    res.json({ message: 'Installation cancelled' });
  } else {
    res.status(400).json({ error: 'No active installation found' });
  }
});

// ─── POST /api/servers/:id/start ─────────────────────────────────────────────
router.post('/:id/start', (req, res) => {
  try {
    const result = serverManager.startServer(parseInt(req.params.id, 10));
    res.json({ message: 'Server started', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/servers/:id/stop ──────────────────────────────────────────────
router.post('/:id/stop', (req, res) => {
  try {
    serverManager.stopServer(parseInt(req.params.id, 10));
    res.json({ message: 'Stop signal sent' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/servers/:id/restart ───────────────────────────────────────────
router.post('/:id/restart', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    if (serverManager.isRunning(id)) {
      serverManager.stopServer(id);
      await new Promise(r => setTimeout(r, 3000));
    }
    const result = serverManager.startServer(id);
    res.json({ message: 'Server restarted', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/servers/:id/update ────────────────────────────────────────────
router.post('/:id/update', (req, res) => {
  const id     = parseInt(req.params.id, 10);
  const server = db.getServer(id);
  if (!server)                     return res.status(404).json({ error: 'Server not found' });
  if (serverManager.isRunning(id)) return res.status(400).json({ error: 'Stop the server before updating' });
  if (steamcmd.isInstalling(id))   return res.status(400).json({ error: 'Already installing/updating' });

  db.updateServer(id, { status: 'updating' });
  steamcmd.installServer(id, server.app_id, server.install_dir, req.app.get('io'), {
    username: req.body.steam_username || 'anonymous',
    password: req.body.steam_password || ''
  });
  res.json({ message: 'Update started' });
});

// ─── POST /api/servers/:id/command ───────────────────────────────────────────
router.post('/:id/command', (req, res) => {
  const { command } = req.body;
  if (!command?.trim()) return res.status(400).json({ error: 'Command is required' });
  try {
    serverManager.sendCommand(parseInt(req.params.id, 10), command.trim());
    res.json({ message: 'Command sent' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
