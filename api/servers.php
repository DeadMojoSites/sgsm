<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db     = new GSM_DB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$action = $_GET['action'] ?? '';

// ── Templates ───────────────────────────────────────────────────────────────
if (isset($_GET['templates'])) {
    jsonResponse([
        ['name' => 'Counter-Strike 2',        'app_id' => '730',     'launch_executable' => './game/bin/linuxsteamrt64/cs2',                        'launch_args' => '-dedicated +map de_dust2 +maxplayers 10',                                              'port' => 27015, 'max_players' => 10  ],
        ['name' => 'Counter-Strike: GO',       'app_id' => '740',     'launch_executable' => './srcds_run',                                          'launch_args' => '-game csgo +maxplayers 10 +map de_dust2',                                              'port' => 27015, 'max_players' => 10  ],
        ['name' => 'Valheim',                  'app_id' => '896660',  'launch_executable' => './valheim_server.x86_64',                              'launch_args' => "-name 'Valheim' -port 2456 -world 'World' -password 'changeme'",                       'port' => 2456,  'max_players' => 10  ],
        ['name' => 'Rust',                     'app_id' => '258550',  'launch_executable' => './RustDedicated',                                      'launch_args' => '-batchmode +server.port 28015 +server.hostname "Rust Server"',                         'port' => 28015, 'max_players' => 50  ],
        ['name' => 'ARK: Survival Evolved',    'app_id' => '376030',  'launch_executable' => './ShooterGameServer',                                  'launch_args' => 'TheIsland?SessionName=ARK?Port=7777?QueryPort=27015 -server -log',                     'port' => 7777,  'max_players' => 70  ],
        ['name' => 'ARK: Survival Ascended',   'app_id' => '2430930', 'launch_executable' => './ArkAscendedServer.sh',                               'launch_args' => 'TheIsland_WP?SessionName=ASA?Port=7777?QueryPort=27015 -server -log',                 'port' => 7777,  'max_players' => 70  ],
        ['name' => "Garry's Mod",              'app_id' => '4020',    'launch_executable' => './srcds_run',                                          'launch_args' => '-game garrysmod +maxplayers 16 +map gm_flatgrass',                                     'port' => 27015, 'max_players' => 16  ],
        ['name' => 'Team Fortress 2',          'app_id' => '232250',  'launch_executable' => './srcds_run',                                          'launch_args' => '-game tf +maxplayers 24 +map ctf_2fort',                                               'port' => 27015, 'max_players' => 24  ],
        ['name' => 'Left 4 Dead 2',            'app_id' => '222860',  'launch_executable' => './srcds_run',                                          'launch_args' => '-game left4dead2 +map l4d2_c1m1_hotel +maxplayers 8',                                  'port' => 27015, 'max_players' => 8   ],
        ['name' => '7 Days to Die',            'app_id' => '294420',  'launch_executable' => './7DaysToDieServer.x86_64',                            'launch_args' => '-configfile=serverconfig.xml -dedicated -nographics',                                  'port' => 26900, 'max_players' => 8   ],
        ['name' => 'Project Zomboid',          'app_id' => '380870',  'launch_executable' => './start-server.sh',                                    'launch_args' => '',                                                                                     'port' => 16261, 'max_players' => 32  ],
        ['name' => 'Terraria (TShock)',        'app_id' => '105600',  'launch_executable' => './TerrariaServer',                                     'launch_args' => '-port 7777 -maxplayers 8',                                                             'port' => 7777,  'max_players' => 8   ],
        ['name' => 'DayZ',                     'app_id' => '223350',  'launch_executable' => './DayZServer',                                         'launch_args' => '-config=serverDZ.cfg -port=2302 -BEpath=battleye',                                     'port' => 2302,  'max_players' => 60,  'requires_login' => true ],
        ['name' => 'Satisfactory',             'app_id' => '1690800', 'launch_executable' => './Engine/Binaries/Linux/FactoryServer-Linux-Shipping', 'launch_args' => '-multihome=0.0.0.0 -MaxPlayers=4',                                                    'port' => 7777,  'max_players' => 4   ],
        ['name' => 'Palworld',                 'app_id' => '2394010', 'launch_executable' => './PalServer.sh',                                       'launch_args' => 'EpicApp=PalServer',                                                                    'port' => 8211,  'max_players' => 32  ],
        ['name' => 'Enshrouded',               'app_id' => '2278520', 'launch_executable' => './enshrouded_server',                                  'launch_args' => '',                                                                                     'port' => 15636, 'max_players' => 16,  'requires_login' => true ],
        ['name' => 'Arma Reforger',            'app_id' => '1874900', 'launch_executable' => './ArmaReforgerServer',                                 'launch_args' => '-config {INSTALL_DIR}/config.json -profile {INSTALL_DIR}/profile -maxFPS 30 -nothrow',  'port' => 2001,  'max_players' => 32  ],
        ['name' => 'Space Engineers DS',       'app_id' => '298740',  'launch_executable' => './SpaceEngineersDedicated.exe',                        'launch_args' => '-console -path ./saves',                                                               'port' => 27016, 'max_players' => 16  ],
        ['name' => 'Squad',                    'app_id' => '403240',  'launch_executable' => './SquadGameServer.sh',                                 'launch_args' => 'SquadGame -log -Port=7787 -QueryPort=27165',                                           'port' => 7787,  'max_players' => 100, 'requires_login' => true ],
        ['name' => 'Conan Exiles',             'app_id' => '443030',  'launch_executable' => './ConanSandbox/Binaries/Win64/ConanSandboxServer.exe', 'launch_args' => '-MaxPlayers=40 -Port=7777 -QueryPort=27015 -log',                                      'port' => 7777,  'max_players' => 40,  'requires_login' => true ],
        ['name' => 'The Forest',               'app_id' => '556450',  'launch_executable' => './TheForestDedicatedServer',                           'launch_args' => '-serverip 0.0.0.0 -serverport 27015 -serverplayers 8 -servername "The Forest"',        'port' => 27015, 'max_players' => 8   ],
        ['name' => 'Sons of the Forest',       'app_id' => '1326470', 'launch_executable' => './SonsOfTheForestDS',                                  'launch_args' => '',                                                                                     'port' => 8766,  'max_players' => 8   ],
        ['name' => 'Killing Floor 2',          'app_id' => '232130',  'launch_executable' => './KFGameSteamServer.sh',                               'launch_args' => 'KF-BioticsLab?Difficulty=0?GameLength=1 -Port=7777',                                   'port' => 7777,  'max_players' => 6   ],
        ['name' => 'V Rising',                 'app_id' => '1829350', 'launch_executable' => './VRisingServer.exe',                                  'launch_args' => '-persistentDataPath ./save-data -serverName "V Rising" -maxConnectedUsers 40',         'port' => 9876,  'max_players' => 40,  'requires_login' => true ],
    ]);
}

