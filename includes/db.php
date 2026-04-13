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
    }

    private function migrate(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
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
                created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
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
        // Migrations for existing installs — add columns if missing
        foreach (['container_id TEXT NOT NULL DEFAULT ""',
                  'cpu_limit REAL NOT NULL DEFAULT 0',
                  'ram_limit_mb INTEGER NOT NULL DEFAULT 0'] as $col) {
            [$colName] = explode(' ', $col);
            try { $this->pdo->exec("ALTER TABLE servers ADD COLUMN $col"); } catch (\PDOException) {}
        }

        $defaults = [
            'app_name'              => 'Game Server Manager',
            'setup_complete'        => '',
            'admin_username'        => '',
            'admin_password_hash'   => '',
            'steamcmd_path'         => '/opt/steamcmd/steamcmd.sh',
            'servers_path'          => '/opt/servers',
            'steam_api_key'         => '',
            'db_type'               => 'none',
            'db_host'               => '', 'db_port' => '', 'db_name' => '',
            'db_user'               => '', 'db_password' => '',
            'logo_path'             => '',
            'update_repo_url'       => '',
            'custom_api_key_1_name' => '', 'custom_api_key_1_value' => '',
            'custom_api_key_2_name' => '', 'custom_api_key_2_value' => '',
        ];
        $stmt = $this->pdo->prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
        foreach ($defaults as $k => $v) $stmt->execute([$k, $v]);
    }

    public function getSetting(string $key): string {
        $stmt = $this->pdo->prepare("SELECT value FROM settings WHERE key=?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? (string)$val : '';
    }

    public function setSetting(string $key, string $value): void {
        $this->pdo->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
                  ->execute([$key, $value]);
    }

    public function getSettings(): array {
        $rows = $this->pdo->query("SELECT key, value FROM settings")->fetchAll();
        $out  = [];
        foreach ($rows as $r) $out[$r['key']] = $r['value'];
        return $out;
    }

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
            INSERT INTO servers (name,app_id,install_dir,launch_executable,launch_args,port,max_players,notes,cpu_limit,ram_limit_mb)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ")->execute([
            $d['name'], $d['app_id'], $d['install_dir'],
            $d['launch_executable'] ?? '', $d['launch_args'] ?? '',
            isset($d['port']) && $d['port'] !== '' ? (int)$d['port'] : null,
            (int)($d['max_players'] ?? 0),
            $d['notes'] ?? '',
            (float)($d['cpu_limit'] ?? 0),
            (int)($d['ram_limit_mb'] ?? 0),
        ]);
        return $this->getServer((int)$this->pdo->lastInsertId());
    }

    public function updateServer(int $id, array $d): ?array {
        $allowed = ['name','app_id','install_dir','launch_executable','launch_args','port','max_players',
                    'notes','status','pid','container_id','cpu_limit','ram_limit_mb'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $d)) { $sets[] = "$f=?"; $vals[] = $d[$f]; }
        }
        if ($sets) {
            $sets[] = 'updated_at=CURRENT_TIMESTAMP';
            $vals[] = $id;
            $this->pdo->prepare("UPDATE servers SET " . implode(',', $sets) . " WHERE id=?")->execute($vals);
        }
        return $this->getServer($id);
    }

    public function deleteServer(int $id): void {
        $this->pdo->prepare("DELETE FROM servers WHERE id=?")->execute([$id]);
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
            INSERT INTO mods (server_id, mod_id, name, description, preview_url, source, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(server_id, mod_id) DO UPDATE SET
                name=excluded.name, description=excluded.description,
                preview_url=excluded.preview_url, source=excluded.source,
                status=excluded.status
        ")->execute([
            $serverId, $modId,
            $d['name'] ?? '', $d['description'] ?? '',
            $d['preview_url'] ?? '', $d['source'] ?? 'steam',
            $d['status'] ?? 'pending',
        ]);
        $stmt = $this->pdo->prepare("SELECT * FROM mods WHERE server_id=? AND mod_id=?");
        $stmt->execute([$serverId, $modId]);
        return $stmt->fetch();
    }

    public function setModStatus(int $id, string $status): void {
        $this->pdo->prepare("UPDATE mods SET status=? WHERE id=?")->execute([$status, $id]);
    }

    public function deleteMod(int $id): void {
        $this->pdo->prepare("DELETE FROM mods WHERE id=?")->execute([$id]);
    }
}
