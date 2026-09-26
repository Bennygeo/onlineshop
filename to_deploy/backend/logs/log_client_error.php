<?php
require_once __DIR__ . '/../config/db.php';

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data || !is_array($data)) {
        $data = $_POST;
    }

    $message   = $data['message']   ?? 'Unknown client error';
    $stack     = $data['stack']     ?? null;
    $url       = $data['url']       ?? ($_SERVER['HTTP_REFERER'] ?? null);
    $component = $data['component'] ?? null;
    $user      = $data['user']      ?? null;
    $extra     = $data['extra']     ?? [];

    $context = [
        'trace'     => $stack,
        'url'       => $url,
        'component' => $component,
        'user'      => $user,
        'extra'     => $extra
    ];

    Logger::clientError($message, $context);

    sendJson(['status' => 'logged', 'timestamp' => date('Y-m-d H:i:s')]);
} catch (Throwable $e) {
    sendJson(['status' => 'error', 'message' => $e->getMessage()], 500);
}
