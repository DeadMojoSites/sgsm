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

// ── GET list ──────────────────────────────────────────────────────────────────
if ($method === 'GET' && $id === 0) {
    requireAdmin();
    if (!$serverId) jsonError('server_id is required');
    jsonResponse($db->getSchedules($serverId));
}

// ── POST create ───────────────────────────────────────────────────────────────
if ($method === 'POST') {
    requireAdmin();
    $b   = getBody();
    $sid = $serverId ?: (int)($b['server_id'] ?? 0);
    if (!$sid) jsonError('server_id is required');
    if (empty($b['action']))          jsonError('action is required');
    if (empty($b['cron_expression'])) jsonError('cron_expression is required');
    if (!in_array($b['action'], ['start','stop','restart'], true)) jsonError('action must be start, stop, or restart');
    jsonResponse($db->createSchedule($sid, $b), 201);
}

// ── PUT update ────────────────────────────────────────────────────────────────
if ($method === 'PUT' && $id > 0) {
    requireAdmin();
    if (!$db->getSchedule($id)) jsonError('Not found', 404);
    $db->updateSchedule($id, getBody());
    jsonResponse($db->getSchedule($id));
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE' && $id > 0) {
    requireAdmin();
    $db->deleteSchedule($id);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
