<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$mobile = isset($details['mobile']) ? $details['mobile'] : getParam('mobile');

if (!$mobile) {
    sendJson([]);
}

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->prepare("SELECT order_id, mobile, address_json, total_amount, payment_type, status, delivery_date, created_at FROM orders WHERE mobile = ? ORDER BY created_at DESC");
    $stmt->execute([$mobile]);
    $orders = $stmt->fetchAll();
    sendJson($orders);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
