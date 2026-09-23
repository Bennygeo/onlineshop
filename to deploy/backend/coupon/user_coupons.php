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
    try {
        $pdo->exec("DELETE uc1 FROM user_coupons uc1 INNER JOIN user_coupons uc2 WHERE uc1.id > uc2.id AND uc1.mobile = uc2.mobile AND uc1.coupon_code = uc2.coupon_code");
    } catch (Exception $e) {}

    $stmt = $pdo->prepare("
        SELECT MIN(uc.id) AS id, uc.coupon_code AS code, MAX(uc.used) AS used_count, uc.mobile,
               c.discount_percent, c.max_discount, c.min_order_amount,
               COALESCE(c.count, 5) AS count,
               COALESCE(c.categories, 'Vegetables,Veg') AS categories,
               COALESCE(c.description, '5% OFF on Vegetables') AS description,
               COALESCE(c.offer, '5% OFF') AS offer
        FROM user_coupons uc 
        LEFT JOIN coupons c ON uc.coupon_code = c.code 
        WHERE uc.mobile = ? AND uc.used < COALESCE(c.count, 5)
        GROUP BY uc.mobile, uc.coupon_code
    ");
    $stmt->execute([$mobile]);
    $userCoupons = $stmt->fetchAll();
    sendJson($userCoupons);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
