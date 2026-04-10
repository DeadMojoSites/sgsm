# SGSM – Steam Game Server Manager

A self-hosted, Docker-based platform for managing game servers via SteamCMD.  
Features a **beautiful Steam-styled dark UI** where the admin configures everything — databases, API keys, file locations, and more — entirely through the web interface.

---

## ✨ Features

- 🎮 **Manage any SteamCMD-compatible game server** (TF2, CS2, Valheim, ARK, Rust, Palworld, and more)
- 🐳 **Docker-first** — everything runs in a single container, no extra dependencies
- 🌑 **Steam dark UI** — pixel-perfect Steam-styled interface with status badges, log consoles, and resource meters
- ⚙ **Web-based setup wizard** — configure paths, SteamCMD, API keys, and admin password on first run
- 📋 **Live log console** — real-time polling of per-server installation and runtime logs
- 💻 **System resources dashboard** — CPU, RAM, and disk usage at a glance
- ↻ **Install / Update / Start / Stop / Restart** servers with one click
- 🔑 **Steam Web API key support** for game metadata lookups
- 🔒 **Password-protected admin** — set during setup wizard
- 📦 **SQLite by default**, configurable to PostgreSQL/MySQL via `DATABASE_URL`

---

## 🚀 Quick Start

### Docker Compose (recommended)

```bash
git clone https://github.com/MBrown22073/sgsm.git
cd sgsm
docker compose up -d
```

Then open **http://localhost:5000** in your browser and follow the setup wizard.

### Manual (development)

```bash
pip install -r requirements.txt
python run.py
```

---

## 🗂 Project Structure

```
sgsm/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── run.py                      # Entry point
└── app/
    ├── __init__.py             # App factory
    ├── models.py               # SQLAlchemy models (Setting, GameServer, ServerLog)
    ├── routes/
    │   ├── main.py             # Dashboard
    │   ├── servers.py          # Server CRUD + lifecycle
    │   ├── settings.py         # Application settings
    │   ├── setup.py            # First-run setup wizard
    │   └── api.py              # JSON API (status polling, logs)
    ├── steamcmd/
    │   └── manager.py          # SteamCMD integration (install, start, stop, …)
    ├── templates/
    │   ├── base.html           # Sidebar + topbar layout
    │   ├── dashboard.html
    │   ├── servers/            # list, create, edit, detail
    │   ├── settings/
    │   └── setup/              # Multi-step wizard
    └── static/
        ├── css/steam.css       # Steam-styled dark theme
        └── js/app.js           # Tab switching, status polling, log tailing
```

---

## ⚙ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SGSM_DATA_DIR` | `/data` | SQLite database and application data |
| `SGSM_SERVERS_DIR` | `/servers` | Parent directory for game server installs |
| `SGSM_STEAMCMD_DIR` | `/steamcmd` | SteamCMD installation directory |
| `SECRET_KEY` | (random) | Flask session secret key – set a fixed value for persistent sessions |
| `DATABASE_URL` | (SQLite) | Override the database, e.g. `postgresql://user:pass@host/db` |

---

## 🐳 Docker Volumes

| Volume | Purpose |
|---|---|
| `sgsm_data` | SGSM database and settings |
| `steamcmd` | SteamCMD installation |
| `game_servers` | All managed game server files |

---

## 📝 License

MIT
