<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db     = new GSM_DB();
$method = $_SERVER['REQUEST_METHOD'];
$path   = trim($_GET['path'] ?? '');
$action = $_GET['action'] ?? '';

if (!$path && $action !== 'upload') jsonError('path is required', 400);

// ── Security: restrict all access to the configured servers directory ─────────
$serversBase = rtrim($db->getSetting('servers_path') ?: '/opt/servers', '/\\');

function normalizePath(string $p): string {
    $norm = [];
    foreach (explode('/', str_replace('\\', '/', $p)) as $seg) {
        if ($seg === '' || $seg === '.') continue;
        if ($seg === '..') { if ($norm) array_pop($norm); continue; }
        $norm[] = $seg;
    }
    return '/' . implode('/', $norm);
}

$cleanPath = $path ? normalizePath($path) : '';
$cleanBase = normalizePath($serversBase);

function assertInBase(string $p, string $base): void {
    if (!str_starts_with($p . '/', $base . '/')) {
        jsonError('Access denied: path is outside the servers directory', 403);
    }
}

if ($cleanPath) assertInBase($cleanPath, $cleanBase);

// ── GET: list directory or read file ─────────────────────────────────────────
if ($method === 'GET' && $action === '') {
    if (!file_exists($cleanPath)) jsonError('Not found', 404);
    if (is_dir($cleanPath)) {
        $items = [];
        foreach (scandir($cleanPath) as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $full = $cleanPath . '/' . $entry;
            $items[] = [
                'name'     => $entry,
                'path'     => $full,
                'is_dir'   => is_dir($full),
                'size'     => is_file($full) ? filesize($full) : null,
                'modified' => filemtime($full),
            ];
        }
        usort($items, fn($a, $b) => ($b['is_dir'] <=> $a['is_dir']) ?: strcmp($a['name'], $b['name']));
        jsonResponse(['path' => $cleanPath, 'items' => $items]);
    }
    if (is_file($cleanPath)) {
        $size = filesize($cleanPath);
        if ($size > 5 * 1024 * 1024) jsonError('File too large to edit inline (>5 MB)', 400);
        jsonResponse(['content' => file_get_contents($cleanPath)]);
    }
    jsonError('Not a file or directory', 400);
}

// ── PUT: write file ───────────────────────────────────────────────────────────
if ($method === 'PUT' && $action === '') {
    $b = getBody();
    if (!array_key_exists('content', $b)) jsonError('content is required', 400);
    $dir = dirname($cleanPath);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) jsonError('Could not create directory', 500);
    file_put_contents($cleanPath, $b['content']);
    jsonResponse(['ok' => true]);
}

// ── POST mkdir ────────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'mkdir') {
    if (!$cleanPath) jsonError('path is required');
    assertInBase($cleanPath, $cleanBase);
    if (file_exists($cleanPath)) jsonError('Path already exists');
    if (!mkdir($cleanPath, 0755, true)) jsonError('Could not create directory', 500);
    jsonResponse(['ok' => true]);
}

// ── POST upload ───────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'upload') {
    $uploadPath = trim($_POST['path'] ?? '');
    if (!$uploadPath) jsonError('path is required');
    $cleanUpload = normalizePath($uploadPath);
    assertInBase($cleanUpload, $cleanBase);
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) jsonError('No file uploaded or upload error');
    if (!is_dir($cleanUpload) && !mkdir($cleanUpload, 0755, true)) jsonError('Could not create directory', 500);
    $dest = $cleanUpload . '/' . basename($file['name']);
    // Prevent path traversal in filename
    if (basename($dest) !== basename($file['name'])) jsonError('Invalid filename');
    if (!move_uploaded_file($file['tmp_name'], $dest)) jsonError('Failed to save file', 500);
    jsonResponse(['ok' => true, 'path' => $dest]);
}

// ── DELETE: remove file or directory ─────────────────────────────────────────
if ($method === 'DELETE') {
    if (!file_exists($cleanPath)) jsonError('Not found', 404);
    if (is_dir($cleanPath)) {
        // Recursive delete
        $iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($cleanPath, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iter as $f) {
            $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname());
        }
        rmdir($cleanPath);
    } else {
        unlink($cleanPath);
    }
    jsonResponse(['ok' => true]);
}

// ── POST rename / move ────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'rename') {
    $b       = getBody();
    $newName = trim($b['new_name'] ?? '');
    if (!$newName || str_contains($newName, '/') || str_contains($newName, '\\')) {
        jsonError('new_name must be a single filename without path separators');
    }
    if (!file_exists($cleanPath)) jsonError('Source not found', 404);
    $dest = dirname($cleanPath) . '/' . $newName;
    assertInBase($dest, $cleanBase);
    if (file_exists($dest)) jsonError('Destination already exists');
    rename($cleanPath, $dest);
    jsonResponse(['ok' => true, 'new_path' => $dest]);
}

jsonError('Method not allowed', 405);


// ── Security: restrict all access to the configured servers directory ─────────
$serversBase = rtrim($db->getSetting('servers_path') ?: '/opt/servers', '/\\');

// Normalize the requested path manually to defeat traversal (/../ etc.)
$norm = [];
foreach (explode('/', str_replace('\\', '/', $path)) as $seg) {
    if ($seg === '' || $seg === '.') continue;
    if ($seg === '..') { if ($norm) array_pop($norm); continue; }
    $norm[] = $seg;
}
$cleanPath = '/' . implode('/', $norm);

// Normalise the base the same way
$baseNorm = [];
foreach (explode('/', str_replace('\\', '/', $serversBase)) as $seg) {
    if ($seg === '' || $seg === '.') continue;
    if ($seg === '..') { if ($baseNorm) array_pop($baseNorm); continue; }
    $baseNorm[] = $seg;
}
$cleanBase = '/' . implode('/', $baseNorm);

// The requested path must sit inside the servers base directory
if (!str_starts_with($cleanPath . '/', $cleanBase . '/')) {
    jsonError('Access denied: path is outside the servers directory', 403);
}

// ── GET: read file ────────────────────────────────────────────────────────────
if ($method === 'GET') {
    if (!file_exists($cleanPath)) jsonError('File not found', 404);
    if (!is_file($cleanPath))     jsonError('Not a file', 400);
    jsonResponse(['content' => file_get_contents($cleanPath)]);
}

// ── PUT: write file ───────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $b = getBody();
    if (!array_key_exists('content', $b)) jsonError('content is required', 400);
    $dir = dirname($cleanPath);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        jsonError('Could not create directory', 500);
    }
    file_put_contents($cleanPath, $b['content']);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
