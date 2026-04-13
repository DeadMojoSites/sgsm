<?php
declare(strict_types=1);
require_once __DIR__ . '/includes/db.php';
session_start();

$db = new GSM_DB();

// Base path for use in HTML (empty at root, /subdir when in XAMPP subdir)
$base = rtrim(str_replace('\\','/', dirname($_SERVER['PHP_SELF'])), '/');
if ($base === '.') $base = '';
define('BASE', $base);

// First-run setup
if (!$db->getSetting('setup_complete')) {
    require __DIR__ . '/pages/setup.php';
    exit;
}

// Auth
require_once __DIR__ . '/includes/helpers.php';
if (empty($_SESSION['gsm_user_id'])) {
    require __DIR__ . '/pages/login.php';
    exit;
}

$page      = preg_replace('/[^a-z]/', '', $_GET['p'] ?? 'dashboard');
$isAdmin    = isAdmin();
$validPages = ['dashboard', 'servers', 'settings', 'users', 'mojos', 'activity'];
if (!in_array($page, $validPages)) $page = 'dashboard';
// Restrict admin-only pages
if (in_array($page, ['users', 'mojos', 'settings']) && !$isAdmin) $page = 'dashboard';

$appName  = $db->getSetting('app_name') ?: 'Game Server Manager';
$logoPath = $db->getSetting('logo_path');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><?= htmlspecialchars($appName) ?></title>
  <link rel="stylesheet" href="<?= BASE ?>/assets/style.css">
</head>
<body>
<div class="app-shell">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <?php if ($logoPath && file_exists(__DIR__ . '/' . $logoPath)): ?>
        <img src="<?= BASE ?>/<?= htmlspecialchars($logoPath) ?>" alt="Logo" class="brand-logo">
      <?php else: ?>
        <svg class="brand-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      <?php endif; ?>
      <span class="brand-name"><?= htmlspecialchars($appName) ?></span>
    </div>

    <nav class="sidebar-nav">
      <a href="<?= BASE ?>/?p=dashboard" class="nav-item <?= $page === 'dashboard' ? 'active' : '' ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Dashboard
      </a>
      <a href="<?= BASE ?>/?p=servers" class="nav-item <?= $page === 'servers' ? 'active' : '' ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/></svg>
        Servers
      </a>
      <a href="<?= BASE ?>/?p=activity" class="nav-item <?= $page === 'activity' ? 'active' : '' ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Activity
      </a>
      <?php if ($isAdmin): ?>
      <a href="<?= BASE ?>/?p=users" class="nav-item <?= $page === 'users' ? 'active' : '' ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        Users
      </a>
      <a href="<?= BASE ?>/?p=mojos" class="nav-item <?= $page === 'mojos' ? 'active' : '' ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
        Mojos
      </a>
      <a href="<?= BASE ?>/?p=settings" class="nav-item <?= $page === 'settings' ? 'active' : '' ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        Settings
      </a>
      <?php endif; ?>
    </nav>

    <div class="sidebar-footer">
      <a href="<?= BASE ?>/api/auth.php?action=logout" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Logout
      </a>
    </div>
  </aside>

  <!-- Main content -->
  <main class="main-content">
    <div id="toast" class="toast" style="display:none"></div>
    <?php require __DIR__ . '/pages/' . $page . '.php'; ?>
  </main>

</div>

<script>
window.GSM_BASE    = '<?= BASE ?>';
window.GSM_IS_ADMIN = <?= $isAdmin ? 'true' : 'false' ?>;
window.GSM_USER_ID  = <?= (int)currentUserId() ?>;
</script>
<script src="<?= BASE ?>/assets/app.js"></script>
</body>
</html>
