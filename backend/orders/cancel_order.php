<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details') ?: getParam('data') ?: getParam('order');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$order_id = isset($details['order_id']) ? $details['order_id'] : (isset($details['id']) ? $details['id'] : getParam('order_id'));

if (!$order_id) {
    sendJson(['error' => 'Order ID is required'], 400);
}

if (!$pdo) {
    sendJson(['status' => 'SUCCESS']);
}

try {
    // Ensure refund columns exist
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
        sendJson(['status' => 'SUCCESS', 'message' => 'Order already cancelled', 'refund_amount' => 0]);
    }

    $pdo->beginTransaction();

    $mobile = $order['mobile'];
    $payment_type = $order['payment_type'] ?? 'Wallet';
    $isCOD = (strcasecmp($payment_type, 'COD') === 0 || stripos($payment_type, 'cash') !== false);
    $total_amount = floatval($order['total_amount']);
    $prev_refund = floatval($order['refund_amount'] ?? 0);
    $refund_due = max(0, $total_amount - $prev_refund);

    $actual_refund = 0;
    // Refund to wallet only for Prepaid / Wallet orders (NOT COD)
    if (!$isCOD && $refund_due > 0 && !empty($mobile)) {
        $walletStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'placed')");
        $walletStmt->execute([
            $mobile,
            round($refund_due),
            "Refund for cancelled order #{$order_id}"
        ]);
        $actual_refund = round($refund_due);
    }

    // Update order status and refund info
    $updStmt = $pdo->prepare("UPDATE orders SET status = 'CANCELLED', refund_amount = ?, refund_notes = ? WHERE order_id = ?");
    $updStmt->execute([
        $total_amount,
        $isCOD ? 'Cancelled (COD - No refund)' : 'Cancelled full refund to wallet',
        $order_id
    ]);

    // Mark all order_items as cancelled
    $updItems = $pdo->prepare("UPDATE order_items SET item_status = 'cancelled', subsStatus = 'cancelled' WHERE order_id = ?");
    $updItems->execute([$order_id]);

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
        'payment_type' => $payment_type,
        'is_cod' => $isCOD,
        'refund_amount' => $actual_refund,
        'wallet_balance' => $newWalletBal,
        'message' => $isCOD
            ? "Order #{$order_id} cancelled. Since this was Cash on Delivery, no refund was required."
            : "Order #{$order_id} cancelled. ₹" . number_format($actual_refund, 0) . " has been refunded to your wallet."
    ]);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(['error' => $e->getMessage()], 500);
}
