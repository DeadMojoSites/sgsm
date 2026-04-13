/* global */ const BASE = window.GSM_BASE || '';
let consoleSSE = null;

// ── Live status polling ───────────────────────────────────────────────────────
// Polls /api/servers.php every 5s when on the servers page and updates badges
// and action buttons without a full page reload.
(function startStatusPolling() {
  if (!document.getElementById('servers-tbody')) return;

  async function pollStatuses() {
    try {
      const servers = await (await fetch(BASE + '/api/servers.php')).json();
      if (!Array.isArray(servers)) return;
      servers.forEach(s => {
        const badge = document.getElementById('status-' + s.id);
        if (!badge) return;
        const prev = badge.dataset.status || badge.className.match(/status-(\w+)/)?.[1];
        if (prev === s.status) return; // no change

        // Update badge text and class
        badge.className = 'status-badge status-' + s.status;
        badge.textContent = s.status.charAt(0).toUpperCase() + s.status.slice(1);
        badge.dataset.status = s.status;

        // Reload the page to refresh action buttons when status changes
        // (only if no modal/console is open)
        const anyModalOpen = document.querySelector('.modal-overlay[style*="flex"]');
        if (!anyModalOpen) location.reload();
      });
    } catch {}
  }

  setInterval(pollStatuses, 5000);
})();

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent    = msg;
  el.className      = 'toast toast-' + type;
  el.style.display  = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id)  { const m = document.getElementById(id); if (m) m.style.display = 'flex'; }
function closeModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; }

