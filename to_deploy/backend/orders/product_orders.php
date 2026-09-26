<?php
require_once __DIR__ . '/../config/db.php';

$targetProduct = getParam('targetProduct');
$data = is_string($targetProduct) ? json_decode($targetProduct, true) : $targetProduct;

if (!$data || !$pdo) {
    sendJson('SUCCESS');
}

try {
    $orderID = isset($data['orderID']) ? $data['orderID'] : '';
    $productID = isset($data['productID']) ? (string)$data['productID'] : '';
    $mobile = isset($data['mobile']) ? (string)$data['mobile'] : (isset($data['customerID']) ? (string)$data['customerID'] : '');
    $quantity = isset($data['quantity']) ? (int)$data['quantity'] : 1;
    $price = isset($data['price']) ? (float)$data['price'] : 0;
    $weight = isset($data['weight']) ? (string)$data['weight'] : '';
    $rangeDates = isset($data['rangeDates']) ? (is_string($data['rangeDates']) ? $data['rangeDates'] : json_encode($data['rangeDates'])) : '[]';
    $subscribedDates = isset($data['subscribedDates']) ? (is_string($data['subscribedDates']) ? $data['subscribedDates'] : json_encode($data['subscribedDates'])) : '[]';
    $subscriptionType = isset($data['subscriptionType']) ? $data['subscriptionType'] : 'none';
    $subsStatus = isset($data['subsStatus']) ? $data['subsStatus'] : 'active';
    $pausedDates = isset($data['pausedDates']) ? (is_string($data['pausedDates']) ? $data['pausedDates'] : json_encode($data['pausedDates'])) : '[]';

    if ($productID !== '') {
        if ($orderID) {
            // Check order status before modifying items
            $stmtStatus = $pdo->prepare("SELECT status FROM orders WHERE order_id = ?");
            $stmtStatus->execute([$orderID]);
            $order = $stmtStatus->fetch();

            if ($order && strtoupper($order['status']) !== 'CART') {
                sendJson(['status' => 'BLOCKED_ORDER_ALREADY_PLACED']);
            }

            $stmtDel = $pdo->prepare("DELETE FROM order_items WHERE order_id = ? AND (product_id = ? OR id = ?)");
            $stmtDel->execute([$orderID, $productID, $productID]);
        }

        // If quantity <= 0 (deletion), also clean up any matching order_items for this user in CART status orders
        if ($quantity <= 0 && $mobile !== '') {
            try {
                $stmtDelUser = $pdo->prepare("DELETE oi FROM order_items oi JOIN orders o ON oi.order_id = o.order_id WHERE o.mobile = ? AND o.status = 'CART' AND (oi.product_id = ? OR oi.id = ?)");
                $stmtDelUser->execute([$mobile, $productID, $productID]);
            } catch (Exception $eDelUser) {}
        }

        if ($quantity > 0 && $orderID) {
            $stmtIns = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price, weight, rangeDates, subscribedDates, subscriptionType, subsStatus, pausedDates) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmtIns->execute([$orderID, $productID, $quantity, $price, $weight, $rangeDates, $subscribedDates, $subscriptionType, $subsStatus, $pausedDates]);
        }

        // Update total_amount in orders table
        if ($orderID) {
            try {
                $stmtTot = $pdo->prepare("SELECT COALESCE(SUM(quantity * price), 0) AS new_total FROM order_items WHERE order_id = ?");
                $stmtTot->execute([$orderID]);
                $rowTot = $stmtTot->fetch();
                $newTotal = (float)($rowTot['new_total'] ?? 0);
                $stmtUpd = $pdo->prepare("UPDATE orders SET total_amount = ? WHERE order_id = ? AND status = 'CART'");
                $stmtUpd->execute([$newTotal, $orderID]);
            } catch (Exception $eTot) {}
        }
    }

    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}

