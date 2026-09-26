<?php
require_once __DIR__ . '/../config/db.php';

sendJson([
    'server_time' => date('Y-m-d H:i:s'),
    'server_time_iso' => date('c'),
    'server_epoch_ms' => round(microtime(true) * 1000)
]);
