"""Flask application factory for SGSM."""

import os
from flask import Flask
from .models import db
from .routes.main import main_bp
from .routes.servers import servers_bp
from .routes.settings import settings_bp
from .routes.setup import setup_bp
from .routes.api import api_bp


def create_app(config=None):
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Default configuration
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY", os.urandom(32).hex()),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SGSM_DATA_DIR=os.environ.get("SGSM_DATA_DIR", "/data"),
        SGSM_SERVERS_DIR=os.environ.get("SGSM_SERVERS_DIR", "/servers"),
        SGSM_STEAMCMD_DIR=os.environ.get("SGSM_STEAMCMD_DIR", "/steamcmd"),
    )

    # Apply caller-supplied overrides before reading derived values
    if config:
        app.config.update(config)

    # Determine database URI (after overrides so test paths are respected)
    data_dir = app.config["SGSM_DATA_DIR"]
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "sgsm.db")
    app.config.setdefault(
        "SQLALCHEMY_DATABASE_URI",
        os.environ.get("DATABASE_URL", f"sqlite:///{db_path}"),
    )

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(servers_bp, url_prefix="/servers")
    app.register_blueprint(settings_bp, url_prefix="/settings")
    app.register_blueprint(setup_bp, url_prefix="/setup")
    app.register_blueprint(api_bp, url_prefix="/api")

    with app.app_context():
        db.create_all()
        _seed_defaults(app)

    return app


def _seed_defaults(app):
    """Seed default settings if not present."""
    from .models import Setting

    defaults = {
        "setup_complete": "false",
        "steamcmd_dir": app.config["SGSM_STEAMCMD_DIR"],
        "servers_dir": app.config["SGSM_SERVERS_DIR"],
        "steam_api_key": "",
        "admin_password": "",
        "site_title": "SGSM – Game Server Manager",
        "max_servers": "10",
        "auto_restart": "false",
        "log_lines": "200",
    }
    for key, value in defaults.items():
        if not Setting.query.filter_by(key=key).first():
            db.session.add(Setting(key=key, value=value))
    db.session.commit()
