<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

// Fallback to php://input if getParam did not capture it
if (!$data) {
    $rawInput = file_get_contents('php://input');
    if ($rawInput) {
        $jsonInput = json_decode($rawInput, true);
        if ($jsonInput) {
            $data = isset($jsonInput['data']) ? (is_string($jsonInput['data']) ? json_decode($jsonInput['data'], true) : $jsonInput['data']) : $jsonInput;
        }
    }
}

if (!$data || !is_array($data)) {
    sendJson(['error' => 'A valid list of products is required for bulk upload.'], 400);
}

// Support wrapping array in a property "products" or direct array
$items = isset($data['products']) && is_array($data['products']) ? $data['products'] : (isset($data[0]) ? $data : [$data]);

if (empty($items)) {
    sendJson(['error' => 'Product list is empty.'], 400);
}

if (!$pdo) {
    sendJson(['error' => 'Database connection unavailable'], 500);
}

// Discover all product tables (e.g. products, zone1_products_new_1, zone2_products_new_1)
$tables = ['products'];
try {
    $stmtTbls = $pdo->query("SHOW TABLES LIKE '%products%'");
    $dbTbls = $stmtTbls->fetchAll(PDO::FETCH_COLUMN);
    if (!empty($dbTbls)) {
        $tables = $dbTbls;
    }
} catch (Exception $e) {}

// Ensure all schema columns exist
$columnDefs = [
    "in_stock INT DEFAULT 1",
    "stock_qty DECIMAL(10,2) DEFAULT 0.00",
    "gst_percent DECIMAL(5,2) DEFAULT 5.00",
    "stock_price DECIMAL(10,2) DEFAULT 0.00",
    "profit_percent DECIMAL(5,2) DEFAULT 10.00",
    "show_off_percent DECIMAL(5,2) DEFAULT 0.00",
    "total_purchased_qty DECIMAL(10,2) DEFAULT 0.00",
    "total_purchased_cost DECIMAL(10,2) DEFAULT 0.00",
    "allow_next_day INT DEFAULT 1",
    "allow_immediate_10 INT DEFAULT 0",
    "allow_immediate_30 INT DEFAULT 0",
    "allow_immediate_60 INT DEFAULT 0",
    "is_unlimited TINYINT(1) DEFAULT 0",
    "subscribe_flg INT DEFAULT 0",
    "preferred_days VARCHAR(255) DEFAULT '[]'"
];

foreach ($tables as $t) {
    foreach ($columnDefs as $colDef) {
        try {
            $pdo->exec("ALTER TABLE `{$t}` ADD COLUMN {$colDef}");
        } catch (Exception $eCol) {}
    }
}

$insertedCount = 0;
$updatedCount = 0;
$errorList = [];

