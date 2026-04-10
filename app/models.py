"""Database models for SGSM."""

import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

_utcnow = lambda: datetime.datetime.now(datetime.timezone.utc)  # noqa: E731


class Setting(db.Model):
    """Key-value store for application settings."""

    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(120), unique=True, nullable=False, index=True)
    value = db.Column(db.Text, default="")
    updated_at = db.Column(
        db.DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    @classmethod
    def get(cls, key, default=""):
        row = cls.query.filter_by(key=key).first()
        return row.value if row else default

    @classmethod
    def set(cls, key, value):
        row = cls.query.filter_by(key=key).first()
        if row:
            row.value = value
        else:
            row = cls(key=key, value=value)
            db.session.add(row)
        db.session.commit()

    def __repr__(self):
        return f"<Setting {self.key}={self.value!r}>"


class GameServer(db.Model):
    """Represents a managed game server instance."""

    __tablename__ = "game_servers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    app_id = db.Column(db.String(20), nullable=False)
    game_name = db.Column(db.String(120), default="")
    install_dir = db.Column(db.String(500), nullable=False)
    launch_args = db.Column(db.Text, default="")
    executable = db.Column(db.String(500), default="")
    status = db.Column(db.String(20), default="stopped")  # stopped, running, installing, updating, error
    pid = db.Column(db.Integer, nullable=True)
    port = db.Column(db.Integer, nullable=True)
    max_players = db.Column(db.Integer, default=16)
    password = db.Column(db.String(120), default="")
    auto_restart = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    logs = db.relationship("ServerLog", back_populates="server", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<GameServer {self.name} ({self.app_id})>"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "app_id": self.app_id,
            "game_name": self.game_name,
            "install_dir": self.install_dir,
            "status": self.status,
            "pid": self.pid,
            "port": self.port,
            "max_players": self.max_players,
            "auto_restart": self.auto_restart,
        }


class ServerLog(db.Model):
    """Log entry for a game server."""

    __tablename__ = "server_logs"

    id = db.Column(db.Integer, primary_key=True)
    server_id = db.Column(db.Integer, db.ForeignKey("game_servers.id"), nullable=False)
    level = db.Column(db.String(20), default="info")  # info, warning, error, success
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow)

    server = db.relationship("GameServer", back_populates="logs")

    def __repr__(self):
        return f"<ServerLog [{self.level}] {self.message[:60]}>"

    def to_dict(self):
        return {
            "id": self.id,
            "server_id": self.server_id,
            "level": self.level,
            "message": self.message,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }
