<?php $servers = $db->getServers(); ?>
<div class="page-header">
  <h2 class="page-title">Game Servers</h2>
  <button class="btn btn-primary" onclick="openServerModal()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Add Server
  </button>
</div>

<div id="server-list">
<?php if ($servers): ?>
<div class="card">
  <table class="table">
    <thead><tr><th>Name</th><th>App ID</th><th>Status</th><th>Port</th><th>Players</th><th>Actions</th></tr></thead>
    <tbody id="servers-tbody">
    <?php foreach ($servers as $s):
      $id = $s['id']; ?>
      <tr id="server-row-<?= $id ?>">
        <td><strong><?= htmlspecialchars($s['name']) ?></strong><?php if ($s['notes']): ?><br><small class="text-muted"><?= htmlspecialchars(mb_strimwidth($s['notes'], 0, 60, '…')) ?></small><?php endif; ?></td>
        <td><span class="badge"><?= htmlspecialchars($s['app_id']) ?></span></td>
        <td><span class="status-badge status-<?= $s['status'] ?>" id="status-<?= $id ?>"><?= ucfirst($s['status']) ?></span></td>
        <td><?= $s['port'] ?: '—' ?></td>
        <td><?= $s['max_players'] ?: '—' ?></td>
        <td class="actions-cell">
          <?php if ($s['status'] === 'stopped' || $s['status'] === 'error'): ?>
            <button class="btn btn-success btn-sm" onclick="serverAction(<?= $id ?>,'start')" title="Start">▶</button>
          <?php elseif ($s['status'] === 'running'): ?>
            <button class="btn btn-danger btn-sm"  onclick="serverAction(<?= $id ?>,'stop')"  title="Stop">■</button>
            <button class="btn btn-ghost btn-sm"   onclick="serverAction(<?= $id ?>,'restart')" title="Restart">↺</button>
          <?php elseif ($s['status'] === 'installing'): ?>
            <button class="btn btn-warning btn-sm" onclick="serverAction(<?= $id ?>,'cancel-install')" title="Cancel">✕</button>
          <?php endif; ?>
          <?php
            // Show install log if currently installing, or if server has never been started (no server log yet)
            $serverLog  = DATA_DIR . '/logs/server-'  . $id . '.log';
            $installLog = DATA_DIR . '/logs/install-' . $id . '.log';
            $consoleType = ($s['status'] === 'installing' || (!file_exists($serverLog) && file_exists($installLog))) ? 'install' : 'server';
          ?>
          <button class="btn btn-ghost btn-sm" onclick="openConsole(<?= $id ?>, '<?= $consoleType ?>')" title="Console">⌨</button>
          <button class="btn btn-ghost btn-sm" onclick="serverAction(<?= $id ?>,'install')" title="Install/Update">⬇</button>
          <button class="btn btn-ghost btn-sm" onclick="openServerModal(<?= htmlspecialchars(json_encode($s), ENT_QUOTES) ?>)" title="Edit">✎</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteServer(<?= $id ?>, '<?= htmlspecialchars($s['name'], ENT_QUOTES) ?>')" title="Delete">🗑</button>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php else: ?>
<div class="empty-state">
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/></svg>
  <p>No servers yet. Click <strong>Add Server</strong> to get started.</p>
</div>
<?php endif; ?>
</div>

<!-- Add/Edit Server Modal -->
<div class="modal-overlay" id="server-modal" style="display:none" onclick="if(event.target===this)closeModal('server-modal')">
  <div class="modal modal-lg">
    <div class="modal-header">
      <span class="modal-title" id="server-modal-title">Add Game Server</span>
      <button class="btn btn-ghost btn-icon" onclick="closeModal('server-modal')">✕</button>
    </div>
    <form id="server-form" onsubmit="submitServerForm(event)">
      <div class="modal-body">
        <input type="hidden" id="sf-id">
        <div id="sf-error" class="alert alert-error" style="display:none"></div>

        <div class="settings-section-title">Quick Start Templates</div>
        <div id="templates-list" class="templates-grid">Loading…</div>
        <p class="form-hint">Click a template to pre-fill, then edit below.</p>
        <div class="divider"></div>

        <div class="settings-section-title">Server Details</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Server Name <span class="required">*</span></label>
            <input class="form-control" type="text" id="sf-name" required placeholder="My Valheim Server">
          </div>
          <div class="form-group">
            <label class="form-label">Steam App ID <span class="required">*</span></label>
            <input class="form-control" type="text" id="sf-appid" required placeholder="896660" pattern="\d+">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Install Directory <span class="required">*</span></label>
          <input class="form-control" type="text" id="sf-dir" required placeholder="/opt/servers/my-server">
          <span class="form-hint">Absolute path inside the container.</span>
        </div>

        <div class="divider"></div>
        <div class="settings-section-title">Launch Configuration</div>
        <div class="form-group">
          <label class="form-label">Launch Executable</label>
          <input class="form-control" type="text" id="sf-exec" placeholder="./server.x86_64">
          <span class="form-hint">Relative to install directory. Required for Start/Stop controls.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Launch Arguments</label>
          <input class="form-control" type="text" id="sf-args" placeholder="-port 27015 +maxplayers 16">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Game Port</label>
            <input class="form-control" type="number" id="sf-port" placeholder="27015" min="1" max="65535">
          </div>
          <div class="form-group">
            <label class="form-label">Max Players</label>
            <input class="form-control" type="number" id="sf-maxp" placeholder="16" min="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="sf-notes" rows="2" placeholder="Optional notes…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" onclick="closeModal('server-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary" id="sf-submit">Add Server</button>
      </div>
    </form>
  </div>
</div>

<!-- Console Modal -->
<div class="modal-overlay" id="console-modal" style="display:none" onclick="if(event.target===this)closeConsole()">
  <div class="modal modal-xl">
    <div class="modal-header">
      <span class="modal-title" id="console-title">Server Console</span>
      <button class="btn btn-ghost btn-icon" onclick="closeConsole()">✕</button>
    </div>
    <div class="modal-body">
      <div class="console-wrapper" id="console-output">Connecting…</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeConsole()">Close</button>
    </div>
  </div>
</div>
