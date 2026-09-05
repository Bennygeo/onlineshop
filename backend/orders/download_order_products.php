<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$order_id = isset($details['order_id']) ? $details['order_id'] : getParam('order_id');

if (!$order_id) {
    sendJson([]);
}

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->prepare("SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.price, p.img_url, p.unit_name, p.weight FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?");
    $stmt->execute([$order_id]);
    $items = $stmt->fetchAll();
    sendJson($items);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
