<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$order_id = isset($details['order_id']) ? $details['order_id'] : getParam('order_id');

if (!$order_id) {
    sendJson(['error' => 'Order ID is required'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("UPDATE orders SET status = 'CANCELLED' WHERE order_id = ?");
    $stmt->execute([$order_id]);
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
