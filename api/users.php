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

// ── GET list ──────────────────────────────────────────────────────────────────
if ($method === 'GET' && $id === 0 && $action === '') {
    requireAdmin();
    jsonResponse($db->getUsers());
}

// ── GET single ────────────────────────────────────────────────────────────────
if ($method === 'GET' && $id > 0 && $action === '') {
    requireAdmin();
    $user = $db->getUser($id);
    if (!$user) jsonError('Not found', 404);
    $user['permissions'] = $db->getServerPermissionsForUser($id);
    jsonResponse($user);
}

// ── POST create ───────────────────────────────────────────────────────────────
if ($method === 'POST' && $id === 0 && $action === '') {
    requireAdmin();
    $b        = getBody();
    $username = trim($b['username'] ?? '');
    $password = $b['password']      ?? '';
    $email    = trim($b['email']    ?? '');
    $role     = in_array($b['role'] ?? '', ['admin','subuser']) ? $b['role'] : 'subuser';
    if (!$username)            jsonError('Username is required');
    if (strlen($password) < 8) jsonError('Password must be at least 8 characters');
    if ($db->getUserByUsername($username)) jsonError('Username already exists');
    $user = $db->createUser(['username' => $username, 'email' => $email, 'password_hash' => password_hash($password, PASSWORD_DEFAULT), 'role' => $role, 'is_active' => 1]);
    logActivity('user.create', "Created user: $username");
    jsonResponse($user, 201);
}

// ── PUT update ────────────────────────────────────────────────────────────────
if ($method === 'PUT' && $id > 0 && $action === '') {
    requireAdmin();
    $user = $db->getUser($id);
    if (!$user) jsonError('Not found', 404);
    $b = getBody(); $updates = [];
    if (isset($b['email']))     $updates['email']     = trim($b['email']);
    if (isset($b['role']))      $updates['role']      = in_array($b['role'], ['admin','subuser']) ? $b['role'] : $user['role'];
    if (isset($b['is_active'])) $updates['is_active'] = (int)$b['is_active'];
    if (!empty($b['password'])) {
        if (strlen($b['password']) < 8) jsonError('Password must be at least 8 characters');
        $updates['password_hash'] = password_hash($b['password'], PASSWORD_DEFAULT);
    }
    $db->updateUser($id, $updates);
    logActivity('user.update', "Updated user: {$user['username']}");
    jsonResponse($db->getUser($id));
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE' && $id > 0) {
    requireAdmin();
    if ($id === currentUserId()) jsonError('Cannot delete your own account');
    $user = $db->getUser($id);
    if (!$user) jsonError('Not found', 404);
    $db->deleteUser($id);
    logActivity('user.delete', "Deleted user: {$user['username']}");
    jsonResponse(['ok' => true]);
}

// ── PUT permissions ───────────────────────────────────────────────────────────
if ($method === 'PUT' && $action === 'permissions') {
    requireAdmin();
    $b        = getBody();
    $userId   = (int)($b['user_id']   ?? 0);
    $serverId = (int)($b['server_id'] ?? 0);
    if (!$userId || !$serverId) jsonError('user_id and server_id are required');
    $db->setServerPermissions($userId, $serverId, $b);
    logActivity('user.permissions', "Updated permissions for user $userId on server $serverId");
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
