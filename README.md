# Steam Game Server Manager 🎮

A self-hosted, Docker-based platform for managing Steam game servers. Built with **PHP 8.2 + Apache** and a dark web UI, everything is configured through the browser — no SSH or config files required.

---

## How It Works

SGSM is a **panel container** that manages **game server containers**. The panel itself runs as a lightweight PHP/Apache image. When you install or start a game server, SGSM communicates with the Docker daemon (via the mounted socket) to spin up a separate, isolated container for that server. Each game server gets its own container — they are independent from the panel and from each other.

```
┌─────────────────────────────┐
│  SGSM Panel Container       │  ← PHP 8.2 + Apache (port 8880)
│  ghcr.io/deadmojosites/sgsm │    Manages containers via Docker socket
└────────────┬────────────────┘
             │ /var/run/docker.sock
             ▼
┌──────────────────────────────────────────────────────────────┐
│  Docker Daemon (host)                                        │
│                                                              │
│  gsm-install-1  ← steamcmd/steamcmd:latest  (install job)   │
│  gsm-server-1   ← steamcmd/steamcmd:latest  (Linux server)  │
│  gsm-server-2   ← sgsm-wine:latest          (Windows .exe)  │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
             │
             │ bind mount: ./gsm_servers/server-1 → /server
             ▼
  Host filesystem  (./gsm_servers/)
```

- **Installs** run inside a temporary `gsm-install-<id>` container using the official `steamcmd/steamcmd:latest` image. The container exits when the install finishes and is cleaned up automatically.
- **Linux game servers** run inside a persistent `gsm-server-<id>` container, also using `steamcmd/steamcmd:latest` (which includes the required Linux Steam Runtime libraries).
- **Windows game servers** (`.exe` executables) run inside a `gsm-server-<id>` container using a Wine-based image (`ghcr.io/deadmojosites/sgsm-wine:latest`).
- **Game files** are bind-mounted from the host (`./gsm_servers/<server-name>/`) into each container at `/server`, so files are always accessible on the host regardless of container state.

---

## Features

- **Steam-styled dark UI** — clean dark theme matching the Steam aesthetic
- **Container-per-server isolation** — each game server runs in its own Docker container; stopping or crashing one does not affect others
- **SteamCMD install containers** — installs and updates run in a dedicated temporary container using the official SteamCMD image; no SteamCMD installed in the panel itself
- **Wine support for Windows servers** — Windows dedicated servers (`.exe`) are automatically detected and launched via a Wine container
- **One-click server controls** — Start, Stop, Restart, Install, Cancel Install
- **Live console** — real-time log output via polling (no long-lived connections)
- **Per-server resource limits** — optionally cap CPU and RAM per game container
- **25+ game templates** — pre-filled configs for CS2, Valheim, Rust, ARK, Arma Reforger, Palworld, and more
- **Post-create setup modal** — when adding a server from a template, prompted to set passwords and key settings before installing
- **In-app config file editor** — edit `config.json` (and any `-config` based server config) directly in the browser
- **Workshop mod manager** — add, view, and download mods per server:
  - **Steam Workshop**: look up mods by ID or URL, download via SteamCMD
  - **Bohemia Workshop**: add mods by ID; automatically written into Arma Reforger's `config.json`
- **Arma Reforger automation** — auto-generates `config.json` and `profile/` directory on first start; mod list kept in sync
- **Full settings UI** — app name, custom logo, server root, Steam API key, password change
- **First-run setup wizard** — guided setup on first launch (admin account, app name, paths)
- **SQLite storage** — zero-dependency embedded database; no external DB required

---

## Quick Start (Docker)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Get the compose file

Download or copy `docker-compose.yml` from this repository.

### 2. Start the panel

```bash
docker compose up -d
```

The image is pulled from GitHub Container Registry (`ghcr.io/deadmojosites/sgsm:latest`). No build step needed.

### 3. Open the web UI

Navigate to **http://your-host:8880**

On first launch the setup wizard will ask you to:
1. Create an admin account
2. Set the application name
3. Confirm the server root path (default is correct for Docker)

---

## docker-compose.yml

