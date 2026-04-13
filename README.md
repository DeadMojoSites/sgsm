# Steam Game Server Manager 🎮

A self-hosted, Docker-based platform for managing Steam game servers. Built with **PHP 8.2 + Apache** and a dark web UI, everything is configured through the browser — no SSH or config files required.

---

## Features

- **Steam-styled dark UI** — clean dark theme matching the Steam aesthetic
- **SteamCMD integration** — auto-downloads SteamCMD on first use; installs and updates any Steam dedicated server by App ID
- **One-click server controls** — Start, Stop, Restart, Install, Cancel Install
- **Live console** — real-time log output via polling (no long-lived connections)
- **25+ game templates** — pre-filled configs for CS2, Valheim, Rust, ARK, Arma Reforger, Palworld, and more
- **Post-create setup modal** — when adding a server from a template, prompted to set passwords and key settings before installing
- **In-app config file editor** — edit `config.json` (and any `-config` based server config) directly in the browser
- **Workshop mod manager** — add, view, and download mods per server:
  - **Steam Workshop**: look up mods by ID or URL, download via SteamCMD
  - **Bohemia Workshop**: add mods by ID; automatically written into Arma Reforger's `config.json`
- **Arma Reforger automation** — auto-generates `config.json` and `profile/` directory on first start; mod list kept in sync
- **Persistent bind mounts** — all data, SteamCMD, and server files are stored in named directories visible on the host
- **Full settings UI** — app name, custom logo, SteamCMD path, server root, Steam API key, password change
- **First-run setup wizard** — guided setup on first launch (admin account, app name, paths)
- **SQLite storage** — zero-dependency embedded database; no external DB required

---

## Quick Start (Docker)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Get the compose file

Download or copy `docker-compose.yml` from this repository.

### 2. Start the container

```bash
docker compose up -d
```

The image is pulled from GitHub Container Registry (`ghcr.io/mbrown22073/sgsm:latest`). No build step needed.

### 3. Open the web UI

Navigate to **http://your-host:8080**

On first launch the setup wizard will ask you to:
1. Create an admin account
2. Set the application name
3. Confirm SteamCMD and server paths (defaults are correct for Docker)

---

## docker-compose.yml

```yaml
services:
  game-server-manager:
    image: ghcr.io/mbrown22073/sgsm:latest
    container_name: game-server-manager
    ports:
      - "8080:80"
    volumes:
      - ./gsm_data:/app/data        # SQLite DB, uploads, logs
      - ./gsm_steamcmd:/opt/steamcmd  # SteamCMD binaries & cache
      - ./gsm_servers:/opt/servers  # Installed game servers
    environment:
      - DATA_DIR=/app/data
    restart: unless-stopped
```

All three directories are bind-mounted so files are visible directly on the host (e.g. via Synology File Station).

---

## Adding a Game Server

1. Click **Add Server** → choose a **Quick Start Template** or fill in manually
2. The **Setup modal** opens automatically — set passwords and key settings (e.g. server name, world name, RCON password) or edit the full config file
3. Click **Install** (⬇) to download via SteamCMD — watch progress in the console
4. Once installed, click **Start** (▶)

### Server row buttons

| Button | Action |
|--------|--------|
| ▶ / ■ / ↺ | Start / Stop / Restart |
| ⬇ | Install or update files via SteamCMD |
| ⌨ | Open live console (install or server log) |
| 🧩 | Workshop Mod Manager |
| 📄 | Edit config file in-browser (servers using `-config`) |
| ✎ | Edit server settings |
| 🗑 | Delete server and remove files from disk |

---

## Workshop Mod Manager

Open via the 🧩 button on any server row.

### Steam Workshop games
1. Paste a Workshop URL or item ID into the search box
2. Click **Look Up** — displays mod name, description, and thumbnail (via Steam API, no key required)
3. Click **Add to Server** to register the mod
4. Click ⬇ on the mod row to download it via SteamCMD; a live console streams the output

### Arma Reforger (Bohemia Workshop)
- The modal auto-switches to **Bohemia Workshop** mode for App ID `1874900`
- Enter the Bohemia mod ID (hex string, e.g. `59A2F27A88A0DD57`) and a display name
- Adding or removing a mod instantly rewrites `config.json` under `game.mods[]`
- The server downloads mods automatically on next start — no SteamCMD step needed

