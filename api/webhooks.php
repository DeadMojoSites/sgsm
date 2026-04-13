<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();
requireAdmin();

$db     = new GSM_DB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($method === 'GET'    && $id === 0) jsonResponse($db->getWebhooks());
if ($method === 'GET'    && $id > 0)  { $w = $db->getWebhook($id); if (!$w) jsonError('Not found', 404); jsonResponse($w); }
if ($method === 'POST')  {
    $b = getBody();
    if (empty($b['event'])) jsonError('event is required');
    if (empty($b['url']))   jsonError('url is required');
    if (!filter_var($b['url'], FILTER_VALIDATE_URL)) jsonError('Invalid URL');
    jsonResponse($db->createWebhook($b), 201);
}
if ($method === 'PUT'    && $id > 0)  { $db->updateWebhook($id, getBody()); jsonResponse($db->getWebhook($id)); }
if ($method === 'DELETE' && $id > 0)  { $db->deleteWebhook($id); jsonResponse(['ok' => true]); }

jsonError('Method not allowed', 405);
