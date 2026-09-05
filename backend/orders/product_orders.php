<?php
require_once __DIR__ . '/../config/db.php';

$targetProduct = getParam('targetProduct');
$data = is_string($targetProduct) ? json_decode($targetProduct, true) : $targetProduct;

if (!$data || !$pdo) {
    sendJson('SUCCESS');
}

try {
    $orderID = isset($data['orderID']) ? $data['orderID'] : '';
    $productID = isset($data['productID']) ? $data['productID'] : '';
    $quantity = isset($data['quantity']) ? $data['quantity'] : 1;
    $price = isset($data['price']) ? $data['price'] : 0;
    $weight = isset($data['weight']) ? (string)$data['weight'] : '';
    $rangeDates = isset($data['rangeDates']) ? (is_string($data['rangeDates']) ? $data['rangeDates'] : json_encode($data['rangeDates'])) : '[]';
    $subscribedDates = isset($data['subscribedDates']) ? (is_string($data['subscribedDates']) ? $data['subscribedDates'] : json_encode($data['subscribedDates'])) : '[]';
    $subscriptionType = isset($data['subscriptionType']) ? $data['subscriptionType'] : 'none';
    $subsStatus = isset($data['subsStatus']) ? $data['subsStatus'] : 'active';
    $pausedDates = isset($data['pausedDates']) ? (is_string($data['pausedDates']) ? $data['pausedDates'] : json_encode($data['pausedDates'])) : '[]';

    if ($orderID && $productID) {
        $stmtDel = $pdo->prepare("DELETE FROM order_items WHERE order_id = ? AND product_id = ?");
        $stmtDel->execute([$orderID, $productID]);

        if ($quantity > 0) {
            $stmtIns = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price, weight, rangeDates, subscribedDates, subscriptionType, subsStatus, pausedDates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtIns->execute([$orderID, $productID, $quantity, $price, $weight, $rangeDates, $subscribedDates, $subscriptionType, $subsStatus, $pausedDates]);
        }
    }

    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}

