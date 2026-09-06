<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data') ?: (getParam('ids') ?: getParam('products'));
$ids = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;
$orderId = getParam('orderId');

if (empty($ids) || !is_array($ids)) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}

if (!$pdo) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}

try {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer FROM products WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    $products = $stmt->fetchAll();

    $cart = [];
    if ($orderId) {
        $stmtCart = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS productID, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi WHERE oi.order_id = ?");
        $stmtCart->execute([$orderId]);
        $cart = $stmtCart->fetchAll() ?: [];
    }

    sendJson([
        'live' => $products ?: [],
        'outOfStock' => [],
        'cart' => $cart
    ]);
} catch (Exception $e) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}


