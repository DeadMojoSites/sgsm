"""SteamCMD manager – handles installation and server lifecycle."""

import os
import subprocess
import threading
import shutil
import signal
import platform
import time
import logging
from pathlib import Path

from flask import current_app

from ..models import db, GameServer, ServerLog

logger = logging.getLogger(__name__)

# Map of popular game server App IDs for convenience
POPULAR_GAMES = [
    {"app_id": "232250", "name": "Team Fortress 2 Dedicated Server"},
    {"app_id": "232370", "name": "Half-Life 1 Dedicated Server (HLDS)"},
    {"app_id": "740", "name": "Counter-Strike: Global Offensive Dedicated Server"},
    {"app_id": "1829350", "name": "Counter-Strike 2 Dedicated Server"},
    {"app_id": "376030", "name": "ARK: Survival Evolved Dedicated Server"},
    {"app_id": "1690800", "name": "ARK: Survival Ascended Dedicated Server"},
    {"app_id": "244310", "name": "Valheim Dedicated Server"},
    {"app_id": "896660", "name": "Valheim (Beta) Dedicated Server"},
    {"app_id": "1006030", "name": "Rust Dedicated Server"},
    {"app_id": "258550", "name": "Rust (Beta) Dedicated Server"},
    {"app_id": "294420", "name": "7 Days to Die Dedicated Server"},
    {"app_id": "223350", "name": "Source SDK Base 2013 Dedicated Server"},
    {"app_id": "443030", "name": "Squad Dedicated Server"},
    {"app_id": "581320", "name": "Conan Exiles Dedicated Server"},
    {"app_id": "403240", "name": "Dark and Light Dedicated Server"},
    {"app_id": "476400", "name": "Miscreated Dedicated Server"},
    {"app_id": "251570", "name": "7 Days to Die (Beta)"},
    {"app_id": "343050", "name": "Unturned Dedicated Server"},
    {"app_id": "1080195", "name": "DayZ Server"},
    {"app_id": "1316500", "name": "V Rising Dedicated Server"},
    {"app_id": "2394010", "name": "Palworld Dedicated Server"},
    {"app_id": "2278520", "name": "Sons of the Forest Dedicated Server"},
]


def _log(server_id, message, level="info"):
    """Add a log entry for a server (must be called in app context)."""
    entry = ServerLog(server_id=server_id, message=message, level=level)
    db.session.add(entry)
    db.session.commit()


def steamcmd_path(steamcmd_dir: str) -> str:
    """Return the path to the steamcmd executable."""
    if platform.system() == "Windows":
        return os.path.join(steamcmd_dir, "steamcmd.exe")
    return os.path.join(steamcmd_dir, "steamcmd.sh")


def is_steamcmd_installed(steamcmd_dir: str) -> bool:
    """Return True if SteamCMD is available."""
    return os.path.isfile(steamcmd_path(steamcmd_dir))


def install_steamcmd(steamcmd_dir: str) -> tuple[bool, str]:
    """Download and install SteamCMD into *steamcmd_dir*."""
    os.makedirs(steamcmd_dir, exist_ok=True)

    if platform.system() == "Windows":
        url = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip"
        dest = os.path.join(steamcmd_dir, "steamcmd.zip")
        try:
            import urllib.request
            urllib.request.urlretrieve(url, dest)
            import zipfile
            with zipfile.ZipFile(dest, "r") as z:
                z.extractall(steamcmd_dir)
            os.remove(dest)
            return True, "SteamCMD installed successfully."
        except Exception as exc:
            return False, f"Installation failed: {exc}"
    else:
        # Linux
        tarball = os.path.join(steamcmd_dir, "steamcmd_linux.tar.gz")
        url = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz"
        try:
            import urllib.request
            urllib.request.urlretrieve(url, tarball)
            subprocess.run(["tar", "-xzf", tarball, "-C", steamcmd_dir], check=True)
            os.remove(tarball)
            sh = os.path.join(steamcmd_dir, "steamcmd.sh")
            os.chmod(sh, 0o755)
            return True, "SteamCMD installed successfully."
        except Exception as exc:
            return False, f"Installation failed: {exc}"


def _run_steamcmd(steamcmd_dir: str, args: list[str]) -> tuple[int, str]:
    """Run steamcmd with the given arguments; returns (returncode, output)."""
    cmd = [steamcmd_path(steamcmd_dir)] + args + ["+quit"]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,
        )
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return -1, "SteamCMD timed out after 1 hour."
    except FileNotFoundError:
        return -1, f"SteamCMD not found at: {steamcmd_path(steamcmd_dir)}"
    except Exception as exc:
        return -1, str(exc)


