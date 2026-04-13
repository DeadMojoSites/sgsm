<?php
declare(strict_types=1);

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

function isProcessRunning(int $pid): bool {
    if ($pid <= 0) return false;
    if (PHP_OS_FAMILY === 'Windows') {
        $out = shell_exec("tasklist /FI \"PID eq $pid\" 2>NUL");
        return str_contains((string)$out, (string)$pid);
    }
    return file_exists("/proc/$pid");
}

function killProcess(int $pid): void {
    if ($pid <= 0) return;
    if (PHP_OS_FAMILY === 'Windows') {
        shell_exec("taskkill /PID $pid /F 2>NUL");
    } else {
        shell_exec("kill -15 $pid 2>/dev/null");
        usleep(500000);
        if (isProcessRunning($pid)) shell_exec("kill -9 $pid 2>/dev/null");
    }
}

function startServer(array $server): int {
    $id         = (int)$server['id'];
    $installDir = $server['install_dir'];
    $executable = $server['launch_executable'] ?? '';
    $launchArgs = $server['launch_args'] ?? '';

    if (!$executable) throw new RuntimeException('No launch executable configured. Edit the server to set one.');
    if (!is_dir($installDir) && !mkdir($installDir, 0755, true)) {
        throw new RuntimeException("Install directory does not exist and could not be created: \"$installDir\".");
    }

    // Resolve the executable path
    $execPath = str_starts_with($executable, '/') ? $executable
        : rtrim($installDir, '/') . '/' . ltrim(preg_replace('#^\./#', '', $executable), '/');

    if (!file_exists($execPath)) throw new RuntimeException("Executable not found: \"$executable\".");

    $logFile = DATA_DIR . '/logs/server-' . $id . '.log';
    if (!is_dir(dirname($logFile))) mkdir(dirname($logFile), 0755, true);
    file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . "] --- Server starting ---\n");

    $cmd = sprintf(
        'cd %s && nohup %s %s >> %s 2>&1 & echo $!',
        escapeshellarg($installDir),
        escapeshellarg($execPath),
        $launchArgs,
        escapeshellarg($logFile)
    );
    $pid = (int)shell_exec($cmd);
    if ($pid <= 0) throw new RuntimeException('Failed to start server process. Check server logs.');
    return $pid;
}

function autoInstallSteamCmd(string $steamcmdPath): void {
    $steamcmdDir = dirname($steamcmdPath);
    if (!is_dir($steamcmdDir) && !mkdir($steamcmdDir, 0755, true)) {
        throw new RuntimeException("Cannot create SteamCMD directory: \"$steamcmdDir\". Check permissions.");
    }

    // Download the SteamCMD tarball
    $tarball = $steamcmdDir . '/steamcmd_linux.tar.gz';
    $result  = shell_exec('curl -fsSL -o ' . escapeshellarg($tarball) . ' "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" 2>&1');
    if (!file_exists($tarball)) {
        throw new RuntimeException('Failed to download SteamCMD. Ensure the container has internet access.');
    }

    shell_exec('tar -xzf ' . escapeshellarg($tarball) . ' -C ' . escapeshellarg($steamcmdDir) . ' 2>&1');
    @unlink($tarball);

    if (!file_exists($steamcmdPath)) {
        throw new RuntimeException('SteamCMD extraction failed. Could not find steamcmd.sh after download.');
    }
    chmod($steamcmdPath, 0755);

    // First-run bootstrap so SteamCMD updates itself
    shell_exec($steamcmdPath . ' +quit 2>&1');
}

function installServer(array $server, string $steamcmdPath): int {
    $id         = (int)$server['id'];
    $installDir = $server['install_dir'];
    $appId      = (int)$server['app_id'];

    if (!is_dir($installDir)) mkdir($installDir, 0755, true);

    // Auto-download SteamCMD if it is not present yet
    if (!file_exists($steamcmdPath)) {
        autoInstallSteamCmd($steamcmdPath);
    }

    $logFile = DATA_DIR . '/logs/install-' . $id . '.log';
    if (!is_dir(dirname($logFile))) mkdir(dirname($logFile), 0755, true);
    file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . "] --- Installing App ID $appId ---\n");

    // Set HOME to the steamcmd dir so SteamCMD can write its cache there
    // instead of trying to use /var/www (www-data's default home)
    $steamHome = dirname($steamcmdPath);
    $cmd = sprintf(
        'HOME=%s nohup %s +force_install_dir %s +login anonymous +app_update %d validate +quit >> %s 2>&1 & echo $!',
        escapeshellarg($steamHome),
        escapeshellarg($steamcmdPath),
        escapeshellarg($installDir),
        $appId,
        escapeshellarg($logFile)
    );
    $pid = (int)shell_exec($cmd);
    if ($pid <= 0) throw new RuntimeException('Failed to start SteamCMD. Check SteamCMD path in Settings.');
    return $pid;
}
