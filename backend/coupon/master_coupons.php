<?php
require_once __DIR__ . '/../config/db.php';

$defaultCoupons = [
    [
        'code' => 'VEG5',
        'discount_percent' => 5,
        'max_discount' => 100,
        'min_order_amount' => 300,
        'count' => 5,
        'categories' => 'Vegetables,Veg',
        'description' => '5% OFF on Vegetables category (Min cart > ₹300, 5 uses max)',
        'offer' => '5% OFF on Vegetables',
        'offer_desc' => '5% discount on Vegetables items'
    ],
    [
        'code' => 'WELCOME10',
        'discount_percent' => 10,
        'max_discount' => 100,
        'min_order_amount' => 300,
        'count' => 5,
        'categories' => 'all',
        'description' => '10% OFF on your order (Min cart > ₹300)',
        'offer' => '10% OFF',
        'offer_desc' => '10% discount on order'
    ],
    [
        'code' => 'SUPER50',
        'discount_percent' => 15,
        'max_discount' => 150,
        'min_order_amount' => 500,
        'count' => 5,
        'categories' => 'all',
        'description' => '15% OFF on order above ₹500',
        'offer' => '15% OFF',
        'offer_desc' => '15% discount on order'
    ]
];

if (!$pdo) {
    sendJson($defaultCoupons);
}

try {
    // Add columns to coupons table if missing
    try { $pdo->exec("ALTER TABLE coupons ADD COLUMN count INT DEFAULT 5"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE coupons ADD COLUMN categories VARCHAR(255) DEFAULT 'all'"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE coupons ADD COLUMN description VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE coupons ADD COLUMN offer VARCHAR(100) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE coupons ADD COLUMN offer_desc VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}

    // Seed VEG5 promo code
    $seedStmt = $pdo->prepare("
        INSERT INTO coupons (code, discount_percent, max_discount, min_order_amount, count, categories, description, offer, offer_desc, disabled) 
        VALUES ('VEG5', 5.00, 100.00, 300.00, 5, 'Vegetables,Veg', '5% OFF on Vegetables category (Min cart > ₹300, 5 uses max)', '5% OFF on Vegetables', '5% discount on Vegetables items', 0)
        ON DUPLICATE KEY UPDATE discount_percent = 5.00, min_order_amount = 300.00, count = 5, categories = 'Vegetables,Veg', description = VALUES(description), offer = VALUES(offer)
    ");
    $seedStmt->execute();

    $stmt = $pdo->query("SELECT code, discount_percent, max_discount, min_order_amount, count, categories, description, offer, offer_desc FROM coupons WHERE disabled = 0");
    $coupons = $stmt->fetchAll();
    
    if (empty($coupons)) {
        $coupons = $defaultCoupons;
    }
    
    sendJson($coupons);
} catch (Exception $e) {
    sendJson($defaultCoupons);
}