// ── Sync helper ─────────────────────────────────────────────────────────────
function syncStatus(array &$s): void {
    global $db;
    if (in_array($s['status'], ['running', 'installing'])) {
        $cid = $s['container_id'] ?? '';
        if (!$cid || !isContainerRunning($cid)) {
            // Check if it's an install container that exited normally
            $newStatus = 'stopped';
            if ($s['status'] === 'installing' && $cid) {
                $info = docker()->inspectContainer($cid);
                if ($info !== null && ($info['State']['ExitCode'] ?? 1) === 0) {
                    // Clean exit — install succeeded, remove the install container
                    try { docker()->removeContainer($cid, true); } catch (RuntimeException) {}
                }
            }
            $db->updateServer((int)$s['id'], ['status' => $newStatus, 'container_id' => '']);
            $s['status']       = $newStatus;
            $s['container_id'] = '';
        }
    }
}

// ── GET list / single ────────────────────────────────────────────────────────
if ($method === 'GET' && $id === 0 && $action === '') {
    $servers = $db->getServers();
    foreach ($servers as &$s) syncStatus($s);
    jsonResponse($servers);
}

if ($method === 'GET' && $id > 0) {
    $s = $db->getServer($id);
    if (!$s) jsonError('Not found', 404);
    syncStatus($s);
    jsonResponse($s);
}

// ── GET stats ────────────────────────────────────────────────────────────────
if (isset($_GET['stats'])) {
    $servers  = $db->getServers();
    $total    = count($servers);
    $running  = 0; $stopped = 0; $installing = 0;
    foreach ($servers as $s) {
        syncStatus($s);
        match ($s['status']) {
            'running'    => $running++,
            'installing' => $installing++,
            default      => $stopped++,
        };
    }
    jsonResponse(compact('total', 'running', 'stopped', 'installing'));
}

