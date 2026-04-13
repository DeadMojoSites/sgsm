<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db       = new GSM_DB();
$serverId = (int)($_GET['server_id'] ?? 0);
$limit    = min((int)($_GET['limit'] ?? 60), 1440);
if (!$serverId) jsonError('server_id is required');
if (!isAdmin() && !hasServerPermission($serverId, 'can_console')) jsonError('Forbidden', 403);
jsonResponse($db->getMetrics($serverId, $limit));
