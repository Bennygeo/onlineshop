<?php
require_once __DIR__ . '/../config/db.php';

$customerID = getParam('customerID') ?: getParam('userID');
$status = getParam('status', 'CART');

if (!$pdo) {
    sendJson([]);
}

try {
    try {
        $stmt = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS id, oi.product_id AS productID, COALESCE(NULLIF(oi.product_name, ''), p.name, 'Product Item') AS name, COALESCE(p.img_url, 'assets/categories/Thinkspot_veggiesIcon.png') AS img_url, COALESCE(p.unit_name, '') AS unit_name, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi JOIN orders o ON oi.order_id = o.order_id LEFT JOIN products p ON oi.product_id = p.id WHERE o.mobile = ? AND o.status = ?");
        $stmt->execute([$customerID, $status]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $colEx) {
        $stmt = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS id, oi.product_id AS productID, COALESCE(p.name, 'Product Item') AS name, COALESCE(p.img_url, 'assets/categories/Thinkspot_veggiesIcon.png') AS img_url, COALESCE(p.unit_name, '') AS unit_name, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi JOIN orders o ON oi.order_id = o.order_id LEFT JOIN products p ON oi.product_id = p.id WHERE o.mobile = ? AND o.status = ?");
        $stmt->execute([$customerID, $status]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    sendJson($items ?: []);
} catch (Exception $e) {
    sendJson([]);
}