```yaml
services:
  game-server-manager:
    image: ghcr.io/deadmojosites/sgsm:latest
    container_name: game-server-manager
    ports:
      - "8880:8080"                                        # Web UI
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock          # Docker socket — required to manage game containers
      - ./gsm_data:/app/data                               # SQLite DB, logs, uploads
      - ./gsm_servers:/opt/servers                         # Game server files (shared with game containers)
    environment:
      - DATA_DIR=/app/data
      - DOCKER_SOCKET=/var/run/docker.sock
      - GSM_SERVERS_HOST_PATH=${PWD}/gsm_servers           # Absolute host path passed to game containers
    restart: unless-stopped
```

> **Why `GSM_SERVERS_HOST_PATH`?** The Docker daemon runs on the **host**, not inside the panel container. When SGSM creates a game container it must tell Docker the *host* path to bind-mount. This variable provides that mapping. Set it to the absolute path of your `gsm_servers` directory on the host.

---

## Adding a Game Server

1. Click **Add Server** → choose a **Quick Start Template** or fill in manually
2. The **Setup modal** opens automatically — set passwords and key settings (e.g. server name, world name, RCON password) or edit the full config file
3. Click **Install** (⬇) — SGSM pulls `steamcmd/steamcmd:latest` and runs a one-shot install container; watch progress in the live console
4. Once the install container exits successfully, click **Start** (▶) — SGSM creates a new game container and starts the server process inside it

### What happens under the hood

| Action | Container created | Image used | Lifecycle |
|--------|------------------|------------|-----------|
| Install | `gsm-install-<id>` | `steamcmd/steamcmd:latest` | Exits on completion; auto-removed |
| Start (Linux) | `gsm-server-<id>` | `steamcmd/steamcmd:latest` | Lives until Stop |
| Start (Windows .exe) | `gsm-server-<id>` | `ghcr.io/deadmojosites/sgsm-wine:latest` | Lives until Stop |

Game files in `./gsm_servers/<dir>/` are bind-mounted into each container at `/server`. The host directory persists independently of any container.

### Server row buttons

| Button | Action |
|--------|--------|
| ▶ / ■ / ↺ | Start / Stop / Restart |
| ⬇ | Install or update files via SteamCMD container |
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
4. Click ⬇ on the mod row to download it via a SteamCMD container; a live console streams the output

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

## Resource Limits

Each game server container can have optional CPU and RAM caps set from the server edit modal:

| Setting | Description |
|---------|-------------|
| CPU Limit | Maximum CPU cores (e.g. `2.0` = 2 cores). Leave blank for no limit. |
| RAM Limit (MB) | Maximum memory in megabytes (e.g. `4096` = 4 GB). Leave blank for no limit. |

These map directly to Docker's `NanoCpus` and `Memory` constraints on the game container.

---

## Ports

| Port | Purpose |
|------|---------|
| 8880 | Game Server Manager web UI (maps to container port 8080) |

Because game server containers use **host networking**, their ports are exposed directly on the host without any additional `docker-compose.yml` changes. The server's configured port is informational only — the game process inside the container binds directly to the host network interface.

---

## Directory Structure

```
sgsm/
├── Dockerfile                  ← PHP 8.2 + Apache image (no SteamCMD — runs in game containers)
├── docker-compose.yml          ← Panel service + bind mount definitions
├── docker-entrypoint.sh        ← Fixes volume ownership at startup
├── apache.conf                 ← VirtualHost with mod_rewrite
├── includes/
│   ├── db.php                  ← SQLite PDO wrapper + migrations
│   ├── docker.php              ← Docker API client (communicates via Unix socket)
│   └── helpers.php             ← Container launch logic, Arma config helpers
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

### Host directories created by Docker Compose

| Directory | Purpose |
|-----------|---------|
| `./gsm_data/` | SQLite database, uploaded logo, install/server logs |
| `./gsm_servers/` | Game server files — one subdirectory per server, bind-mounted into game containers |

---

## Updating

When a new image is published to GHCR:

```bash
docker compose pull
docker compose up -d
```

Your database and all game server files are preserved in the bind-mounted `./gsm_data/` and `./gsm_servers/` directories.

---

## Security

- Run behind a **reverse proxy with HTTPS** (nginx, Caddy) in production
- Do not expose port 8880 directly to the internet
- Passwords are hashed with **bcrypt**
- The `api/file.php` endpoint is restricted to the configured servers directory — path traversal attempts are blocked
- All API endpoints require an authenticated session
- The Docker socket gives the panel full Docker access — keep the host secured and limit network exposure

---

## License

MIT — free to use, modify, and distribute.
