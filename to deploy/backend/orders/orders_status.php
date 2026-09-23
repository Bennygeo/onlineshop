<?php
require_once __DIR__ . '/../config/db.php';

$userID = getParam('userID') ?: getParam('mobile');
$defaultOrderId = 'ORD_' . date('YmdHis') . '_' . rand(100, 999);

if (!$userID || !$pdo) {
    sendJson([['order_id' => $defaultOrderId, 'status' => 'NEW', 'total_amount' => 0]]);
}

try {
    $stmt = $pdo->prepare("SELECT order_id, status, total_amount, created_at FROM orders WHERE mobile = ? AND status = 'CART' ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([$userID]);
    $cartOrder = $stmt->fetch();

    if ($cartOrder) {
        sendJson([['order_id' => $cartOrder['order_id'], 'status' => 'CART', 'total_amount' => $cartOrder['total_amount']]]);
    } else {
        sendJson([['order_id' => $defaultOrderId, 'status' => 'NEW', 'total_amount' => 0]]);
    }
} catch (Exception $e) {
    sendJson([['order_id' => $defaultOrderId, 'status' => 'NEW', 'total_amount' => 0]]);
}