// ── API fetch helper ──────────────────────────────────────────────────────────
async function api(url, opts = {}) {
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const r = await fetch(BASE + url, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

// ── Settings tabs ─────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.style.display = '';
  if (btn)   btn.classList.add('active');
}

// ── Save settings ─────────────────────────────────────────────────────────────
async function saveSettings(keys) {
  const saved = document.getElementById('settings-saved');
  const err   = document.getElementById('settings-error');
  if (saved) saved.style.display = 'none';
  if (err)   err.style.display   = 'none';
  const body = {};
  keys.forEach(k => {
    const el = document.getElementById('cfg-' + k);
    if (el) body[k] = el.tagName === 'SELECT' ? el.value : el.value;
  });
  try {
    await api('/api/settings.php', { method: 'POST', body: JSON.stringify(body) });
    if (saved) { saved.style.display = 'flex'; setTimeout(() => { saved.style.display = 'none'; }, 2500); }
    toast('Settings saved');
  } catch (e) {
    if (err) { err.textContent = e.message; err.style.display = 'flex'; }
    toast(e.message, 'error');
  }
}

async function saveSteamSettings() {
  const saved = document.getElementById('settings-saved');
  const err   = document.getElementById('settings-error');
  if (saved) saved.style.display = 'none';
  if (err)   err.style.display   = 'none';
  const userEl = document.getElementById('cfg-steam_username');
  const passEl = document.getElementById('cfg-steam_password');
  const body = { steamcmd_path: document.getElementById('cfg-steamcmd_path')?.value || '',
                 servers_path:  document.getElementById('cfg-servers_path')?.value  || '',
                 steam_username: userEl?.value || '' };
  // Only send password if it was actually changed (not the placeholder dots)
  const pw = passEl?.value || '';
  if (pw && pw !== '••••••••') body.steam_password = pw;
  try {
    await api('/api/settings.php', { method: 'POST', body: JSON.stringify(body) });
    if (saved) { saved.style.display = 'flex'; setTimeout(() => { saved.style.display = 'none'; }, 2500); }
    toast('Steam settings saved');
  } catch (e) {
    if (err) { err.textContent = e.message; err.style.display = 'flex'; }
    toast(e.message, 'error');
  }
}

// ── Upload logo ───────────────────────────────────────────────────────────────
async function uploadLogo() {
  const input = document.getElementById('logo-upload');
  if (!input || !input.files.length) { toast('Select a file first', 'error'); return; }
  const form = new FormData();
  form.append('logo', input.files[0]);
  try {
    const r = await fetch(BASE + '/api/settings.php?action=upload-logo', { method: 'POST', body: form });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    toast('Logo uploaded — reload to see it');
  } catch (e) { toast(e.message, 'error'); }
}

// ── Test DB ───────────────────────────────────────────────────────────────────
async function testDbConn() {
  const result = document.getElementById('db-test-result');
  if (result) result.textContent = 'Testing…';
  const body = {};
  ['db_type','db_host','db_port','db_name','db_user','db_password'].forEach(k => {
    const el = document.getElementById('cfg-' + k);
    if (el) body[k] = el.value;
  });
  try {
    const d = await api('/api/settings.php?action=test-db', { method: 'POST', body: JSON.stringify(body) });
    if (result) { result.textContent = '✓ ' + d.message; result.style.color = 'var(--green)'; }
  } catch (e) {
    if (result) { result.textContent = '✕ ' + e.message; result.style.color = 'var(--red)'; }
  }
}

// ── Change password ───────────────────────────────────────────────────────────
async function changePassword() {
  const msg = document.getElementById('pw-msg');
  const curr = document.getElementById('pw-current')?.value;
  const newpw = document.getElementById('pw-new')?.value;
  const conf  = document.getElementById('pw-confirm')?.value;
  if (msg) msg.style.display = 'none';
  if (newpw !== conf) { if (msg) { msg.textContent = 'Passwords do not match'; msg.className = 'alert alert-error'; msg.style.display = 'flex'; } return; }
  try {
    await api('/api/auth.php?action=change-password', { method: 'POST', body: JSON.stringify({ current_password: curr, new_password: newpw }) });
    if (msg) { msg.textContent = 'Password updated successfully'; msg.className = 'alert alert-success'; msg.style.display = 'flex'; }
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value     = '';
    document.getElementById('pw-confirm').value  = '';
  } catch (e) {
    if (msg) { msg.textContent = e.message; msg.className = 'alert alert-error'; msg.style.display = 'flex'; }
  }
}

// ── Run update ────────────────────────────────────────────────────────────────
async function runUpdate() {
  const el = document.getElementById('update-console');
  if (!el) return;
  el.style.display = 'block';
  el.textContent   = 'Starting update…\n';
  try {
    await api(`${BASE}/api/settings.php?action=update`, { method: 'POST' });
    // Fetch the log directly — no long-running SSE needed for static instructions
    const res = await fetch(`${BASE}/api/console.php?type=update`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Parse SSE data lines
      buf.split('\n').forEach(line => {
        if (line.startsWith('data:')) {
          try { el.textContent += JSON.parse(line.slice(5).trim()) + '\n'; } catch {}
        }
      });
      // Stop once we see the Done marker
      if (buf.includes('--- Done ---')) { reader.cancel(); break; }
    }
  } catch (e) { el.textContent += 'Error: ' + e.message; }
}

// ── Templates ─────────────────────────────────────────────────────────────────
async function loadTemplates() {
  const container = document.getElementById('templates-list');
  if (!container) return;
  try {
    const templates = await api('/api/servers.php?templates=1');
    container.innerHTML = templates.map(t =>
      `<button type="button" class="tpl-btn" onclick='applyTemplate(${JSON.stringify(t)})'>${t.name}</button>`
    ).join('');
  } catch { container.textContent = 'Could not load templates'; }
}

function applyTemplate(t) {
  const serversPath = document.getElementById('cfg-servers_path')?.value || '/opt/servers';
  const installDir  = serversPath + '/' + t.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  // Replace {INSTALL_DIR} placeholder in launch args with the actual install directory
  const launchArgs  = (t.launch_args || '').replace(/\{INSTALL_DIR\}/g, installDir);
  setValue('sf-name',  t.name);
  setValue('sf-appid', t.app_id);
  setValue('sf-dir',   installDir);
  setValue('sf-exec',  t.launch_executable);
  setValue('sf-args',  launchArgs);
  setValue('sf-port',  t.port  || '');
  setValue('sf-maxp',  t.max_players || '');
  setValue('sf-cpu',   '');
  setValue('sf-ram',   '');

  // Show warning if this game requires a Steam account login
  let warn = document.getElementById('tpl-login-warning');
  if (!warn) {
    warn = document.createElement('div');
    warn.id = 'tpl-login-warning';
    warn.className = 'alert alert-warning';
    warn.style.cssText = 'margin-top:10px;display:none';
    warn.innerHTML = '⚠️ This game requires a Steam account login to install. '
      + 'Add your credentials in <strong>Settings → Steam</strong> before clicking Install, '
      + 'otherwise the download will fail.';
    document.getElementById('templates-list')?.parentElement?.appendChild(warn);
  }
  warn.style.display = t.requires_login ? 'flex' : 'none';
}

function setValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

// ── Post-create setup modal ───────────────────────────────────────────────────
// Patterns that identify user-configurable values inside launch_args.
// Each entry: { label, regex (group 1 = current value), build(newVal) = replacement string }
const SETUP_PATTERNS = [
  { label: 'Server Name (in-game)',  regex: /-name\s+'([^']+)'/,                  build: v => `-name '${v}'`              },
  { label: 'World Name',             regex: /-world\s+'([^']+)'/,                 build: v => `-world '${v}'`             },
  { label: 'Server Password',        regex: /-password\s+'([^']+)'/,              build: v => `-password '${v}'`          },
  { label: 'Server Hostname',        regex: /\+server\.hostname\s+"([^"]+)"/,     build: v => `+server.hostname "${v}"`   },
  { label: 'RCON Password',          regex: /\+rcon\.password\s+(\S+)/,           build: v => `+rcon.password ${v}`       },
  { label: 'Session Name',           regex: /\?SessionName=([^?&\s]+)/,           build: v => `?SessionName=${v}`         },
  { label: 'Server Password',        regex: /\?ServerPassword=([^?&\s]+)/,        build: v => `?ServerPassword=${v}`      },
  { label: 'Server Name',            regex: /-servername\s+"([^"]+)"/,            build: v => `-servername "${v}"`        },
  { label: 'Admin Password',         regex: /-adminPassword\s+(\S+)/,             build: v => `-adminPassword ${v}`       },
  { label: 'Server Name',            regex: /\+server\.name\s+"([^"]+)"/,        build: v => `+server.name "${v}"`       },
];

