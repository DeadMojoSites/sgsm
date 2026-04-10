"""Game server management routes."""

import os
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app

from ..models import db, GameServer, ServerLog, Setting
from ..steamcmd.manager import (
    POPULAR_GAMES,
    install_server,
    update_server,
    start_server,
    stop_server,
    restart_server,
    check_process_alive,
)

servers_bp = Blueprint("servers", __name__)


@servers_bp.route("/")
def list_servers():
    servers = GameServer.query.order_by(GameServer.name).all()
    for s in servers:
        if s.status == "running" and not check_process_alive(s.pid):
            s.status = "stopped"
            s.pid = None
    db.session.commit()
    return render_template("servers/list.html", servers=servers)


@servers_bp.route("/new", methods=["GET", "POST"])
def create_server():
    servers_dir = Setting.get("servers_dir", current_app.config["SGSM_SERVERS_DIR"])
    error = None

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        app_id = request.form.get("app_id", "").strip()
        game_name = request.form.get("game_name", "").strip()
        install_dir = request.form.get("install_dir", "").strip()
        executable = request.form.get("executable", "").strip()
        launch_args = request.form.get("launch_args", "").strip()
        port = request.form.get("port", "").strip()
        max_players = request.form.get("max_players", "16").strip()
        auto_restart = request.form.get("auto_restart") == "on"
        password = request.form.get("password", "").strip()

        if not name:
            error = "Server name is required."
        elif not app_id:
            error = "Steam App ID is required."
        else:
            if not install_dir:
                safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
                install_dir = os.path.join(servers_dir, safe_name)

            server = GameServer(
                name=name,
                app_id=app_id,
                game_name=game_name or name,
                install_dir=install_dir,
                executable=executable,
                launch_args=launch_args,
                port=int(port) if port.isdigit() else None,
                max_players=int(max_players) if max_players.isdigit() else 16,
                auto_restart=auto_restart,
                password=password,
                status="stopped",
            )
            db.session.add(server)
            db.session.commit()

            do_install = request.form.get("do_install") == "on"
            if do_install:
                install_server(current_app._get_current_object(), server.id)
                flash(f"Server '{name}' created – installation started in background.", "success")
            else:
                flash(f"Server '{name}' created.", "success")

            return redirect(url_for("servers.server_detail", server_id=server.id))

    return render_template(
        "servers/create.html",
        popular_games=POPULAR_GAMES,
        servers_dir=servers_dir,
        error=error,
    )


@servers_bp.route("/<int:server_id>")
def server_detail(server_id):
    server = GameServer.query.get_or_404(server_id)
    if server.status == "running" and not check_process_alive(server.pid):
        server.status = "stopped"
        server.pid = None
        db.session.commit()

    log_count = int(Setting.get("log_lines", "200"))
    logs = (
        ServerLog.query.filter_by(server_id=server_id)
        .order_by(ServerLog.created_at.desc())
        .limit(log_count)
        .all()
    )
    logs.reverse()
    return render_template("servers/detail.html", server=server, logs=logs)


@servers_bp.route("/<int:server_id>/edit", methods=["GET", "POST"])
def edit_server(server_id):
    server = GameServer.query.get_or_404(server_id)
    error = None

    if request.method == "POST":
        server.name = request.form.get("name", server.name).strip()
        server.game_name = request.form.get("game_name", server.game_name).strip()
        server.executable = request.form.get("executable", server.executable).strip()
        server.launch_args = request.form.get("launch_args", server.launch_args).strip()
        port = request.form.get("port", "").strip()
        server.port = int(port) if port.isdigit() else None
        mp = request.form.get("max_players", "16").strip()
        server.max_players = int(mp) if mp.isdigit() else 16
        server.auto_restart = request.form.get("auto_restart") == "on"
        server.password = request.form.get("password", "").strip()

        if not server.name:
            error = "Server name is required."
        else:
            db.session.commit()
            flash("Server settings saved.", "success")
            return redirect(url_for("servers.server_detail", server_id=server.id))

    return render_template("servers/edit.html", server=server, error=error)


@servers_bp.route("/<int:server_id>/delete", methods=["POST"])
def delete_server(server_id):
    server = GameServer.query.get_or_404(server_id)
    name = server.name
    if server.status == "running":
        stop_server(current_app._get_current_object(), server_id)
    db.session.delete(server)
    db.session.commit()
    flash(f"Server '{name}' deleted.", "info")
    return redirect(url_for("servers.list_servers"))


@servers_bp.route("/<int:server_id>/install", methods=["POST"])
def install(server_id):
    server = GameServer.query.get_or_404(server_id)
    if server.status not in ("stopped", "error"):
        flash("Stop the server before re-installing.", "warning")
        return redirect(url_for("servers.server_detail", server_id=server_id))
    install_server(current_app._get_current_object(), server_id)
    flash("Installation started in background.", "info")
    return redirect(url_for("servers.server_detail", server_id=server_id))


@servers_bp.route("/<int:server_id>/update", methods=["POST"])
def update(server_id):
    server = GameServer.query.get_or_404(server_id)
    if server.status not in ("stopped", "error"):
        flash("Stop the server before updating.", "warning")
        return redirect(url_for("servers.server_detail", server_id=server_id))
    update_server(current_app._get_current_object(), server_id)
    flash("Update started in background.", "info")
    return redirect(url_for("servers.server_detail", server_id=server_id))


@servers_bp.route("/<int:server_id>/start", methods=["POST"])
def start(server_id):
    server = GameServer.query.get_or_404(server_id)
    if server.status == "running":
        flash("Server is already running.", "warning")
        return redirect(url_for("servers.server_detail", server_id=server_id))
    start_server(current_app._get_current_object(), server_id)
    flash("Start command sent.", "info")
    return redirect(url_for("servers.server_detail", server_id=server_id))


@servers_bp.route("/<int:server_id>/stop", methods=["POST"])
def stop(server_id):
    server = GameServer.query.get_or_404(server_id)
    if server.status != "running":
        flash("Server is not running.", "warning")
        return redirect(url_for("servers.server_detail", server_id=server_id))
    stop_server(current_app._get_current_object(), server_id)
    flash("Stop command sent.", "info")
    return redirect(url_for("servers.server_detail", server_id=server_id))


@servers_bp.route("/<int:server_id>/restart", methods=["POST"])
def restart(server_id):
    GameServer.query.get_or_404(server_id)
    restart_server(current_app._get_current_object(), server_id)
    flash("Restart command sent.", "info")
    return redirect(url_for("servers.server_detail", server_id=server_id))
