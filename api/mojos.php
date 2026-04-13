<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db     = new GSM_DB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// ── GET list (with variables) ─────────────────────────────────────────────────
if ($method === 'GET' && $id === 0) {
    $mojos = $db->getMojos();
    foreach ($mojos as &$m) {
        $m['variables'] = $db->getMojoVariables((int)$m['id']);
    }
    jsonResponse($mojos);
}

// ── GET single ────────────────────────────────────────────────────────────────
if ($method === 'GET' && $id > 0) {
    $mojo = $db->getMojo($id);
    if (!$mojo) jsonError('Not found', 404);
    $mojo['variables'] = $db->getMojoVariables($id);
    jsonResponse($mojo);
}

// ── POST create ───────────────────────────────────────────────────────────────
if ($method === 'POST' && $id === 0) {
    requireAdmin();
    $b = getBody();
    if (empty($b['name'])) jsonError('name is required');
    if (empty($b['slug'])) $b['slug'] = strtolower(preg_replace('/[^a-z0-9]+/i', '-', trim($b['name'])));
    $mojo = $db->createMojo($b);
    if (!empty($b['variables']) && is_array($b['variables'])) {
        foreach ($b['variables'] as $v) {
            $db->upsertMojoVariable((int)$mojo['id'], $v['env_key'], $v);
        }
        $mojo['variables'] = $db->getMojoVariables((int)$mojo['id']);
    }
    jsonResponse($mojo, 201);
}

// ── PUT update ────────────────────────────────────────────────────────────────
if ($method === 'PUT' && $id > 0) {
    requireAdmin();
    $mojo = $db->getMojo($id);
    if (!$mojo) jsonError('Not found', 404);
    $b    = getBody();
    $mojo = $db->updateMojo($id, $b);
    if (isset($b['variables']) && is_array($b['variables'])) {
        foreach ($b['variables'] as $v) {
            $db->upsertMojoVariable($id, $v['env_key'], $v);
        }
    }
    $mojo['variables'] = $db->getMojoVariables($id);
    jsonResponse($mojo);
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE' && $id > 0) {
    requireAdmin();
    $mojo = $db->getMojo($id);
    if (!$mojo) jsonError('Not found', 404);
    if ($mojo['is_builtin']) jsonError('Cannot delete built-in Mojos');
    $db->deleteMojo($id);
    jsonResponse(['ok' => true]);
}

// ── DELETE variable ───────────────────────────────────────────────────────────
if ($method === 'DELETE' && isset($_GET['variable_id'])) {
    requireAdmin();
    $db->deleteMojoVariable((int)$_GET['variable_id']);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
