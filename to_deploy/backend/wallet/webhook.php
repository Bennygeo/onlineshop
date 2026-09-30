<?php
require_once __DIR__ . '/../config/db.php';

$rawBody = file_get_contents('php://input');
$signature = isset($_SERVER['HTTP_X_RAZORPAY_SIGNATURE']) ? $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] : '';

$webhookSecret = defined('RAZORPAY_WEBHOOK_SECRET') ? RAZORPAY_WEBHOOK_SECRET : getenv('RAZORPAY_WEBHOOK_SECRET');

// Validate Webhook Signature if secret configured
if (!empty($webhookSecret)) {
    if (empty($signature)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing X-Razorpay-Signature header']);
        exit;
    }

    $expectedSignature = hash_hmac('sha256', $rawBody, $webhookSecret);
    if (!hash_equals($expectedSignature, $signature)) {
        if (class_exists('Logger')) {
            Logger::error("Razorpay webhook signature verification failed");
        }
        http_response_code(400);
        echo json_encode(['error' => 'Invalid webhook signature']);
        exit;
    }
}

$eventData = json_decode($rawBody, true);
if (!$eventData || !isset($eventData['event'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$event = $eventData['event'];
$payload = $eventData['payload'] ?? [];

if (class_exists('Logger')) {
    Logger::info("Razorpay Webhook received: " . $event, ['event' => $event]);
}

if ($pdo) {
    try {
        if ($event === 'payment.captured' || $event === 'order.paid') {
            $paymentEntity = $payload['payment']['entity'] ?? [];
            $orderEntity = $payload['order']['entity'] ?? [];

            $paymentId = $paymentEntity['id'] ?? null;
            $orderId = $paymentEntity['order_id'] ?? ($orderEntity['id'] ?? null);
            $amountPaise = $paymentEntity['amount'] ?? ($orderEntity['amount_paid'] ?? 0);
            $amountRupees = round((float)$amountPaise / 100);
            $mobile = $paymentEntity['contact'] ?? ($paymentEntity['notes']['mobile'] ?? null);

            // Strip +91 country code if present
            if ($mobile && str_starts_with($mobile, '+91')) {
                $mobile = substr($mobile, 3);
            }

            // Fallback mobile from order record
            if (empty($mobile) && $orderId) {
                $oStmt = $pdo->prepare("SELECT mobile FROM razorpay_orders WHERE order_id = ?");
                $oStmt->execute([$orderId]);
                $mobile = $oStmt->fetchColumn();
            }

            if (!$mobile) {
                $mobile = '9876543210';
            }

            // Idempotency check: check if payment already credited in wallets
            $checkStmt = $pdo->prepare("SELECT id FROM wallets WHERE description LIKE ? AND status = 'authorized' LIMIT 1");
            $checkStmt->execute(["%{$paymentId}%"]);
            $existing = $checkStmt->fetch();

            if (!$existing) {
                $pdo->beginTransaction();

                if ($orderId) {
                    $updStmt = $pdo->prepare("UPDATE razorpay_orders SET status = 'authorized', payment_id = ? WHERE order_id = ?");
                    $updStmt->execute([$paymentId, $orderId]);
                }

                $desc = "Added money via Razorpay ({$paymentId})";
                $wStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'authorized')");
                $wStmt->execute([$mobile, $amountRupees, $desc]);

                $pdo->commit();
            }
        } elseif ($event === 'payment.failed') {
            $paymentEntity = $payload['payment']['entity'] ?? [];
            $paymentId = $paymentEntity['id'] ?? null;
            $orderId = $paymentEntity['order_id'] ?? null;
            $mobile = $paymentEntity['contact'] ?? '9876543210';

            if ($orderId) {
                $updStmt = $pdo->prepare("UPDATE razorpay_orders SET status = 'failed', payment_id = ? WHERE order_id = ?");
                $updStmt->execute([$paymentId, $orderId]);
            }
        }
    } catch (Exception $e) {
        if ($pdo && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if (class_exists('Logger')) {
            Logger::error("Razorpay webhook processing error: " . $e->getMessage());
        }
    }
}

http_response_code(200);
echo json_encode(['status' => 'ok', 'event' => $event]);
exit;
