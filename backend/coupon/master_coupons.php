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

    // Seed master promo codes
    $pdo->exec("
        UPDATE coupons SET 
            offer = '10% OFF', 
            description = '10% OFF on orders above ₹300 (Max discount ₹100)', 
            offer_desc = '10% discount on order' 
        WHERE code = 'WELCOME10' AND (description IS NULL OR description = '');

        UPDATE coupons SET 
            offer = '15% OFF', 
            description = '15% OFF on orders above ₹500 (Max discount ₹150)', 
            offer_desc = '15% discount on order' 
        WHERE code = 'SUPER50' AND (description IS NULL OR description = '');

        UPDATE coupons SET 
            offer = '25% OFF Referral Offer', 
            description = 'Special Referral Benefit: 25% OFF on your first order (One-time use, min cart ₹100)', 
            offer_desc = '25% discount on first order' 
        WHERE code = 'WELCOME25' AND (description IS NULL OR description = '' OR description = '25% OFF on first order (One-time use)');

        UPDATE coupons SET 
            offer = '5% OFF on Veg', 
            description = '5% OFF on Vegetables category (Min cart > ₹300, 5 uses max)', 
            offer_desc = '5% discount on Vegetables items' 
        WHERE code = 'VEG5' AND (description IS NULL OR description = '');
    ");

    $stmt = $pdo->query("SELECT code, discount_percent, max_discount, min_order_amount, count, categories, description, offer, offer_desc FROM coupons WHERE disabled = 0");
    $coupons = $stmt->fetchAll();
    
    if (empty($coupons)) {
        $coupons = $defaultCoupons;
    }
    
    sendJson($coupons);
} catch (Exception $e) {
    sendJson($defaultCoupons);
}