// ── POST create ──────────────────────────────────────────────────────────────
if ($method === 'POST' && $id === 0 && $action === '') {
    $b = getBody();
    if (empty(trim($b['name'] ?? '')))       jsonError('Server name is required');
    if (empty(trim($b['app_id'] ?? '')))     jsonError('Steam App ID is required');
    if (!ctype_digit($b['app_id']))          jsonError('App ID must be numeric');
    if (empty(trim($b['install_dir'] ?? ''))) jsonError('Install directory is required');
    $newServer = $db->createServer($b);

    // Pre-create config.json & profile dir so setup modal can access them immediately
    $installDir = rtrim($newServer['install_dir'], '/');
    $args = str_replace('{INSTALL_DIR}', '/server', $newServer['launch_args'] ?? '');
    if (preg_match('/-config\s+(\S+)/', $args, $cfgM)) {
        $cfgInContainer = $cfgM[1];
        $cfgOnHost = str_replace('/server/', $installDir . '/', $cfgInContainer);
        ensureArmaConfig($cfgOnHost, $newServer);
    }
    if (preg_match('/-profile\s+(\S+)/', $args, $profM)) {
        $profileOnHost = str_replace('/server/', $installDir . '/', $profM[1]);
        if (!is_dir($profileOnHost)) mkdir($profileOnHost, 0755, true);
    }

    jsonResponse($newServer, 201);
}

// ── PUT update ───────────────────────────────────────────────────────────────
if ($method === 'PUT' && $id > 0) {
    if (!$db->getServer($id)) jsonError('Not found', 404);
    jsonResponse($db->updateServer($id, getBody()));
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE' && $id > 0) {
    $s = $db->getServer($id);
    if (!$s) jsonError('Not found', 404);
    if (in_array($s['status'], ['running', 'installing'])) jsonError('Stop the server before deleting it');
    // Remove the game server container and install container if they exist
    try {
        $d = docker();
        foreach ([containerName($id), 'gsm-install-' . $id] as $cname) {
            $info = $d->inspectContainer($cname);
            if ($info !== null) $d->removeContainer($cname, true);
        }
    } catch (RuntimeException) {}
    $db->deleteServer($id);
    @unlink(DATA_DIR . '/logs/server-' . $id . '.log');
    @unlink(DATA_DIR . '/logs/install-' . $id . '.log');
    jsonResponse(['ok' => true]);
}

// ── Actions ──────────────────────────────────────────────────────────────────
if ($method === 'POST' && $id > 0 && $action !== '') {
    $s = $db->getServer($id);
    if (!$s) jsonError('Not found', 404);
    syncStatus($s);

    switch ($action) {

        case 'start':
            if ($s['status'] === 'running') jsonError('Server is already running');
            try {
                $containerId = startServer($s);
                $db->updateServer($id, ['status' => 'running', 'container_id' => $containerId]);
                jsonResponse(['ok' => true, 'container_id' => $containerId]);
            } catch (RuntimeException $e) {
                jsonError($e->getMessage());
            }

        case 'stop':
            if ($s['status'] !== 'running') jsonError('Server is not running');
            stopContainer($s['container_id'] ?? '');
            $db->updateServer($id, ['status' => 'stopped', 'container_id' => '']);
            jsonResponse(['ok' => true]);

        case 'install':
            if ($s['status'] === 'running')    jsonError('Stop the server before installing');
            if ($s['status'] === 'installing') jsonError('Installation already in progress');
            $steamUser = $db->getSetting('steam_username') ?: '';
            $steamPass = $db->getSetting('steam_password') ?: '';
            try {
                $containerId = installServer($s, $steamUser, $steamPass);
                $db->updateServer($id, ['status' => 'installing', 'container_id' => $containerId]);
                jsonResponse(['ok' => true, 'container_id' => $containerId]);
            } catch (RuntimeException $e) {
                jsonError($e->getMessage());
            }

        case 'cancel-install':
            if ($s['status'] !== 'installing') jsonError('No active installation');
            stopContainer($s['container_id'] ?? '');
            $db->updateServer($id, ['status' => 'stopped', 'container_id' => '']);
            jsonResponse(['ok' => true]);

        case 'restart':
            stopContainer($s['container_id'] ?? '');
            try {
                $containerId = startServer($s);
                $db->updateServer($id, ['status' => 'running', 'container_id' => $containerId]);
                jsonResponse(['ok' => true, 'container_id' => $containerId]);
            } catch (RuntimeException $e) {
                $db->updateServer($id, ['status' => 'stopped', 'container_id' => '']);
                jsonError($e->getMessage());
            }

        case 'stats':
            if ($s['status'] !== 'running' || empty($s['container_id'])) {
                jsonResponse(['cpu_pct' => 0, 'mem_mb' => 0, 'mem_limit_mb' => 0]);
            }
            try {
                $stats = docker()->getStats($s['container_id']);
                jsonResponse(docker()->calcStats($stats));
            } catch (RuntimeException $e) {
                jsonResponse(['cpu_pct' => 0, 'mem_mb' => 0, 'mem_limit_mb' => 0]);
            }

        default:
            jsonError("Unknown action: $action", 404);
    }
}

jsonError('Not found', 404);
