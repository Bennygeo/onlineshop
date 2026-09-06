<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;
$mobile = isset($data['mobile']) ? $data['mobile'] : getParam('mobile');
$code = isset($data['code']) ? $data['code'] : (isset($data['coupon_code']) ? $data['coupon_code'] : getParam('code'));

if (!$mobile || !$code) {
    sendJson(['error' => 'Mobile and code are required'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("UPDATE user_coupons SET used = used + 1 WHERE mobile = ? AND coupon_code = ?");
    $stmt->execute([$mobile, $code]);

    if ($stmt->rowCount() === 0) {
        $insertStmt = $pdo->prepare("INSERT INTO user_coupons (mobile, coupon_code, used) VALUES (?, ?, 1)");
        $insertStmt->execute([$mobile, $code]);
    }
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
