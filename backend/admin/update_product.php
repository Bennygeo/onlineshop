<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

if (!$data || !isset($data['id'])) {
    sendJson(['error' => 'Product ID is required'], 400);
}

$id = trim($data['id']);
$name = isset($data['name']) ? trim($data['name']) : null;
$price = isset($data['price']) ? floatval($data['price']) : null;
$original_price = isset($data['original_price']) ? floatval($data['original_price']) : null;
$stock_price = isset($data['stock_price']) ? floatval($data['stock_price']) : null;
$profit_percent = isset($data['profit_percent']) ? floatval($data['profit_percent']) : null;
$cat = isset($data['cat']) ? trim($data['cat']) : null;
$sub_cat = isset($data['sub_cat']) ? trim($data['sub_cat']) : null;
$disabled = isset($data['disabled']) ? intval($data['disabled']) : null;
$img_url = isset($data['img_url']) ? trim($data['img_url']) : null;

if (!$pdo) {
    sendJson(['error' => 'Database connection unavailable'], 500);
}

$tables = ['products', 'zone1_products_new_1', 'zone2_products_new_1'];

foreach ($tables as $table) {
    try {
        $updates = [];
        $params = [];

        if ($name !== null) { $updates[] = "name = ?"; $params[] = $name; }
        if ($price !== null) { $updates[] = "price = ?"; $params[] = $price; }
        if ($original_price !== null) { $updates[] = "original_price = ?"; $params[] = $original_price; }
        if ($stock_price !== null) { $updates[] = "stock_price = ?"; $params[] = $stock_price; }
        if ($profit_percent !== null) { $updates[] = "profit_percent = ?"; $params[] = $profit_percent; }
        if ($cat !== null) { $updates[] = "cat = ?"; $params[] = $cat; }
        if ($sub_cat !== null) { $updates[] = "sub_cat = ?"; $params[] = $sub_cat; }
        if ($disabled !== null) { $updates[] = "disabled = ?"; $params[] = $disabled; }
        if ($img_url !== null) { $updates[] = "img_url = ?"; $params[] = $img_url; }

        if (!empty($updates)) {
            $sql = "UPDATE {$table} SET " . implode(", ", $updates) . " WHERE id = ?";
            $params[] = $id;
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
    } catch (Exception $e) {
        // Continue
    }
}

sendJson([
    'status' => 'SUCCESS',
    'message' => 'Product updated successfully'
]);
