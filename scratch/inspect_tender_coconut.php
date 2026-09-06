<?php
require_once __DIR__ . '/../backend/config/db.php';

if (!$pdo) {
    echo "DB Connection failed\n";
    exit;
}

$stmt = $pdo->query("SELECT oi.*, o.mobile, o.status as order_status FROM order_items oi JOIN orders o ON oi.order_id = o.order_id WHERE oi.product_id LIKE '%tender_coconut%' OR oi.product_name LIKE '%coconut%'");
$items = $stmt->fetchAll();

echo "Found " . count($items) . " coconut items:\n\n";

foreach ($items as $item) {
    echo "ID: {$item['id']}\n";
    echo "OrderID: {$item['order_id']}\n";
    echo "Mobile: {$item['mobile']}\n";
    echo "OrderStatus: {$item['order_status']}\n";
    echo "ProductID: {$item['product_id']}\n";
    echo "DB Quantity: {$item['quantity']}\n";
    echo "Type: {$item['subscriptionType']}\n";
    echo "SubsStatus: {$item['subsStatus']}\n";
    echo "rangeDates: {$item['rangeDates']}\n";
    echo "subscribedDates: {$item['subscribedDates']}\n";
    echo "pausedDates: {$item['pausedDates']}\n";
    echo "---------------------------------------------------------\n";
}
