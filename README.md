# Game Server Manager 🎮

A self-hosted, Docker-based platform for managing game servers via SteamCMD. Features a beautiful Steam-styled dark UI where the admin configures everything — databases, API keys, file locations, and more — entirely through the web interface.

---

## Features

- **Steam-styled dark UI** — matches the look and feel of the Steam client
- **Custom branding** — upload your own logo in Settings → General
- **SteamCMD integration** — install, update, and manage any Steam game server by App ID
- **One-click server controls** — Start, Stop, Restart, Install, Update
- **Real-time console** — live output streamed via WebSockets with command input
- **15+ game templates** — CS2, Valheim, Rust, ARK, Garry's Mod, and more
- **External database** — connect MySQL or PostgreSQL from the Settings UI, test the connection live
- **Full settings UI** — configure every setting in the browser (no config files to edit)
  - General: app name, custom logo
  - Steam / SteamCMD: paths and configuration
  - Database: host, port, credentials, live test
  - File Locations: server and SteamCMD directories
  - API Keys: Steam Web API key + two custom key slots
  - Security: password change
- **First-run setup wizard** — guided three-step setup on first launch
- **Persistent storage** — Docker volumes for data, SteamCMD cache, and game servers

---

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed

### 1. Clone or download this project

```bash
git clone https://github.com/your-org/game-server-manager.git
cd game-server-manager
```

### 2. Build and run

```bash
docker compose up -d --build
```

The first build takes a few minutes (Node.js, SteamCMD download ~35 MB).

### 3. Open the web UI

Navigate to **http://localhost:8080** in your browser.

On first launch you will be taken through the setup wizard to:
1. Create your admin account
2. Set the application name
3. Confirm SteamCMD and server paths (defaults are correct for Docker)

---

## Directory Structure

```
game-server-manager/
├── Dockerfile              ← Multi-stage build (React + Ubuntu 22.04 + Node 20 + SteamCMD)
├── docker-compose.yml      ← Service + volumes definition
├── .dockerignore
├── backend/                ← Express + Socket.io API
│   ├── server.js
│   ├── middleware/
│   ├── routes/             ← auth, settings, servers
│   └── services/           ← database (SQLite), steamcmd, serverManager
└── frontend/               ← React + Vite Steam-styled UI
    ├── src/
    │   ├── components/     ← Login, Setup, Layout, Dashboard, ServerList, Settings…
    │   ├── services/       ← axios API client, Socket.io client
    │   └── styles/         ← steam.css theme
    └── index.html
```

---

## Docker Volumes

| Volume         | Mount Point        | Contents                              |
|----------------|--------------------|---------------------------------------|
| `gsm_data`     | `/app/data`        | SQLite database, uploaded logo        |
| `gsm_steamcmd` | `/opt/steamcmd`    | SteamCMD binaries and download cache  |
| `gsm_servers`  | `/opt/servers`     | Installed game server files           |

> **Backup tip:** `docker compose exec game-server-manager tar -czf - /app/data` to export your config.

---

## Adding a Game Server

1. Click **Add Server** on the Servers page (or Dashboard)
2. Choose a **Quick Start Template** (e.g. Valheim) or fill in manually:
   - **Steam App ID** — the dedicated server App ID from the Steam store
   - **Install Directory** — where SteamCMD will install files (pre-filled from the root path setting)
   - **Launch Executable** — the binary to run (relative to install dir)
   - **Launch Arguments** — startup flags for your server
3. Click **Save**, then **Install** to download via SteamCMD
4. Watch the download in the **Console** modal (live output)
5. Once installed, click **Start**

---

## Settings Reference

### General
| Setting      | Description                                       |
|--------------|---------------------------------------------------|
| App Name     | Title shown in the browser tab and header         |
| Custom Logo  | Upload PNG/JPG/SVG up to 5 MB                     |

### Steam / SteamCMD
| Setting           | Default (Docker)                     |
|-------------------|--------------------------------------|
| SteamCMD Path     | `/opt/steamcmd/steamcmd.sh`          |
| Servers Root Dir  | `/opt/servers`                       |

### Database
Connect an external **MySQL** or **PostgreSQL** for your game server's application data (e.g. player databases). The GSM's own config is always stored in embedded SQLite.

| Setting   | Description          |
|-----------|----------------------|
| DB Type   | mysql / postgresql   |
| Host      | Hostname or IP       |
| Port      | 3306 / 5432          |
| DB Name   | Database name        |
| User      | Username             |
| Password  | Password (stored in SQLite) |

### API Keys
| Key              | Where to get it                                          |
|------------------|----------------------------------------------------------|
| Steam Web API    | https://steamcommunity.com/dev/apikey                    |
| Custom Key 1 & 2 | For Discord bots, monitoring tools, or game server APIs  |

---

## Ports

| Port  | Purpose                    |
|-------|----------------------------|
| 8080  | Game Server Manager web UI |

Game server ports (e.g. 27015 for CS2) need to be added to `docker-compose.yml` or use `--network host` mode depending on your hosting setup. Example:

```yaml
ports:
  - "8080:8080"
  - "27015:27015/udp"   # CS2
  - "2456:2456/udp"     # Valheim
```

---

## Security

- Always run behind a **reverse proxy with HTTPS** (nginx, Caddy) in production
- Do **not** expose port 8080 directly to the internet
- The JWT session expires after **24 hours**
- Passwords are hashed with **bcrypt** (12 rounds)
- API inputs are validated server-side

### Example Caddy reverse proxy

```
gsm.yourdomain.com {
    reverse_proxy localhost:8080
}
```

---

## Development (local, without Docker)

```bash
# Terminal 1 – backend
cd backend
npm install
node server.js

# Terminal 2 – frontend dev server (auto-proxies /api to :8080)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

SteamCMD must be installed locally for server install/update features.

---

## Supported Game Servers (built-in templates)

| Game                    | App ID  |
|-------------------------|---------|
| Counter-Strike 2        | 730     |
| Counter-Strike: GO DS   | 740     |
| Valheim                 | 896660  |
| Rust                    | 258550  |
| ARK: Survival Evolved   | 376030  |
| Garry's Mod             | 4020    |
| Team Fortress 2         | 232250  |
| Left 4 Dead 2           | 222860  |
| 7 Days to Die           | 294420  |
| Project Zomboid         | 380870  |
| Terraria (TShock)       | 105600  |
| DayZ                    | 223350  |
| Satisfactory            | 1690800 |
| Palworld                | 2394010 |
| Enshrouded              | 2278520 |

Any other Steam dedicated server can be added manually via its App ID.

---

## License

MIT — free to use, modify, and distribute.
