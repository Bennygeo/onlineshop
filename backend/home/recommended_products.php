<?php
require_once __DIR__ . '/../config/db.php';

$table_name = getParam('table_name');

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
    $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, index_num AS `index`, offer FROM products WHERE disabled = 0 ORDER BY index_num ASC LIMIT 10");
    $stmt->execute();
    $products = $stmt->fetchAll();
    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
