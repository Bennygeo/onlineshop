<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->query("SELECT * FROM orders ORDER BY id DESC LIMIT 100");
    $orders = $stmt->fetchAll();

    foreach ($orders as &$ord) {
        if (isset($ord['items']) && is_string($ord['items'])) {
            $ord['items'] = json_decode($ord['items'], true);
        }
        if (isset($ord['address']) && is_string($ord['address'])) {
            $ord['address'] = json_decode($ord['address'], true);
        }
    }

    sendJson($orders);
} catch (Exception $e) {
    sendJson([]);
}
