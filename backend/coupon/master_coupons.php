<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([
        ['code' => 'WELCOME10', 'discount_percent' => 10, 'max_discount' => 100, 'min_order_amount' => 300],
        ['code' => 'SUPER50', 'discount_percent' => 15, 'max_discount' => 150, 'min_order_amount' => 500]
    ]);
}

try {
    $stmt = $pdo->query("SELECT code, discount_percent, max_discount, min_order_amount FROM coupons WHERE disabled = 0");
    $coupons = $stmt->fetchAll();
    sendJson($coupons);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
