<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;
$mobile = isset($data['mobile']) ? $data['mobile'] : getParam('mobile');

if (!$mobile) {
    sendJson([]);
}

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->prepare("SELECT uc.id, uc.coupon_code, uc.used, c.discount_percent, c.max_discount, c.min_order_amount FROM user_coupons uc LEFT JOIN coupons c ON uc.coupon_code = c.code WHERE uc.mobile = ? AND uc.used = 0");
    $stmt->execute([$mobile]);
    $userCoupons = $stmt->fetchAll();
    sendJson($userCoupons);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
