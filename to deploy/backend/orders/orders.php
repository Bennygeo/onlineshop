<?php
require_once __DIR__ . '/../config/db.php';

$ordersDetails = getParam('ordersDetails');
$details = is_string($ordersDetails) ? json_decode($ordersDetails, true) : $ordersDetails;

if (!$details || !$pdo) {
    sendJson('SUCCESS');
}

try {
    $orderID = isset($details['orderID']) ? $details['orderID'] : (isset($details['order_id']) ? $details['order_id'] : '');
    $mobile = isset($details['mobile']) ? $details['mobile'] : '';
    $orderTotal = isset($details['orderTotal']) ? (float)$details['orderTotal'] : (isset($details['total_amount']) ? (float)$details['total_amount'] : 0);
    $status = isset($details['status']) ? $details['status'] : 'CART';

    if ($orderID && $mobile) {
        $stmtCheck = $pdo->prepare("SELECT order_id FROM orders WHERE order_id = ?");
        $stmtCheck->execute([$orderID]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $stmtUpd = $pdo->prepare("UPDATE orders SET total_amount = ? WHERE order_id = ? AND status = 'CART'");
            $stmtUpd->execute([$orderTotal, $orderID]);
        } else {
            $stmtIns = $pdo->prepare("INSERT INTO orders (order_id, mobile, total_amount, status) VALUES (?, ?, ?, ?)");
            $stmtIns->execute([$orderID, $mobile, $orderTotal, $status]);
        }
    }

    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}

