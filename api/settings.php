<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db     = new GSM_DB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET all settings ─────────────────────────────────────────────────────────
if ($method === 'GET' && $action === '') {
    $s = $db->getSettings();
    unset($s['admin_password_hash']); // never expose
    jsonResponse($s);
}

// ── POST save settings ───────────────────────────────────────────────────────
if ($method === 'POST' && $action === '') {
    $b       = getBody();
    $allowed = [
        'app_name', 'steamcmd_path', 'servers_path', 'steam_api_key',
        'db_type', 'db_host', 'db_port', 'db_name', 'db_user', 'db_password',
        'update_repo_url',
        'custom_api_key_1_name', 'custom_api_key_1_value',
        'custom_api_key_2_name', 'custom_api_key_2_value',
    ];
    foreach ($allowed as $key) {
        if (array_key_exists($key, $b)) {
            $db->setSetting($key, (string)$b[$key]);
        }
    }
    jsonResponse(['ok' => true]);
}

// ── POST upload logo ─────────────────────────────────────────────────────────
if ($action === 'upload-logo' && $method === 'POST') {
    $file = $_FILES['logo'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) jsonError('No file uploaded');

    $allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    $finfo   = new finfo(FILEINFO_MIME_TYPE);
    $mime    = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $allowed, true)) jsonError('Invalid file type. Use PNG, JPG, SVG or WebP.');
    if ($file['size'] > 5 * 1024 * 1024) jsonError('File too large (max 5 MB)');

    $uploadDir = DATA_DIR . '/uploads';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $ext  = pathinfo($file['name'], PATHINFO_EXTENSION);
    $name = 'logo_' . time() . '.' . strtolower($ext);
    $dest = $uploadDir . '/' . $name;

    if (!move_uploaded_file($file['tmp_name'], $dest)) jsonError('Failed to save file');

    $db->setSetting('logo_path', 'data/uploads/' . $name);
    jsonResponse(['ok' => true, 'path' => 'data/uploads/' . $name]);
}

// ── POST test DB connection ───────────────────────────────────────────────────
if ($action === 'test-db' && $method === 'POST') {
    $b    = getBody();
    $type = $b['db_type'] ?? 'none';
    if ($type === 'none') jsonResponse(['ok' => true, 'message' => 'No external DB configured']);

    try {
        $host = $b['db_host'] ?? '127.0.0.1';
        $port = (int)($b['db_port'] ?? ($type === 'mysql' ? 3306 : 5432));
        $name = $b['db_name'] ?? '';
        $user = $b['db_user'] ?? '';
        $pass = $b['db_password'] ?? '';
        $dsn  = $type === 'mysql'
            ? "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4"
            : "pgsql:host=$host;port=$port;dbname=$name";
        new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 5]);
        jsonResponse(['ok' => true, 'message' => 'Connection successful']);
    } catch (PDOException $e) {
        jsonError('Connection failed: ' . $e->getMessage());
    }
}

// ── POST run update ───────────────────────────────────────────────────────────
if ($action === 'update' && $method === 'POST') {
    $log = DATA_DIR . '/logs/update.log';
    if (!is_dir(dirname($log))) mkdir(dirname($log), 0755, true);

    $image = 'ghcr.io/mbrown22073/sgsm:latest';
    $msg   = implode("\n", [
        '[' . date('Y-m-d H:i:s') . '] --- Update check started ---',
        'This application runs inside a Docker container.',
        'To update to the latest version:',
        '',
        '  1. On your Synology, open Container Manager',
        '  2. Stop and remove this container',
        '  3. Run: docker pull ' . $image,
        '  4. Recreate the container from your docker-compose.yml',
        '',
        'Your data (servers, settings, logs) is stored in Docker volumes',
        'and will be preserved across updates.',
        '[' . date('Y-m-d H:i:s') . '] --- Done ---',
    ]);
    file_put_contents($log, $msg . "\n");
    jsonResponse(['ok' => true]);
}

jsonError('Not found', 404);
