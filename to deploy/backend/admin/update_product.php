<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

if (!$data || !isset($data['id'])) {
    sendJson(['error' => 'Product ID is required'], 400);
}

$id = trim($data['id']);
$name = isset($data['name']) ? trim($data['name']) : null;
$tamil_name = isset($data['tamil_name']) ? trim($data['tamil_name']) : null;
$price = isset($data['price']) ? floatval($data['price']) : null;
$original_price = isset($data['original_price']) ? floatval($data['original_price']) : null;
$stock_price = isset($data['stock_price']) ? floatval($data['stock_price']) : null;
$profit_percent = isset($data['profit_percent']) ? floatval($data['profit_percent']) : null;
$cat = isset($data['cat']) ? trim($data['cat']) : null;
$sub_cat = isset($data['sub_cat']) ? trim($data['sub_cat']) : null;
$weight = isset($data['weight']) ? intval($data['weight']) : null;
$unit_name = isset($data['unit_name']) ? trim($data['unit_name']) : null;
$disabled = isset($data['disabled']) ? intval($data['disabled']) : null;
$is_unlimited = isset($data['is_unlimited']) ? intval($data['is_unlimited']) : null;
$stock_qty = isset($data['stock_qty']) && $data['stock_qty'] !== '' ? floatval($data['stock_qty']) : null;
$in_stock = isset($data['in_stock']) ? intval($data['in_stock']) : null;
if ($is_unlimited !== 1 && $stock_qty !== null && $stock_qty <= 0 && $in_stock === null) {
    $in_stock = 0;
}
$gst_percent = isset($data['gst_percent']) ? floatval($data['gst_percent']) : null;
$subscribe_flg = isset($data['subscribe_flg']) ? intval($data['subscribe_flg']) : (isset($data['subscribeFlg']) ? ($data['subscribeFlg'] ? 1 : 0) : null);
$img_url = isset($data['img_url']) ? trim($data['img_url']) : null;
$allow_next_day = isset($data['allow_next_day']) ? intval($data['allow_next_day']) : null;
$allow_immediate_10 = isset($data['allow_immediate_10']) ? intval($data['allow_immediate_10']) : null;
$allow_immediate_30 = isset($data['allow_immediate_30']) ? intval($data['allow_immediate_30']) : null;
$allow_immediate_60 = isset($data['allow_immediate_60']) ? intval($data['allow_immediate_60']) : null;
$preferred_days = isset($data['preferred_days']) ? (is_array($data['preferred_days']) ? json_encode(array_values($data['preferred_days'])) : trim($data['preferred_days'])) : null;

if (!$pdo) {
    sendJson(['error' => 'Database connection unavailable'], 500);
}

$tables = ['products'];
try {
    $stmtTbls = $pdo->query("SHOW TABLES LIKE '%products%'");
    $dbTbls = $stmtTbls->fetchAll(PDO::FETCH_COLUMN);
    if (!empty($dbTbls)) {
        $tables = $dbTbls;
    }
} catch (Exception $e) {}

foreach ($tables as $table) {
    $columnDefs = [
        "ALTER TABLE {$table} ADD COLUMN in_stock INT DEFAULT 1",
        "ALTER TABLE {$table} ADD COLUMN stock_qty DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE {$table} ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00",
        "ALTER TABLE {$table} ADD COLUMN stock_price DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE {$table} ADD COLUMN profit_percent DECIMAL(5,2) DEFAULT 10.00",
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
        $updates = [];
        $params = [];

        if ($name !== null) { $updates[] = "name = ?"; $params[] = $name; }
        if ($tamil_name !== null) { $updates[] = "tamil_name = ?"; $params[] = $tamil_name; }
        if ($price !== null) { $updates[] = "price = ?"; $params[] = $price; }
        if ($original_price !== null) { $updates[] = "original_price = ?"; $params[] = $original_price; }
        if ($stock_price !== null) { $updates[] = "stock_price = ?"; $params[] = $stock_price; }
        if ($profit_percent !== null) { $updates[] = "profit_percent = ?"; $params[] = $profit_percent; }
        if ($cat !== null) { $updates[] = "cat = ?"; $params[] = $cat; }
        if ($sub_cat !== null) { $updates[] = "sub_cat = ?"; $params[] = $sub_cat; }
        if ($weight !== null) { 
            $updates[] = "weight = ?"; $params[] = $weight; 
            $updates[] = "original_weight = ?"; $params[] = $weight;
        }
        if ($unit_name !== null) { 
            $updates[] = "unit_name = ?"; $params[] = $unit_name; 
            $updates[] = "original_unit_name = ?"; $params[] = $unit_name;
        }
        if ($disabled !== null) { $updates[] = "disabled = ?"; $params[] = $disabled; }
        if ($in_stock !== null) { $updates[] = "in_stock = ?"; $params[] = $in_stock; }
        if ($stock_qty !== null) { $updates[] = "stock_qty = ?"; $params[] = $stock_qty; }
        if ($gst_percent !== null) { $updates[] = "gst_percent = ?"; $params[] = $gst_percent; }
        if ($img_url !== null) { $updates[] = "img_url = ?"; $params[] = $img_url; }
        if ($allow_next_day !== null) { $updates[] = "allow_next_day = ?"; $params[] = $allow_next_day; }
        if ($allow_immediate_10 !== null) { $updates[] = "allow_immediate_10 = ?"; $params[] = $allow_immediate_10; }
        if ($allow_immediate_30 !== null) { $updates[] = "allow_immediate_30 = ?"; $params[] = $allow_immediate_30; }
        if ($allow_immediate_60 !== null) { $updates[] = "allow_immediate_60 = ?"; $params[] = $allow_immediate_60; }
        if ($is_unlimited !== null) { $updates[] = "is_unlimited = ?"; $params[] = $is_unlimited; }
        if ($subscribe_flg !== null) { $updates[] = "subscribe_flg = ?"; $params[] = $subscribe_flg; }
        if ($preferred_days !== null) { $updates[] = "preferred_days = ?"; $params[] = $preferred_days; }

        if (!empty($updates)) {
            $sql = "UPDATE {$table} SET " . implode(", ", $updates) . " WHERE id = ?" . ($name ? " OR name = ?" : "");
            $params[] = $id;
            if ($name) { $params[] = $name; }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
    } catch (Exception $e) {
        // Continue
    }
}

sendJson([
    'status' => 'SUCCESS',
    'message' => 'Product updated successfully',
    'product' => [
        'id' => $id,
        'name' => $name,
        'stock_qty' => $stock_qty,
        'in_stock' => $in_stock,
        'price' => $price,
        'original_price' => $original_price,
        'stock_price' => $stock_price,
        'profit_percent' => $profit_percent,
        'gst_percent' => $gst_percent,
        'subscribe_flg' => $subscribe_flg,
        'subscribeFlg' => ($subscribe_flg === 1),
        'allow_next_day' => $allow_next_day,
        'allow_immediate_10' => $allow_immediate_10,
        'allow_immediate_30' => $allow_immediate_30,
        'allow_immediate_60' => $allow_immediate_60,
        'preferred_days' => $preferred_days
    ]
]);


