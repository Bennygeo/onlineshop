<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details') ?: getParam('data') ?: getParam('item');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;

$order_id = isset($details['order_id']) ? trim($details['order_id']) : trim(getParam('order_id') ?: '');
$product_id = isset($details['product_id']) ? trim($details['product_id']) : (isset($details['productID']) ? trim($details['productID']) : trim(getParam('product_id') ?: ''));
$order_item_id = isset($details['order_item_id']) ? trim($details['order_item_id']) : (isset($details['orderItemId']) ? trim($details['orderItemId']) : '');
$item_id = isset($details['id']) ? trim($details['id']) : trim(getParam('id') ?: '');
$product_name = isset($details['product_name']) ? trim($details['product_name']) : (isset($details['name']) ? trim($details['name']) : '');

if (!$order_id || (!$product_id && !$item_id && !$order_item_id && !$product_name)) {
    sendJson(['error' => 'Order ID and Product/Item ID are required'], 400);
}

if (!$pdo) {
    sendJson(['status' => 'SUCCESS']);
}

try {
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00");
        $pdo->exec("ALTER TABLE orders ADD COLUMN refund_notes TEXT DEFAULT NULL");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN item_status VARCHAR(50) DEFAULT 'active'");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00");
    } catch (Exception $colEx) {}

    // Fetch order
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE order_id = ?");
    $stmt->execute([$order_id]);
    $order = $stmt->fetch();

    if (!$order) {
        sendJson(['error' => 'Order not found'], 404);
    }

    if ($order['status'] === 'CANCELLED') {
        sendJson(['error' => 'Order is already cancelled'], 400);
    }

    // Robust item lookup cascade
    $targetItem = null;

    // 1. Check by explicit order_item_id
    if (!empty($order_item_id)) {
        $stmtItem = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ? AND id = ? LIMIT 1");
        $stmtItem->execute([$order_id, $order_item_id]);
        $targetItem = $stmtItem->fetch();
    }

    // 2. Check if item_id matches order_items.id
    if (!$targetItem && !empty($item_id)) {
        $stmtItem = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ? AND id = ? LIMIT 1");
        $stmtItem->execute([$order_id, $item_id]);
        $targetItem = $stmtItem->fetch();
    }

    // 3. Check by product_id
    if (!$targetItem && !empty($product_id)) {
        $stmtItem = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ? AND (product_id = ? OR id = ?) LIMIT 1");
        $stmtItem->execute([$order_id, $product_id, $product_id]);
        $targetItem = $stmtItem->fetch();
    }

    // 4. In case item_id is the product_id
    if (!$targetItem && !empty($item_id)) {
        $stmtItem = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1");
        $stmtItem->execute([$order_id, $item_id]);
        $targetItem = $stmtItem->fetch();
    }

    // 5. Match by product_name
    if (!$targetItem && !empty($product_name)) {
        $stmtItem = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ? AND product_name = ? LIMIT 1");
        $stmtItem->execute([$order_id, $product_name]);
        $targetItem = $stmtItem->fetch();
    }

    if (!$targetItem) {
        sendJson(['error' => 'Item not found in this order'], 404);
    }

    if (($targetItem['item_status'] ?? '') === 'cancelled') {
        sendJson(['status' => 'SUCCESS', 'message' => 'Item already cancelled', 'refund_amount' => 0]);
    }

    $pdo->beginTransaction();

    $mobile = $order['mobile'];
    $payment_type = $order['payment_type'] ?? 'Wallet';
    $isCOD = (strcasecmp($payment_type, 'COD') === 0 || stripos($payment_type, 'cash') !== false);
    $item_price = round(floatval($targetItem['price']));
    $prod_name = $targetItem['product_name'] ?: 'Item';

    $actual_refund = 0;
    // Refund to wallet only for Prepaid / Wallet orders (NOT COD)
    if (!$isCOD && $item_price > 0 && !empty($mobile)) {
        $walletStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'placed')");
        $walletStmt->execute([
            $mobile,
            $item_price,
            "Refund for cancelled item ({$prod_name}) in order #{$order_id}"
        ]);
        $actual_refund = $item_price;
    }

    // Mark item as cancelled
    $updItem = $pdo->prepare("UPDATE order_items SET item_status = 'cancelled', subsStatus = 'cancelled', refund_amount = ? WHERE id = ?");
    $updItem->execute([$actual_refund, $targetItem['id']]);

    // Check remaining active items in this order
    $stmtActive = $pdo->prepare("SELECT COUNT(*) as active_cnt, COALESCE(SUM(price), 0) as active_tot FROM order_items WHERE order_id = ? AND (item_status IS NULL OR item_status != 'cancelled')");
    $stmtActive->execute([$order_id]);
    $activeInfo = $stmtActive->fetch();

    $activeCount = (int)($activeInfo['active_cnt'] ?? 0);
    $activeTotal = round(floatval($activeInfo['active_tot'] ?? 0));

    $newOrderStatus = $order['status'];
    if ($activeCount === 0) {
        $newOrderStatus = 'CANCELLED';
    }

    // Update order total and accumulated refund amount
    $newOrderTotal = max(0, $activeTotal);
    $newRefundTotal = round(floatval($order['refund_amount'] ?? 0) + $actual_refund);
    $refundNotes = "Cancelled item {$prod_name}";

    $updOrder = $pdo->prepare("UPDATE orders SET total_amount = ?, refund_amount = ?, refund_notes = ?, status = ? WHERE order_id = ?");
    $updOrder->execute([$newOrderTotal, $newRefundTotal, $refundNotes, $newOrderStatus, $order_id]);

    $pdo->commit();

    // Get updated wallet balance
    $newWalletBal = 0;
    if (!empty($mobile)) {
        $stmtBal = $pdo->prepare("SELECT amount, type, status FROM wallets WHERE mobile = ?");
        $stmtBal->execute([$mobile]);
        $walletRows = $stmtBal->fetchAll();
        foreach ($walletRows as $wRow) {
            $wAmt = round((float)$wRow['amount']);
            $wType = strtoupper($wRow['type']);
            $wStatus = strtolower($wRow['status'] ?: 'authorized');
            if ($wStatus === 'authorized' || $wStatus === 'captured' || $wStatus === 'placed' || $wStatus === 'success') {
                if ($wType === 'DEBIT') $newWalletBal -= $wAmt;
                else $newWalletBal += $wAmt;
            }
        }
        $newWalletBal = max(0, round($newWalletBal));
    }

    sendJson([
        'status' => 'SUCCESS',
        'order_id' => $order_id,
        'item_id' => $targetItem['id'],
        'product_id' => $targetItem['product_id'],
        'payment_type' => $payment_type,
        'is_cod' => $isCOD,
        'item_price' => $item_price,
        'refund_amount' => $actual_refund,
        'new_order_total' => $newOrderTotal,
        'order_status' => $newOrderStatus,
        'active_items_count' => $activeCount,
        'wallet_balance' => $newWalletBal,
        'message' => $isCOD
            ? "{$prod_name} cancelled. Order total payable on delivery updated to ₹" . number_format($newOrderTotal, 0) . "."
            : "{$prod_name} cancelled. ₹" . number_format($actual_refund, 0) . " refunded to your wallet."
    ]);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(['error' => $e->getMessage()], 500);
}
