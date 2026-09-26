<?php
require_once __DIR__ . '/../config/db.php';

$table_name = getParam('table_name');
if ($table_name === 'zone2_products_new_1') {
    sendJson([]);
    exit;
}

if (!$pdo) {
    sendJson([
        [
            'id' => 'p1',
            'name' => 'Fresh Tomato',
            'tamil_name' => 'தக்காளி',
            'cat' => 'Vegetables',
            'sub_cat' => 'Daily Veg',
            'price' => 40,
            'original_price' => 50,
            'weight' => 500,
            'unit_name' => 'grams',
            'img_url' => 'assets/products/veg/thinkspot_greenTomato.jpg',
            'disabled' => false,
            'index' => 1,
            'offer' => 20
        ],
        [
            'id' => 'p2',
            'name' => 'Fresh Onion',
            'tamil_name' => 'வெங்காயம்',
            'cat' => 'Vegetables',
            'sub_cat' => 'Daily Veg',
            'price' => 30,
            'original_price' => 40,
            'weight' => 1000,
            'unit_name' => 'grams',
            'img_url' => 'assets/products/veg/thinkspot_whiteOnion.jpg',
            'disabled' => false,
            'index' => 2,
            'offer' => 25
        ]
    ]);
}

try {
    $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, in_stock, stock_qty, is_unlimited, index_num AS `index`, offer FROM products WHERE disabled = 0 ORDER BY index_num ASC LIMIT 10");
    $stmt->execute();
    $products = $stmt->fetchAll();
    foreach ($products as &$p) {
        $p['price'] = floatval($p['price'] ?: 0);
        $p['original_price'] = floatval($p['original_price'] ?: $p['price']);
        $p['weight'] = intval($p['weight'] ?: 500);
        $p['disabled'] = ((int)($p['disabled'] ?? 0) === 1);
        $p['stock_qty'] = isset($p['stock_qty']) ? round(floatval($p['stock_qty']), 2) : 0.0;
        $p['is_unlimited'] = isset($p['is_unlimited']) && ((int)$p['is_unlimited'] === 1 || $p['is_unlimited'] === true || $p['is_unlimited'] === '1');
        
        $isStockZero = isset($p['in_stock']) && ((int)$p['in_stock'] === 0 || $p['in_stock'] === false || $p['in_stock'] === '0');
        if ($p['is_unlimited']) {
            $p['in_stock'] = true;
        } else {
            $p['in_stock'] = !$isStockZero;
        }
    }
    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
