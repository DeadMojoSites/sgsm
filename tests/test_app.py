"""Basic tests for SGSM application routes."""

import os
import pytest


@pytest.fixture
def app(tmp_path):
    """Create a test application instance."""
    from app import create_app
    application = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SGSM_DATA_DIR": str(tmp_path / "data"),
        "SGSM_SERVERS_DIR": str(tmp_path / "servers"),
        "SGSM_STEAMCMD_DIR": str(tmp_path / "steamcmd"),
    })
    yield application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def setup_complete(app):
    """Mark setup as complete and return a client."""
    with app.app_context():
        from app.models import Setting
        Setting.set("setup_complete", "true")
    return app.test_client()


# ── Setup wizard ──────────────────────────────────────────────

class TestSetupWizard:
    def test_redirect_to_setup_when_not_configured(self, client):
        r = client.get("/")
        assert r.status_code == 302
        assert "/setup/" in r.headers["Location"]

    def test_setup_wizard_step1_get(self, client):
        r = client.get("/setup/")
        assert r.status_code == 200
        assert b"SGSM Setup" in r.data
        assert b"Create Admin Account" in r.data

    def test_setup_wizard_step1_post_valid(self, client):
        r = client.post("/setup/", data={
            "action": "step1",
            "site_title": "Test SGSM",
            "admin_password": "securepass",
        })
        assert r.status_code == 302
        assert "step=2" in r.headers["Location"]

    def test_setup_wizard_step1_post_short_password(self, client):
        r = client.post("/setup/", data={
            "action": "step1",
            "site_title": "Test SGSM",
            "admin_password": "abc",
        })
        assert r.status_code == 200
        assert b"least 6 characters" in r.data

    def test_setup_wizard_step2_paths(self, client, tmp_path):
        r = client.post("/setup/", data={
            "action": "step2",
            "servers_dir": str(tmp_path / "servers"),
            "steamcmd_dir": str(tmp_path / "steamcmd"),
            "data_dir": str(tmp_path / "data"),
        })
        assert r.status_code == 302
        assert "step=3" in r.headers["Location"]

    def test_setup_finish(self, client):
        r = client.post("/setup/", data={"action": "finish"})
        assert r.status_code == 302
        assert r.headers["Location"] in ("/", "http://localhost/")


# ── Health API ────────────────────────────────────────────────

