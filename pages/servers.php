<?php
$servers = $db->getServers();
$isAdmin = isAdmin();
?>
<div class="page-header">
  <h2 class="page-title">Game Servers</h2>
  <?php if ($isAdmin): ?>
  <button class="btn btn-primary" onclick="openServerModal()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Add Server
  </button>
  <?php endif; ?>
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
            $serverLog  = DATA_DIR . '/logs/server-'  . $id . '.log';
            $installLog = DATA_DIR . '/logs/install-' . $id . '.log';
            $consoleType = ($s['status'] === 'installing' || (!file_exists($serverLog) && file_exists($installLog))) ? 'install' : 'server';
          ?>
          <button class="btn btn-ghost btn-sm" onclick="openConsole(<?= $id ?>, '<?= $consoleType ?>')" title="Console">⌨</button>
          <?php if ($isAdmin): ?>
          <button class="btn btn-ghost btn-sm" onclick="openInstallDialog(<?= $id ?>)" title="Install/Update">⬇</button>
          <button class="btn btn-ghost btn-sm" onclick="openModsModal(<?= $id ?>, <?= htmlspecialchars(json_encode($s['name']), ENT_QUOTES) ?>, <?= htmlspecialchars(json_encode($s['app_id']), ENT_QUOTES) ?>)" title="Workshop Mods">🧩</button>
          <button class="btn btn-ghost btn-sm" onclick="openServerDetail(<?= $id ?>)" title="Manage">⚙</button>
          <button class="btn btn-ghost btn-sm" onclick="openServerModal(<?= htmlspecialchars(json_encode($s), ENT_QUOTES) ?>)" title="Edit">✎</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteServer(<?= $id ?>, '<?= htmlspecialchars($s['name'], ENT_QUOTES) ?>')" title="Delete">🗑</button>
          <?php endif; ?>
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

<!-- Console Modal -->
<div class="modal-overlay" id="console-modal" style="display:none" onclick="if(event.target===this)closeConsole()">
  <div class="modal modal-xl">
    <div class="modal-header">
      <span class="modal-title" id="console-title">Server Console</span>
      <button class="btn btn-ghost btn-icon" onclick="closeConsole()">✕</button>
    </div>
    <div class="modal-body" style="padding-bottom:0">
      <div class="console-wrapper" id="console-output">Connecting…</div>
    </div>
    <div class="console-stdin-bar" id="console-stdin-bar" style="display:none">
      <input type="text" class="form-input console-stdin-input" id="console-stdin-input"
             placeholder="Type a command and press Enter…"
             onkeydown="if(event.key==='Enter')sendConsoleCommand()">
      <button class="btn btn-primary btn-sm" onclick="sendConsoleCommand()">Send</button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeConsole()">Close</button>
    </div>
  </div>
</div>

<!-- Server Detail Modal (Variables, Backups, Schedules) -->
<div class="modal-overlay" id="detail-modal" style="display:none" onclick="if(event.target===this)closeModal('detail-modal')">
  <div class="modal modal-xl">
    <div class="modal-header">
      <span class="modal-title" id="detail-modal-title">Server Management</span>
      <button class="btn btn-ghost btn-icon" onclick="closeModal('detail-modal')">✕</button>
    </div>
    <div class="modal-body" style="padding:0">
      <div class="tab-bar">
        <button class="tab-item active" id="dtab-variables"  onclick="showDetailTab('variables')">Variables</button>
        <button class="tab-item"        id="dtab-backups"    onclick="showDetailTab('backups')">Backups</button>
        <button class="tab-item"        id="dtab-schedules"  onclick="showDetailTab('schedules')">Schedules</button>
        <button class="tab-item"        id="dtab-files"      onclick="showDetailTab('files')">Files</button>
      </div>
      <div style="padding:1.25rem">
        <!-- Variables Tab -->
        <div id="detail-tab-variables">
          <p class="text-muted" style="margin-bottom:0.75rem">These values replace <code>{PLACEHOLDER}</code> tokens in the startup command.</p>
          <div id="vars-list"></div>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="saveVariables()">Save Variables</button>
        </div>

        <!-- Backups Tab -->
        <div id="detail-tab-backups" style="display:none">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
            <span class="text-muted">Snapshots of the server directory stored as <code>.tar.gz</code></span>
            <button class="btn btn-primary btn-sm" onclick="createBackup()">Create Backup</button>
          </div>
          <div id="backups-list"></div>
        </div>

        <!-- Schedules Tab -->
        <div id="detail-tab-schedules" style="display:none">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
            <span class="text-muted">Scheduled start/stop/restart using cron expressions</span>
            <button class="btn btn-primary btn-sm" onclick="openScheduleForm()">Add Schedule</button>
          </div>
          <div id="schedules-list"></div>
          <div id="schedule-form" style="display:none;margin-top:1rem;padding:1rem;background:var(--bg-section,rgba(0,0,0,.2));border-radius:var(--radius)">
            <input type="hidden" id="sched-id">
            <div class="form-row">
              <div class="form-group" style="flex:2">
                <label class="form-label">Cron Expression <span class="text-muted">(min hour dom mon dow)</span></label>
                <input type="text" class="form-input" id="sched-cron" placeholder="0 6 * * *">
              </div>
              <div class="form-group">
                <label class="form-label">Action</label>
                <select class="form-input" id="sched-action">
                  <option value="start">Start</option>
                  <option value="stop">Stop</option>
                  <option value="restart">Restart</option>
                </select>
              </div>
              <div class="form-group" style="flex:0;align-self:flex-end">
                <label class="checkbox-label" style="padding-bottom:0.75rem">
                  <input type="checkbox" id="sched-active" checked> Active
                </label>
              </div>
            </div>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-primary btn-sm" onclick="saveSchedule()">Save</button>
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('schedule-form').style.display='none'">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Files Tab -->
        <div id="detail-tab-files" style="display:none">
          <div id="file-breadcrumb" class="file-breadcrumb"></div>
          <div id="file-list-area"></div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('detail-modal')">Close</button>
    </div>
  </div>
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

        <div id="sf-mojo-section">
          <div class="settings-section-title">Choose a Mojo (Game Template)</div>
          <select class="form-input" id="sf-mojo-id" onchange="onMojoSelect()" style="margin-bottom:0.5rem">
            <option value="">— Select a Mojo —</option>
          </select>
          <div id="sf-mojo-vars" style="display:none">
            <div class="settings-section-title" style="margin-top:1rem">Startup Variables</div>
            <div id="sf-mojo-vars-list"></div>
          </div>
          <div class="divider"></div>
        </div>

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
        </div>
        <div class="divider"></div>
        <div class="settings-section-title">Launch Configuration</div>
        <div class="form-group">
          <label class="form-label">Launch Executable</label>
          <input class="form-control" type="text" id="sf-exec" placeholder="./server.x86_64">
        </div>
        <div class="form-group">
          <label class="form-label">Launch Arguments</label>
          <input class="form-control" type="text" id="sf-args" placeholder="-port 27015 +maxplayers 16">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Port</label>
            <input class="form-control" type="number" id="sf-port" placeholder="27015" min="1" max="65535">
          </div>
          <div class="form-group">
            <label class="form-label">Max Players</label>
            <input class="form-control" type="number" id="sf-maxp" placeholder="16" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">CPU Limit (cores, 0 = unlimited)</label>
            <input class="form-control" type="number" id="sf-cpu" placeholder="0" min="0" step="0.5">
          </div>
          <div class="form-group">
            <label class="form-label">RAM Limit MB (0 = unlimited)</label>
            <input class="form-control" type="number" id="sf-ram" placeholder="0" min="0" step="256">
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

