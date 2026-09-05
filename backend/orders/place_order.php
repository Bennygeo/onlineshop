<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details') ?: getParam('ordersDetails');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;

if (!$details) {
    sendJson(['error' => 'Order details are required'], 400);
}

$mobile = isset($details['mobile']) ? $details['mobile'] : (isset($details['user_id']) ? $details['user_id'] : '');
$total_amount = isset($details['total_amount']) ? $details['total_amount'] : (isset($details['amount']) ? $details['amount'] : 0);
$payment_type = isset($details['payment_type']) ? $details['payment_type'] : 'COD';
$address_json = isset($details['address']) ? (is_string($details['address']) ? $details['address'] : json_encode($details['address'])) : '';
$items = isset($details['items']) ? $details['items'] : (isset($details['products']) ? $details['products'] : []);

$order_id = 'ORD_' . date('YmdHis') . '_' . rand(100, 999);

if (!$pdo) {
    sendJson(['status' => 'SUCCESS', 'order_id' => $order_id]);
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("INSERT INTO orders (order_id, mobile, address_json, total_amount, payment_type, status) VALUES (?, ?, ?, ?, ?, 'PLACED')");
    $stmt->execute([$order_id, $mobile, $address_json, $total_amount, $payment_type]);

    if (!empty($items) && is_array($items)) {
        $stmtItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)");
        foreach ($items as $item) {
            $prod_id = isset($item['id']) ? $item['id'] : (isset($item['product_id']) ? $item['product_id'] : '');
            $prod_name = isset($item['name']) ? $item['name'] : '';
            $qty = isset($item['qty']) ? $item['qty'] : (isset($item['quantity']) ? $item['quantity'] : 1);
            $price = isset($item['price']) ? $item['price'] : 0;
            $stmtItem->execute([$order_id, $prod_id, $prod_name, $qty, $price]);
        }
    }

    $pdo->commit();
    sendJson(['status' => 'SUCCESS', 'order_id' => $order_id]);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(['error' => $e->getMessage()], 500);
}
