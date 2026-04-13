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
          <button class="btn btn-ghost btn-sm" onclick="openModsModal(<?= $id ?>, <?= htmlspecialchars(json_encode($s['name']), ENT_QUOTES) ?>, <?= htmlspecialchars(json_encode($s['app_id']), ENT_QUOTES) ?>)" title="Workshop Mods">🧩</button>
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

<!-- Workshop Mods Modal -->
<div class="modal-overlay" id="mods-modal" style="display:none" onclick="if(event.target===this)closeModsModal()">
  <div class="modal modal-xl">
    <div class="modal-header">
      <span class="modal-title" id="mods-modal-title">Workshop Mods</span>
      <button class="btn btn-ghost btn-icon" onclick="closeModsModal()">✕</button>
    </div>
    <div class="modal-body" style="gap:0">

      <!-- Add mod panel -->
      <div class="settings-section-title" style="margin-bottom:10px">Add Mod</div>
      <div id="mods-source-tabs" class="" style="display:flex;gap:6px;margin-bottom:12px">
        <button class="btn btn-sm btn-primary"  id="mods-tab-steam"  onclick="setModSource('steam')">Steam Workshop</button>
        <button class="btn btn-sm btn-ghost"    id="mods-tab-bohemia" onclick="setModSource('bohemia')">Bohemia Workshop</button>
      </div>

      <div id="mods-add-section" style="background:var(--bg-section,rgba(0,0,0,.2));border-radius:var(--radius);padding:14px;margin-bottom:18px">
        <div class="form-row" style="align-items:flex-end">
          <div class="form-group" style="flex:1">
            <label class="form-label" id="mods-id-label">Steam Workshop URL or Item ID</label>
            <input class="form-control" type="text" id="mods-add-id" placeholder="e.g. 1234567890 or full URL">
          </div>
          <div class="form-group">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-ghost" onclick="lookupMod()">Look Up</button>
          </div>
        </div>
        <div id="mods-preview" style="display:none;gap:12px;align-items:flex-start;margin-top:10px">
          <img id="mods-preview-img" src="" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:var(--radius);flex-shrink:0">
          <div style="flex:1;min-width:0">
            <div id="mods-preview-name" style="font-weight:700;color:var(--text-bright);margin-bottom:4px"></div>
            <div id="mods-preview-desc" style="font-size:.8rem;color:var(--text-muted);white-space:pre-wrap"></div>
            <a id="mods-preview-link" href="#" target="_blank" rel="noopener noreferrer" style="font-size:.8rem">View on Workshop ↗</a>
          </div>
        </div>
        <div id="mods-manual-name" style="display:none" class="form-group">
          <label class="form-label">Mod Name <span class="required">*</span></label>
          <input class="form-control" type="text" id="mods-manual-name-input" placeholder="e.g. ACE3">
        </div>
        <div id="mods-add-error" class="alert alert-error" style="display:none;margin-top:8px"></div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn btn-primary" id="mods-add-btn" onclick="addMod()" style="display:none">Add to Server</button>
        </div>
      </div>

      <!-- Installed mod list -->
      <div class="settings-section-title" style="margin-bottom:10px">Installed Mods <span id="mods-count" style="font-size:.8rem;font-weight:400;color:var(--text-muted)"></span></div>
      <div id="mods-list">Loading…</div>
    </div>
    <div class="modal-footer">
      <span id="mods-footer-hint" style="flex:1;font-size:.8rem;color:var(--text-muted)"></span>
      <button class="btn btn-ghost" onclick="closeModsModal()">Close</button>
    </div>
  </div>
</div>

<!-- Mod Install Console Modal -->
<div class="modal-overlay" id="mod-console-modal" style="display:none" onclick="if(event.target===this)closeModConsole()">
  <div class="modal modal-lg">
    <div class="modal-header">
      <span class="modal-title" id="mod-console-title">Downloading Mod…</span>
      <button class="btn btn-ghost btn-icon" onclick="closeModConsole()">✕</button>
    </div>
    <div class="modal-body">
      <div class="console-wrapper" id="mod-console-output"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModConsole()">Close</button>
    </div>
  </div>
</div>

<!-- Post-Create Setup Modal -->
<div class="modal-overlay" id="setup-modal" style="display:none" onclick="if(event.target===this)closeSetupModal()">
  <div class="modal modal-lg">
    <div class="modal-header">
      <span class="modal-title">Server Created — Quick Setup</span>
      <button class="btn btn-ghost btn-icon" onclick="closeSetupModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="alert alert-success" style="margin-bottom:1rem">
        ✓ Server added! Review and update any passwords or settings below before installing.
      </div>
      <input type="hidden" id="setup-server-id">
      <div id="setup-fields"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeSetupModal()">Skip</button>
      <button class="btn btn-primary" id="setup-save" onclick="saveSetupConfig()">Save &amp; Continue</button>
    </div>
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
