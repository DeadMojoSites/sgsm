<?php
$servers = $db->getServers();
$total   = count($servers);
$running = $stopped = $installing = 0;
foreach ($servers as $s) {
    match ($s['status']) {
        'running'    => $running++,
        'installing' => $installing++,
        default      => $stopped++,
    };
}
$recentActivity = $db->getActivityLog(10);
?>
<div class="page-header">
  <h2 class="page-title">Dashboard</h2>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon" style="background:rgba(26,159,255,.12);color:var(--blue)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/></svg>
    </div>
    <div class="stat-info"><div class="stat-value"><?= $total ?></div><div class="stat-label">Total Servers</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon" style="background:rgba(76,217,100,.12);color:#4cd964">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </div>
    <div class="stat-info"><div class="stat-value"><?= $running ?></div><div class="stat-label">Running</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon" style="background:rgba(255,59,48,.12);color:#ff3b30">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    </div>
    <div class="stat-info"><div class="stat-value"><?= $stopped ?></div><div class="stat-label">Stopped</div></div>
  </div>
  <div class="stat-card">
    <div class="stat-icon" style="background:rgba(255,204,0,.12);color:#ffcc00">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
    </div>
    <div class="stat-info"><div class="stat-value"><?= $installing ?></div><div class="stat-label">Installing</div></div>
  </div>
</div>

<div class="dashboard-grid">

<?php if ($servers): ?>
<div class="card">
  <div class="card-header"><h3 class="card-title">Servers</h3></div>
  <table class="table">
    <thead><tr><th>Name</th><th>App ID</th><th>Status</th><th>Port</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($servers as $s): ?>
      <tr>
        <td><?= htmlspecialchars($s['name']) ?></td>
        <td><span class="badge"><?= htmlspecialchars($s['app_id']) ?></span></td>
        <td><span class="status-badge status-<?= $s['status'] ?>"><?= ucfirst($s['status']) ?></span></td>
        <td><?= $s['port'] ? htmlspecialchars((string)$s['port']) : '—' ?></td>
        <td>
          <a href="<?= BASE ?>/?p=servers" class="btn btn-ghost btn-sm">Manage</a>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php else: ?>
<div class="empty-state">
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/></svg>
  <p>No servers yet. <a href="<?= BASE ?>/?p=servers">Add your first server →</a></p>
</div>
<?php endif; ?>

<div class="card">
  <div class="card-header">
    <h3 class="card-title">Recent Activity</h3>
    <a href="<?= BASE ?>/?p=activity" class="btn btn-ghost btn-sm">View all</a>
  </div>
  <?php if ($recentActivity): ?>
  <table class="table">
    <tbody>
    <?php foreach ($recentActivity as $a): ?>
      <tr>
        <td style="white-space:nowrap;color:var(--text-muted);font-size:0.8rem"><?= date('M j H:i', strtotime($a['created_at'])) ?></td>
        <td><span class="badge badge-neutral"><?= htmlspecialchars($a['action']) ?></span></td>
        <td><?= htmlspecialchars($a['description'] ?? '') ?></td>
        <td style="color:var(--text-muted);font-size:0.8rem"><?= htmlspecialchars($a['username'] ?? 'system') ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <?php else: ?>
  <p class="text-muted" style="padding:1rem">No activity yet.</p>
  <?php endif; ?>
</div>

</div><!-- .dashboard-grid -->

