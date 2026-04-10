"""Main / dashboard routes."""

import platform
import psutil
from flask import Blueprint, render_template, redirect, url_for

from ..models import Setting, GameServer
from ..steamcmd.manager import check_process_alive

main_bp = Blueprint("main", __name__)


@main_bp.before_app_request
def check_setup():
    """Redirect to setup wizard if setup is not complete."""
    from flask import request
    if request.endpoint and request.endpoint.startswith("setup"):
        return
    if request.endpoint in ("static",):
        return
    if request.endpoint and request.endpoint.startswith("api."):
        return
    if Setting.get("setup_complete") != "true":
        return redirect(url_for("setup.wizard"))


@main_bp.route("/")
def index():
    servers = GameServer.query.all()
    # Refresh running status
    for s in servers:
        if s.status == "running" and not check_process_alive(s.pid):
            s.status = "stopped"
            s.pid = None
    from ..models import db
    db.session.commit()

    running = sum(1 for s in servers if s.status == "running")
    stopped = sum(1 for s in servers if s.status == "stopped")
    error = sum(1 for s in servers if s.status == "error")
    installing = sum(1 for s in servers if s.status in ("installing", "updating"))

    try:
        cpu = psutil.cpu_percent(interval=0.2)
        ram = psutil.virtual_memory()
        ram_used = ram.used // (1024 ** 2)
        ram_total = ram.total // (1024 ** 2)
        disk = psutil.disk_usage("/")
        disk_used = disk.used // (1024 ** 3)
        disk_total = disk.total // (1024 ** 3)
    except Exception:
        cpu = ram_used = ram_total = disk_used = disk_total = 0

    return render_template(
        "dashboard.html",
        servers=servers,
        running=running,
        stopped=stopped,
        error=error,
        installing=installing,
        cpu=cpu,
        ram_used=ram_used,
        ram_total=ram_total,
        disk_used=disk_used,
        disk_total=disk_total,
        platform=platform.system(),
    )