def install_server(app, server_id: int):
    """Install a game server in a background thread."""

    def _worker():
        with app.app_context():
            server = GameServer.query.get(server_id)
            if not server:
                return
            server.status = "installing"
            db.session.commit()
            _log(server_id, f"Starting installation for App ID {server.app_id}…")

            from ..models import Setting
            steamcmd_dir = Setting.get("steamcmd_dir", current_app.config["SGSM_STEAMCMD_DIR"])

            if not is_steamcmd_installed(steamcmd_dir):
                ok, msg = install_steamcmd(steamcmd_dir)
                _log(server_id, f"SteamCMD install: {msg}", "info" if ok else "error")
                if not ok:
                    server.status = "error"
                    db.session.commit()
                    return

            os.makedirs(server.install_dir, exist_ok=True)
            args = [
                "+force_install_dir", server.install_dir,
                "+login", "anonymous",
                f"+app_update {server.app_id} validate",
            ]
            _log(server_id, "Running SteamCMD app_update…")
            rc, output = _run_steamcmd(steamcmd_dir, args)
            if rc == 0:
                server.status = "stopped"
                _log(server_id, "Installation complete.", "success")
            else:
                server.status = "error"
                _log(server_id, f"Installation failed (exit {rc}):\n{output[-2000:]}", "error")
            db.session.commit()

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def update_server(app, server_id: int):
    """Update (validate + update) a game server in a background thread."""

    def _worker():
        with app.app_context():
            server = GameServer.query.get(server_id)
            if not server:
                return
            server.status = "updating"
            db.session.commit()
            _log(server_id, f"Starting update for App ID {server.app_id}…")

            from ..models import Setting
            steamcmd_dir = Setting.get("steamcmd_dir", current_app.config["SGSM_STEAMCMD_DIR"])
            args = [
                "+force_install_dir", server.install_dir,
                "+login", "anonymous",
                f"+app_update {server.app_id} validate",
            ]
            rc, output = _run_steamcmd(steamcmd_dir, args)
            if rc == 0:
                server.status = "stopped"
                _log(server_id, "Update complete.", "success")
            else:
                server.status = "error"
                _log(server_id, f"Update failed (exit {rc}):\n{output[-2000:]}", "error")
            db.session.commit()

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def start_server(app, server_id: int):
    """Start a game server process."""

    def _worker():
        with app.app_context():
            server = GameServer.query.get(server_id)
            if not server:
                return
            if not server.executable:
                _log(server_id, "No executable configured – cannot start.", "error")
                return

            exe = os.path.join(server.install_dir, server.executable)
            if not os.path.isfile(exe):
                _log(server_id, f"Executable not found: {exe}", "error")
                server.status = "error"
                db.session.commit()
                return

            args = server.launch_args.split() if server.launch_args else []
            cmd = [exe] + args
            try:
                proc = subprocess.Popen(
                    cmd,
                    cwd=server.install_dir,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
                server.pid = proc.pid
                server.status = "running"
                db.session.commit()
                _log(server_id, f"Server started (PID {proc.pid}).", "success")
            except Exception as exc:
                server.status = "error"
                db.session.commit()
                _log(server_id, f"Failed to start server: {exc}", "error")

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def stop_server(app, server_id: int):
    """Stop a running game server process."""

    def _worker():
        with app.app_context():
            server = GameServer.query.get(server_id)
            if not server or not server.pid:
                return
            try:
                os.kill(server.pid, signal.SIGTERM)
                _log(server_id, f"SIGTERM sent to PID {server.pid}.", "info")
            except ProcessLookupError:
                _log(server_id, "Process not found – already stopped.", "warning")
            except Exception as exc:
                _log(server_id, f"Error stopping server: {exc}", "error")
            server.status = "stopped"
            server.pid = None
            db.session.commit()

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def restart_server(app, server_id: int):
    """Restart a game server: stop then start."""

    def _worker():
        with app.app_context():
            server = GameServer.query.get(server_id)
            if not server:
                return
            if server.pid:
                try:
                    os.kill(server.pid, signal.SIGTERM)
                except Exception:
                    pass
                server.pid = None
                server.status = "stopped"
                db.session.commit()
                _log(server_id, "Server stopped for restart.", "info")
            time.sleep(2)

        stop_server(app, server_id)
        time.sleep(3)
        start_server(app, server_id)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def check_process_alive(pid: int) -> bool:
    """Return True if a process with *pid* is alive."""
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False
