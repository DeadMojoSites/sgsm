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
