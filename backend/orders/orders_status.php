<?php
require_once __DIR__ . '/../config/db.php';

$userID = getParam('userID') ?: getParam('mobile');
$defaultOrderId = 'ORD_' . date('YmdHis') . '_' . rand(100, 999);

if (!$userID || !$pdo) {
    sendJson([['order_id' => $defaultOrderId, 'status' => 'NEW', 'total_amount' => 0]]);
}

try {
    $stmt = $pdo->prepare("SELECT order_id, status, total_amount, created_at FROM orders WHERE mobile = ? ORDER BY created_at DESC LIMIT 5");
    $stmt->execute([$userID]);
    $statuses = $stmt->fetchAll();

    if (empty($statuses)) {
        sendJson([['order_id' => $defaultOrderId, 'status' => 'NEW', 'total_amount' => 0]]);
    } else {
        sendJson($statuses);
    }
} catch (Exception $e) {
    sendJson([['order_id' => $defaultOrderId, 'status' => 'NEW', 'total_amount' => 0]]);
}

