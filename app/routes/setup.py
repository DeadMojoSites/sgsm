"""Setup wizard routes – first-run configuration."""

import os
from flask import Blueprint, render_template, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash

from ..models import db, Setting
from ..steamcmd.manager import is_steamcmd_installed, install_steamcmd

setup_bp = Blueprint("setup", __name__)


def _validate_path(path: str) -> tuple[bool, str]:
    """Return (ok, error_msg) for an admin-supplied directory path.

    Ensures the value is an absolute path with no directory traversal sequences,
    reducing the risk of path-injection vulnerabilities.
    """
    if not path:
        return False, "Path must not be empty."
    # Normalise and check the path is absolute after resolving any traversal
    resolved = os.path.normpath(path)
    if not os.path.isabs(resolved):
        return False, f"Path must be absolute: {path!r}"
    # Reject any remaining traversal components after normpath
    if ".." in resolved.split(os.sep):
        return False, f"Path must not contain directory traversal: {path!r}"
    return True, ""


@setup_bp.route("/", methods=["GET", "POST"])
def wizard():
    if Setting.get("setup_complete") == "true":
        return redirect(url_for("main.index"))

    step = int(request.args.get("step", 1))
    error = None

    if request.method == "POST":
        action = request.form.get("action")

        if action == "step1":
            # Site title + admin password
            title = request.form.get("site_title", "SGSM – Game Server Manager").strip()
            password = request.form.get("admin_password", "").strip()
            if not password or len(password) < 6:
                error = "Password must be at least 6 characters."
                return render_template(
                    "setup/wizard.html",
                    step=1,
                    error=error,
                    settings={
                        "site_title": title,
                        "servers_dir": Setting.get("servers_dir", "/servers"),
                        "steamcmd_dir": Setting.get("steamcmd_dir", "/steamcmd"),
                        "data_dir": Setting.get("data_dir", "/data"),
                        "steam_api_key": Setting.get("steam_api_key", ""),
                    },
                )
            Setting.set("site_title", title)
            Setting.set("admin_password", generate_password_hash(password))
            return redirect(url_for("setup.wizard", step=2))

        elif action == "step2":
            # Paths
            servers_dir = request.form.get("servers_dir", "/servers").strip()
            steamcmd_dir = request.form.get("steamcmd_dir", "/steamcmd").strip()
            data_dir = request.form.get("data_dir", "/data").strip()

            for label, path in (
                ("Servers directory", servers_dir),
                ("SteamCMD directory", steamcmd_dir),
                ("Data directory", data_dir),
            ):
                ok, msg = _validate_path(path)
                if not ok:
                    error = f"{label}: {msg}"
                    return render_template("setup/wizard.html", step=2, error=error,
                                           settings=_current_settings())

            # Use the normalised form for all filesystem operations
            servers_dir = os.path.normpath(servers_dir)
            steamcmd_dir = os.path.normpath(steamcmd_dir)
            data_dir = os.path.normpath(data_dir)

            try:
                os.makedirs(servers_dir, exist_ok=True)
                os.makedirs(steamcmd_dir, exist_ok=True)
                os.makedirs(data_dir, exist_ok=True)
            except OSError as exc:
                error = f"Could not create directories: {exc}"
                return render_template("setup/wizard.html", step=2, error=error,
                                       settings=_current_settings())
            Setting.set("servers_dir", servers_dir)
            Setting.set("steamcmd_dir", steamcmd_dir)
            Setting.set("data_dir", data_dir)
            return redirect(url_for("setup.wizard", step=3))

        elif action == "step3":
            # SteamCMD install
            steamcmd_dir = Setting.get("steamcmd_dir", "/steamcmd")
            if is_steamcmd_installed(steamcmd_dir):
                flash("SteamCMD is already installed.", "success")
            else:
                ok, msg = install_steamcmd(steamcmd_dir)
                if ok:
                    flash(msg, "success")
                else:
                    flash(f"SteamCMD install failed: {msg} – You can install it manually later.", "warning")
            return redirect(url_for("setup.wizard", step=4))

        elif action == "step4":
            # Steam API key (optional)
            api_key = request.form.get("steam_api_key", "").strip()
            Setting.set("steam_api_key", api_key)
            return redirect(url_for("setup.wizard", step=5))

        elif action == "finish":
            Setting.set("setup_complete", "true")
            flash("Setup complete! Welcome to SGSM.", "success")
            return redirect(url_for("main.index"))

    steamcmd_dir = Setting.get("steamcmd_dir", "/steamcmd")
    steamcmd_installed = is_steamcmd_installed(steamcmd_dir)

    return render_template(
        "setup/wizard.html",
        step=step,
        error=error,
        steamcmd_installed=steamcmd_installed,
        settings=_current_settings(),
    )


def _current_settings() -> dict:
    """Return current setup-relevant settings for template context."""
    return {
        "site_title": Setting.get("site_title", "SGSM – Game Server Manager"),
        "servers_dir": Setting.get("servers_dir", "/servers"),
        "steamcmd_dir": Setting.get("steamcmd_dir", "/steamcmd"),
        "data_dir": Setting.get("data_dir", "/data"),
        "steam_api_key": Setting.get("steam_api_key", ""),
    }