<!-- Config File Editor Modal -->
<div class="modal-overlay" id="config-editor-modal" style="display:none" onclick="if(event.target===this)closeConfigEditor()">
  <div class="modal modal-lg">
    <div class="modal-header">
      <span class="modal-title" id="config-editor-title">Edit Config File</span>
      <button class="btn btn-ghost btn-icon" onclick="closeConfigEditor()">✕</button>
    </div>
    <div class="modal-body">
      <p class="form-hint" id="config-editor-path" style="margin:0 0 8px;word-break:break-all"></p>
      <div id="config-editor-error" class="alert alert-error" style="display:none"></div>
      <textarea id="config-editor-content" class="form-control" rows="24"
        style="font-family:Consolas,'Courier New',monospace;font-size:.8rem;resize:vertical"
        placeholder="Loading…"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeConfigEditor()">Cancel</button>
      <button class="btn btn-primary" id="config-editor-save" onclick="saveConfigEditor()">Save</button>
    </div>
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
      <div class="settings-section-title" style="margin-bottom:10px">Add Mod</div>
      <div id="mods-source-tabs" style="display:flex;gap:6px;margin-bottom:12px">
        <button class="btn btn-sm btn-primary"  id="mods-tab-steam"   onclick="setModSource('steam')">Steam Workshop</button>
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
        <div style="margin-top:10px">
          <button class="btn btn-primary" id="mods-add-btn" onclick="addMod()" style="display:none">Add to Server</button>
        </div>
      </div>
      <div class="settings-section-title" style="margin-bottom:10px">Installed Mods <span id="mods-count" style="font-size:.8rem;font-weight:400;color:var(--text-muted)"></span></div>
      <div id="mods-list">Loading…</div>
    </div>
    <div class="modal-footer">
      <span id="mods-footer-hint" style="flex:1;font-size:.8rem;color:var(--text-muted)"></span>
      <button class="btn btn-ghost" onclick="closeModsModal()">Close</button>
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
        ✓ Server added! Review any passwords or settings below before installing.
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

<!-- Steam Guard / Install Dialog -->
<div id="install-dialog" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeInstallDialog()">
  <div class="modal" style="max-width:420px">
    <div class="modal-header">
      <h3 class="modal-title">Install / Update Server</h3>
      <button class="modal-close" onclick="closeInstallDialog()">✕</button>
    </div>
    <div class="modal-body">
      <p style="margin:0 0 1rem;color:var(--text-muted);font-size:.9rem">
        If your Steam account uses the mobile authenticator, open the Steam app now and enter the current Guard code below before clicking Install.
      </p>
      <div class="form-group">
        <label class="form-label">Steam Guard Code <span style="font-weight:400;color:var(--text-muted)">(leave blank if not needed)</span></label>
        <input type="text" id="steam-guard-code" class="form-input" maxlength="10"
               placeholder="e.g. AB3KP" autocomplete="off" style="letter-spacing:.15em;font-size:1.1rem">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeInstallDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmInstall()">Install</button>
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