---

## Config File Editor

For servers that use a `-config <path>` launch argument (e.g. Arma Reforger), a **📄** button appears in the server row. Clicking it opens a full in-browser text editor pre-loaded with the file content. Changes are saved directly to disk.

The config file is also pre-created automatically when the server is first added, so it can be edited before ever running the server.

---

## Arma Reforger Notes

- **Config auto-generation**: `config.json` and `profile/` are created at server creation time with sensible defaults
- **Admin password**: default is `changeme` — change it in the config editor before starting
- **Mods**: managed through the Workshop Mod Manager; written to `config.json` automatically
- **Steam login**: App ID `1874900` requires an anonymous login (supported) for the server binary; mods are fetched by the server itself from Bohemia servers

---

## Supported Game Templates

| Game | App ID |
|------|--------|
| Counter-Strike 2 | 730 |
| Counter-Strike: GO | 740 |
| Valheim | 896660 |
| Rust | 258550 |
| ARK: Survival Evolved | 376030 |
| ARK: Survival Ascended | 2430930 |
| Garry's Mod | 4020 |
| Team Fortress 2 | 232250 |
| Left 4 Dead 2 | 222860 |
| 7 Days to Die | 294420 |
| Project Zomboid | 380870 |
| Terraria (TShock) | 105600 |
| DayZ | 223350 |
| Satisfactory | 1690800 |
| Palworld | 2394010 |
| Enshrouded | 2278520 |
| Arma Reforger | 1874900 |
| Minecraft (Bedrock) | 1944420 |
| Space Engineers | 298740 |
| Squad | 403240 |
| Conan Exiles | 443030 |
| The Forest | 556450 |
| Sons of the Forest | 1326470 |
| Killing Floor 2 | 232130 |
| V Rising | 1829350 |

Any other Steam dedicated server can be added manually by App ID.

---

## Directory Structure

```
sgsm/
├── Dockerfile                  ← PHP 8.2 + Apache image
├── docker-compose.yml          ← Service + bind mount definitions
├── docker-entrypoint.sh        ← Fixes volume ownership at startup
├── apache.conf                 ← VirtualHost with mod_rewrite
├── includes/
│   ├── db.php                  ← SQLite PDO wrapper + migrations
│   └── helpers.php             ← Auth, process management, install/start logic
├── api/
│   ├── auth.php                ← Login, logout, change password
│   ├── servers.php             ← Server CRUD, actions, templates
│   ├── mods.php                ← Workshop mod management + Steam API lookup
│   ├── console.php             ← Log polling endpoint (JSON)
│   ├── file.php                ← Secure file read/write (servers dir only)
│   └── settings.php            ← Settings CRUD, logo upload
├── pages/
│   ├── servers.php             ← Servers page + all modals
│   ├── settings.php            ← Settings page
│   └── setup.php               ← First-run wizard
└── assets/
    ├── app.js                  ← All frontend JavaScript
    └── style.css               ← Dark theme CSS
```

---

## Ports

| Port | Purpose |
|------|---------|
| 8080 | Game Server Manager web UI (maps to container port 80) |

Game server ports need to be added to `docker-compose.yml` as needed. Example:

```yaml
ports:
  - "8080:80"
  - "27015:27015/udp"   # CS2 / Source games
  - "2456-2458:2456-2458/udp"  # Valheim
  - "2001:2001/udp"    # Arma Reforger
```

---

## Updating

When a new image is published to GHCR:

```bash
docker pull ghcr.io/mbrown22073/sgsm:latest
docker stop game-server-manager
docker rm game-server-manager
docker compose up -d
```

Your data, SteamCMD binaries, and game server files are preserved in the bind-mounted directories.

---

## Security

- Run behind a **reverse proxy with HTTPS** (nginx, Caddy) in production
- Do not expose port 8080 directly to the internet
- Passwords are hashed with **bcrypt**
- The `api/file.php` endpoint is restricted to the configured servers directory — path traversal attempts are blocked
- All API endpoints require an authenticated session

---

## License

MIT — free to use, modify, and distribute.


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
