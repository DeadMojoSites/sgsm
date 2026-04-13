<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
session_start();
requireAuth();

$db       = new GSM_DB();
$method   = $_SERVER['REQUEST_METHOD'];
$serverId = isset($_GET['server_id']) ? (int)$_GET['server_id'] : 0;
$modDbId  = isset($_GET['id'])        ? (int)$_GET['id']        : 0;
$action   = $_GET['action'] ?? '';

if ($serverId && !$db->getServer($serverId)) jsonError('Server not found', 404);

// ── GET list ──────────────────────────────────────────────────────────────────
if ($method === 'GET' && $serverId && !$action) {
    jsonResponse($db->getMods($serverId));
}

// ── GET Steam Workshop lookup ─────────────────────────────────────────────────
// No API key needed — GetPublishedFileDetails is publicly accessible.
if ($method === 'GET' && $action === 'lookup') {
    $workshopId = trim($_GET['workshop_id'] ?? '');
    if (!$workshopId) jsonError('workshop_id is required');

    $ch = curl_init('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(['itemcount' => 1, 'publishedfileids[0]' => $workshopId]),
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err || !$raw) jsonError('Could not reach Steam API');
    $data = json_decode($raw, true);
    $file = $data['response']['publishedfiledetails'][0] ?? null;
    if (!$file || ($file['result'] ?? 0) !== 1) jsonError('Workshop item not found or is private');

    jsonResponse([
        'mod_id'      => $workshopId,
        'name'        => $file['title'] ?? '',
        'description' => mb_strimwidth(strip_tags($file['description'] ?? ''), 0, 300, '…'),
        'preview_url' => $file['preview_url'] ?? '',
        'app_id'      => (string)($file['consumer_appid'] ?? ''),
        'source'      => 'steam',
        'workshop_url'=> 'https://steamcommunity.com/sharedfiles/filedetails/?id=' . $workshopId,
    ]);
}

// ── POST add mod ──────────────────────────────────────────────────────────────
if ($method === 'POST' && !$action) {
    if (!$serverId) jsonError('server_id is required');
    $b = getBody();
    $modId = trim($b['mod_id'] ?? '');
    if (!$modId) jsonError('mod_id is required');

    $mod = $db->upsertMod($serverId, $modId, [
        'name'        => trim($b['name'] ?? $modId),
        'description' => trim($b['description'] ?? ''),
        'preview_url' => trim($b['preview_url'] ?? ''),
        'source'      => trim($b['source'] ?? 'steam'),
        'status'      => 'pending',
    ]);

    // For Arma Reforger (Bohemia Workshop): sync mod list into config.json
    $server = $db->getServer($serverId);
    syncArmaConfig($db, $server);

    jsonResponse($mod, 201);
}

// ── POST install (Steam Workshop download via SteamCMD) ───────────────────────
if ($method === 'POST' && $action === 'install' && $modDbId) {
    $mod    = $db->getMod($modDbId);
    if (!$mod) jsonError('Mod not found', 404);
    if ($mod['source'] !== 'steam') jsonError('Only Steam Workshop mods can be installed this way');

    $server     = $db->getServer((int)$mod['server_id']);
    $steamcmd   = $db->getSetting('steamcmd_path') ?: '/opt/steamcmd/steamcmd.sh';
    $steamHome  = dirname($steamcmd);
    $appId      = $server['app_id'];
    $workshopId = $mod['mod_id'];

    if (!file_exists($steamcmd)) {
        require_once __DIR__ . '/../includes/helpers.php';
        autoInstallSteamCmd($steamcmd);
    }

    $logFile = DATA_DIR . '/logs/mod-' . $modDbId . '.log';
    if (!is_dir(dirname($logFile))) mkdir(dirname($logFile), 0755, true);
    file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . "] --- Downloading Workshop item $workshopId for app $appId ---\n");

    $cmd = sprintf(
        'HOME=%s nohup %s +login anonymous +workshop_download_item %s %s +quit >> %s 2>&1 & echo $!',
        escapeshellarg($steamHome),
        escapeshellarg($steamcmd),
        escapeshellarg($appId),
        escapeshellarg($workshopId),
        escapeshellarg($logFile)
    );
    $pid = (int)shell_exec($cmd);
    if ($pid <= 0) jsonError('Failed to start SteamCMD');

    $db->setModStatus($modDbId, 'installing');
    jsonResponse(['ok' => true, 'pid' => $pid, 'log' => basename($logFile)]);
}

// ── GET mod install log ────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'log' && $modDbId) {
    $mod = $db->getMod($modDbId);
    if (!$mod) jsonError('Mod not found', 404);
    $logFile = DATA_DIR . '/logs/mod-' . $modDbId . '.log';
    $offset  = (int)($_GET['offset'] ?? 0);
    if (!file_exists($logFile)) jsonResponse(['lines' => [], 'offset' => 0]);

    $content = file_get_contents($logFile, false, null, $offset);
    $lines   = $content === false ? [] : array_filter(explode("\n", $content), fn($l) => $l !== '');
    $newOff  = $offset + strlen((string)$content);

    // Detect completion: SteamCMD prints "Success" or "ERROR" near the end
    $done = false;
    if (str_contains((string)$content, 'Success.') || str_contains((string)$content, 'ERROR!')) {
        $done = true;
        $status = str_contains((string)$content, 'Success.') ? 'installed' : 'error';
        $db->setModStatus($modDbId, $status);

        // If success, also sync Arma config (mods are already in DB)
        if ($status === 'installed') {
            $server = $db->getServer((int)$mod['server_id']);
            syncArmaConfig($db, $server);
        }
    }

    jsonResponse(['lines' => array_values($lines), 'offset' => $newOff, 'done' => $done]);
}

// ── DELETE mod ────────────────────────────────────────────────────────────────
if ($method === 'DELETE' && $modDbId) {
    $mod = $db->getMod($modDbId);
    if (!$mod) jsonError('Not found', 404);
    $db->deleteMod($modDbId);

    // Sync Arma config after removal
    $server = $db->getServer((int)$mod['server_id']);
    syncArmaConfig($db, $server);

    jsonResponse(['ok' => true]);
}

jsonError('Bad request', 400);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * For servers with a -config <path> in their launch_args (e.g. Arma Reforger),
 * write the current mod list into config.json under game.mods.
 * Arma Reforger downloads mods automatically on startup from the Bohemia Workshop
 * when they're listed there.
 */
function syncArmaConfig(GSM_DB $db, ?array $server): void {
    if (!$server) return;
    $args = $server['launch_args'] ?? '';
    if (!preg_match('/-config\s+(\S+)/', $args, $m)) return;

    $cfgFile = $m[1];
    if (!file_exists($cfgFile)) return;

    $json = json_decode(file_get_contents($cfgFile), true);
    if (!is_array($json)) return;

    $mods = $db->getMods((int)$server['id']);
    $modsArr = array_values(array_map(fn($mod) => [
        'modId' => $mod['mod_id'],
        'name'  => $mod['name'],
    ], $mods));

    if (!isset($json['game'])) $json['game'] = [];
    $json['game']['mods'] = $modsArr;

    file_put_contents($cfgFile, json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}
