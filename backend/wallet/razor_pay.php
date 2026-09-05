<?php
require_once __DIR__ . '/../config/db.php';

$amountPaise = getParam('amount', 10000); // Default to 10000 paise (₹100) if not sent
$currency = getParam('currency', 'INR');
$receipt = getParam('reciept') ?: getParam('receipt', 'Receipt#' . rand(1000, 9999));
$mobile = getParam('mobile') ?: getParam('user_id') ?: '7200015551';

// Generate mock Razorpay Order ID for test mode
$orderId = 'order_' . substr(md5(uniqid(rand(), true)), 0, 14);
$amountRupees = (float)$amountPaise / 100;

if ($pdo) {
    try {
        $stmt = $pdo->prepare("INSERT INTO razorpay_orders (order_id, mobile, amount, currency, status) VALUES (?, ?, ?, ?, 'created')");
        $stmt->execute([$orderId, $mobile, $amountRupees, $currency]);
    } catch (Exception $e) {
        // Continue even if logging fails
    }
}

// Razorpay Test Mode Key (Standard Demo Key)
$testKey = 'rzp_test_1DP5mmOlF5G5ag';

sendJson([
    'key' => $testKey,
    'order_id' => $orderId,
    'amount' => (int)$amountPaise,
    'currency' => $currency,
    'status' => 'created'
]);
