<?php
declare(strict_types=1);

/**
 * Docker API client — communicates with the Docker daemon via the Unix socket.
 * Requires /var/run/docker.sock to be mounted into the PHP container.
 */
class DockerClient {

    private string $socket;
    private string $api = 'v1.43';

    public function __construct() {
        $this->socket = getenv('DOCKER_SOCKET') ?: '/var/run/docker.sock';
    }

    public function available(): bool {
        return file_exists($this->socket);
    }

    public function assertAvailable(): void {
        if (!$this->available()) {
            throw new RuntimeException(
                'Docker socket not found at ' . $this->socket . '. ' .
                'Ensure /var/run/docker.sock is mounted into the container.'
            );
        }
    }

    // ── Low-level HTTP over Unix socket ─────────────────────────────────────

    private function req(string $method, string $path, mixed $body = null, array $query = []): array {
        $url = 'http://localhost/' . $this->api . $path;
        if ($query) $url .= '?' . http_build_query($query);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_UNIX_SOCKET_PATH, $this->socket);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $headers = [];
        if ($body !== null) {
            $json = json_encode($body);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            $headers[] = 'Content-Type: application/json';
            $headers[] = 'Content-Length: ' . strlen($json);
        }
        if ($headers) curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response  = curl_exec($ch);
        $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) throw new RuntimeException("Docker socket error: $curlError");

        $decoded = strlen((string)$response) > 0 ? json_decode($response, true) : null;
        return ['code' => $httpCode, 'body' => $decoded ?? $response];
    }

    /** Raw response (for multiplexed log streams). */
    private function reqRaw(string $method, string $path, array $query = []): string {
        $url = 'http://localhost/' . $this->api . $path;
        if ($query) $url .= '?' . http_build_query($query);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_UNIX_SOCKET_PATH, $this->socket);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($ch);
        curl_close($ch);
        return $response ?: '';
    }

    // ── Container ────────────────────────────────────────────────────────────

    /**
     * Create a container and return its full ID.
     * $config is the full Docker container-create body.
     */
    public function createContainer(string $name, array $config): string {
        $r = $this->req('POST', '/containers/create', $config, ['name' => $name]);
        if ($r['code'] !== 201) {
            $msg = is_array($r['body']) ? ($r['body']['message'] ?? json_encode($r['body'])) : (string)$r['body'];
            throw new RuntimeException("Failed to create container \"$name\": $msg");
        }
        return $r['body']['Id'];
    }

    public function startContainer(string $id): void {
        $r = $this->req('POST', "/containers/$id/start");
        // 204 = started, 304 = already running — both are fine
        if ($r['code'] !== 204 && $r['code'] !== 304) {
            $msg = is_array($r['body']) ? ($r['body']['message'] ?? json_encode($r['body'])) : (string)$r['body'];
            throw new RuntimeException("Failed to start container: $msg");
        }
    }

    public function stopContainer(string $id, int $timeout = 10): void {
        $this->req('POST', "/containers/$id/stop", null, ['t' => $timeout]);
    }

    public function removeContainer(string $id, bool $force = true): void {
        $this->req('DELETE', "/containers/$id", null, [
            'force' => $force ? 'true' : 'false',
            'v'     => 'false', // do NOT remove named volumes
        ]);
    }

    public function inspectContainer(string $id): ?array {
        $r = $this->req('GET', "/containers/$id/json");
        return $r['code'] === 200 ? $r['body'] : null;
    }

    public function isRunning(string $id): bool {
        $info = $this->inspectContainer($id);
        return $info !== null && ($info['State']['Running'] ?? false) === true;
    }

    public function isExited(string $id): bool {
        $info = $this->inspectContainer($id);
        return $info !== null && ($info['State']['Status'] ?? '') === 'exited';
    }

    /** Get exit code of a stopped container. */
    public function exitCode(string $id): int {
        $info = $this->inspectContainer($id);
        return (int)($info['State']['ExitCode'] ?? -1);
    }

    // ── Logs ─────────────────────────────────────────────────────────────────

    /**
     * Fetch container logs.
     * $since = Unix timestamp to fetch logs from (0 = all).
     * Returns plain text with embedded timestamps.
     */
    public function getLogs(string $id, int $tail = 500, int $since = 0): string {
        $query = ['stdout' => 1, 'stderr' => 1, 'tail' => $tail, 'timestamps' => 1];
        if ($since > 0) $query['since'] = $since;
        $raw = $this->reqRaw('GET', "/containers/$id/logs", $query);
        return $this->stripMultiplex($raw);
    }

    /**
     * Docker multiplexes stdout/stderr with 8-byte headers per frame.
     * Strip them to get plain text.
     */
    private function stripMultiplex(string $raw): string {
        $out    = '';
        $offset = 0;
        $len    = strlen($raw);
        while ($offset < $len) {
            if ($offset + 8 > $len) {
                $out .= substr($raw, $offset); // malformed tail — append as-is
                break;
            }
            $frameSize = unpack('N', substr($raw, $offset + 4, 4))[1];
            $offset   += 8;
            if ($frameSize > 0 && $offset + $frameSize <= $len) {
                $out .= substr($raw, $offset, $frameSize);
            }
            $offset += $frameSize;
        }
        return $out;
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    /** Return a single non-streaming stats snapshot for a running container. */
    public function getStats(string $id): array {
        $r = $this->req('GET', "/containers/$id/stats", null, ['stream' => 'false', 'one-shot' => 'true']);
        return $r['code'] === 200 && is_array($r['body']) ? $r['body'] : [];
    }

    /**
     * Calculate CPU % and memory usage from a stats snapshot.
     * Returns ['cpu_pct' => float, 'mem_mb' => float, 'mem_limit_mb' => float].
     */
    public function calcStats(array $stats): array {
        $cpu = 0.0;
        if (!empty($stats['cpu_stats']) && !empty($stats['precpu_stats'])) {
            $cpuDelta = ($stats['cpu_stats']['cpu_usage']['total_usage'] ?? 0)
                      - ($stats['precpu_stats']['cpu_usage']['total_usage'] ?? 0);
            $sysDelta = ($stats['cpu_stats']['system_cpu_usage'] ?? 0)
                      - ($stats['precpu_stats']['system_cpu_usage'] ?? 0);
            $numCpu   = $stats['cpu_stats']['online_cpus'] ?? 1;
            if ($sysDelta > 0 && $cpuDelta > 0) {
                $cpu = round(($cpuDelta / $sysDelta) * $numCpu * 100, 1);
            }
        }
        $memBytes  = $stats['memory_stats']['usage'] ?? 0;
        $memLimit  = $stats['memory_stats']['limit'] ?? 0;
        return [
            'cpu_pct'      => $cpu,
            'mem_mb'       => round($memBytes / 1048576, 1),
            'mem_limit_mb' => round($memLimit  / 1048576, 1),
        ];
    }

    // ── Images ───────────────────────────────────────────────────────────────

    public function imageExists(string $image): bool {
        $r = $this->req('GET', '/images/' . urlencode($image) . '/json');
        return $r['code'] === 200;
    }

    public function pullImage(string $image): void {
        $parts = explode(':', $image, 2);
        $this->req('POST', '/images/create', null, [
            'fromImage' => $parts[0],
            'tag'       => $parts[1] ?? 'latest',
        ]);
    }

    // ── Volumes ──────────────────────────────────────────────────────────────

    public function createVolume(string $name): void {
        $this->req('POST', '/volumes/create', ['Name' => $name]);
    }

    public function removeVolume(string $name): bool {
        $r = $this->req('DELETE', "/volumes/$name");
        return $r['code'] === 204;
    }

    public function volumeExists(string $name): bool {
        $r = $this->req('GET', "/volumes/$name");
        return $r['code'] === 200;
    }

    // ── Exec (stdin) ──────────────────────────────────────────────────────────

    /**
     * Send a text command to a container's main-process stdin by writing to
     * /proc/1/fd/0 via docker exec. Works for most dedicated game servers.
     * Returns false if the exec failed (container has no /bin/sh, etc.).
     */
    public function sendStdin(string $containerId, string $command): bool {
        try {
            // Create exec instance — run sh -c "printf ... > /proc/1/fd/0"
            $safeCmd = 'printf "%s\n" ' . escapeshellarg($command) . ' > /proc/1/fd/0';
            $r = $this->req('POST', "/containers/$containerId/exec", [
                'AttachStdin'  => false,
                'AttachStdout' => false,
                'AttachStderr' => false,
                'Tty'          => false,
                'Cmd'          => ['/bin/sh', '-c', $safeCmd],
            ]);
            if ($r['code'] !== 201 || empty($r['body']['Id'])) return false;
            $execId = $r['body']['Id'];
            // Start exec — detached (fire-and-forget)
            $this->req('POST', "/exec/$execId/start", ['Detach' => true, 'Tty' => false]);
            return true;
        } catch (RuntimeException) {
            return false;
        }
    }
}
