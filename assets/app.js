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
  const mojoSection = document.getElementById('sf-mojo-section');
  if (mojoSection) mojoSection.style.display = isEdit ? 'none' : '';
  if (!isEdit) loadMojosForSelect(server?.mojo_id);
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
    mojo_id:           document.getElementById('sf-mojo-id')?.value || null,
  };
  // Collect mojo variable values
  const varEls = document.querySelectorAll('#sf-mojo-vars-list .mojo-var-input');
  const mojoVars = {};
  varEls.forEach(el => { mojoVars[el.dataset.key] = el.value; });
  if (Object.keys(mojoVars).length) body._mojo_vars = mojoVars;
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
let _consoleServerId = null;

function openConsole(id, type) {
  _consoleServerId = id;
  document.getElementById('console-title').textContent = type === 'install' ? 'Install Console' : 'Server Console';
  document.getElementById('console-output').textContent = '';
  const stdinBar = document.getElementById('console-stdin-bar');
  if (stdinBar) stdinBar.style.display = (type === 'server') ? 'flex' : 'none';
  const stdinInput = document.getElementById('console-stdin-input');
  if (stdinInput) stdinInput.value = '';
  openModal('console-modal');
  startConsolePolling(id, type, document.getElementById('console-output'));
}

async function sendConsoleCommand() {
  const input = document.getElementById('console-stdin-input');
  const cmd = input?.value.trim();
  if (!cmd || !_consoleServerId) return;
  input.value = '';
  try {
    await api('/api/console.php', { method: 'POST', body: JSON.stringify({ id: _consoleServerId, command: cmd }) });
  } catch (e) { toast(e.message, 'error'); }
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


// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURES – Mojos, Users, Activity, Backups, Schedules, Webhooks, Files
// ═══════════════════════════════════════════════════════════════════════════

// ── Mojo selector in server create modal ────────────────────────────────────
let _allMojos = [];

async function loadMojosForSelect(selectedId) {
  const sel = document.getElementById('sf-mojo-id');
  if (!sel) return;
  if (!_allMojos.length) {
    try { _allMojos = await api('/api/servers.php?mojos=1'); } catch { _allMojos = []; }
  }
  sel.innerHTML = '<option value="">— Select a Mojo —</option>' +
    _allMojos.map(m => `<option value="${m.id}"${m.id == selectedId ? ' selected' : ''}>${escHtml(m.name)}</option>`).join('');
  if (selectedId) onMojoSelect();
}

function onMojoSelect() {
  const sel   = document.getElementById('sf-mojo-id');
  const mojo  = _allMojos.find(m => m.id == sel?.value);
  const varsDiv  = document.getElementById('sf-mojo-vars');
  const varsList = document.getElementById('sf-mojo-vars-list');
  if (!mojo || !varsList) { if (varsDiv) varsDiv.style.display = 'none'; return; }

  // Pre-fill server fields from mojo
  const serversPath = document.getElementById('cfg-servers_path')?.value || '/opt/servers';
  const slug = mojo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  setValue('sf-appid', mojo.app_id || '');
  setValue('sf-exec',  mojo.launch_executable || '');
  setValue('sf-port',  mojo.port || '');
  setValue('sf-maxp',  mojo.max_players || '');
  if (!document.getElementById('sf-dir').value)
    setValue('sf-dir', serversPath + '/' + slug);

  // Render variable inputs
  const vars = mojo.variables || [];
  varsList.innerHTML = vars.map(v => `
    <div class="form-row" style="margin-bottom:0.5rem">
      <div class="form-group" style="flex:1">
        <label class="form-label">${escHtml(v.name)} <code style="font-size:0.75rem">{${escHtml(v.env_variable)}}</code></label>
        <input type="text" class="form-input mojo-var-input" data-key="${escHtml(v.env_variable)}"
               value="${escHtml(v.default_value)}" placeholder="${escHtml(v.default_value)}">
      </div>
    </div>`).join('');
  varsDiv.style.display = vars.length ? '' : 'none';
}

// ── Server Detail Modal (Variables / Backups / Schedules / Files) ────────────
let _detailServerId = null;
let _detailServerInstallDir = '';

async function openServerDetail(serverId) {
  _detailServerId = serverId;
  const s = await api('/api/servers.php?id=' + serverId).catch(() => null);
  if (s) {
    _detailServerInstallDir = s.install_dir || '';
    document.getElementById('detail-modal-title').textContent = s.name + ' — Management';
  }
  openModal('detail-modal');
  showDetailTab('variables');
}

function showDetailTab(name) {
  ['variables','backups','schedules','files'].forEach(t => {
    const el  = document.getElementById('detail-tab-' + t);
    const btn = document.getElementById('dtab-' + t);
    if (el)  el.style.display  = t === name ? '' : 'none';
    if (btn) btn.classList.toggle('active', t === name);
  });
  if (name === 'variables') loadVariables();
  if (name === 'backups')   loadBackups();
  if (name === 'schedules') loadSchedules();
  if (name === 'files')     loadFiles(_detailServerInstallDir);
}

// ── Variables ────────────────────────────────────────────────────────────────
async function loadVariables() {
  const el = document.getElementById('vars-list');
  if (!el || !_detailServerId) return;
  try {
    const vars = await api('/api/servers.php?id=' + _detailServerId + '&variables=1');
    if (!vars || !Object.keys(vars).length) {
      el.innerHTML = '<p class="text-muted">No variables configured for this server.</p>';
      return;
    }
    el.innerHTML = Object.entries(vars).map(([k, v]) => `
      <div class="form-row" style="margin-bottom:0.5rem">
        <div class="form-group" style="flex:0;min-width:180px">
          <label class="form-label"><code>{${escHtml(k)}}</code></label>
        </div>
        <div class="form-group" style="flex:2">
          <input type="text" class="form-input var-input" data-key="${escHtml(k)}" value="${escHtml(String(v))}">
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<p class="text-muted">${escHtml(e.message)}</p>`; }
}

async function saveVariables() {
  const inputs = document.querySelectorAll('#vars-list .var-input');
  const body = {};
  inputs.forEach(el => { body[el.dataset.key] = el.value; });
  try {
    await api('/api/servers.php?id=' + _detailServerId + '&variables=1', { method: 'PUT', body: JSON.stringify(body) });
    toast('Variables saved');
  } catch (e) { toast(e.message, 'error'); }
}

// ── Backups ───────────────────────────────────────────────────────────────────
async function loadBackups() {
  const el = document.getElementById('backups-list');
  if (!el || !_detailServerId) return;
  el.textContent = 'Loading…';
  try {
    const list = await api('/api/backups.php?server_id=' + _detailServerId);
    if (!list.length) { el.innerHTML = '<p class="text-muted">No backups yet.</p>'; return; }
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Name</th><th>Size</th><th>Status</th><th>Created</th><th style="width:120px"></th></tr></thead>
      <tbody>${list.map(b => `
        <tr id="backup-row-${b.id}">
          <td>${escHtml(b.name || 'backup-' + b.id)}</td>
          <td>${b.size_bytes ? formatBytes(b.size_bytes) : '—'}</td>
          <td><span class="status-badge status-${escHtml(b.status)}">${escHtml(b.status)}</span></td>
          <td style="font-size:.8rem;color:var(--text-muted)">${escHtml(b.created_at || '')}</td>
          <td>
            ${b.status === 'complete' ? `<a href="${BASE}/api/backups.php?id=${b.id}&action=download" class="btn btn-ghost btn-sm">⬇</a>` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteBackup(${b.id})">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) { el.innerHTML = `<p class="text-muted">${escHtml(e.message)}</p>`; }
}

async function createBackup() {
  try {
    await api('/api/backups.php', { method: 'POST', body: JSON.stringify({ server_id: _detailServerId }) });
    toast('Backup started…');
    setTimeout(loadBackups, 2000);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteBackup(id) {
  if (!confirm('Delete this backup? This cannot be undone.')) return;
  try {
    await api('/api/backups.php?id=' + id, { method: 'DELETE' });
    const row = document.getElementById('backup-row-' + id);
    if (row) row.remove();
    toast('Backup deleted');
  } catch (e) { toast(e.message, 'error'); }
}

function formatBytes(b) {
  if (b < 1024)       return b + ' B';
  if (b < 1048576)    return (b/1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
  return (b/1073741824).toFixed(2) + ' GB';
}

// ── Schedules ─────────────────────────────────────────────────────────────────
async function loadSchedules() {
  const el = document.getElementById('schedules-list');
  if (!el || !_detailServerId) return;
  el.textContent = 'Loading…';
  try {
    const list = await api('/api/schedules.php?server_id=' + _detailServerId);
    if (!list.length) { el.innerHTML = '<p class="text-muted">No schedules yet.</p>'; return; }
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Cron</th><th>Action</th><th>Active</th><th style="width:80px"></th></tr></thead>
      <tbody>${list.map(s => `
        <tr id="sched-row-${s.id}">
          <td><code>${escHtml(s.cron_expression)}</code></td>
          <td><span class="badge">${escHtml(s.action)}</span></td>
          <td>${s.is_active ? '✓' : '—'}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editSchedule(${JSON.stringify(s).replace(/"/g,'&quot;')})">✎</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) { el.innerHTML = `<p class="text-muted">${escHtml(e.message)}</p>`; }
}

function openScheduleForm() {
  document.getElementById('sched-id').value     = '';
  document.getElementById('sched-cron').value   = '';
  document.getElementById('sched-action').value = 'start';
  document.getElementById('sched-active').checked = true;
  document.getElementById('schedule-form').style.display = '';
}

function editSchedule(s) {
  document.getElementById('sched-id').value       = s.id;
  document.getElementById('sched-cron').value     = s.cron_expression;
  document.getElementById('sched-action').value   = s.action;
  document.getElementById('sched-active').checked = !!s.is_active;
  document.getElementById('schedule-form').style.display = '';
}

async function saveSchedule() {
  const id    = document.getElementById('sched-id').value;
  const body  = {
    server_id:       _detailServerId,
    cron_expression: document.getElementById('sched-cron').value.trim(),
    action:          document.getElementById('sched-action').value,
    is_active:       document.getElementById('sched-active').checked ? 1 : 0,
  };
  try {
    if (id) await api('/api/schedules.php?id=' + id, { method: 'PUT',  body: JSON.stringify(body) });
    else    await api('/api/schedules.php',           { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('schedule-form').style.display = 'none';
    toast('Schedule saved');
    loadSchedules();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  try {
    await api('/api/schedules.php?id=' + id, { method: 'DELETE' });
    const row = document.getElementById('sched-row-' + id);
    if (row) row.remove();
    toast('Schedule deleted');
  } catch (e) { toast(e.message, 'error'); }
}

// ── File Manager ──────────────────────────────────────────────────────────────
let _filePath = '';

async function loadFiles(dir) {
  _filePath = dir || _detailServerInstallDir;
  const area   = document.getElementById('file-list-area');
  const crumb  = document.getElementById('file-breadcrumb');
  if (!area) return;
  area.textContent = 'Loading…';

  // Build breadcrumb
  if (crumb) {
    const base = _detailServerInstallDir;
    const rel  = _filePath.startsWith(base) ? _filePath.slice(base.length) : _filePath;
    const parts = rel.split('/').filter(Boolean);
    let html = `<span class="crumb-item" style="cursor:pointer" onclick="loadFiles('${escHtml(base)}')">~/server</span>`;
    let cumPath = base;
    parts.forEach((p, i) => {
      cumPath += '/' + p;
      const cp = cumPath;
      html += ` / <span class="crumb-item" style="cursor:pointer" onclick="loadFiles('${escHtml(cp)}')">${escHtml(p)}</span>`;
    });
    crumb.innerHTML = html;
  }

  try {
    const d = await api('/api/file.php?path=' + encodeURIComponent(_filePath));
    if (d.items !== undefined) {
      // Directory listing
      if (!d.items.length) { area.innerHTML = '<p class="text-muted">Empty directory.</p>'; return; }
      area.innerHTML = `
        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem">
          <button class="btn btn-sm btn-secondary" onclick="promptMkdir()">New Folder</button>
          <label class="btn btn-sm btn-secondary" style="cursor:pointer">
            Upload <input type="file" style="display:none" onchange="uploadFile(this)">
          </label>
        </div>
        <table class="data-table">
        <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th style="width:100px"></th></tr></thead>
        <tbody>${d.items.map(f => `
          <tr>
            <td style="cursor:pointer" onclick="${f.is_dir ? `loadFiles('${escHtml(f.path)}')` : `openRemoteFile('${escHtml(f.path)}')`}">
              ${f.is_dir ? '📁' : '📄'} ${escHtml(f.name)}
            </td>
            <td style="font-size:.8rem;color:var(--text-muted)">${f.is_dir ? '' : formatBytes(f.size || 0)}</td>
            <td style="font-size:.8rem;color:var(--text-muted)">${new Date((f.modified||0)*1000).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="promptRename('${escHtml(f.path)}','${escHtml(f.name)}')">✎</button>
              <button class="btn btn-danger btn-sm" onclick="deleteRemoteFile('${escHtml(f.path)}','${escHtml(f.name)}')">🗑</button>
            </td>
          </tr>`).join('')}
        </tbody></table>`;
    } else if (d.content !== undefined) {
      // File content editor
      area.innerHTML = `
        <button class="btn btn-sm btn-ghost" style="margin-bottom:0.5rem" onclick="loadFiles('${escHtml(_filePath.split('/').slice(0,-1).join('/'))}')">← Back</button>
        <textarea id="remote-file-ta" class="form-input" rows="20" style="font-family:monospace;font-size:.8rem;width:100%">${escHtml(d.content)}</textarea>
        <div style="margin-top:0.5rem;display:flex;gap:0.5rem">
          <button class="btn btn-primary btn-sm" onclick="saveRemoteFile()">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="loadFiles('${escHtml(_filePath.split('/').slice(0,-1).join('/'))}')">Cancel</button>
        </div>`;
    }
  } catch (e) { area.innerHTML = `<p class="text-muted">${escHtml(e.message)}</p>`; }
}

async function openRemoteFile(path) {
  _filePath = path;
  await loadFiles(path);
}

async function saveRemoteFile() {
  const ta = document.getElementById('remote-file-ta');
  if (!ta) return;
  try {
    await api('/api/file.php?path=' + encodeURIComponent(_filePath), { method: 'PUT', body: JSON.stringify({ content: ta.value }) });
    toast('File saved');
  } catch (e) { toast(e.message, 'error'); }
}

async function promptMkdir() {
  const name = prompt('New folder name:');
  if (!name) return;
  try {
    await api('/api/file.php?action=mkdir&path=' + encodeURIComponent(_filePath + '/' + name), { method: 'POST' });
    toast('Folder created');
    loadFiles(_filePath);
  } catch (e) { toast(e.message, 'error'); }
}

async function uploadFile(input) {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  form.append('path', _filePath);
  try {
    const r = await fetch(BASE + '/api/file.php?action=upload', { method: 'POST', body: form });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    toast('File uploaded');
    loadFiles(_filePath);
  } catch (e) { toast(e.message, 'error'); }
}

async function promptRename(path, currentName) {
  const newName = prompt('Rename to:', currentName);
  if (!newName || newName === currentName) return;
  try {
    await api('/api/file.php?action=rename&path=' + encodeURIComponent(path), { method: 'POST', body: JSON.stringify({ new_name: newName }) });
    toast('Renamed');
    loadFiles(_filePath);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteRemoteFile(path, name) {
  if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
  try {
    await api('/api/file.php?path=' + encodeURIComponent(path), { method: 'DELETE' });
    toast('Deleted');
    loadFiles(_filePath);
  } catch (e) { toast(e.message, 'error'); }
}

// ── Users page ────────────────────────────────────────────────────────────────
let _editUserId = null;
let _permsUserId = null;
let _permServers = [];

async function loadUsers() {
  if (!document.getElementById('users-tbody')) return;
  try {
    const users = await api('/api/users.php');
    const tbody = document.getElementById('users-tbody');
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No users yet.</td></tr>'; return; }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${escHtml(u.username)}</strong></td>
        <td>${escHtml(u.email || '—')}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-blue' : ''}">${escHtml(u.role)}</span></td>
        <td><span class="status-badge status-${u.is_active ? 'running' : 'stopped'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td style="font-size:.8rem;color:var(--text-muted)">${escHtml(u.created_at || '')}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openUserModal(${JSON.stringify(u).replace(/"/g,'&quot;')})">✎</button>
          ${u.role !== 'admin' ? `<button class="btn btn-ghost btn-sm" onclick="openPermsModal(${u.id}, '${escHtml(u.username)}')">🔑</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${escHtml(u.username)}')">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

function openUserModal(user) {
  _editUserId = user?.id || null;
  document.getElementById('user-modal-title').textContent = _editUserId ? 'Edit User' : 'Add User';
  document.getElementById('user-id').value       = _editUserId || '';
  document.getElementById('user-username').value = user?.username || '';
  document.getElementById('user-email').value    = user?.email || '';
  document.getElementById('user-role').value     = user?.role || 'subuser';
  document.getElementById('user-password').value = '';
  document.getElementById('user-password-confirm').value = '';
  document.getElementById('user-pass-label').textContent = _editUserId ? 'New Password (leave blank to keep)' : 'Password *';
  document.getElementById('user-active-group').style.display = _editUserId ? '' : 'none';
  if (_editUserId) document.getElementById('user-active').checked = !!user?.is_active;
  openModal('user-modal');
}

function closeUserModal() { closeModal('user-modal'); }

async function saveUser() {
  const id   = document.getElementById('user-id').value;
  const pass = document.getElementById('user-password').value;
  const conf = document.getElementById('user-password-confirm').value;
  if (pass && pass !== conf) { toast('Passwords do not match', 'error'); return; }
  const body = {
    username: document.getElementById('user-username').value.trim(),
    email:    document.getElementById('user-email').value.trim(),
    role:     document.getElementById('user-role').value,
  };
  if (pass) body.password = pass;
  if (id)   body.is_active = document.getElementById('user-active').checked ? 1 : 0;
  try {
    if (id) await api('/api/users.php?id=' + id, { method: 'PUT',  body: JSON.stringify(body) });
    else    await api('/api/users.php',           { method: 'POST', body: JSON.stringify(body) });
    toast('User saved');
    closeUserModal();
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteUser(id, name) {
  if (!confirm('Delete user "' + name + '"?')) return;
  try {
    await api('/api/users.php?id=' + id, { method: 'DELETE' });
    toast('User deleted');
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

async function openPermsModal(userId, username) {
  _permsUserId = userId;
  document.getElementById('perms-modal-title').textContent = username + ' — Server Permissions';
  const list = document.getElementById('perms-list');
  list.innerHTML = 'Loading…';
  openModal('perms-modal');
  try {
    const [servers, userData] = await Promise.all([
      api('/api/servers.php'),
      api('/api/users.php?id=' + userId),
    ]);
    _permServers = servers;
    const perms = Array.isArray(userData.permissions) ? userData.permissions : [];
    const permsMap = {};
    perms.forEach(p => { permsMap[p.server_id] = p; });
    const PERM_KEYS = ['can_start','can_stop','can_console','can_files','can_backups','can_edit_startup'];
    list.innerHTML = servers.map(s => {
      const p = permsMap[s.id] || {};
      return `<div style="margin-bottom:1rem;padding:0.75rem;background:var(--bg-section,rgba(0,0,0,.2));border-radius:var(--radius)">
        <strong>${escHtml(s.name)}</strong>
        <div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:0.5rem">
          ${PERM_KEYS.map(k => `<label class="checkbox-label"><input type="checkbox" class="perm-cb" data-server="${s.id}" data-perm="${k}" ${p[k] ? 'checked' : ''}> ${k.replace('can_','')}</label>`).join('')}
        </div>
      </div>`;
    }).join('');
  } catch (e) { list.innerHTML = `<p class="text-muted">${escHtml(e.message)}</p>`; }
}

function closePermsModal() { closeModal('perms-modal'); }

async function savePermissions() {
  for (const s of _permServers) {
    const cbs = document.querySelectorAll(`.perm-cb[data-server="${s.id}"]`);
    const perms = {};
    cbs.forEach(cb => { perms[cb.dataset.perm] = cb.checked ? 1 : 0; });
    try {
      await api('/api/users.php?action=permissions', { method: 'PUT', body: JSON.stringify({ user_id: _permsUserId, server_id: s.id, ...perms }) });
    } catch {}
  }
  toast('Permissions saved');
  closePermsModal();
}

// ── Mojos page ────────────────────────────────────────────────────────────────
let _editMojoId = null;
let _mojoVarCounter = 0;

async function loadMojos() {
  if (!document.getElementById('mojos-tbody')) return;
  try {
    const mojos = await api('/api/servers.php?mojos=1');
    const tbody = document.getElementById('mojos-tbody');
    if (!mojos.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No Mojos found.</td></tr>'; return; }
    tbody.innerHTML = mojos.map(m => `
      <tr>
        <td><strong>${escHtml(m.name)}</strong></td>
        <td>${escHtml(m.app_id || '—')}</td>
        <td>${(m.variables || []).length}</td>
        <td>${m.is_builtin ? '<span class="badge">built-in</span>' : '<span class="badge badge-blue">custom</span>'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openMojoModal(${JSON.stringify(m).replace(/"/g,'&quot;')})">✎</button>
          ${!m.is_builtin ? `<button class="btn btn-danger btn-sm" onclick="deleteMojo(${m.id})">🗑</button>` : ''}
        </td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

function openMojoModal(mojo) {
  _editMojoId = mojo?.id || null;
  document.getElementById('mojo-modal-title').textContent = _editMojoId ? 'Edit Mojo' : 'New Mojo';
  document.getElementById('mojo-id').value           = _editMojoId || '';
  document.getElementById('mojo-name').value         = mojo?.name || '';
  document.getElementById('mojo-app-id').value       = mojo?.app_id || '';
  document.getElementById('mojo-docker-image').value = mojo?.docker_image || '';
  document.getElementById('mojo-executable').value   = mojo?.launch_executable || '';
  document.getElementById('mojo-startup').value      = mojo?.startup_template || '';
  document.getElementById('mojo-port').value         = mojo?.port || '';
  document.getElementById('mojo-max-players').value  = mojo?.max_players || '';
  document.getElementById('mojo-requires-login').checked = !!mojo?.requires_login;

  const varsList = document.getElementById('mojo-vars-list');
  varsList.innerHTML = '';
  _mojoVarCounter = 0;
  (mojo?.variables || []).forEach(v => addMojoVar(v));
  openModal('mojo-modal');
}

function closeMojoModal() { closeModal('mojo-modal'); }

function addMojoVar(v) {
  const i = _mojoVarCounter++;
  const div = document.createElement('div');
  div.className = 'form-row mojo-var-row';
  div.dataset.idx = i;
  if (v?.id) div.dataset.varId = v.id;
  div.innerHTML = `
    <div class="form-group"><input type="text" class="form-input" placeholder="Name" value="${escHtml(v?.name||'')}"></div>
    <div class="form-group"><input type="text" class="form-input" placeholder="ENV_VARIABLE" value="${escHtml(v?.env_variable||'')}"></div>
    <div class="form-group" style="flex:2"><input type="text" class="form-input" placeholder="Default value" value="${escHtml(v?.default_value||'')}"></div>
    <div class="form-group" style="flex:0;align-self:flex-end">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.mojo-var-row').remove()">✕</button>
    </div>`;
  document.getElementById('mojo-vars-list').appendChild(div);
}

async function saveMojo() {
  const id   = document.getElementById('mojo-id').value;
  const vars = [];
  document.querySelectorAll('.mojo-var-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const entry = { name: inputs[0].value, env_variable: inputs[1].value, default_value: inputs[2].value };
    if (row.dataset.varId) entry.id = parseInt(row.dataset.varId);
    if (entry.name || entry.env_variable) vars.push(entry);
  });
  const body = {
    name:              document.getElementById('mojo-name').value.trim(),
    app_id:            document.getElementById('mojo-app-id').value.trim(),
    docker_image:      document.getElementById('mojo-docker-image').value.trim(),
    launch_executable: document.getElementById('mojo-executable').value.trim(),
    startup_template:  document.getElementById('mojo-startup').value.trim(),
    port:              parseInt(document.getElementById('mojo-port').value) || 0,
    max_players:       parseInt(document.getElementById('mojo-max-players').value) || 0,
    requires_login:    document.getElementById('mojo-requires-login').checked ? 1 : 0,
    variables: vars,
  };
  try {
    if (id) await api('/api/mojos.php?id=' + id, { method: 'PUT',  body: JSON.stringify(body) });
    else    await api('/api/mojos.php',           { method: 'POST', body: JSON.stringify(body) });
    toast('Mojo saved');
    closeMojoModal();
    loadMojos();
    _allMojos = []; // invalidate cache
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteMojo(id) {
  if (!confirm('Delete this Mojo?')) return;
  try {
    await api('/api/mojos.php?id=' + id, { method: 'DELETE' });
    toast('Mojo deleted');
    loadMojos();
    _allMojos = [];
  } catch (e) { toast(e.message, 'error'); }
}

// ── Activity page ─────────────────────────────────────────────────────────────
let _activityPage = 0;
const ACTIVITY_LIMIT = 50;

async function loadActivity() {
  const tbody   = document.getElementById('activity-tbody');
  if (!tbody) return;
  const serverId = document.getElementById('activity-server-filter')?.value || '';
  try {
    const url = '/api/activity.php?limit=' + ACTIVITY_LIMIT + '&offset=' + (_activityPage * ACTIVITY_LIMIT) + (serverId ? '&server_id=' + serverId : '');
    const rows = await api(url);
    document.getElementById('activity-page-label').textContent = 'Page ' + (_activityPage + 1);
    document.getElementById('activity-prev').disabled = _activityPage === 0;
    document.getElementById('activity-next').disabled = rows.length < ACTIVITY_LIMIT;
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No activity recorded.</td></tr>'; return; }
    tbody.innerHTML = rows.map(a => `
      <tr>
        <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${escHtml(a.created_at || '')}</td>
        <td>${escHtml(a.username || 'system')}</td>
        <td>${escHtml(a.server_name || '—')}</td>
        <td><span class="badge badge-neutral">${escHtml(a.action)}</span></td>
        <td>${escHtml(a.description || '')}</td>
        <td style="font-size:.75rem;color:var(--text-muted)">${escHtml(a.ip_address || '')}</td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-muted">${escHtml(e.message)}</td></tr>`; }
}

function activityPage(delta) {
  _activityPage = Math.max(0, _activityPage + delta);
  loadActivity();
}

async function populateActivityServerFilter() {
  const sel = document.getElementById('activity-server-filter');
  if (!sel) return;
  try {
    const servers = await api('/api/servers.php');
    servers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
  } catch {}
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
async function loadWebhooks() {
  const tbody = document.getElementById('webhooks-tbody');
  if (!tbody) return;
  try {
    const hooks = await api('/api/webhooks.php');
    if (!hooks.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No webhooks configured.</td></tr>'; return; }
    tbody.innerHTML = hooks.map(h => `
      <tr>
        <td style="word-break:break-all;font-size:.85rem">${escHtml(h.url)}</td>
        <td style="font-size:.8rem">${escHtml(h.events || '*')}</td>
        <td><span class="status-badge status-${h.is_active ? 'running' : 'stopped'}">${h.is_active ? 'Active' : 'Paused'}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openWebhookModal(${JSON.stringify(h).replace(/"/g,'&quot;')})">✎</button>
          <button class="btn btn-danger btn-sm" onclick="deleteWebhook(${h.id})">🗑</button>
        </td>
      </tr>`).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="text-muted">${escHtml(e.message)}</td></tr>`; }
}

function openWebhookModal(hook) {
  document.getElementById('wh-id').value     = hook?.id || '';
  document.getElementById('wh-url').value    = hook?.url || '';
  document.getElementById('wh-secret').value = '';
  document.getElementById('wh-events').value = hook?.events || '*';
  document.getElementById('wh-active').checked = hook ? !!hook.is_active : true;
  document.getElementById('webhook-modal-title').textContent = hook?.id ? 'Edit Webhook' : 'Add Webhook';
  openModal('webhook-modal');
}
function closeWebhookModal() { closeModal('webhook-modal'); }

async function saveWebhook() {
  const id = document.getElementById('wh-id').value;
  const body = {
    url:       document.getElementById('wh-url').value.trim(),
    events:    document.getElementById('wh-events').value.trim() || '*',
    is_active: document.getElementById('wh-active').checked ? 1 : 0,
  };
  const secret = document.getElementById('wh-secret').value.trim();
  if (secret) body.secret = secret;
  try {
    if (id) await api('/api/webhooks.php?id=' + id, { method: 'PUT',  body: JSON.stringify(body) });
    else    await api('/api/webhooks.php',           { method: 'POST', body: JSON.stringify(body) });
    toast('Webhook saved');
    closeWebhookModal();
    loadWebhooks();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteWebhook(id) {
  if (!confirm('Delete this webhook?')) return;
  try {
    await api('/api/webhooks.php?id=' + id, { method: 'DELETE' });
    toast('Webhook deleted');
    loadWebhooks();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Page auto-init ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('users-tbody'))     loadUsers();
  if (document.getElementById('mojos-tbody'))     loadMojos();
  if (document.getElementById('activity-tbody')) { populateActivityServerFilter(); loadActivity(); }
  if (document.getElementById('webhooks-tbody'))  loadWebhooks();
  // On settings page, load webhooks when tab is clicked (already handled by switchTab + load)
});
