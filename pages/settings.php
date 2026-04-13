<?php $cfg = $db->getSettings(); ?>
<div class="page-header">
  <h2 class="page-title">Settings</h2>
</div>

<div class="settings-tabs">
  <button class="tab-btn active" onclick="switchTab('general',this)">General</button>
  <button class="tab-btn" onclick="switchTab('steam',this)">Steam / SteamCMD</button>
  <button class="tab-btn" onclick="switchTab('database',this)">Database</button>
  <button class="tab-btn" onclick="switchTab('apikeys',this)">API Keys</button>
  <button class="tab-btn" onclick="switchTab('security',this)">Security</button>
  <button class="tab-btn" onclick="switchTab('updates',this)">Updates</button>
</div>

<div id="settings-saved" class="alert alert-success" style="display:none">Settings saved.</div>
<div id="settings-error" class="alert alert-error" style="display:none"></div>

<!-- General -->
<div class="tab-panel" id="tab-general">
  <div class="card">
    <div class="card-header"><h3 class="card-title">General</h3></div>
    <div class="card-body">
      <div class="form-group">
        <label class="form-label">Application Name</label>
        <input class="form-control" type="text" id="cfg-app_name" value="<?= htmlspecialchars($cfg['app_name'] ?? '') ?>">
      </div>
      <div class="form-group">
        <label class="form-label">Application Logo</label>
        <?php if (!empty($cfg['logo_path'])): ?>
          <img src="<?= BASE ?>/<?= htmlspecialchars($cfg['logo_path']) ?>" alt="Logo" style="height:48px;margin-bottom:8px;display:block">
        <?php endif; ?>
        <input type="file" id="logo-upload" class="form-control" accept="image/png,image/jpeg,image/svg+xml,image/webp">
        <span class="form-hint">PNG, JPG, SVG or WebP — max 5 MB</span>
      </div>
      <button class="btn btn-primary" onclick="saveSettings(['app_name'])">Save</button>
      <button class="btn btn-ghost" onclick="uploadLogo()" style="margin-left:8px">Upload Logo</button>
    </div>
  </div>
</div>

<!-- Steam -->
<div class="tab-panel" id="tab-steam" style="display:none">
  <div class="card">
    <div class="card-header"><h3 class="card-title">Steam &amp; SteamCMD</h3></div>
    <div class="card-body">
      <div class="form-group">
        <label class="form-label">SteamCMD Path</label>
        <input class="form-control" type="text" id="cfg-steamcmd_path" value="<?= htmlspecialchars($cfg['steamcmd_path'] ?? '') ?>">
        <span class="form-hint">Full path to <code>steamcmd.sh</code> (Linux) or <code>steamcmd.exe</code> (Windows).</span>
      </div>
      <div class="form-group">
        <label class="form-label">Default Servers Path</label>
        <input class="form-control" type="text" id="cfg-servers_path" value="<?= htmlspecialchars($cfg['servers_path'] ?? '') ?>">
        <span class="form-hint">Base directory where game servers are installed.</span>
      </div>
      <button class="btn btn-primary" onclick="saveSettings(['steamcmd_path','servers_path'])">Save</button>
    </div>
  </div>
</div>

<!-- Database -->
<div class="tab-panel" id="tab-database" style="display:none">
  <div class="card">
    <div class="card-header"><h3 class="card-title">External Database</h3></div>
    <div class="card-body">
      <p class="form-hint" style="margin-bottom:12px">Optional — for your game servers to connect to. GSM itself always uses SQLite.</p>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-control" id="cfg-db_type">
          <option value="none" <?= ($cfg['db_type'] ?? 'none') === 'none' ? 'selected' : '' ?>>None</option>
          <option value="mysql" <?= ($cfg['db_type'] ?? '') === 'mysql' ? 'selected' : '' ?>>MySQL</option>
          <option value="postgres" <?= ($cfg['db_type'] ?? '') === 'postgres' ? 'selected' : '' ?>>PostgreSQL</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Host</label><input class="form-control" type="text" id="cfg-db_host" value="<?= htmlspecialchars($cfg['db_host'] ?? '') ?>" placeholder="127.0.0.1"></div>
        <div class="form-group"><label class="form-label">Port</label><input class="form-control" type="number" id="cfg-db_port" value="<?= htmlspecialchars($cfg['db_port'] ?? '') ?>" placeholder="3306"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Database Name</label><input class="form-control" type="text" id="cfg-db_name" value="<?= htmlspecialchars($cfg['db_name'] ?? '') ?>"></div>
        <div class="form-group"><label class="form-label">Username</label><input class="form-control" type="text" id="cfg-db_user" value="<?= htmlspecialchars($cfg['db_user'] ?? '') ?>"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-control" type="password" id="cfg-db_password" value="<?= htmlspecialchars($cfg['db_password'] ?? '') ?>">
      </div>
      <button class="btn btn-primary" onclick="saveSettings(['db_type','db_host','db_port','db_name','db_user','db_password'])">Save</button>
      <button class="btn btn-ghost" onclick="testDbConn()" style="margin-left:8px">Test Connection</button>
      <span id="db-test-result" style="margin-left:12px;font-size:.85rem"></span>
    </div>
  </div>
