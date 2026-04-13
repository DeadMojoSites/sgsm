<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db       = new GSM_DB();
$serverId = isset($_GET['server_id']) ? (int)$_GET['server_id'] : null;
$limit    = min((int)($_GET['limit'] ?? 100), 500);

if (!isAdmin()) {
    if (!$serverId) jsonError('Forbidden', 403);
    if (!hasServerPermission($serverId, 'can_console')) jsonError('Forbidden', 403);
}

jsonResponse($db->getActivityLog($limit, $serverId));
