<?php /* Activity Log */ ?>

<div class="page-header">
  <div>
    <h1 class="page-title">Activity Log</h1>
    <p class="page-subtitle">Audit trail of all panel actions</p>
  </div>
  <select class="form-input" id="activity-server-filter" style="width:auto" onchange="loadActivity()">
    <option value="">All Servers</option>
  </select>
</div>

<div class="card">
  <table class="data-table" id="activity-table">
    <thead>
      <tr>
        <th>Time</th>
        <th>User</th>
        <th>Server</th>
        <th>Action</th>
        <th>Description</th>
        <th>IP</th>
      </tr>
    </thead>
    <tbody id="activity-tbody">
      <tr><td colspan="6" class="empty-row">Loading…</td></tr>
    </tbody>
  </table>
  <div style="padding:0.75rem 1rem;border-top:1px solid var(--border);display:flex;gap:0.5rem;align-items:center">
    <button class="btn btn-sm btn-secondary" id="activity-prev" onclick="activityPage(-1)" disabled>← Prev</button>
    <span id="activity-page-label" class="text-muted" style="font-size:0.8rem">Page 1</span>
    <button class="btn btn-sm btn-secondary" id="activity-next" onclick="activityPage(1)">Next →</button>
  </div>
</div>
