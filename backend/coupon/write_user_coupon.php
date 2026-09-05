<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;
$mobile = isset($data['mobile']) ? $data['mobile'] : getParam('mobile');
$coupon_code = isset($data['coupon_code']) ? $data['coupon_code'] : getParam('coupon_code');

if (!$mobile || !$coupon_code) {
    sendJson(['error' => 'Mobile and coupon code are required'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("INSERT INTO user_coupons (mobile, coupon_code) VALUES (?, ?)");
    $stmt->execute([$mobile, $coupon_code]);
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
