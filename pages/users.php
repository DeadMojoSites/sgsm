<?php /* Admin-only: User management */ ?>

<div class="page-header">
  <div>
    <h1 class="page-title">Users</h1>
    <p class="page-subtitle">Manage admin &amp; sub-user accounts</p>
  </div>
  <button class="btn btn-primary" onclick="openUserModal()">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Add User
  </button>
</div>

<div class="card">
  <table class="data-table" id="users-table">
    <thead>
      <tr>
        <th>Username</th>
        <th>Email</th>
        <th>Role</th>
        <th>Status</th>
        <th>Created</th>
        <th style="width:120px"></th>
      </tr>
    </thead>
    <tbody id="users-tbody">
      <tr><td colspan="6" class="empty-row">Loading…</td></tr>
    </tbody>
  </table>
</div>

<!-- User Modal -->
<div class="modal-overlay" id="user-modal" style="display:none">
  <div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h2 class="modal-title" id="user-modal-title">Add User</h2>
      <button class="modal-close" onclick="closeUserModal()">✕</button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="user-id">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" class="form-input" id="user-username" placeholder="username" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-input" id="user-role">
            <option value="subuser">Sub-user</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Email (optional)</label>
        <input type="email" class="form-input" id="user-email" placeholder="user@example.com">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" id="user-pass-label">Password</label>
          <input type="password" class="form-input" id="user-password" placeholder="Min 8 characters" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm Password</label>
          <input type="password" class="form-input" id="user-password-confirm" placeholder="Repeat password" autocomplete="new-password">
        </div>
      </div>
      <div class="form-group" id="user-active-group" style="display:none">
        <label class="checkbox-label">
          <input type="checkbox" id="user-active" checked>
          Account active
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeUserModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveUser()">Save</button>
    </div>
  </div>
</div>

<!-- Permissions Modal -->
<div class="modal-overlay" id="perms-modal" style="display:none">
  <div class="modal" style="max-width:640px">
    <div class="modal-header">
      <h2 class="modal-title" id="perms-modal-title">Server Permissions</h2>
      <button class="modal-close" onclick="closePermsModal()">✕</button>
    </div>
    <div class="modal-body">
      <p class="text-muted" style="margin-bottom:1rem">Set which actions this user can perform on each server.</p>
      <div id="perms-list"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closePermsModal()">Close</button>
      <button class="btn btn-primary" onclick="savePermissions()">Save Permissions</button>
    </div>
  </div>
</div>
