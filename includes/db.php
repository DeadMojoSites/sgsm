<?php
declare(strict_types=1);

define('DATA_DIR', rtrim((string)(getenv('DATA_DIR') ?: __DIR__ . '/../data'), '/\\'));

class GSM_DB {
    private PDO $pdo;

    public function __construct() {
        if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
        $this->pdo = new PDO('sqlite:' . DATA_DIR . '/gsm.db', null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
        $this->migrate();
        $this->migrateAdminToUsers();
        $this->seedMojos();
    }

    private function migrate(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    NOT NULL UNIQUE,
                email         TEXT    NOT NULL DEFAULT '',
                password_hash TEXT    NOT NULL,
                role          TEXT    NOT NULL DEFAULT 'subuser',
                is_active     INTEGER NOT NULL DEFAULT 1,
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login    DATETIME
            );
            CREATE TABLE IF NOT EXISTS servers (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                name              TEXT    NOT NULL,
                app_id            TEXT    NOT NULL,
                install_dir       TEXT    NOT NULL,
                launch_executable TEXT    NOT NULL DEFAULT '',
                launch_args       TEXT    NOT NULL DEFAULT '',
                status            TEXT    NOT NULL DEFAULT 'stopped',
                port              INTEGER,
                max_players       INTEGER NOT NULL DEFAULT 0,
                notes             TEXT    NOT NULL DEFAULT '',
                pid               INTEGER,
                container_id      TEXT    NOT NULL DEFAULT '',
                cpu_limit         REAL    NOT NULL DEFAULT 0,
                ram_limit_mb      INTEGER NOT NULL DEFAULT 0,
                mojo_id           INTEGER,
                requires_login    INTEGER NOT NULL DEFAULT 0,
                docker_image      TEXT    NOT NULL DEFAULT '',
                created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS server_permissions (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id          INTEGER NOT NULL,
                server_id        INTEGER NOT NULL,
                can_start        INTEGER NOT NULL DEFAULT 0,
                can_stop         INTEGER NOT NULL DEFAULT 0,
                can_console      INTEGER NOT NULL DEFAULT 0,
                can_files        INTEGER NOT NULL DEFAULT 0,
                can_backups      INTEGER NOT NULL DEFAULT 0,
                can_edit_startup INTEGER NOT NULL DEFAULT 0,
                UNIQUE(user_id, server_id)
            );
            CREATE TABLE IF NOT EXISTS mojos (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                name             TEXT    NOT NULL,
                slug             TEXT    NOT NULL UNIQUE,
                description      TEXT    NOT NULL DEFAULT '',
                docker_image     TEXT    NOT NULL DEFAULT 'cm2network/steamcmd:latest',
                app_id           TEXT    NOT NULL DEFAULT '',
                install_command  TEXT    NOT NULL DEFAULT '',
                startup_template TEXT    NOT NULL DEFAULT '',
                default_port     INTEGER NOT NULL DEFAULT 0,
                max_players      INTEGER NOT NULL DEFAULT 10,
                requires_login   INTEGER NOT NULL DEFAULT 0,
                is_builtin       INTEGER NOT NULL DEFAULT 0,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS mojo_variables (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                mojo_id       INTEGER NOT NULL,
                env_key       TEXT    NOT NULL,
                label         TEXT    NOT NULL,
                description   TEXT    NOT NULL DEFAULT '',
                default_value TEXT    NOT NULL DEFAULT '',
                is_required   INTEGER NOT NULL DEFAULT 0,
                is_sensitive  INTEGER NOT NULL DEFAULT 0,
                sort_order    INTEGER NOT NULL DEFAULT 0,
                UNIQUE(mojo_id, env_key)
            );
            CREATE TABLE IF NOT EXISTS server_variables (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                env_key   TEXT    NOT NULL,
                value     TEXT    NOT NULL DEFAULT '',
                UNIQUE(server_id, env_key)
            );
            CREATE TABLE IF NOT EXISTS allocations (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id   INTEGER NOT NULL,
                port        INTEGER NOT NULL,
                protocol    TEXT    NOT NULL DEFAULT 'tcp',
                description TEXT    NOT NULL DEFAULT '',
                is_primary  INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS backups (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id  INTEGER NOT NULL,
                filename   TEXT    NOT NULL,
                size       INTEGER NOT NULL DEFAULT 0,
                status     TEXT    NOT NULL DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS schedules (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id       INTEGER NOT NULL,
                name            TEXT    NOT NULL DEFAULT '',
                action          TEXT    NOT NULL,
                cron_expression TEXT    NOT NULL,
                is_active       INTEGER NOT NULL DEFAULT 1,
                last_run        DATETIME,
                next_run        DATETIME,
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS webhooks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                event      TEXT    NOT NULL,
                url        TEXT    NOT NULL,
                secret     TEXT    NOT NULL DEFAULT '',
                is_active  INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS activity_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER,
                server_id   INTEGER,
                action      TEXT    NOT NULL,
                description TEXT    NOT NULL DEFAULT '',
                ip_address  TEXT    NOT NULL DEFAULT '',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS server_metrics (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id   INTEGER NOT NULL,
                cpu_percent REAL    NOT NULL DEFAULT 0,
                mem_mb      REAL    NOT NULL DEFAULT 0,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS mods (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id   INTEGER NOT NULL,
                mod_id      TEXT    NOT NULL,
                name        TEXT    NOT NULL DEFAULT '',
                description TEXT    NOT NULL DEFAULT '',
                preview_url TEXT    NOT NULL DEFAULT '',
                source      TEXT    NOT NULL DEFAULT 'steam',
                status      TEXT    NOT NULL DEFAULT 'pending',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(server_id, mod_id),
                FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
            );
        ");

        // Add new columns to existing installs
        foreach ([
            'mojo_id INTEGER',
            'requires_login INTEGER NOT NULL DEFAULT 0',
            'docker_image TEXT NOT NULL DEFAULT ""',
        ] as $col) {
            try { $this->pdo->exec("ALTER TABLE servers ADD COLUMN $col"); } catch (\PDOException) {}
        }
        // Legacy migrations
        foreach ([
            'container_id TEXT NOT NULL DEFAULT ""',
            'cpu_limit REAL NOT NULL DEFAULT 0',
            'ram_limit_mb INTEGER NOT NULL DEFAULT 0',
        ] as $col) {
            try { $this->pdo->exec("ALTER TABLE servers ADD COLUMN $col"); } catch (\PDOException) {}
        }

        $defaults = [
            'app_name'              => 'Steam Game Server Manager',
            'setup_complete'        => '',
            'admin_username'        => '',
            'admin_password_hash'   => '',
            'steamcmd_path'         => '/opt/steamcmd/steamcmd.sh',
            'servers_path'          => '/opt/servers',
            'steam_api_key'         => '',
            'steam_username'        => '',
            'steam_password'        => '',
            'db_type'               => 'none',
            'db_host'               => '', 'db_port' => '', 'db_name' => '',
            'db_user'               => '', 'db_password' => '',
            'logo_path'             => '',
            'update_repo_url'       => 'ghcr.io/deadmojosites/sgsm:latest',
            'custom_api_key_1_name' => '', 'custom_api_key_1_value' => '',
            'custom_api_key_2_name' => '', 'custom_api_key_2_value' => '',
        ];
        $stmt = $this->pdo->prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
        foreach ($defaults as $k => $v) $stmt->execute([$k, $v]);
    }

    private function migrateAdminToUsers(): void {
        $count = (int)$this->pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        if ($count > 0) return;
        $username = $this->getSetting('admin_username');
        $hash     = $this->getSetting('admin_password_hash');
        if ($username && $hash) {
            $this->pdo->prepare(
                "INSERT OR IGNORE INTO users (username,password_hash,role,is_active) VALUES (?,?,'admin',1)"
            )->execute([$username, $hash]);
        }
    }

    private function seedMojos(): void {
        $count = (int)$this->pdo->query("SELECT COUNT(*) FROM mojos WHERE is_builtin=1")->fetchColumn();
        if ($count > 0) return;

        $games = [
            ['Counter-Strike 2',        'cs2',                '730',     './game/bin/linuxsteamrt64/cs2 -dedicated +map de_dust2 +maxplayers {MAX_PLAYERS} -port {SERVER_PORT}',                        27015, 10,  0],
            ['Counter-Strike: GO',       'csgo',               '740',     './srcds_run -game csgo +maxplayers {MAX_PLAYERS} +map de_dust2 -port {SERVER_PORT}',                                         27015, 10,  0],
            ['Valheim',                  'valheim',            '896660',  "./valheim_server.x86_64 -name '{SERVER_NAME}' -port {SERVER_PORT} -world 'World' -password '{SERVER_PASSWORD}'",              2456,  10,  0],
            ['Rust',                     'rust',               '258550',  './RustDedicated -batchmode +server.port {SERVER_PORT} +server.hostname "{SERVER_NAME}" +server.maxplayers {MAX_PLAYERS}',    28015, 50,  0],
            ['ARK: Survival Evolved',    'ark-se',             '376030',  './ShooterGameServer TheIsland?SessionName={SERVER_NAME}?Port={SERVER_PORT}?QueryPort=27015 -server -log -MaxPlayers={MAX_PLAYERS}', 7777, 70, 0],
            ['ARK: Survival Ascended',   'ark-sa',             '2430930', './ArkAscendedServer.sh TheIsland_WP?SessionName={SERVER_NAME}?Port={SERVER_PORT}?QueryPort=27015 -server -log -MaxPlayers={MAX_PLAYERS}', 7777, 70, 0],
            ["Garry's Mod",              'gmod',               '4020',    './srcds_run -game garrysmod +maxplayers {MAX_PLAYERS} +map gm_flatgrass -port {SERVER_PORT}',                                27015, 16,  0],
            ['Team Fortress 2',          'tf2',                '232250',  './srcds_run -game tf +maxplayers {MAX_PLAYERS} +map ctf_2fort -port {SERVER_PORT}',                                          27015, 24,  0],
            ['Left 4 Dead 2',            'l4d2',               '222860',  './srcds_run -game left4dead2 +map l4d2_c1m1_hotel +maxplayers {MAX_PLAYERS} -port {SERVER_PORT}',                            27015, 8,   0],
            ['7 Days to Die',            '7dtd',               '294420',  './7DaysToDieServer.x86_64 -configfile=serverconfig.xml -dedicated -nographics',                                              26900, 8,   0],
            ['Project Zomboid',          'pz',                 '380870',  './start-server.sh',                                                                                                          16261, 32,  0],
            ['Terraria (TShock)',         'terraria',           '105600',  './TerrariaServer -port {SERVER_PORT} -maxplayers {MAX_PLAYERS}',                                                             7777,  8,   0],
            ['DayZ',                     'dayz',               '223350',  './DayZServer -config=serverDZ.cfg -port={SERVER_PORT} -BEpath=battleye',                                                     2302,  60,  1],
            ['Satisfactory',             'satisfactory',       '1690800', './Engine/Binaries/Linux/FactoryServer-Linux-Shipping -multihome=0.0.0.0 -MaxPlayers={MAX_PLAYERS}',                         7777,  4,   0],
            ['Palworld',                 'palworld',           '2394010', './PalServer.sh EpicApp=PalServer',                                                                                           8211,  32,  0],
            ['Enshrouded',               'enshrouded',         '2278520', './enshrouded_server',                                                                                                        15636, 16,  1],
            ['Arma Reforger',            'arma-reforger',      '1874900', './ArmaReforgerServer -config {INSTALL_DIR}/config.json -profile {INSTALL_DIR}/profile -maxFPS 30 -nothrow',                 2001,  32,  0],
            ['Space Engineers DS',       'space-engineers',    '298740',  './SpaceEngineersDedicated.exe -console -path ./saves',                                                                       27016, 16,  0],
            ['Squad',                    'squad',              '403240',  './SquadGameServer.sh SquadGame -log -Port={SERVER_PORT} -QueryPort=27165',                                                   7787,  100, 1],
            ['Conan Exiles',             'conan-exiles',       '443030',  './ConanSandbox/Binaries/Win64/ConanSandboxServer.exe -MaxPlayers={MAX_PLAYERS} -Port={SERVER_PORT} -QueryPort=27015 -log',  7777,  40,  1],
            ['The Forest',               'the-forest',         '556450',  './TheForestDedicatedServer -serverip 0.0.0.0 -serverport {SERVER_PORT} -serverplayers {MAX_PLAYERS} -servername "{SERVER_NAME}"', 27015, 8, 0],
            ['Sons of the Forest',       'sons-of-the-forest', '1326470', './SonsOfTheForestDS',                                                                                                        8766,  8,   0],
            ['Killing Floor 2',          'kf2',                '232130',  './KFGameSteamServer.sh KF-BioticsLab?Difficulty=0?GameLength=1 -Port={SERVER_PORT}',                                        7777,  6,   0],
            ['V Rising',                 'v-rising',           '1829350', './VRisingServer.exe -persistentDataPath ./save-data -serverName "{SERVER_NAME}" -maxConnectedUsers {MAX_PLAYERS}',           9876,  40,  1],
        ];

        $stmtM = $this->pdo->prepare(
            "INSERT OR IGNORE INTO mojos (name,slug,app_id,startup_template,default_port,max_players,requires_login,is_builtin) VALUES (?,?,?,?,?,?,?,1)"
        );
        $stmtV = $this->pdo->prepare(
            "INSERT OR IGNORE INTO mojo_variables (mojo_id,env_key,label,description,default_value,is_required,sort_order) VALUES (?,?,?,?,?,?,?)"
        );

        foreach ($games as [$name, $slug, $appId, $startup, $port, $max, $reqLogin]) {
            $this->pdo->beginTransaction();
            $stmtM->execute([$name, $slug, $appId, $startup, $port, $max, $reqLogin]);
            $mid = (int)$this->pdo->lastInsertId();
            if ($mid) {
                $stmtV->execute([$mid, 'SERVER_NAME',     'Server Name',    'Display name of the server',    $name,          1, 1]);
                $stmtV->execute([$mid, 'SERVER_PORT',     'Server Port',    'UDP/TCP port for game clients', (string)$port,  1, 2]);
                $stmtV->execute([$mid, 'MAX_PLAYERS',     'Max Players',    'Maximum concurrent players',   (string)$max,   1, 3]);
                if ($slug === 'valheim') {
                    $stmtV->execute([$mid, 'SERVER_PASSWORD', 'Server Password', 'Server join password', 'changeme', 0, 4]);
                }
                if ($reqLogin) {
                    $stmtV->execute([$mid, 'STEAM_LOGIN', 'Steam Login', 'Steam account (leave blank for anonymous)', '', 0, 10]);
                }
            }
            $this->pdo->commit();
        }
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    public function getSetting(string $key): string {
        $stmt = $this->pdo->prepare("SELECT value FROM settings WHERE key=?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? (string)$val : '';
    }

    public function setSetting(string $key, string $value): void {
        $this->pdo->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")->execute([$key, $value]);
    }

    public function getSettings(): array {
        $rows = $this->pdo->query("SELECT key, value FROM settings")->fetchAll();
        $out  = [];
        foreach ($rows as $r) $out[$r['key']] = $r['value'];
        return $out;
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    public function getUsers(): array {
        return $this->pdo->query("SELECT id,username,email,role,is_active,created_at,last_login FROM users ORDER BY id")->fetchAll();
    }

    public function getUser(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT id,username,email,role,is_active,created_at,last_login FROM users WHERE id=?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function getUserByUsername(string $username): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE username=?");
        $stmt->execute([$username]);
        return $stmt->fetch() ?: null;
    }

    public function createUser(array $d): array {
        $this->pdo->prepare(
            "INSERT INTO users (username,email,password_hash,role,is_active) VALUES (?,?,?,?,?)"
        )->execute([$d['username'], $d['email'] ?? '', $d['password_hash'], $d['role'] ?? 'subuser', isset($d['is_active']) ? (int)$d['is_active'] : 1]);
        return $this->getUser((int)$this->pdo->lastInsertId());
    }

    public function updateUser(int $id, array $d): ?array {
        $allowed = ['username','email','password_hash','role','is_active','last_login'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $d)) { $sets[] = "$f=?"; $vals[] = $d[$f]; } }
        if ($sets) { $vals[] = $id; $this->pdo->prepare("UPDATE users SET " . implode(',', $sets) . " WHERE id=?")->execute($vals); }
        return $this->getUser($id);
    }

    public function deleteUser(int $id): void {
        $this->pdo->prepare("DELETE FROM users WHERE id=?")->execute([$id]);
        $this->pdo->prepare("DELETE FROM server_permissions WHERE user_id=?")->execute([$id]);
    }

    // ── Server Permissions ────────────────────────────────────────────────────

    public function getServerPermissionsForUser(int $userId): array {
        $stmt = $this->pdo->prepare("SELECT * FROM server_permissions WHERE user_id=?");
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function getPermissionsForServer(int $userId, int $serverId): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM server_permissions WHERE user_id=? AND server_id=?");
        $stmt->execute([$userId, $serverId]);
        return $stmt->fetch() ?: null;
    }

    public function setServerPermissions(int $userId, int $serverId, array $p): void {
        $this->pdo->prepare(
            "INSERT OR REPLACE INTO server_permissions
             (user_id,server_id,can_start,can_stop,can_console,can_files,can_backups,can_edit_startup)
             VALUES (?,?,?,?,?,?,?,?)"
        )->execute([$userId,$serverId,(int)($p['can_start']??0),(int)($p['can_stop']??0),(int)($p['can_console']??0),(int)($p['can_files']??0),(int)($p['can_backups']??0),(int)($p['can_edit_startup']??0)]);
    }

    // ── Servers ───────────────────────────────────────────────────────────────

    public function getServers(): array {
        return $this->pdo->query("SELECT * FROM servers ORDER BY name")->fetchAll();
    }

    public function getServer(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM servers WHERE id=?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function createServer(array $d): array {
        $this->pdo->prepare("
            INSERT INTO servers (name,app_id,install_dir,launch_executable,launch_args,port,max_players,notes,cpu_limit,ram_limit_mb,mojo_id,requires_login,docker_image)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $d['name'], $d['app_id'], $d['install_dir'],
            $d['launch_executable'] ?? '', $d['launch_args'] ?? '',
            isset($d['port']) && $d['port'] !== '' ? (int)$d['port'] : null,
            (int)($d['max_players'] ?? 0),
            $d['notes'] ?? '',
            (float)($d['cpu_limit'] ?? 0),
            (int)($d['ram_limit_mb'] ?? 0),
            isset($d['mojo_id']) && $d['mojo_id'] ? (int)$d['mojo_id'] : null,
            (int)($d['requires_login'] ?? 0),
            $d['docker_image'] ?? '',
        ]);
        return $this->getServer((int)$this->pdo->lastInsertId());
    }

    public function updateServer(int $id, array $d): ?array {
        $allowed = ['name','app_id','install_dir','launch_executable','launch_args','port','max_players',
                    'notes','status','pid','container_id','cpu_limit','ram_limit_mb',
                    'mojo_id','requires_login','docker_image'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $d)) { $sets[] = "$f=?"; $vals[] = $d[$f]; } }
        if ($sets) {
            $sets[] = 'updated_at=CURRENT_TIMESTAMP';
            $vals[] = $id;
            $this->pdo->prepare("UPDATE servers SET " . implode(',', $sets) . " WHERE id=?")->execute($vals);
        }
        return $this->getServer($id);
    }

    public function deleteServer(int $id): void {
        $this->pdo->prepare("DELETE FROM servers WHERE id=?")->execute([$id]);
        foreach (['server_permissions','server_variables','allocations','backups','schedules','server_metrics','mods'] as $t) {
            $this->pdo->prepare("DELETE FROM $t WHERE server_id=?")->execute([$id]);
        }
    }

    // ── Server Variables ──────────────────────────────────────────────────────

    public function getServerVariables(int $serverId): array {
        $stmt = $this->pdo->prepare("SELECT env_key,value FROM server_variables WHERE server_id=?");
        $stmt->execute([$serverId]);
        $out = [];
        foreach ($stmt->fetchAll() as $r) $out[$r['env_key']] = $r['value'];
        return $out;
    }

    public function setServerVariable(int $serverId, string $key, string $value): void {
        $this->pdo->prepare("INSERT OR REPLACE INTO server_variables (server_id,env_key,value) VALUES (?,?,?)")->execute([$serverId, $key, $value]);
    }

    public function setServerVariables(int $serverId, array $vars): void {
        foreach ($vars as $k => $v) $this->setServerVariable($serverId, $k, (string)$v);
    }

    // ── Mojos ─────────────────────────────────────────────────────────────────

    public function getMojos(): array {
        return $this->pdo->query("SELECT * FROM mojos ORDER BY name")->fetchAll();
    }

    public function getMojo(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM mojos WHERE id=?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function getMojoVariables(int $mojoId): array {
        $stmt = $this->pdo->prepare("SELECT * FROM mojo_variables WHERE mojo_id=? ORDER BY sort_order,id");
        $stmt->execute([$mojoId]);
        return $stmt->fetchAll();
    }

    public function createMojo(array $d): array {
        $this->pdo->prepare(
            "INSERT INTO mojos (name,slug,description,docker_image,app_id,install_command,startup_template,default_port,max_players,requires_login)
             VALUES (?,?,?,?,?,?,?,?,?,?)"
        )->execute([$d['name'],$d['slug'],$d['description']??'',$d['docker_image']??'cm2network/steamcmd:latest',$d['app_id']??'',$d['install_command']??'',$d['startup_template']??'',(int)($d['default_port']??0),(int)($d['max_players']??10),(int)($d['requires_login']??0)]);
        return $this->getMojo((int)$this->pdo->lastInsertId());
    }

    public function updateMojo(int $id, array $d): ?array {
        $allowed = ['name','slug','description','docker_image','app_id','install_command','startup_template','default_port','max_players','requires_login'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $d)) { $sets[] = "$f=?"; $vals[] = $d[$f]; } }
        if ($sets) { $sets[] = "updated_at=CURRENT_TIMESTAMP"; $vals[] = $id; $this->pdo->prepare("UPDATE mojos SET " . implode(',', $sets) . " WHERE id=?")->execute($vals); }
        return $this->getMojo($id);
    }

    public function deleteMojo(int $id): void {
        $this->pdo->prepare("DELETE FROM mojos WHERE id=? AND is_builtin=0")->execute([$id]);
        $this->pdo->prepare("DELETE FROM mojo_variables WHERE mojo_id=?")->execute([$id]);
    }

    public function upsertMojoVariable(int $mojoId, string $envKey, array $d): void {
        $this->pdo->prepare(
            "INSERT INTO mojo_variables (mojo_id,env_key,label,description,default_value,is_required,is_sensitive,sort_order)
             VALUES (?,?,?,?,?,?,?,?)
             ON CONFLICT(mojo_id,env_key) DO UPDATE SET
               label=excluded.label,description=excluded.description,
               default_value=excluded.default_value,is_required=excluded.is_required,
               is_sensitive=excluded.is_sensitive,sort_order=excluded.sort_order"
        )->execute([$mojoId,$envKey,$d['label']??$envKey,$d['description']??'',$d['default_value']??'',(int)($d['is_required']??0),(int)($d['is_sensitive']??0),(int)($d['sort_order']??0)]);
    }

    public function deleteMojoVariable(int $id): void {
        $this->pdo->prepare("DELETE FROM mojo_variables WHERE id=?")->execute([$id]);
    }

    // ── Allocations ───────────────────────────────────────────────────────────

    public function getAllocations(int $serverId): array {
        $stmt = $this->pdo->prepare("SELECT * FROM allocations WHERE server_id=? ORDER BY is_primary DESC,port");
        $stmt->execute([$serverId]);
        return $stmt->fetchAll();
    }

    public function createAllocation(int $serverId, int $port, string $protocol = 'tcp', string $desc = '', bool $primary = false): array {
        $this->pdo->prepare("INSERT INTO allocations (server_id,port,protocol,description,is_primary) VALUES (?,?,?,?,?)")->execute([$serverId,$port,$protocol,$desc,(int)$primary]);
        return ['id' => (int)$this->pdo->lastInsertId(), 'server_id' => $serverId, 'port' => $port, 'protocol' => $protocol, 'description' => $desc, 'is_primary' => (int)$primary];
    }

    public function deleteAllocation(int $id): void {
        $this->pdo->prepare("DELETE FROM allocations WHERE id=?")->execute([$id]);
    }

    // ── Backups ───────────────────────────────────────────────────────────────

    public function getBackups(int $serverId): array {
        $stmt = $this->pdo->prepare("SELECT * FROM backups WHERE server_id=? ORDER BY created_at DESC");
        $stmt->execute([$serverId]);
        return $stmt->fetchAll();
    }

    public function getBackup(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM backups WHERE id=?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function createBackup(int $serverId, string $filename): array {
        $this->pdo->prepare("INSERT INTO backups (server_id,filename,status) VALUES (?,?,'pending')")->execute([$serverId,$filename]);
        return $this->getBackup((int)$this->pdo->lastInsertId());
    }

    public function updateBackup(int $id, array $d): void {
        $allowed = ['size','status'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $d)) { $sets[] = "$f=?"; $vals[] = $d[$f]; } }
        if ($sets) { $vals[] = $id; $this->pdo->prepare("UPDATE backups SET " . implode(',', $sets) . " WHERE id=?")->execute($vals); }
    }

    public function deleteBackup(int $id): void {
        $this->pdo->prepare("DELETE FROM backups WHERE id=?")->execute([$id]);
    }

    // ── Schedules ─────────────────────────────────────────────────────────────

    public function getSchedules(int $serverId): array {
        $stmt = $this->pdo->prepare("SELECT * FROM schedules WHERE server_id=? ORDER BY id");
        $stmt->execute([$serverId]);
        return $stmt->fetchAll();
    }

    public function getAllActiveSchedules(): array {
        return $this->pdo->query("SELECT * FROM schedules WHERE is_active=1")->fetchAll();
    }

    public function getSchedule(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM schedules WHERE id=?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function createSchedule(int $serverId, array $d): array {
        $this->pdo->prepare("INSERT INTO schedules (server_id,name,action,cron_expression,is_active) VALUES (?,?,?,?,?)")->execute([$serverId,$d['name']??'',$d['action'],$d['cron_expression'],(int)($d['is_active']??1)]);
        return $this->getSchedule((int)$this->pdo->lastInsertId());
    }

    public function updateSchedule(int $id, array $d): void {
        $allowed = ['name','action','cron_expression','is_active','last_run','next_run'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $d)) { $sets[] = "$f=?"; $vals[] = $d[$f]; } }
        if ($sets) { $vals[] = $id; $this->pdo->prepare("UPDATE schedules SET " . implode(',', $sets) . " WHERE id=?")->execute($vals); }
    }

    public function deleteSchedule(int $id): void {
        $this->pdo->prepare("DELETE FROM schedules WHERE id=?")->execute([$id]);
    }

    // ── Webhooks ──────────────────────────────────────────────────────────────

    public function getWebhooks(): array {
        return $this->pdo->query("SELECT * FROM webhooks ORDER BY id")->fetchAll();
    }

    public function getWebhook(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM webhooks WHERE id=?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function getWebhooksByEvent(string $event): array {
        $stmt = $this->pdo->prepare("SELECT * FROM webhooks WHERE (event=? OR event='*') AND is_active=1");
        $stmt->execute([$event]);
        return $stmt->fetchAll();
    }

    public function createWebhook(array $d): array {
        $this->pdo->prepare("INSERT INTO webhooks (event,url,secret,is_active) VALUES (?,?,?,?)")->execute([$d['event'],$d['url'],$d['secret']??'',(int)($d['is_active']??1)]);
        return $this->getWebhook((int)$this->pdo->lastInsertId());
    }

    public function updateWebhook(int $id, array $d): void {
        $allowed = ['event','url','secret','is_active'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $d)) { $sets[] = "$f=?"; $vals[] = $d[$f]; } }
        if ($sets) { $vals[] = $id; $this->pdo->prepare("UPDATE webhooks SET " . implode(',', $sets) . " WHERE id=?")->execute($vals); }
    }

    public function deleteWebhook(int $id): void {
        $this->pdo->prepare("DELETE FROM webhooks WHERE id=?")->execute([$id]);
    }

    // ── Activity Log ──────────────────────────────────────────────────────────

    public function logActivity(?int $userId, ?int $serverId, string $action, string $description = '', string $ip = ''): void {
        $this->pdo->prepare("INSERT INTO activity_log (user_id,server_id,action,description,ip_address) VALUES (?,?,?,?,?)")->execute([$userId,$serverId,$action,$description,$ip]);
    }

    public function getActivityLog(int $limit = 100, ?int $serverId = null): array {
        if ($serverId !== null) {
            $stmt = $this->pdo->prepare("SELECT a.*,u.username FROM activity_log a LEFT JOIN users u ON a.user_id=u.id WHERE a.server_id=? ORDER BY a.id DESC LIMIT ?");
            $stmt->execute([$serverId, $limit]);
        } else {
            $stmt = $this->pdo->prepare("SELECT a.*,u.username FROM activity_log a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT ?");
            $stmt->execute([$limit]);
        }
        return $stmt->fetchAll();
    }

    // ── Metrics ───────────────────────────────────────────────────────────────

    public function recordMetric(int $serverId, float $cpu, float $mem): void {
        $this->pdo->prepare("INSERT INTO server_metrics (server_id,cpu_percent,mem_mb) VALUES (?,?,?)")->execute([$serverId,$cpu,$mem]);
        $this->pdo->prepare("DELETE FROM server_metrics WHERE server_id=? AND id NOT IN (SELECT id FROM server_metrics WHERE server_id=? ORDER BY id DESC LIMIT 1440)")->execute([$serverId,$serverId]);
    }

    public function getMetrics(int $serverId, int $limit = 60): array {
        $stmt = $this->pdo->prepare("SELECT * FROM server_metrics WHERE server_id=? ORDER BY id DESC LIMIT ?");
        $stmt->execute([$serverId, $limit]);
        return array_reverse($stmt->fetchAll());
    }

    // ── Mods ──────────────────────────────────────────────────────────────────

    public function getMods(int $serverId): array {
        $stmt = $this->pdo->prepare("SELECT * FROM mods WHERE server_id=? ORDER BY name");
        $stmt->execute([$serverId]);
        return $stmt->fetchAll();
    }

    public function getMod(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM mods WHERE id=?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function upsertMod(int $serverId, string $modId, array $d): array {
        $this->pdo->prepare("
            INSERT INTO mods (server_id,mod_id,name,description,preview_url,source,status)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(server_id,mod_id) DO UPDATE SET
                name=excluded.name, description=excluded.description,
                preview_url=excluded.preview_url, source=excluded.source,
                status=excluded.status
        ")->execute([$serverId,$modId,$d['name']??'',$d['description']??'',$d['preview_url']??'',$d['source']??'steam',$d['status']??'pending']);
        $stmt = $this->pdo->prepare("SELECT * FROM mods WHERE server_id=? AND mod_id=?");
        $stmt->execute([$serverId, $modId]);
        return $stmt->fetch();
    }

    public function setModStatus(int $id, string $status): void {
        $this->pdo->prepare("UPDATE mods SET status=? WHERE id=?")->execute([$status,$id]);
    }

    public function deleteMod(int $id): void {
        $this->pdo->prepare("DELETE FROM mods WHERE id=?")->execute([$id]);
    }
}