class TestHealthAPI:
    def test_health_endpoint(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.get_json() == {"status": "ok"}

    def test_health_without_setup(self, client):
        """Health endpoint must work even before setup is complete."""
        r = client.get("/api/health")
        assert r.status_code == 200


# ── Dashboard ─────────────────────────────────────────────────

class TestDashboard:
    def test_dashboard_redirects_without_setup(self, client):
        r = client.get("/")
        assert r.status_code == 302

    def test_dashboard_loads_after_setup(self, setup_complete):
        r = setup_complete.get("/")
        assert r.status_code == 200
        assert b"Dashboard" in r.data
        assert b"Managed Servers" in r.data
        assert b"System Resources" in r.data


# ── Server CRUD ───────────────────────────────────────────────

class TestServerCRUD:
    def test_server_list_empty(self, setup_complete):
        r = setup_complete.get("/servers/")
        assert r.status_code == 200
        assert b"No servers configured" in r.data

    def test_create_server_get(self, setup_complete):
        r = setup_complete.get("/servers/new")
        assert r.status_code == 200
        assert b"Add Game Server" in r.data
        assert b"Quick Preset" in r.data
        assert b"Team Fortress 2" in r.data

    def test_create_server_post(self, setup_complete, tmp_path):
        r = setup_complete.post("/servers/new", data={
            "name": "Test TF2",
            "app_id": "232250",
            "game_name": "Team Fortress 2",
            "install_dir": str(tmp_path / "tf2"),
            "executable": "",
            "launch_args": "-game tf",
            "port": "27015",
            "max_players": "24",
        })
        assert r.status_code == 302
        assert "/servers/" in r.headers["Location"]

    def test_server_detail_page(self, setup_complete, app):
        with app.app_context():
            from app.models import db, GameServer
            s = GameServer(
                name="Test Server",
                app_id="232250",
                game_name="TF2",
                install_dir="/tmp/test",
                status="stopped",
            )
            db.session.add(s)
            db.session.commit()
            server_id = s.id

        r = setup_complete.get(f"/servers/{server_id}")
        assert r.status_code == 200
        assert b"Test Server" in r.data
        assert b"232250" in r.data
        assert b"Server Details" in r.data

    def test_server_not_found(self, setup_complete):
        r = setup_complete.get("/servers/9999")
        assert r.status_code == 404

    def test_delete_server(self, setup_complete, app):
        with app.app_context():
            from app.models import db, GameServer
            s = GameServer(
                name="Delete Me",
                app_id="232250",
                game_name="TF2",
                install_dir="/tmp/del",
                status="stopped",
            )
            db.session.add(s)
            db.session.commit()
            server_id = s.id

        r = setup_complete.post(f"/servers/{server_id}/delete")
        assert r.status_code == 302

        with app.app_context():
            from app.models import GameServer
            assert GameServer.query.get(server_id) is None


# ── Settings ──────────────────────────────────────────────────

class TestSettings:
    def test_settings_page_loads(self, setup_complete):
        r = setup_complete.get("/settings/")
        assert r.status_code == 200
        assert b"Settings" in r.data
        assert b"General Settings" in r.data

    def test_save_general_settings(self, setup_complete, app):
        r = setup_complete.post("/settings/", data={
            "section": "general",
            "site_title": "My SGSM",
            "max_servers": "5",
            "log_lines": "100",
        })
        assert r.status_code == 302

        with app.app_context():
            from app.models import Setting
            assert Setting.get("site_title") == "My SGSM"
            assert Setting.get("max_servers") == "5"

    def test_save_steam_api_key(self, setup_complete, app):
        r = setup_complete.post("/settings/", data={
            "section": "steam",
            "steam_api_key": "TESTKEY123",
        })
        assert r.status_code == 302
        with app.app_context():
            from app.models import Setting
            assert Setting.get("steam_api_key") == "TESTKEY123"

    def test_password_mismatch(self, setup_complete):
        r = setup_complete.post("/settings/", data={
            "section": "security",
            "new_password": "newpass1",
            "confirm_password": "newpass2",
        }, follow_redirects=True)
        assert b"do not match" in r.data

    def test_password_too_short(self, setup_complete):
        r = setup_complete.post("/settings/", data={
            "section": "security",
            "new_password": "abc",
            "confirm_password": "abc",
        }, follow_redirects=True)
        assert b"6 characters" in r.data


# ── API endpoints ─────────────────────────────────────────────

class TestAPI:
    def test_api_servers_list(self, setup_complete):
        r = setup_complete.get("/api/servers")
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)

    def test_api_server_status(self, setup_complete, app):
        with app.app_context():
            from app.models import db, GameServer
            s = GameServer(
                name="API Test",
                app_id="232250",
                game_name="TF2",
                install_dir="/tmp/api_test",
                status="stopped",
            )
            db.session.add(s)
            db.session.commit()
            server_id = s.id

        r = setup_complete.get(f"/api/servers/{server_id}/status")
        assert r.status_code == 200
        data = r.get_json()
        assert data["status"] == "stopped"
        assert data["pid"] is None

    def test_api_server_logs(self, setup_complete, app):
        with app.app_context():
            from app.models import db, GameServer, ServerLog
            s = GameServer(
                name="Log Test",
                app_id="232250",
                game_name="TF2",
                install_dir="/tmp/log_test",
                status="stopped",
            )
            db.session.add(s)
            db.session.commit()
            log = ServerLog(server_id=s.id, message="Test log entry", level="info")
            db.session.add(log)
            db.session.commit()
            server_id = s.id

        r = setup_complete.get(f"/api/servers/{server_id}/logs")
        assert r.status_code == 200
        logs = r.get_json()
        assert len(logs) == 1
        assert logs[0]["message"] == "Test log entry"
        assert logs[0]["level"] == "info"


# ── Model tests ───────────────────────────────────────────────

class TestModels:
    def test_setting_get_set(self, app):
        with app.app_context():
            from app.models import Setting
            Setting.set("test_key", "test_value")
            assert Setting.get("test_key") == "test_value"

    def test_setting_default(self, app):
        with app.app_context():
            from app.models import Setting
            assert Setting.get("nonexistent_key", "fallback") == "fallback"

    def test_game_server_to_dict(self, app):
        with app.app_context():
            from app.models import db, GameServer
            s = GameServer(
                name="Dict Test",
                app_id="12345",
                game_name="Test Game",
                install_dir="/tmp/dict_test",
                status="stopped",
                port=27015,
                max_players=32,
            )
            db.session.add(s)
            db.session.commit()
            d = s.to_dict()
            assert d["name"] == "Dict Test"
            assert d["app_id"] == "12345"
            assert d["status"] == "stopped"
            assert d["port"] == 27015