let _setupServer = null;

function openSetupModal(server) {
  _setupServer = server;
  document.getElementById('setup-server-id').value = server.id;
  const args   = server.launch_args || '';
  const fields = document.getElementById('setup-fields');
  fields.innerHTML = '';

  let found = 0;
  SETUP_PATTERNS.forEach((p, idx) => {
    const m = args.match(p.regex);
    if (!m) return;
    found++;
    const div   = document.createElement('div');
    div.className = 'form-group';
    div.dataset.patternIdx = idx;
    div.innerHTML =
      `<label class="form-label">${escHtml(p.label)}</label>` +
      `<input class="form-control" type="text" id="setup-f-${idx}" value="${escHtml(m[1])}">`;
    fields.appendChild(div);
  });

  // Note for config-file-based servers (e.g. Arma Reforger)
  const cfgMatch = args.match(/-config\s+(\S+)/);
  if (cfgMatch) {
    const note = document.createElement('div');
    note.style.cssText = 'padding:10px 14px;border-radius:var(--radius);font-size:.85rem;background:rgba(0,122,255,.12);color:#6ab0ff;border:1px solid rgba(0,122,255,.2);margin-top:.5rem';
    note.innerHTML = `<strong>Config file:</strong> A config file will be auto-created at <code>${escHtml(cfgMatch[1])}</code> on first start. `
      + `Edit it via File Station to change the admin password and other settings.`;
    fields.appendChild(note);
  }

  const saveBtn = document.getElementById('setup-save');
  if (saveBtn) saveBtn.style.display = found > 0 ? '' : 'none';

  if (!found && !cfgMatch) {
    const hint = document.createElement('p');
    hint.className = 'form-hint';
    hint.textContent = 'No configurable fields detected. You can edit the server at any time using the pencil icon.';
    fields.appendChild(hint);
  }

  closeModal('server-modal');
  openModal('setup-modal');
}

