/* SGSM – Application JavaScript */

/* ── Flash message auto-dismiss ── */
(function () {
  document.querySelectorAll(".alert[data-autohide]").forEach(function (el) {
    setTimeout(function () {
      el.style.transition = "opacity 0.4s";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 400);
    }, 4000);
  });
})();

/* ── Confirm dialogs for destructive actions ── */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-confirm]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (!confirm(el.dataset.confirm)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  });
});

/* ── Tab switching ── */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".tabs").forEach(function (tabsEl) {
    tabsEl.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.dataset.tab;
        tabsEl.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var container = tabsEl.closest(".tabs-container") || document;
        container.querySelectorAll(".tab-pane").forEach(function (p) { p.classList.remove("active"); });
        var pane = container.querySelector("#tab-" + target);
        if (pane) pane.classList.add("active");
      });
    });
  });
});

/* ── Server detail: poll status ── */
(function () {
  var statusEl = document.getElementById("server-status-badge");
  var pidEl = document.getElementById("server-pid");
  if (!statusEl) return;
  var serverId = statusEl.dataset.serverId;
  if (!serverId) return;

  function pollStatus() {
    fetch("/api/servers/" + serverId + "/status")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var status = data.status;
        var badgeClass = "badge-" + status;
        statusEl.className = "badge " + badgeClass;
        statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);

        if (pidEl) {
          pidEl.textContent = data.pid ? "PID " + data.pid : "—";
        }

        // Refresh page if transitioning away from installing/updating
        if (status === "stopped" || status === "running" || status === "error") {
          var indicator = document.getElementById("install-progress");
          if (indicator) {
            indicator.style.display = "none";
            // Reload to show fresh logs
            window.location.reload();
          }
        }
      })
      .catch(function () {});
  }

  // Poll every 3 seconds if installing/updating
  var initial = statusEl.dataset.status || "";
  if (initial === "installing" || initial === "updating") {
    var interval = setInterval(function () {
      pollStatus();
      // Stop after status changes
      var current = statusEl.className;
      if (!current.includes("installing") && !current.includes("updating")) {
        clearInterval(interval);
      }
    }, 3000);
  }
})();

/* ── Log console: poll for new entries ── */
(function () {
  var consoleEl = document.getElementById("log-console");
  if (!consoleEl) return;
  var serverId = consoleEl.dataset.serverId;
  if (!serverId) return;

  var lastId = parseInt(consoleEl.dataset.lastId || "0", 10);

  function appendLog(entry) {
    var row = document.createElement("div");
    row.className = "log-entry " + (entry.level || "info");
    row.innerHTML =
      '<span class="ts">' + entry.created_at + '</span>' +
      '<span class="msg">' + escapeHtml(entry.message) + '</span>';
    consoleEl.appendChild(row);
    lastId = Math.max(lastId, entry.id);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pollLogs() {
    fetch("/api/servers/" + serverId + "/logs")
      .then(function (r) { return r.json(); })
      .then(function (entries) {
        var newEntries = entries.filter(function (e) { return e.id > lastId; });
        newEntries.forEach(appendLog);
        if (newEntries.length > 0) {
          consoleEl.scrollTop = consoleEl.scrollHeight;
        }
      })
      .catch(function () {});
  }

  // Auto-scroll initially
  consoleEl.scrollTop = consoleEl.scrollHeight;

  // Poll every 2.5 seconds when installing/updating
  var statusBadge = document.getElementById("server-status-badge");
  if (statusBadge) {
    var initStatus = statusBadge.dataset.status || "";
    if (initStatus === "installing" || initStatus === "updating") {
      setInterval(pollLogs, 2500);
    }
  }
})();

/* ── Game preset selector ── */
document.addEventListener("DOMContentLoaded", function () {
  var preset = document.getElementById("game-preset");
  if (!preset) return;
  preset.addEventListener("change", function () {
    var val = preset.value;
    var parts = val.split("|");
    if (parts.length >= 2) {
      var appIdEl = document.getElementById("app_id");
      var gameNameEl = document.getElementById("game_name");
      if (appIdEl) appIdEl.value = parts[0];
      if (gameNameEl) gameNameEl.value = parts[1];
    }
  });
});

/* ── Resource bar colors ── */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".resource-bar-fill").forEach(function (el) {
    var pct = parseFloat(el.style.width);
    if (pct > 85) el.classList.add("danger");
    else if (pct > 60) el.classList.add("warning");
  });
});