</div>

<!-- API Keys -->
<div class="tab-panel" id="tab-apikeys" style="display:none">
  <div class="card">
    <div class="card-header"><h3 class="card-title">API Keys</h3></div>
    <div class="card-body">
      <div class="form-group">
        <label class="form-label">Steam Web API Key</label>
        <input class="form-control" type="password" id="cfg-steam_api_key" value="<?= htmlspecialchars($cfg['steam_api_key'] ?? '') ?>" placeholder="Get from steamcommunity.com/dev/apikey">
      </div>
      <div class="divider"></div>
      <div class="settings-section-title">Custom Keys</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Key 1 — Name</label><input class="form-control" type="text" id="cfg-custom_api_key_1_name" value="<?= htmlspecialchars($cfg['custom_api_key_1_name'] ?? '') ?>"></div>
        <div class="form-group"><label class="form-label">Key 1 — Value</label><input class="form-control" type="password" id="cfg-custom_api_key_1_value" value="<?= htmlspecialchars($cfg['custom_api_key_1_value'] ?? '') ?>"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Key 2 — Name</label><input class="form-control" type="text" id="cfg-custom_api_key_2_name" value="<?= htmlspecialchars($cfg['custom_api_key_2_name'] ?? '') ?>"></div>
        <div class="form-group"><label class="form-label">Key 2 — Value</label><input class="form-control" type="password" id="cfg-custom_api_key_2_value" value="<?= htmlspecialchars($cfg['custom_api_key_2_value'] ?? '') ?>"></div>
      </div>
      <button class="btn btn-primary" onclick="saveSettings(['steam_api_key','custom_api_key_1_name','custom_api_key_1_value','custom_api_key_2_name','custom_api_key_2_value'])">Save</button>
    </div>
  </div>
</div>

<!-- Security -->
<div class="tab-panel" id="tab-security" style="display:none">
  <div class="card">
    <div class="card-header"><h3 class="card-title">Change Password</h3></div>
    <div class="card-body">
      <div id="pw-msg" class="alert" style="display:none"></div>
      <div class="form-group"><label class="form-label">Current Password</label><input class="form-control" type="password" id="pw-current"></div>
      <div class="form-group"><label class="form-label">New Password</label><input class="form-control" type="password" id="pw-new" minlength="8"></div>
      <div class="form-group"><label class="form-label">Confirm New Password</label><input class="form-control" type="password" id="pw-confirm"></div>
      <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
    </div>
  </div>
</div>

<!-- Updates -->
<div class="tab-panel" id="tab-updates" style="display:none">
  <div class="card">
    <div class="card-header"><h3 class="card-title">Application Updates</h3></div>
    <div class="card-body">
      <div class="form-group">
        <label class="form-label">Git Repository URL (optional override)</label>
        <input class="form-control" type="text" id="cfg-update_repo_url" value="<?= htmlspecialchars($cfg['update_repo_url'] ?? '') ?>" placeholder="https://github.com/deadmojo/sgsm">
      </div>
      <button class="btn btn-primary" onclick="saveSettings(['update_repo_url'])">Save URL</button>
      <button class="btn btn-ghost" onclick="runUpdate()" style="margin-left:8px">Pull Updates Now</button>
      <div id="update-console" class="console-wrapper mt-3" style="display:none;min-height:200px"></div>
    </div>
  </div>
</div>
