<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();

$db     = new GSM_DB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Setup (first-run)
if ($action === 'setup' && $method === 'POST') {
    $users = $db->getUsers();
    if ($users) jsonError('Setup already complete', 400);
    $b        = getBody();
    $username = trim($b['username'] ?? '');
    $password = $b['password']     ?? '';
    $appName  = trim($b['app_name'] ?? 'Steam Game Server Manager');
    if (!$username)            jsonError('Username is required');
    if (strlen($password) < 8) jsonError('Password must be at least 8 characters');
    $db->setSetting('app_name',       $appName);
    $db->setSetting('setup_complete', '1');
    $db->setSetting('admin_username', $username);
    $db->createUser([
        'username'      => $username,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role'          => 'admin',
        'is_active'     => 1,
    ]);
    jsonResponse(['ok' => true]);
}

// Login
if ($action === 'login' && $method === 'POST') {
    $b        = getBody();
    $username = trim($b['username'] ?? '');
    $password = $b['password']      ?? '';
    $user     = $db->getUserByUsername($username);
    if (!$user || !$user['is_active'] || !password_verify($password, $user['password_hash'])) {
        jsonError('Invalid username or password', 401);
    }
    session_regenerate_id(true);
    $_SESSION['gsm_user_id']  = (int)$user['id'];
    $_SESSION['gsm_username'] = $user['username'];
    $_SESSION['gsm_role']     = $user['role'];
    $db->updateUser((int)$user['id'], ['last_login' => date('Y-m-d H:i:s')]);
    logActivity('auth.login', 'User logged in');
    jsonResponse(['ok' => true, 'role' => $user['role'], 'username' => $user['username']]);
}

// Logout
if ($action === 'logout' && $method === 'POST') {
    if (isLoggedIn()) logActivity('auth.logout', 'User logged out');
    session_destroy();
    jsonResponse(['ok' => true]);
}

// Me
if ($action === 'me' && $method === 'GET') {
    requireAuth();
    $user = $db->getUser(currentUserId());
    if (!$user) jsonError('User not found', 404);
    jsonResponse($user);
}

// Change password
if ($action === 'change-password' && $method === 'POST') {
    requireAuth();
    $b        = getBody();
    $current  = $b['current_password'] ?? '';
    $newPass  = $b['new_password']     ?? '';
    $targetId = (isAdmin() && isset($b['user_id'])) ? (int)$b['user_id'] : currentUserId();
    $user     = $db->getUser($targetId);
    if (!$user) jsonError('User not found', 404);
    if ($targetId === currentUserId()) {
        $full = $db->getUserByUsername($user['username']);
        if (!password_verify($current, $full['password_hash'])) {
            jsonError('Current password is incorrect', 401);
        }
    } else {
        requireAdmin();
    }
    if (strlen($newPass) < 8) jsonError('Password must be at least 8 characters');
    $db->updateUser($targetId, ['password_hash' => password_hash($newPass, PASSWORD_DEFAULT)]);
    logActivity('auth.password-change', "Password changed for user: {$user['username']}");
    jsonResponse(['ok' => true]);
}

jsonError('Unknown action', 400);