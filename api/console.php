<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

// Polling-based log reader — returns JSON instantly, no long-running connection.
// Client calls repeatedly with ?offset=N to get new lines since last read.
//
// For Docker containers, offset 0 = "last 200 lines", offset > 0 = Unix timestamp
// treated as a "since" cursor so only new lines are returned. The returned offset
// is always the current Unix timestamp when reading from Docker.

$id     = (int)($_GET['id'] ?? 0);
$type   = preg_replace('/[^a-z]/', '', $_GET['type'] ?? 'server');
$offset = max(0, (int)($_GET['offset'] ?? 0));

$lines     = [];
$newOffset = $offset;

// ── Docker-based log reading ─────────────────────────────────────────────────
if ($id > 0 && in_array($type, ['server', 'install'])) {
    $db = new GSM_DB();
    $s  = $db->getServer($id);
    $containerId = $s['container_id'] ?? '';

    if ($containerId) {
        try {
            // offset=0 → initial load (last 200 lines); offset>0 → since‐timestamp poll
            $since = ($offset > 10000) ? $offset : null;
            $raw   = docker()->getLogs($containerId, 200, $since);
            $newOffset = time();
            foreach (explode("\n", $raw) as $line) {
                if ($line !== '') $lines[] = $line;
            }
            jsonResponse(['lines' => $lines, 'offset' => $newOffset]);
        } catch (RuntimeException) {
            // Container gone — fall through to file-based fallback
        }
    }
}

// ── File-based log reading (fallback / update log) ───────────────────────────
if ($type === 'update') {
    $logFile = DATA_DIR . '/logs/update.log';
} elseif ($id > 0 && in_array($type, ['server', 'install'])) {
    $logFile = DATA_DIR . '/logs/' . $type . '-' . $id . '.log';
} else {
    jsonError('Invalid parameters', 400);
}

clearstatcache(true, $logFile);
if (file_exists($logFile)) {
    $size = filesize($logFile);
    if ($size > $offset) {
        $fh = fopen($logFile, 'rb');
        fseek($fh, $offset);
        $data = fread($fh, $size - $offset);
        fclose($fh);
        $newOffset = $size;
        foreach (explode("\n", $data) as $line) {
            if ($line !== '') $lines[] = $line;
        }
    }
} elseif ($offset === 0) {
    $lines[] = 'Waiting for container to start...';
}

jsonResponse(['lines' => $lines, 'offset' => $newOffset]);
