"""JSON API endpoints for async updates (status polling, logs)."""

from flask import Blueprint, jsonify

from ..models import GameServer, ServerLog, Setting
from ..steamcmd.manager import check_process_alive

api_bp = Blueprint("api", __name__)


@api_bp.route("/servers")
def servers():
    all_servers = GameServer.query.order_by(GameServer.name).all()
    data = []
    for s in all_servers:
        if s.status == "running" and not check_process_alive(s.pid):
            s.status = "stopped"
            s.pid = None
            from ..models import db
            db.session.commit()
        data.append(s.to_dict())
    return jsonify(data)


@api_bp.route("/servers/<int:server_id>/status")
def server_status(server_id):
    server = GameServer.query.get_or_404(server_id)
    if server.status == "running" and not check_process_alive(server.pid):
        server.status = "stopped"
        server.pid = None
        from ..models import db
        db.session.commit()
    return jsonify({"status": server.status, "pid": server.pid})


@api_bp.route("/servers/<int:server_id>/logs")
def server_logs(server_id):
    GameServer.query.get_or_404(server_id)
    log_count = int(Setting.get("log_lines", "200"))
    logs = (
        ServerLog.query.filter_by(server_id=server_id)
        .order_by(ServerLog.created_at.desc())
        .limit(log_count)
        .all()
    )
    logs.reverse()
    return jsonify([l.to_dict() for l in logs])


@api_bp.route("/health")
def health():
    return jsonify({"status": "ok"})
