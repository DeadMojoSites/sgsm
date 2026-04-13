<?php
/**
 * cron.php — Schedule runner
 * Called every minute by crond in docker-entrypoint.sh:
 *   * * * * * php /var/www/html/cron.php >> /var/log/gsm-cron.log 2>&1
 */
declare(strict_types=1);
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/helpers.php';

// CLI only
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

$db  = new GSM_DB();
$now = time();

/**
 * Match a single cron field value against the current time value.
 * Supports: * | N | step(N) | N,M | N-M
 */
function cronFieldMatches(string $field, int $value): bool {
    if ($field === '*') return true;
    foreach (explode(',', $field) as $part) {
        $part = trim($part);
        if (str_starts_with($part, '*/')) {
            $step = (int)substr($part, 2);
            if ($step > 0 && $value % $step === 0) return true;
        } elseif (str_contains($part, '-')) {
            [$lo, $hi] = explode('-', $part, 2);
            if ($value >= (int)$lo && $value <= (int)$hi) return true;
        } else {
            if ((int)$part === $value) return true;
        }
    }
    return false;
}

/**
 * Determine if a cron expression matches the given timestamp.
 * Expression format: "min hour dom mon dow"  (standard 5-field cron)
 */
function cronMatches(string $expr, int $ts): bool {
    $f = preg_split('/\s+/', trim($expr));
    if (count($f) !== 5) return false;
    [$min, $hour, $dom, $mon, $dow] = $f;
    return cronFieldMatches($min,  (int)date('i', $ts))
        && cronFieldMatches($hour, (int)date('G', $ts))
        && cronFieldMatches($dom,  (int)date('j', $ts))
        && cronFieldMatches($mon,  (int)date('n', $ts))
        && cronFieldMatches($dow,  (int)date('w', $ts));
}

// Load all active schedules
$schedules = $db->getAllActiveSchedules();
if (empty($schedules)) exit(0);

foreach ($schedules as $sched) {
    if (!cronMatches($sched['cron_expression'], $now)) continue;

    $serverId = (int)$sched['server_id'];
    $action   = $sched['action']; // start | stop | restart

    $s = $db->getServer($serverId);
    if (!$s) continue;

    // Sync container status
    if (in_array($s['status'], ['running', 'installing'])) {
        $cid = $s['container_id'] ?? '';
        if ($cid && !isContainerRunning($cid)) {
            $db->updateServer($serverId, ['status' => 'stopped', 'container_id' => '']);
            $s['status']       = 'stopped';
            $s['container_id'] = '';
        }
    }

    echo "[" . date('Y-m-d H:i:s') . "] Schedule #{$sched['id']} — $action server #$serverId ({$s['name']})\n";

    try {
        if ($action === 'start') {
            if ($s['status'] !== 'running') {
                $cid = startServer($s);
                $db->updateServer($serverId, ['status' => 'running', 'container_id' => $cid]);
                $db->logActivity(null, $serverId, 'schedule.start', "Scheduled start", '');
                fireWebhook('server.started', ['server_id' => $serverId, 'name' => $s['name'], 'trigger' => 'schedule']);
            }
        } elseif ($action === 'stop') {
            if ($s['status'] === 'running') {
                stopContainer($s['container_id'] ?? '');
                $db->updateServer($serverId, ['status' => 'stopped', 'container_id' => '']);
                $db->logActivity(null, $serverId, 'schedule.stop', "Scheduled stop", '');
                fireWebhook('server.stopped', ['server_id' => $serverId, 'name' => $s['name'], 'trigger' => 'schedule']);
            }
        } elseif ($action === 'restart') {
            stopContainer($s['container_id'] ?? '');
            $cid = startServer($s);
            $db->updateServer($serverId, ['status' => 'running', 'container_id' => $cid]);
            $db->logActivity(null, $serverId, 'schedule.restart', "Scheduled restart", '');
            fireWebhook('server.restarted', ['server_id' => $serverId, 'name' => $s['name'], 'trigger' => 'schedule']);
        }
    } catch (RuntimeException $e) {
        echo "  ERROR: " . $e->getMessage() . "\n";
        $db->logActivity(null, $serverId, 'schedule.error', "Schedule $action failed: " . $e->getMessage(), '');
    }
}

exit(0);
