<?php /* Admin-only: Mojo template management */ ?>

<div class="page-header">
  <div>
    <h1 class="page-title">Mojos</h1>
    <p class="page-subtitle">Game server templates &amp; startup variables</p>
  </div>
  <button class="btn btn-primary" onclick="openMojoModal()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    New Mojo
  </button>
</div>

<div class="card">
  <table class="data-table" id="mojos-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Steam App ID</th>
        <th>Variables</th>
        <th>Type</th>
        <th style="width:120px"></th>
      </tr>
    </thead>
    <tbody id="mojos-tbody">
      <tr><td colspan="5" class="empty-row">Loading…</td></tr>
    </tbody>
  </table>
</div>

<!-- Mojo Edit Modal -->
<div class="modal-overlay" id="mojo-modal" style="display:none">
  <div class="modal" style="max-width:680px">
    <div class="modal-header">
      <h2 class="modal-title" id="mojo-modal-title">New Mojo</h2>
      <button class="modal-close" onclick="closeMojoModal()">✕</button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="mojo-id">
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" id="mojo-name" placeholder="My Game Server">
        </div>
        <div class="form-group">
          <label class="form-label">Steam App ID</label>
          <input type="text" class="form-input" id="mojo-app-id" placeholder="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Docker Image</label>
        <input type="text" class="form-input" id="mojo-docker-image" placeholder="steamcmd/steamcmd:latest">
      </div>
      <div class="form-group">
        <label class="form-label">Launch Executable</label>
        <input type="text" class="form-input" id="mojo-executable" placeholder="./server.x86_64">
      </div>
      <div class="form-group">
        <label class="form-label">Startup Template <span class="text-muted">(use {VARIABLE} placeholders)</span></label>
        <input type="text" class="form-input" id="mojo-startup" placeholder="-port {SERVER_PORT} -maxplayers {MAX_PLAYERS}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Default Port</label>
          <input type="number" class="form-input" id="mojo-port" placeholder="27015">
        </div>
        <div class="form-group">
          <label class="form-label">Default Max Players</label>
          <input type="number" class="form-input" id="mojo-max-players" placeholder="10">
        </div>
        <div class="form-group" style="flex:0;align-self:flex-end">
          <label class="checkbox-label" style="padding-bottom:0.75rem">
            <input type="checkbox" id="mojo-requires-login">
            Requires Steam Login
          </label>
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:0.5rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
          <strong>Variables</strong>
          <button class="btn btn-sm btn-secondary" onclick="addMojoVar()">+ Add Variable</button>
        </div>
        <div id="mojo-vars-list"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeMojoModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveMojo()">Save Mojo</button>
    </div>
  </div>
</div>