async function saveSetupConfig() {
  if (!_setupServer) { closeSetupModal(); return; }
  let args = _setupServer.launch_args || '';

  document.querySelectorAll('#setup-fields .form-group[data-pattern-idx]').forEach(el => {
    const p      = SETUP_PATTERNS[parseInt(el.dataset.patternIdx)];
    const input  = el.querySelector('input');
    if (!p || !input) return;
    const m      = args.match(p.regex);
    if (!m) return;
    const newFull = m[0].replace(m[1], input.value);
    args = args.replace(m[0], newFull);
  });

  const id    = document.getElementById('setup-server-id').value;
  const cfgTa = document.getElementById('setup-config-content');
  const saves = [];

  // Always save the (possibly updated) launch args
  saves.push(api(`${BASE}/api/servers.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ launch_args: args }),
  }));

  // Also save the config file if the textarea was loaded and has content
  if (cfgTa && cfgTa.value.trim() && cfgTa.dataset.cfgPath) {
    saves.push(api(`${BASE}/api/file.php?path=${encodeURIComponent(cfgTa.dataset.cfgPath)}`, {
      method: 'PUT',
      body: JSON.stringify({ content: cfgTa.value }),
    }));
  }

  try {
    await Promise.all(saves);
    toast('Configuration saved');
    closeSetupModal();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function closeSetupModal() {
  _setupServer = null;
  closeModal('setup-modal');
  setTimeout(() => location.reload(), 300);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Add / Edit server modal ───────────────────────────────────────────────────
function openServerModal(server) {
  const isEdit = !!server;
  document.getElementById('server-modal-title').textContent = isEdit ? 'Edit Server' : 'Add Game Server';
  document.getElementById('sf-submit').textContent          = isEdit ? 'Save Changes' : 'Add Server';
  document.getElementById('sf-error').style.display  = 'none';
  setValue('sf-id',    server?.id    || '');
  setValue('sf-name',  server?.name  || '');
  setValue('sf-appid', server?.app_id || '');
  setValue('sf-dir',   server?.install_dir || '');
  setValue('sf-exec',  server?.launch_executable || '');
  setValue('sf-args',  server?.launch_args || '');
  setValue('sf-port',  server?.port  || '');
  setValue('sf-maxp',  server?.max_players || '');
  setValue('sf-cpu',   server?.cpu_limit   || '');
  setValue('sf-ram',   server?.ram_limit_mb || '');
  setValue('sf-notes', server?.notes || '');
  if (!isEdit) {
    const tl = document.getElementById('templates-list');
    if (tl) tl.closest('div').style.display = ''; // ensure wrapper is visible
    loadTemplates();
  } else {
    const tl = document.getElementById('templates-list');
    if (tl) tl.closest('div').style.display = 'none'; // hide templates on edit
  }
  openModal('server-modal');
}

async function submitServerForm(e) {
  e.preventDefault();
  const err    = document.getElementById('sf-error');
  const btn    = document.getElementById('sf-submit');
  const id     = document.getElementById('sf-id').value;
  const isEdit = !!id;
  err.style.display = 'none';
  btn.disabled      = true;
  btn.textContent   = 'Saving…';
  const body = {
    name:              document.getElementById('sf-name').value.trim(),
    app_id:            document.getElementById('sf-appid').value.trim(),
    install_dir:       document.getElementById('sf-dir').value.trim(),
    launch_executable: document.getElementById('sf-exec').value.trim(),
    launch_args:       document.getElementById('sf-args').value.trim(),
    port:              document.getElementById('sf-port').value || null,
    max_players:       document.getElementById('sf-maxp').value || 0,
    cpu_limit:         parseFloat(document.getElementById('sf-cpu').value) || 0,
    ram_limit_mb:      parseInt(document.getElementById('sf-ram').value)   || 0,
    notes:             document.getElementById('sf-notes').value.trim(),
  };
  try {
    const url    = isEdit ? `${BASE}/api/servers.php?id=${id}` : `${BASE}/api/servers.php`;
    const method = isEdit ? 'PUT' : 'POST';
    const result = await api(url, { method, body: JSON.stringify(body) });
    if (isEdit) {
      closeModal('server-modal');
      toast('Server updated');
      setTimeout(() => location.reload(), 500);
    } else {
      // On create: open setup modal so user can configure passwords etc.
      toast('Server created');
      openSetupModal(result);
    }
  } catch (ex) {
    err.textContent = ex.message;
    err.style.display = 'flex';
  } finally {
    btn.disabled    = false;
    btn.textContent = isEdit ? 'Save Changes' : 'Add Server';
  }
}

// ── Server actions (start/stop/restart/install/cancel-install) ────────────────
async function serverAction(id, action) {
  try {
    await api(`${BASE}/api/servers.php?id=${id}&action=${action}`, { method: 'POST' });
    const labels = { start:'Starting', stop:'Stopping', restart:'Restarting', install:'Installing', 'cancel-install':'Cancelling' };
    toast((labels[action] || action) + '…');
    if (action === 'install') openConsole(id, 'install');
    else setTimeout(() => location.reload(), 1000);
  } catch (e) { toast(e.message, 'error'); }
}

// ── Delete server ─────────────────────────────────────────────────────────────
async function deleteServer(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api(`${BASE}/api/servers.php?id=${id}`, { method: 'DELETE' });
    toast('Server deleted');
    // Remove the row immediately without a full page reload
    const row = document.getElementById(`server-row-${id}`);
    if (row) row.remove();
    else location.reload();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Console modal ─────────────────────────────────────────────────────────────
function openConsole(id, type) {
  document.getElementById('console-title').textContent = type === 'install' ? 'Install Console' : 'Server Console';
  document.getElementById('console-output').textContent = '';
  openModal('console-modal');
  startConsolePolling(id, type, document.getElementById('console-output'));
}

function startConsolePolling(id, type, outputEl) {
  stopConsolePolling();
  let offset = 0;
  const url = id
    ? `${BASE}/api/console.php?id=${id}&type=${type}`
    : `${BASE}/api/console.php?type=update`;

  async function poll() {
    try {
      const data = await (await fetch(url + `&offset=${offset}`)).json();
      if (data.lines && data.lines.length) {
        data.lines.forEach(line => { outputEl.textContent += line + '\n'; });
        outputEl.scrollTop = outputEl.scrollHeight;
      }
      offset = data.offset ?? offset;
    } catch {}
  }

  poll(); // immediate first fetch
  consoleSSE = setInterval(poll, 1500);
}

function stopConsolePolling() {
  if (consoleSSE) { clearInterval(consoleSSE); consoleSSE = null; }
}

function closeConsole() {
  stopConsolePolling();
  closeModal('console-modal');
}

// Keep old name as alias so any other callers don't break
function closeConsoleSSE() { stopConsolePolling(); }

// ── Config file editor modal ──────────────────────────────────────────────────
let _configEditorPath = null;

async function openConfigEditor(filePath, serverName) {
  _configEditorPath = filePath;
  document.getElementById('config-editor-title').textContent = (serverName || 'Server') + ' — Config File';
  document.getElementById('config-editor-path').textContent  = filePath;
  document.getElementById('config-editor-error').style.display = 'none';
  const ta = document.getElementById('config-editor-content');
  ta.value = 'Loading…';
  ta.readOnly = true;
  document.getElementById('config-editor-save').disabled = true;
  openModal('config-editor-modal');

  try {
    const d = await api(`${BASE}/api/file.php?path=${encodeURIComponent(filePath)}`);
    ta.value    = d.content;
    ta.readOnly = false;
    document.getElementById('config-editor-save').disabled = false;
  } catch (e) {
    ta.value = '';
    ta.readOnly = false;
    document.getElementById('config-editor-save').disabled = false;
    const errEl = document.getElementById('config-editor-error');
    errEl.textContent = e.message + ' — you can still write content and save to create the file.';
    errEl.style.display = 'flex';
  }
}

async function saveConfigEditor() {
  if (!_configEditorPath) return;
  const ta    = document.getElementById('config-editor-content');
  const errEl = document.getElementById('config-editor-error');
  const btn   = document.getElementById('config-editor-save');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await api(`${BASE}/api/file.php?path=${encodeURIComponent(_configEditorPath)}`, {
      method: 'PUT',
      body: JSON.stringify({ content: ta.value }),
    });
    toast('Config file saved');
    closeConfigEditor();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'flex';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

function closeConfigEditor() {
  _configEditorPath = null;
  closeModal('config-editor-modal');
}

// ── Workshop Mods modal ───────────────────────────────────────────────────────
let _modsServerId  = null;
let _modsAppId     = null;
let _modsSource    = 'steam';      // 'steam' | 'bohemia'
let _lookedUpMod   = null;         // last successful lookup result
let _modConsolePoll = null;

async function openModsModal(serverId, serverName, appId) {
  _modsServerId = serverId;
  _modsAppId    = String(appId);
  _lookedUpMod  = null;

  document.getElementById('mods-modal-title').textContent = serverName + ' — Workshop Mods';
  document.getElementById('mods-add-id').value = '';
  document.getElementById('mods-preview').style.display = 'none';
  document.getElementById('mods-add-btn').style.display = 'none';
  document.getElementById('mods-add-error').style.display = 'none';
  document.getElementById('mods-manual-name').style.display = 'none';
  document.getElementById('mods-list').textContent = 'Loading…';

  // Detect source: Arma Reforger uses Bohemia Workshop; other games use Steam
  const isBohemia = _modsAppId === '1874900';
  setModSource(isBohemia ? 'bohemia' : 'steam');

  // Footer hint for Arma Reforger
  const hint = document.getElementById('mods-footer-hint');
  if (hint) hint.textContent = isBohemia
    ? 'Mods are listed in config.json — the server downloads them automatically on next start.'
    : 'Mods are downloaded to the SteamCMD workshop cache. Add them to your launch args if required.';

  openModal('mods-modal');
  await refreshModList();
}

function setModSource(src) {
  _modsSource = src;
  _lookedUpMod = null;
  document.getElementById('mods-preview').style.display = 'none';
  document.getElementById('mods-add-btn').style.display = 'none';
  document.getElementById('mods-add-id').value = '';
  document.getElementById('mods-add-error').style.display = 'none';

  const steamTab   = document.getElementById('mods-tab-steam');
  const bohemiaTab = document.getElementById('mods-tab-bohemia');
  const label      = document.getElementById('mods-id-label');
  const manualName = document.getElementById('mods-manual-name');

  if (src === 'steam') {
    steamTab.className   = 'btn btn-sm btn-primary';
    bohemiaTab.className = 'btn btn-sm btn-ghost';
    label.textContent    = 'Steam Workshop URL or Item ID';
    manualName.style.display = 'none';
    document.getElementById('mods-add-id').placeholder = 'e.g. 1234567890 or full URL';
  } else {
    steamTab.className   = 'btn btn-sm btn-ghost';
    bohemiaTab.className = 'btn btn-sm btn-primary';
    label.textContent    = 'Bohemia Workshop Mod ID';
    manualName.style.display = '';
    document.getElementById('mods-add-id').placeholder = 'e.g. 59A2F27A88A0DD57';
    // For Bohemia we skip lookup — show the Add button immediately when user types an ID
    document.getElementById('mods-add-id').oninput = () => {
      const v = document.getElementById('mods-add-id').value.trim();
      document.getElementById('mods-add-btn').style.display = v ? '' : 'none';
    };
  }
}

async function lookupMod() {
  const raw = document.getElementById('mods-add-id').value.trim();
  if (!raw) return;
  const errEl = document.getElementById('mods-add-error');
  errEl.style.display = 'none';

  // Extract numeric ID from a full Steam Workshop URL
  const idMatch = raw.match(/\d{6,}/);
  const workshopId = idMatch ? idMatch[0] : raw;

  try {
    const mod = await api(`${BASE}/api/mods.php?action=lookup&workshop_id=${encodeURIComponent(workshopId)}`);
    _lookedUpMod = mod;

    const preview = document.getElementById('mods-preview');
    document.getElementById('mods-preview-name').textContent = mod.name;
    document.getElementById('mods-preview-desc').textContent = mod.description;
    document.getElementById('mods-preview-link').href = mod.workshop_url;
    const img = document.getElementById('mods-preview-img');
    if (mod.preview_url) { img.src = mod.preview_url; img.style.display = ''; }
    else img.style.display = 'none';
    preview.style.display = 'flex';
    document.getElementById('mods-add-btn').style.display = '';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'flex';
    _lookedUpMod = null;
    document.getElementById('mods-add-btn').style.display = 'none';
  }
}

async function addMod() {
  const errEl = document.getElementById('mods-add-error');
  errEl.style.display = 'none';

  let modData;
  if (_modsSource === 'steam' && _lookedUpMod) {
    modData = { ..._lookedUpMod, source: 'steam' };
  } else {
    // Bohemia / manual
    const modId = document.getElementById('mods-add-id').value.trim();
    const name  = document.getElementById('mods-manual-name-input')?.value.trim() || modId;
    if (!modId) { errEl.textContent = 'Mod ID is required'; errEl.style.display = 'flex'; return; }
    if (!name)  { errEl.textContent = 'Mod name is required'; errEl.style.display = 'flex'; return; }
    modData = { mod_id: modId, name, source: 'bohemia' };
  }

  try {
    await api(`${BASE}/api/mods.php?server_id=${_modsServerId}`, {
      method: 'POST',
      body: JSON.stringify(modData),
    });
    toast('Mod added');
    document.getElementById('mods-add-id').value = '';
    document.getElementById('mods-manual-name-input') && (document.getElementById('mods-manual-name-input').value = '');
    document.getElementById('mods-preview').style.display = 'none';
    document.getElementById('mods-add-btn').style.display = 'none';
    _lookedUpMod = null;
    await refreshModList();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'flex';
  }
}

async function refreshModList() {
  const listEl = document.getElementById('mods-list');
  try {
    const mods = await api(`${BASE}/api/mods.php?server_id=${_modsServerId}`);
    const countEl = document.getElementById('mods-count');
    if (countEl) countEl.textContent = mods.length ? `(${mods.length})` : '';

    if (!mods.length) {
      listEl.innerHTML = '<p class="form-hint" style="margin:0">No mods added yet.</p>';
      return;
    }

    listEl.innerHTML = `
      <table class="table" style="margin:0">
        <thead><tr><th style="width:60px"></th><th>Name</th><th>ID</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${mods.map(m => `
            <tr id="mod-row-${m.id}">
              <td>${m.preview_url
                ? `<img src="${escHtml(m.preview_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:var(--radius)">`
                : `<div style="width:48px;height:48px;background:var(--bg-hover,#2a2a3a);border-radius:var(--radius)"></div>`
              }</td>
              <td><strong>${escHtml(m.name)}</strong></td>
              <td><code style="font-size:.78rem">${escHtml(m.mod_id)}</code></td>
              <td><span class="badge">${escHtml(m.source)}</span></td>
              <td><span class="status-badge status-${escHtml(m.status)}" id="mod-status-${m.id}">${escHtml(m.status)}</span></td>
              <td style="white-space:nowrap">
                ${m.source === 'steam'
                  ? `<button class="btn btn-ghost btn-sm" onclick="installMod(${m.id}, '${escHtml(m.name)}')" title="Download via SteamCMD">⬇</button>`
                  : ''}
                <button class="btn btn-danger btn-sm" onclick="removeMod(${m.id}, '${escHtml(m.name)}')" title="Remove">🗑</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    listEl.textContent = 'Error loading mods: ' + e.message;
  }
}

async function installMod(modId, modName) {
  try {
    await api(`${BASE}/api/mods.php?id=${modId}&action=install`, { method: 'POST' });
    openModConsole(modId, modName);
    const badge = document.getElementById('mod-status-' + modId);
    if (badge) { badge.textContent = 'installing'; badge.className = 'status-badge status-installing'; }
  } catch (e) { toast(e.message, 'error'); }
}

function openModConsole(modId, modName) {
  document.getElementById('mod-console-title').textContent = 'Downloading: ' + modName;
  const out = document.getElementById('mod-console-output');
  out.textContent = '';
  openModal('mod-console-modal');

  stopModConsolePoll();
  let offset = 0;
  async function poll() {
    try {
      const data = await (await fetch(`${BASE}/api/mods.php?id=${modId}&action=log&offset=${offset}`)).json();
      if (data.lines?.length) {
        data.lines.forEach(l => { out.textContent += l + '\n'; });
        out.scrollTop = out.scrollHeight;
      }
      offset = data.offset ?? offset;
      if (data.done) {
        stopModConsolePoll();
        await refreshModList();
        const statusText = (out.textContent || '').includes('Success.') ? 'installed' : 'error';
        toast(statusText === 'installed' ? modName + ' downloaded successfully' : modName + ' download failed', statusText === 'installed' ? 'success' : 'error');
      }
    } catch {}
  }
  poll();
  _modConsolePoll = setInterval(poll, 1500);
}

function stopModConsolePoll() {
  if (_modConsolePoll) { clearInterval(_modConsolePoll); _modConsolePoll = null; }
}

function closeModConsole() {
  stopModConsolePoll();
  closeModal('mod-console-modal');
}

async function removeMod(modId, modName) {
  if (!confirm(`Remove mod "${modName}"?`)) return;
  try {
    await api(`${BASE}/api/mods.php?id=${modId}`, { method: 'DELETE' });
    const row = document.getElementById('mod-row-' + modId);
    if (row) row.remove();
    await refreshModList();
    toast('Mod removed');
  } catch (e) { toast(e.message, 'error'); }
}

function closeModsModal() {
  closeModal('mods-modal');
  _modsServerId = null;
  _modsAppId    = null;
  _lookedUpMod  = null;
}

