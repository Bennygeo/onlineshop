<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

if (!$data) {
    sendJson(['error' => 'Product payload is required'], 400);
}

$name = isset($data['name']) ? trim($data['name']) : '';
$cat = isset($data['cat']) ? trim($data['cat']) : 'Vegetables';
$sub_cat = isset($data['sub_cat']) ? trim($data['sub_cat']) : 'General';
$price = isset($data['price']) ? floatval($data['price']) : 0;
$original_price = isset($data['original_price']) ? floatval($data['original_price']) : $price;
$stock_price = isset($data['stock_price']) ? floatval($data['stock_price']) : ($price * 0.8);
$profit_percent = isset($data['profit_percent']) ? floatval($data['profit_percent']) : 20;
$show_off_percent = isset($data['show_off_percent']) ? floatval($data['show_off_percent']) : 10;
$weight = isset($data['weight']) ? intval($data['weight']) : 500;
$unit_name = isset($data['unit_name']) ? trim($data['unit_name']) : 'grams';
$original_unit_name = isset($data['original_unit_name']) ? trim($data['original_unit_name']) : 'grams';
$tamil_name = isset($data['tamil_name']) ? trim($data['tamil_name']) : '';
$img_url = isset($data['img_url']) ? trim($data['img_url']) : 'assets/categories/Thinkspot_veggiesIcon.png';
$zone = isset($data['zone']) ? trim($data['zone']) : 'both'; // zone1, zone2, or both

if (!$name) {
    sendJson(['error' => 'Product name is required'], 400);
}

if (!$pdo) {
    sendJson(['error' => 'Database connection unavailable'], 500);
}

$id = 'PROD_' . time() . '_' . rand(100, 999);

$tables = ['products', 'zone1_products_new_1', 'zone2_products_new_1'];

$successCnt = 0;
foreach ($tables as $table) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO {$table} 
            (id, name, tamil_name, cat, sub_cat, price, original_price, stock_price, profit_percent, show_off_percent, weight, unit_name, original_unit_name, img_url, disabled) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ");
        $stmt->execute([
            $id, $name, $tamil_name, $cat, $sub_cat, $price, $original_price,
            $stock_price, $profit_percent, $show_off_percent, $weight,
            $unit_name, $original_unit_name, $img_url
        ]);
        $successCnt++;
    } catch (Exception $e) {
        // Table might not exist or error
    }
}

sendJson([
    'status' => 'SUCCESS',
    'id' => $id,
    'message' => 'Product added successfully'
]);
