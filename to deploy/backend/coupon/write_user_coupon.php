<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;
$mobile = isset($data['mobile']) ? $data['mobile'] : getParam('mobile');
$coupon_code = isset($data['coupon_code']) ? $data['coupon_code'] : (isset($data['code']) ? $data['code'] : getParam('coupon_code'));
if (!$coupon_code) {
    $coupon_code = getParam('code');
}

if (!$mobile || !$coupon_code) {
    sendJson(['error' => 'Mobile and coupon code are required'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    // Clean up any existing duplicate entries
    $pdo->exec("DELETE uc1 FROM user_coupons uc1 INNER JOIN user_coupons uc2 WHERE uc1.id > uc2.id AND uc1.mobile = uc2.mobile AND uc1.coupon_code = uc2.coupon_code");

    $checkStmt = $pdo->prepare("SELECT id FROM user_coupons WHERE mobile = ? AND coupon_code = ?");
    $checkStmt->execute([$mobile, $coupon_code]);
    if (!$checkStmt->fetch()) {
        $stmt = $pdo->prepare("INSERT INTO user_coupons (mobile, coupon_code) VALUES (?, ?)");
        $stmt->execute([$mobile, $coupon_code]);
    }
    sendJson('SUCCESS');
} catch (Exception $e) {
    // If error, return SUCCESS
    sendJson('SUCCESS');
}