foreach ($items as $idx => $row) {
    $rowNum = $idx + 1;
    $name = isset($row['name']) ? trim($row['name']) : '';
    if (!$name) {
        $errorList[] = "Row #{$rowNum}: Product name is missing.";
        continue;
    }

    $id = isset($row['id']) && trim($row['id']) !== '' ? trim($row['id']) : null;
    $tamil_name = isset($row['tamil_name']) ? trim($row['tamil_name']) : '';
    $cat = isset($row['cat']) && trim($row['cat']) !== '' ? trim($row['cat']) : 'Vegetables';
    $sub_cat = isset($row['sub_cat']) && trim($row['sub_cat']) !== '' ? trim($row['sub_cat']) : 'General';
    $price = isset($row['price']) ? floatval($row['price']) : 0;
    $original_price = isset($row['original_price']) && floatval($row['original_price']) > 0 ? floatval($row['original_price']) : $price;
    $stock_price = isset($row['stock_price']) ? floatval($row['stock_price']) : round($price * 0.8, 2);
    $profit_percent = isset($row['profit_percent']) ? floatval($row['profit_percent']) : 20.00;
    $show_off_percent = isset($row['show_off_percent']) ? floatval($row['show_off_percent']) : 0.00;
    $weight = isset($row['weight']) ? intval($row['weight']) : 500;
    $unit_name = isset($row['unit_name']) && trim($row['unit_name']) !== '' ? trim($row['unit_name']) : 'grams';
    $img_url = isset($row['img_url']) && trim($row['img_url']) !== '' ? trim($row['img_url']) : 'assets/categories/Thinkspot_veggiesIcon.png';
    $gst_percent = isset($row['gst_percent']) ? floatval($row['gst_percent']) : 5.00;
    $is_unlimited = isset($row['is_unlimited']) ? intval($row['is_unlimited']) : 1;
    $stock_qty = isset($row['stock_qty']) ? floatval($row['stock_qty']) : 0;
    
    // In stock status calculation
    $in_stock = isset($row['in_stock']) ? intval($row['in_stock']) : 1;
    if ($is_unlimited == 1) {
        $in_stock = 1;
    } else if ($stock_qty <= 0) {
        $in_stock = 0;
    }

    $disabled = isset($row['disabled']) ? intval($row['disabled']) : 0;
    $subscribe_flg = isset($row['subscribe_flg']) ? intval($row['subscribe_flg']) : (isset($row['subscribeFlg']) ? ($row['subscribeFlg'] ? 1 : 0) : 0);
    $allow_next_day = isset($row['allow_next_day']) ? intval($row['allow_next_day']) : 1;
    $allow_immediate_10 = isset($row['allow_immediate_10']) ? intval($row['allow_immediate_10']) : 0;
    $allow_immediate_30 = isset($row['allow_immediate_30']) ? intval($row['allow_immediate_30']) : 0;
    $allow_immediate_60 = isset($row['allow_immediate_60']) ? intval($row['allow_immediate_60']) : 0;

    // Preferred days format normalization
    $preferred_days = '[]';
    if (isset($row['preferred_days'])) {
        if (is_array($row['preferred_days'])) {
            $preferred_days = json_encode(array_values($row['preferred_days']));
        } else if (is_string($row['preferred_days'])) {
            $rawDays = trim($row['preferred_days']);
            if (empty($rawDays) || strtolower($rawDays) === 'all' || strtolower($rawDays) === 'all days' || $rawDays === '[]') {
                $preferred_days = '[]';
            } else if (substr($rawDays, 0, 1) === '[') {
                $preferred_days = $rawDays;
            } else {
                $dayArr = array_map('trim', explode(',', $rawDays));
                $preferred_days = json_encode($dayArr);
            }
        }
    }

    // Check if product already exists by ID or by Name in products table
    $existingId = null;
    try {
        if ($id) {
            $chkStmt = $pdo->prepare("SELECT id FROM products WHERE id = ? LIMIT 1");
            $chkStmt->execute([$id]);
            $existingId = $chkStmt->fetchColumn();
        }
        if (!$existingId && $name) {
            $chkStmt2 = $pdo->prepare("SELECT id FROM products WHERE LOWER(name) = LOWER(?) LIMIT 1");
            $chkStmt2->execute([$name]);
            $existingId = $chkStmt2->fetchColumn();
        }
    } catch (Exception $eChk) {}

    if ($existingId) {
        // UPDATE existing product across all tables
        $updId = $existingId;
        $anyUpdated = false;
        foreach ($tables as $table) {
            try {
                $sql = "
                    UPDATE `{$table}` SET 
                        name = ?, 
                        tamil_name = ?, 
                        cat = ?, 
                        sub_cat = ?, 
                        price = ?, 
                        original_price = ?, 
                        stock_price = ?, 
                        profit_percent = ?, 
                        show_off_percent = ?, 
                        weight = ?, 
                        original_weight = ?, 
                        unit_name = ?, 
                        original_unit_name = ?, 
                        img_url = ?, 
                        disabled = ?, 
                        in_stock = ?, 
                        stock_qty = ?, 
                        gst_percent = ?, 
                        allow_next_day = ?, 
                        allow_immediate_10 = ?, 
                        allow_immediate_30 = ?, 
                        allow_immediate_60 = ?, 
                        is_unlimited = ?, 
                        subscribe_flg = ?, 
                        preferred_days = ?
                    WHERE id = ? OR LOWER(name) = LOWER(?)
                ";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $name, $tamil_name, $cat, $sub_cat, $price, $original_price,
                    $stock_price, $profit_percent, $show_off_percent, $weight, $weight,
                    $unit_name, $unit_name, $img_url, $disabled, $in_stock, $stock_qty,
                    $gst_percent, $allow_next_day, $allow_immediate_10, $allow_immediate_30,
                    $allow_immediate_60, $is_unlimited, $subscribe_flg, $preferred_days,
                    $updId, $name
                ]);
                $anyUpdated = true;
            } catch (Exception $eUpd) {
                // Table might have slight variation, continue to next
            }
        }
        if ($anyUpdated) {
            $updatedCount++;
        } else {
            $errorList[] = "Row #{$rowNum} ({$name}): Failed to update record in tables.";
        }
    } else {
        // INSERT new product across all tables
        $newId = $id ? $id : ('PROD_' . time() . '_' . rand(100, 999));
        $anyInserted = false;
        foreach ($tables as $table) {
            try {
                $sql = "
                    INSERT INTO `{$table}` 
                    (id, name, tamil_name, cat, sub_cat, price, original_price, stock_price, profit_percent, show_off_percent, weight, original_weight, unit_name, original_unit_name, img_url, disabled, in_stock, stock_qty, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60, is_unlimited, subscribe_flg, preferred_days) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $newId, $name, $tamil_name, $cat, $sub_cat, $price, $original_price,
                    $stock_price, $profit_percent, $show_off_percent, $weight, $weight,
                    $unit_name, $unit_name, $img_url, $disabled, $in_stock, $stock_qty,
                    $gst_percent, $allow_next_day, $allow_immediate_10, $allow_immediate_30,
                    $allow_immediate_60, $is_unlimited, $subscribe_flg, $preferred_days
                ]);
                $anyInserted = true;
            } catch (Exception $eIns) {
                // Ignore per-table error
            }
        }
        if ($anyInserted) {
            $insertedCount++;
        } else {
            $errorList[] = "Row #{$rowNum} ({$name}): Failed to insert into product tables.";
        }
    }
}

sendJson([
    'status' => 'SUCCESS',
    'message' => "Bulk operation completed: {$insertedCount} product(s) added, {$updatedCount} product(s) updated.",
    'total' => count($items),
    'inserted' => $insertedCount,
    'updated' => $updatedCount,
    'errors' => $errorList
]);
