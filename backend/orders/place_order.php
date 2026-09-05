<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details') ?: getParam('ordersDetails');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;

if (!$details) {
    sendJson(['error' => 'Order details are required'], 400);
}

$mobile = isset($details['mobile']) ? $details['mobile'] : (isset($details['user_id']) ? $details['user_id'] : '');
$total_amount = isset($details['total_amount']) ? (float)$details['total_amount'] : (isset($details['amount']) ? (float)$details['amount'] : 0);
$payment_type = isset($details['payment_type']) ? $details['payment_type'] : 'Wallet';
$address_json = isset($details['address']) ? (is_string($details['address']) ? $details['address'] : json_encode($details['address'])) : '';
$order_id = isset($details['order_id']) && !empty($details['order_id']) ? $details['order_id'] : ('ORD_' . date('YmdHis') . '_' . rand(100, 999));
$delivery_date_raw = isset($details['delivery_date']) ? $details['delivery_date'] : '';
$delivery_date_timestamp = strtotime($delivery_date_raw);
if ($delivery_date_raw && $delivery_date_timestamp && $delivery_date_timestamp > 0) {
    $delivery_date = date('Y-m-d', $delivery_date_timestamp);
} else {
    $delivery_date = date('Y-m-d', strtotime('+1 day'));
}
$items = isset($details['items']) ? $details['items'] : (isset($details['products']) ? $details['products'] : []);

if (!$pdo) {
    sendJson(['status' => 'SUCCESS', 'order_id' => $order_id]);
}

// Ensure subscription & delivery columns exist in orders and order_items table BEFORE starting transaction
try {
    $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_inst TEXT");
    $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_mode VARCHAR(100) DEFAULT ''");
    $pdo->exec("ALTER TABLE order_items ADD COLUMN subscriptionType VARCHAR(50) DEFAULT 'none'");
    $pdo->exec("ALTER TABLE order_items ADD COLUMN rangeDates TEXT");
    $pdo->exec("ALTER TABLE order_items ADD COLUMN subscribedDates TEXT");
    $pdo->exec("ALTER TABLE order_items ADD COLUMN subsStatus VARCHAR(50) DEFAULT 'active'");
    $pdo->exec("ALTER TABLE order_items ADD COLUMN pausedDates TEXT");
    $pdo->exec("ALTER TABLE order_items ADD COLUMN startDate VARCHAR(50) DEFAULT ''");
    $pdo->exec("ALTER TABLE order_items ADD COLUMN endDate VARCHAR(50) DEFAULT ''");
} catch (Exception $e) {}

try {
    $pdo->beginTransaction();

    $delivery_inst = isset($details['delivery_inst']) ? $details['delivery_inst'] : (isset($details['instructions']) ? $details['instructions'] : '');
    $delivery_mode = isset($details['delivery_mode']) ? (string)$details['delivery_mode'] : '0';

    // Check if order exists and is in CART status. If it's already PLACED, generate a fresh unique order_id!
    $stmtCheck = $pdo->prepare("SELECT order_id, status FROM orders WHERE order_id = ?");
    $stmtCheck->execute([$order_id]);
    $existing = $stmtCheck->fetch();

    if ($existing && $existing['status'] === 'CART') {
        $stmtUpd = $pdo->prepare("UPDATE orders SET mobile = ?, address_json = ?, total_amount = ?, payment_type = ?, status = 'PLACED', delivery_date = ?, delivery_inst = ?, delivery_mode = ? WHERE order_id = ?");
        $stmtUpd->execute([$mobile, $address_json, $total_amount, $payment_type, $delivery_date, $delivery_inst, $delivery_mode, $order_id]);
    } else {
        if ($existing && $existing['status'] !== 'CART') {
            $order_id = 'ORD_' . date('YmdHis') . '_' . rand(100, 999);
        }
        $stmtIns = $pdo->prepare("INSERT INTO orders (order_id, mobile, address_json, total_amount, payment_type, status, delivery_date, delivery_inst, delivery_mode) VALUES (?, ?, ?, ?, ?, 'PLACED', ?, ?, ?)");
        $stmtIns->execute([$order_id, $mobile, $address_json, $total_amount, $payment_type, $delivery_date, $delivery_inst, $delivery_mode]);
    }

    if (!empty($items) && is_array($items)) {
        // Delete any existing items for this order_id to avoid duplicate lines
        $delItems = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
        $delItems->execute([$order_id]);

        $calculatedOrderTotal = 0;

        $stmtItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, price, weight, subscriptionType, rangeDates, subscribedDates, subsStatus, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($items as $item) {
            $prod_id = isset($item['id']) ? $item['id'] : (isset($item['product_id']) ? $item['product_id'] : '');
            $prod_name = isset($item['name']) ? $item['name'] : (isset($item['product_name']) ? $item['product_name'] : '');
            $qty = isset($item['qty']) ? (int)$item['qty'] : (isset($item['quantity']) ? (int)$item['quantity'] : (isset($item['units']) ? (int)$item['units'] : 1));
            $weight = isset($item['weight']) ? $item['weight'] : '';
            $subType = isset($item['subscriptionType']) ? $item['subscriptionType'] : 'none';
            $rangeDates = isset($item['rangeDates']) ? (is_string($item['rangeDates']) ? $item['rangeDates'] : json_encode($item['rangeDates'])) : '[]';
            $subsDates = isset($item['subscribedDates']) ? (is_string($item['subscribedDates']) ? $item['subscribedDates'] : json_encode($item['subscribedDates'])) : '[]';
            $subsStatus = isset($item['subsStatus']) ? $item['subsStatus'] : 'active';
            $startDate = isset($item['startDate']) ? $item['startDate'] : '';
            $endDate = isset($item['endDate']) ? $item['endDate'] : '';

            $daysCount = 1;
            if ($rangeDates && $rangeDates !== '[]') {
                $r = json_decode($rangeDates, true);
                if (is_array($r) && count($r) > 0) $daysCount = count($r);
            } elseif ($subsDates && $subsDates !== '[]') {
                $s = json_decode($subsDates, true);
                if (is_array($s) && count($s) > 0) $daysCount = count($s);
            }

            $price = isset($item['price']) ? (float)$item['price'] : 0;
            if (isset($item['unit_price']) && (float)$item['unit_price'] > 0 && $price == (float)$item['unit_price']) {
                $price = (float)$item['unit_price'] * $qty * $daysCount;
            }

            $calculatedOrderTotal += $price;

            if ($prod_id) {
                $stmtItem->execute([$order_id, $prod_id, $prod_name, $qty, $price, $weight, $subType, $rangeDates, $subsDates, $subsStatus, $startDate, $endDate]);
            }
        }

        if ($calculatedOrderTotal > 0) {
            $total_amount = $calculatedOrderTotal;
            $updTotal = $pdo->prepare("UPDATE orders SET total_amount = ? WHERE order_id = ?");
            $updTotal->execute([$calculatedOrderTotal, $order_id]);
        }
    }

    // Insert wallet debit transaction
    if ($mobile && $total_amount > 0) {
        $walletStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'DEBIT', ?, 'placed')");
        $walletStmt->execute([
            $mobile,
            $total_amount,
            "Order #{$order_id} placed"
        ]);
    }

    $pdo->commit();
    sendJson(['status' => 'SUCCESS', 'order_id' => $order_id, 'amount' => $total_amount]);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(['error' => $e->getMessage()], 500);
}
