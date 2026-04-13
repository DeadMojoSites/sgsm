<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db       = new GSM_DB();
$method   = $_SERVER['REQUEST_METHOD'];
$serverId = isset($_GET['server_id']) ? (int)$_GET['server_id'] : 0;
$id       = isset($_GET['id'])        ? (int)$_GET['id']        : 0;
$action   = $_GET['action'] ?? '';

if ($serverId && !isAdmin() && !hasServerPermission($serverId, 'can_backups')) {
    jsonError('Forbidden', 403);
}

// ── GET list ──────────────────────────────────────────────────────────────────
if ($method === 'GET' && $id === 0 && $action === '') {
    if (!$serverId) jsonError('server_id is required');
    jsonResponse($db->getBackups($serverId));
}

// ── GET download ─────────────────────────────────────────────────────────────
if ($method === 'GET' && $id > 0 && $action === 'download') {
    $backup = $db->getBackup($id);
    if (!$backup) jsonError('Not found', 404);
    $path = DATA_DIR . '/backups/' . basename($backup['filename']);
    if (!file_exists($path)) jsonError('Backup file not found on disk', 404);
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $backup['filename'] . '"');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// ── POST create backup ────────────────────────────────────────────────────────
if ($method === 'POST' && $action === '') {
    if (!$serverId) jsonError('server_id is required');
    $server = $db->getServer($serverId);
    if (!$server) jsonError('Server not found', 404);
    $backupDir = DATA_DIR . '/backups';
    if (!is_dir($backupDir)) mkdir($backupDir, 0755, true);
    $filename = 'backup-' . $serverId . '-' . date('Ymd-His') . '.tar.gz';
    $backup   = $db->createBackup($serverId, $filename);
    $dest     = $backupDir . '/' . $filename;
    $src      = rtrim($server['install_dir'], '/');
    if (!is_dir($src)) { $db->updateBackup((int)$backup['id'], ['status' => 'failed']); jsonError('Install directory not found'); }
    exec('tar -czf ' . escapeshellarg($dest) . ' -C ' . escapeshellarg(dirname($src)) . ' ' . escapeshellarg(basename($src)) . ' 2>&1', $out, $code);
    if ($code !== 0) { $db->updateBackup((int)$backup['id'], ['status' => 'failed']); jsonError('Backup failed: ' . implode(' ', $out)); }
    $size = file_exists($dest) ? filesize($dest) : 0;
    $db->updateBackup((int)$backup['id'], ['status' => 'completed', 'size' => $size]);
    logActivity('backup.create', "Created backup for server: {$server['name']}", $serverId);
    fireWebhook('backup.created', ['server_id' => $serverId, 'server_name' => $server['name'], 'filename' => $filename, 'size' => $size]);
    jsonResponse($db->getBackup((int)$backup['id']));
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE' && $id > 0) {
    requireAdmin();
    $backup = $db->getBackup($id);
    if (!$backup) jsonError('Not found', 404);
    $path = DATA_DIR . '/backups/' . basename($backup['filename']);
    if (file_exists($path)) unlink($path);
    $db->deleteBackup($id);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
