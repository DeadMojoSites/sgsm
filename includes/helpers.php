<?php
declare(strict_types=1);

require_once __DIR__ . '/docker.php';

function isLoggedIn(): bool {
    return !empty($_SESSION['gsm_user']);
}

function requireAuth(): void {
    if (!isLoggedIn()) {
        jsonError('Unauthorized', 401);
    }
}

function jsonResponse(mixed $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function jsonError(string $msg, int $code = 400): never {
    jsonResponse(['error' => $msg], $code);
}

function getBody(): array {
    static $body = null;
    if ($body === null) {
        $raw  = file_get_contents('php://input');
        $body = $raw ? (json_decode($raw, true) ?? []) : [];
    }
    return $body;
}

// ── Docker helpers ────────────────────────────────────────────────────────────

/** Canonical container name for a server ID. */
function containerName(int $id): string {
    return 'gsm-server-' . $id;
}

/** Return a shared DockerClient instance (lazy init). */
function docker(): DockerClient {
    static $client = null;
    if ($client === null) $client = new DockerClient();
    return $client;
}

/**
 * Check whether a server container is still running.
 * Replaces isProcessRunning().
 */
function isContainerRunning(string $containerId): bool {
    if (!$containerId) return false;
    try {
        return docker()->isRunning($containerId);
    } catch (RuntimeException) {
        return false;
    }
}

/**
 * Stop and remove a server container.
 * Replaces killProcess().
 */
function stopContainer(string $containerId, int $timeout = 10): void {
    if (!$containerId) return;
    try {
        $d = docker();
        $d->stopContainer($containerId, $timeout);
        $d->removeContainer($containerId);
    } catch (RuntimeException) {
        // Best-effort — container may already be gone
    }
}

// ── Arma Reforger config helpers ──────────────────────────────────────────────

/**
 * Convert a path inside the panel container to the corresponding host path.
 * Docker daemon mounts from the host — not from inside the panel container.
 *
 * docker-compose.yml mounts  ./gsm_servers → /opt/servers  in the panel, and
 * sets GSM_SERVERS_HOST_PATH to the absolute host path of ./gsm_servers so that
 * game containers can be given the correct bind-mount source.
 */
function hostPath(string $containerPath): string {
    static $base = null;
    if ($base === null) {
        $base = rtrim((string)(getenv('GSM_SERVERS_HOST_PATH') ?: ''), '/');
    }
    if ($base && str_starts_with($containerPath, '/opt/servers/')) {
        return $base . '/' . substr($containerPath, strlen('/opt/servers/'));
    }
    // Fallback: path as-is (direct host install, dev environment)
    return $containerPath;
}


/**
 * Ensure config.json exists for Arma Reforger and strip forbidden DS 1.6+ fields.
 * $cfgFile is the ABSOLUTE path on the host.
 */
function ensureArmaConfig(string $cfgFile, array $server): void {
    if (!file_exists($cfgFile)) {
        $dir = dirname($cfgFile);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents($cfgFile, json_encode([
            'dedicatedServerId'   => '',
            'region'              => 'EU',
            'gameHostBindPort'    => (int)($server['port'] ?? 2001),
            'gameHostRegisterPort'=> (int)($server['port'] ?? 2001),
            'adminPassword'       => 'changeme',
            'game' => [
                'name'                     => $server['name'],
                'password'                 => '',
                'scenarioId'               => '{ECC61978EDCC2B5A}Missions/23_Campaign.conf',
                'maxPlayers'               => (int)($server['max_players'] ?? 32),
                'visible'                  => true,
                'supportedGameClientTypes' => ['PLATFORM_PC'],
            ],
        ], JSON_PRETTY_PRINT) . "\n");
    } else {
        // Auto-fix: remove fields disallowed in DS 1.6+
        $data = json_decode(file_get_contents($cfgFile), true);
        if (is_array($data)) {
            $changed = false;
            foreach (['gameHostBindAddress', 'gameHostRegisterBindAddress'] as $banned) {
                if (array_key_exists($banned, $data)) { unset($data[$banned]); $changed = true; }
            }
            if ($changed) file_put_contents($cfgFile, json_encode($data, JSON_PRETTY_PRINT) . "\n");
        }
    }
}

// ── Server container management ───────────────────────────────────────────────

/**
 * Launch the game server in its own Docker container.
 * Returns the full container ID.
 */
function startServer(array $server): string {
    $id         = (int)$server['id'];
    $installDir = rtrim($server['install_dir'], '/');
    $executable = $server['launch_executable'] ?? '';
    $launchArgs = $server['launch_args'] ?? '';

    if (!$executable) throw new RuntimeException('No launch executable configured. Edit the server to set one.');

    $d = docker();
    $d->assertAvailable();

    // Make install dir on host if it doesn't exist
    if (!is_dir($installDir)) mkdir($installDir, 0755, true);

    // Inside the container the game files are always at /server
    $launchArgs = str_replace('{INSTALL_DIR}', '/server', $launchArgs);

    // Handle Arma Reforger config (maps to host path for file-editor access)
    if (preg_match('/-config\s+(\S+)/', $launchArgs, $m)) {
        // Translate container path /server/... → host path
        $cfgInContainer = $m[1];
        $cfgOnHost = str_replace('/server/', $installDir . '/', $cfgInContainer);
        ensureArmaConfig($cfgOnHost, $server);
    }

    // Auto-create profile dir
    if (preg_match('/-profile\s+(\S+)/', $launchArgs, $m)) {
        $profileInContainer = $m[1];
        $profileOnHost = str_replace('/server/', $installDir . '/', $profileInContainer);
        if (!is_dir($profileOnHost)) mkdir($profileOnHost, 0755, true);
    }

    $isWindows = strtolower(pathinfo($executable, PATHINFO_EXTENSION)) === 'exe';
    $image     = $isWindows ? 'ghcr.io/deadmojosites/sgsm-wine:latest' : 'steamcmd/steamcmd:latest';

    // Build sh -c command string (handles args with embedded spaces safely)
    $execInContainer = preg_replace('#^\./#', '/server/', $executable);
    // chmod the binary inside the container via entrypoint trick
    $shCmd = "chmod +x " . escapeshellarg($execInContainer) . " 2>/dev/null; "
           . ($isWindows ? "wine " : "")
           . $execInContainer . " " . $launchArgs;

    $cname = containerName($id);

    // Remove stale stopped container if present
    $existing = $d->inspectContainer($cname);
    if ($existing !== null && !($existing['State']['Running'] ?? false)) {
        $d->removeContainer($cname, true);
    }

    // Bind mount uses the HOST path (Docker daemon runs on host, not inside panel container)
    $hostInstallDir = hostPath($installDir);

    // Resource limits
    $hostConfig = [
        'Binds'         => [$hostInstallDir . ':/server'],
        'NetworkMode'   => 'host',
        'RestartPolicy' => ['Name' => 'no'],
    ];
    if (!empty($server['cpu_limit']) && (float)$server['cpu_limit'] > 0) {
        $hostConfig['NanoCpus'] = (int)((float)$server['cpu_limit'] * 1e9);
    }
    if (!empty($server['ram_limit_mb']) && (int)$server['ram_limit_mb'] > 0) {
        $hostConfig['Memory'] = (int)$server['ram_limit_mb'] * 1048576;
    }

    $containerId = $d->createContainer($cname, [
        'Image'      => $image,
        'Entrypoint' => ['/bin/sh', '-c'],
        'Cmd'        => [$shCmd],
        'WorkingDir' => '/server',
        'HostConfig' => $hostConfig,
        'Labels'     => ['gsm.server_id' => (string)$id],
    ]);

    $d->startContainer($containerId);
    return $containerId;
}

/**
 * Run a SteamCMD install/update inside a dedicated container.
 * Returns the container ID (the container exits when the install completes).
 */
function installServer(array $server, string $steamUser = '', string $steamPass = ''): string {
    $id         = (int)$server['id'];
    $installDir = rtrim($server['install_dir'], '/');
    $appId      = (int)$server['app_id'];

    $d = docker();
    $d->assertAvailable();

    if (!is_dir($installDir)) mkdir($installDir, 0755, true);

    // Remove any previous install container
    $cname = 'gsm-install-' . $id;
    $existing = $d->inspectContainer($cname);
    if ($existing !== null) $d->removeContainer($cname, true);

    $useLogin = !empty($steamUser) && !empty($steamPass);
    $loginCmd = $useLogin
        ? '+login ' . escapeshellarg($steamUser) . ' ' . escapeshellarg($steamPass)
        : '+login anonymous';

    $note = $useLogin
        ? "NOTE: Installing App ID $appId as Steam user: $steamUser\n\n"
        : "NOTE: Installing App ID $appId anonymously.\n"
        . "      If this fails with 'Missing configuration' / 'No subscription',\n"
        . "      the game requires a Steam account. Go to Settings → Steam to add credentials.\n\n";

    // Write header to log file immediately so the console shows something
    $logFile = DATA_DIR . '/logs/install-' . $id . '.log';
    if (!is_dir(dirname($logFile))) mkdir(dirname($logFile), 0755, true);
    file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . "] --- Installing App ID $appId ---\n" . $note);

    // SteamCMD command inside the container
    $shCmd = "/home/steam/steamcmd/steamcmd.sh"
           . " +force_install_dir /server"
           . " $loginCmd"
           . " +app_update $appId validate"
           . " +quit";

    // Bind mount uses the HOST path (Docker daemon runs on host)
    $hostInstallDir = hostPath($installDir);

    $containerId = $d->createContainer($cname, [
        'Image'      => 'steamcmd/steamcmd:latest',
        'Entrypoint' => ['/bin/sh', '-c'],
        'Cmd'        => [$shCmd],
        'WorkingDir' => '/server',
        'HostConfig' => [
            'Binds'       => [$hostInstallDir . ':/server'],
            'NetworkMode' => 'bridge', // needs internet for download
        ],
        'Labels' => ['gsm.install_id' => (string)$id],
    ]);

    $d->startContainer($containerId);
    return $containerId;
}
