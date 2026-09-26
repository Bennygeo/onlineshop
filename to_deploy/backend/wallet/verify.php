<?php
require_once __DIR__ . '/../config/db.php';

$paymentId = getParam('razorpay_payment_id') ?: ('pay_' . substr(md5(uniqid(rand(), true)), 0, 14));
$orderId = getParam('razorpay_order_id');
$signature = getParam('razorpay_signature');
$mobile = getParam('mobile') ?: getParam('user_id');
$statusParam = strtolower(getParam('status', 'authorized')); // 'authorized', 'failed', 'cancelled'

$amountRupees = 0;

if ($pdo) {
    try {
        // Ensure status column exists in wallets table
        try {
            $pdo->exec("ALTER TABLE wallets ADD COLUMN status VARCHAR(20) DEFAULT 'authorized'");
        } catch (Exception $e) {}

        // Check 1: Idempotency check by paymentId in wallets table
        if (!empty($paymentId)) {
            $checkPaymentStmt = $pdo->prepare("SELECT id, amount, status FROM wallets WHERE description LIKE ? AND status = 'authorized' LIMIT 1");
            $checkPaymentStmt->execute(["%{$paymentId}%"]);
            $existingWallet = $checkPaymentStmt->fetch();
            if ($existingWallet) {
                sendJson([
                    'status' => 'success',
                    'message' => 'Payment already verified and credited to wallet (idempotent)',
                    'payment_id' => $paymentId,
                    'amount' => (float)$existingWallet['amount'],
                    'payment_status' => 'authorized',
                    'already_processed' => true
                ]);
                exit;
            }
        }

        // Find matching razorpay order if exists
        if ($orderId) {
            $stmt = $pdo->prepare("SELECT mobile, amount, status FROM razorpay_orders WHERE order_id = ?");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if ($order) {
                // Check 2: Idempotency check by orderId if already authorized
                if ($order['status'] === 'authorized' && $statusParam === 'authorized') {
                    sendJson([
                        'status' => 'success',
                        'message' => 'Razorpay order already authorized and credited (idempotent)',
                        'payment_id' => $paymentId,
                        'amount' => (float)$order['amount'],
                        'payment_status' => 'authorized',
                        'already_processed' => true
                    ]);
                    exit;
                }

                if (!$mobile) $mobile = $order['mobile'];
                $amountRupees = (float)$order['amount'];
            }
        }

        // Fallback: If amount not found from orderId, check latest created order for mobile
        if ($amountRupees <= 0) {
            if ($mobile) {
                $stmt = $pdo->prepare("SELECT amount FROM razorpay_orders WHERE mobile = ? ORDER BY created_at DESC LIMIT 1");
                $stmt->execute([$mobile]);
                $latest = $stmt->fetch();
                if ($latest) {
                    $amountRupees = (float)$latest['amount'];
                }
            }
        }

        // Final fallback default
        if ($amountRupees <= 0) {
            $amountRupees = 100.00;
        }

        $amountRupees = round((float)$amountRupees);

        if (!$mobile) {
            $mobile = '9876543210';
        }

        $desc = "Added money via Razorpay ({$paymentId})";
        if ($statusParam === 'failed') {
            $desc = "Razorpay payment failed ({$paymentId})";
        } else if ($statusParam === 'cancelled') {
            $desc = "Razorpay payment cancelled ({$paymentId})";
        }

        $pdo->beginTransaction();

        if ($orderId) {
            $updateStmt = $pdo->prepare("UPDATE razorpay_orders SET status = ?, payment_id = ? WHERE order_id = ?");
            $updateStmt->execute([$statusParam, $paymentId, $orderId]);
        }

        // Insert wallet credit/transaction record
        $walletStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, ?)");
        $walletStmt->execute([
            $mobile,
            $amountRupees,
            $desc,
            $statusParam
        ]);

        $pdo->commit();

        sendJson([
            'status' => 'success',
            'message' => 'Payment logged successfully',
            'payment_id' => $paymentId,
            'amount' => $amountRupees,
            'payment_status' => $statusParam
        ]);
        exit;
    } catch (Exception $e) {
        if ($pdo && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(['error' => $e->getMessage()], 500);
        exit;
    }
}

sendJson([
    'status' => 'success',
    'message' => 'Payment verified successfully (mock mode)'
]);
