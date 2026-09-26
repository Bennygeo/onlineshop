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
$gst_percent = isset($data['gst_percent']) ? floatval($data['gst_percent']) : 5.00;
$is_unlimited = isset($data['is_unlimited']) ? intval($data['is_unlimited']) : 1;
$in_stock = isset($data['in_stock']) ? intval($data['in_stock']) : 1;
$stock_qty = isset($data['stock_qty']) ? floatval($data['stock_qty']) : 0;
if ($is_unlimited == 1) {
    $in_stock = 1;
}
$disabled = isset($data['disabled']) ? intval($data['disabled']) : 0;
$allow_next_day = isset($data['allow_next_day']) ? intval($data['allow_next_day']) : 1;
$allow_immediate_10 = isset($data['allow_immediate_10']) ? intval($data['allow_immediate_10']) : 0;
$allow_immediate_30 = isset($data['allow_immediate_30']) ? intval($data['allow_immediate_30']) : 0;
$allow_immediate_60 = isset($data['allow_immediate_60']) ? intval($data['allow_immediate_60']) : 0;
$subscribe_flg = isset($data['subscribe_flg']) ? intval($data['subscribe_flg']) : (isset($data['subscribeFlg']) ? ($data['subscribeFlg'] ? 1 : 0) : 0);
$preferred_days = isset($data['preferred_days']) ? (is_array($data['preferred_days']) ? json_encode(array_values($data['preferred_days'])) : trim($data['preferred_days'])) : '[]';

if (!$name) {
    sendJson(['error' => 'Product name is required'], 400);
}

if (!$pdo) {
    sendJson(['error' => 'Database connection unavailable'], 500);
}

$id = 'PROD_' . time() . '_' . rand(100, 999);

$tables = ['products'];
try {
    $stmtTbls = $pdo->query("SHOW TABLES LIKE '%products%'");
    $dbTbls = $stmtTbls->fetchAll(PDO::FETCH_COLUMN);
    if (!empty($dbTbls)) {
        $tables = $dbTbls;
    }
} catch (Exception $e) {}

$successCnt = 0;
foreach ($tables as $table) {
    $columnDefs = [
        "ALTER TABLE {$table} ADD COLUMN in_stock INT DEFAULT 1",
        "ALTER TABLE {$table} ADD COLUMN stock_qty DECIMAL(10,2) DEFAULT 100.00",
        "ALTER TABLE {$table} ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00",
        "ALTER TABLE {$table} ADD COLUMN stock_price DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE {$table} ADD COLUMN profit_percent DECIMAL(5,2) DEFAULT 10.00",
        "ALTER TABLE {$table} ADD COLUMN total_purchased_qty DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE {$table} ADD COLUMN total_purchased_cost DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE {$table} ADD COLUMN allow_next_day INT DEFAULT 1",
        "ALTER TABLE {$table} ADD COLUMN allow_immediate_10 INT DEFAULT 0",
        "ALTER TABLE {$table} ADD COLUMN allow_immediate_30 INT DEFAULT 0",
        "ALTER TABLE {$table} ADD COLUMN allow_immediate_60 INT DEFAULT 0",
        "ALTER TABLE {$table} ADD COLUMN is_unlimited TINYINT(1) DEFAULT 0",
        "ALTER TABLE {$table} ADD COLUMN subscribe_flg INT DEFAULT 0",
        "ALTER TABLE {$table} ADD COLUMN preferred_days VARCHAR(255) DEFAULT '[]'"
    ];
    foreach ($columnDefs as $sqlDef) {
        try {
            $pdo->exec($sqlDef);
        } catch (Exception $eCol) {}
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO {$table} 
            (id, name, tamil_name, cat, sub_cat, price, original_price, stock_price, profit_percent, show_off_percent, weight, original_weight, unit_name, original_unit_name, img_url, disabled, in_stock, stock_qty, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60, is_unlimited, subscribe_flg, preferred_days) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $id, $name, $tamil_name, $cat, $sub_cat, $price, $original_price,
            $stock_price, $profit_percent, $show_off_percent, $weight, $weight,
            $unit_name, $original_unit_name, $img_url, $disabled, $in_stock, $stock_qty, $gst_percent,
            $allow_next_day, $allow_immediate_10, $allow_immediate_30, $allow_immediate_60, $is_unlimited, $subscribe_flg, $preferred_days
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
