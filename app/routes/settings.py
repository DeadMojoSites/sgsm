"""Application settings routes."""

from flask import Blueprint, render_template, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash

from ..models import db, Setting
from ..steamcmd.manager import is_steamcmd_installed, install_steamcmd

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        section = request.form.get("section")

        if section == "general":
            Setting.set("site_title", request.form.get("site_title", "").strip())
            Setting.set("max_servers", request.form.get("max_servers", "10").strip())
            Setting.set("log_lines", request.form.get("log_lines", "200").strip())
            Setting.set("auto_restart", "true" if request.form.get("auto_restart") == "on" else "false")
            flash("General settings saved.", "success")

        elif section == "paths":
            Setting.set("servers_dir", request.form.get("servers_dir", "").strip())
            Setting.set("steamcmd_dir", request.form.get("steamcmd_dir", "").strip())
            flash("Path settings saved.", "success")

        elif section == "security":
            new_pass = request.form.get("new_password", "").strip()
            confirm = request.form.get("confirm_password", "").strip()
            if new_pass:
                if len(new_pass) < 6:
                    flash("Password must be at least 6 characters.", "error")
                elif new_pass != confirm:
                    flash("Passwords do not match.", "error")
                else:
                    Setting.set("admin_password", generate_password_hash(new_pass))
                    flash("Password updated.", "success")
            else:
                flash("No password change requested.", "info")

        elif section == "steam":
            Setting.set("steam_api_key", request.form.get("steam_api_key", "").strip())
            flash("Steam settings saved.", "success")

        elif section == "steamcmd_install":
            steamcmd_dir = Setting.get("steamcmd_dir", "/steamcmd")
            ok, msg = install_steamcmd(steamcmd_dir)
            flash(msg, "success" if ok else "error")

        return redirect(url_for("settings.index"))

    steamcmd_dir = Setting.get("steamcmd_dir", "/steamcmd")
    return render_template(
        "settings/index.html",
        settings={
            "site_title": Setting.get("site_title", "SGSM"),
            "max_servers": Setting.get("max_servers", "10"),
            "log_lines": Setting.get("log_lines", "200"),
            "auto_restart": Setting.get("auto_restart", "false"),
            "servers_dir": Setting.get("servers_dir", "/servers"),
            "steamcmd_dir": steamcmd_dir,
            "steam_api_key": Setting.get("steam_api_key", ""),
        },
        steamcmd_installed=is_steamcmd_installed(steamcmd_dir),
    )
