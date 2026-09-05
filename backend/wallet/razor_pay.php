<?php
require_once __DIR__ . '/../config/db.php';

$amountPaise = getParam('amount', 10000); // Default to 10000 paise (₹100) if not sent
$currency = getParam('currency', 'INR');
$receipt = getParam('reciept') ?: getParam('receipt', 'Receipt#' . rand(1000, 9999));
$mobile = getParam('mobile') ?: getParam('user_id') ?: '7200015551';

// Read Razorpay API keys if defined
$razorpayKeyId = defined('RAZORPAY_KEY_ID') ? RAZORPAY_KEY_ID : getenv('RAZORPAY_KEY_ID');
$razorpayKeySecret = defined('RAZORPAY_KEY_SECRET') ? RAZORPAY_KEY_SECRET : getenv('RAZORPAY_KEY_SECRET');

$orderId = null;
$isMock = true;

if ($razorpayKeyId && $razorpayKeySecret) {
    // Attempt real Razorpay order creation via API
    $ch = curl_init('https://api.razorpay.com/v1/orders');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, $razorpayKeyId . ':' . $razorpayKeySecret);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'amount' => (int)$amountPaise,
        'currency' => $currency,
        'receipt' => $receipt,
        'payment_capture' => 1
    ]));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $resData = json_decode($response, true);
        if (isset($resData['id'])) {
            $orderId = $resData['id'];
            $isMock = false;
        }
    }
}

if (!$orderId) {
    // Generate mock Razorpay Order ID for test / demo mode
    $orderId = 'order_' . substr(md5(uniqid(rand(), true)), 0, 14);
}

$amountRupees = (float)$amountPaise / 100;

if ($pdo) {
    try {
        $stmt = $pdo->prepare("INSERT INTO razorpay_orders (order_id, mobile, amount, currency, status) VALUES (?, ?, ?, ?, 'created')");
        $stmt->execute([$orderId, $mobile, $amountRupees, $currency]);
    } catch (Exception $e) {
        // Continue even if logging fails
    }
}

$testKey = $razorpayKeyId ?: 'rzp_test_1DP5mmOlF5G5ag';

sendJson([
    'key' => $testKey,
    'order_id' => $orderId,
    'amount' => (int)$amountPaise,
    'currency' => $currency,
    'status' => 'created',
    'is_mock' => $isMock
]);

