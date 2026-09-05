<?php
require_once __DIR__ . '/../config/db.php';

$customerID = getParam('customerID') ?: getParam('userID');
$status = getParam('status', 'CART');

if (!$pdo) {
    sendJson([]);
}

try {
    // If order_items table or cart table has cart items
    $stmt = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS productID, oi.quantity, oi.price, 'CART' AS status FROM order_items oi JOIN orders o ON oi.order_id = o.order_id WHERE o.mobile = ? AND o.status = ?");
    $stmt->execute([$customerID, $status]);
    $items = $stmt->fetchAll();

    sendJson($items ?: []);
} catch (Exception $e) {
    sendJson([]);
}
