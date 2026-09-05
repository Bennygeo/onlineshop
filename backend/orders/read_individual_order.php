<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$order_id = isset($details['order_id']) ? $details['order_id'] : getParam('order_id');

if (!$order_id) {
    sendJson(['error' => 'Order ID is required'], 400);
}

if (!$pdo) {
    sendJson(null);
}

try {
    $stmt = $pdo->prepare("SELECT order_id, mobile, address_json, total_amount, payment_type, status, delivery_date, created_at FROM orders WHERE order_id = ?");
    $stmt->execute([$order_id]);
    $order = $stmt->fetch();

    if ($order) {
        $stmtItems = $pdo->prepare("SELECT id, product_id, product_name, quantity, price FROM order_items WHERE order_id = ?");
        $stmtItems->execute([$order_id]);
        $order['items'] = $stmtItems->fetchAll();
        sendJson($order);
    } else {
        sendJson(null);
    }
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
