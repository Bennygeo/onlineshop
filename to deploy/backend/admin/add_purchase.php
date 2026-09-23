<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

if (!$data || !isset($data['product_id'])) {
    sendJson(['error' => 'Product ID is required'], 400);
}

$product_id = trim($data['product_id']);
$quantity = isset($data['quantity']) ? floatval($data['quantity']) : 0.0;
$total_cost = isset($data['total_cost']) ? floatval($data['total_cost']) : 0.0;
$unit_name = isset($data['unit_name']) ? trim($data['unit_name']) : 'kg';
$product_name = isset($data['product_name']) ? trim($data['product_name']) : '';
$vendor_name = isset($data['vendor_name']) ? trim($data['vendor_name']) : '';
$notes = isset($data['notes']) ? trim($data['notes']) : '';
$purchase_date = !empty($data['purchase_date']) ? date('Y-m-d H:i:s', strtotime($data['purchase_date'])) : date('Y-m-d H:i:s');

$profit_percent = isset($data['profit_percent']) && $data['profit_percent'] !== '' ? floatval($data['profit_percent']) : 10.0;
$gst_percent = isset($data['gst_percent']) && $data['gst_percent'] !== '' ? floatval($data['gst_percent']) : 5.0;
$selling_price = isset($data['selling_price']) && floatval($data['selling_price']) > 0 ? floatval($data['selling_price']) : null;
$original_price = isset($data['original_price']) && floatval($data['original_price']) > 0 ? floatval($data['original_price']) : null;
$target_total_stock = isset($data['new_total_stock']) && floatval($data['new_total_stock']) > 0 ? floatval($data['new_total_stock']) : null;

if ($quantity <= 0) {
    sendJson(['error' => 'Purchase quantity must be greater than 0'], 400);
}

if ($total_cost < 0) {
    sendJson(['error' => 'Total cost cannot be negative'], 400);
}

$cost_per_unit = $quantity > 0 ? round($total_cost / $quantity) : 0;

if (!$pdo) {
    sendJson(['error' => 'Database connection unavailable'], 500);
}

// 1. Ensure product_purchases table exists
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS product_purchases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) DEFAULT '',
            quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            unit_name VARCHAR(50) DEFAULT 'kg',
            total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            vendor_name VARCHAR(255) DEFAULT '',
            notes TEXT DEFAULT NULL,
            purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prod (product_id),
            INDEX idx_date (purchase_date)
        )
    ");
} catch (Exception $e) {}

// 2. Insert purchase record
$stmtIns = $pdo->prepare("
    INSERT INTO product_purchases (product_id, product_name, quantity, unit_name, total_cost, cost_per_unit, vendor_name, notes, purchase_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmtIns->execute([$product_id, $product_name, $quantity, $unit_name, $total_cost, $cost_per_unit, $vendor_name, $notes, $purchase_date]);
$purchaseId = $pdo->lastInsertId();

// 3. Compute overall Weighted Average Cost for this product: SUM(total_cost) / SUM(quantity)
$stmtAgg = $pdo->prepare("SELECT COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(total_cost), 0) as total_cost FROM product_purchases WHERE product_id = ? OR product_name = ?");
$stmtAgg->execute([$product_id, $product_name]);
$agg = $stmtAgg->fetch(PDO::FETCH_ASSOC);

$totalPurchasedQty = floatval($agg['total_qty'] ?? 0);
$totalPurchasedCost = floatval($agg['total_cost'] ?? 0);
$weightedAvgCost = $totalPurchasedQty > 0 ? round($totalPurchasedCost / $totalPurchasedQty) : $cost_per_unit;

// 4. Calculate Final Selling Price = Stock Price + Profit Percentage + GST
if ($selling_price === null) {
    // Base Price with profit = Weighted Avg Cost * (1 + profit_percent/100)
    $baseWithProfit = round($weightedAvgCost * (1 + ($profit_percent / 100)));
    // Final Selling Price = Base Price * (1 + gst_percent/100)
    $selling_price = round($baseWithProfit * (1 + ($gst_percent / 100)));
} else {
    $selling_price = round($selling_price);
}

if ($original_price === null) {
    // Show-off MRP (approx 18% higher than selling price)
    $original_price = round($selling_price * 1.18);
} else {
    $original_price = round($original_price);
}

// 5. Update current stock, weighted average cost, profit %, gst %, and selling price across all product tables
$tables = ['products'];
try {
    $stmtTbls = $pdo->query("SHOW TABLES LIKE '%products%'");
    $dbTbls = $stmtTbls->fetchAll(PDO::FETCH_COLUMN);
    if (!empty($dbTbls)) {
        $tables = $dbTbls;
    }
} catch (Exception $e) {}

// Find current stock from database to calculate next stock quantity
$currentStock = 0;
try {
    $stmtChk = $pdo->prepare("SELECT stock_qty FROM products WHERE id = ? OR name = ?");
    $stmtChk->execute([$product_id, $product_name]);
    $row = $stmtChk->fetch(PDO::FETCH_ASSOC);
    if ($row && isset($row['stock_qty'])) {
        $currentStock = floatval($row['stock_qty']);
    }
} catch (Exception $e) {}

$finalStockQty = round($target_total_stock !== null ? $target_total_stock : ($currentStock + $quantity));

foreach ($tables as $tbl) {
    // Execute each column addition safely and individually
    $columnDefs = [
        'in_stock' => "ALTER TABLE {$tbl} ADD COLUMN in_stock INT DEFAULT 1",
        'stock_qty' => "ALTER TABLE {$tbl} ADD COLUMN stock_qty DECIMAL(10,2) DEFAULT 0.00",
        'stock_price' => "ALTER TABLE {$tbl} ADD COLUMN stock_price DECIMAL(10,2) DEFAULT 0.00",
        'profit_percent' => "ALTER TABLE {$tbl} ADD COLUMN profit_percent DECIMAL(5,2) DEFAULT 10.00",
        'gst_percent' => "ALTER TABLE {$tbl} ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00",
        'total_purchased_qty' => "ALTER TABLE {$tbl} ADD COLUMN total_purchased_qty DECIMAL(10,2) DEFAULT 0.00",
        'total_purchased_cost' => "ALTER TABLE {$tbl} ADD COLUMN total_purchased_cost DECIMAL(10,2) DEFAULT 0.00"
    ];
    foreach ($columnDefs as $sqlDef) {
        try {
            $pdo->exec($sqlDef);
        } catch (Exception $eCol) {}
    }

    try {
        $stmtUpd = $pdo->prepare("
            UPDATE {$tbl} 
            SET stock_qty = ?,
                stock_price = ?,
                profit_percent = ?,
                gst_percent = ?,
                price = ?,
                original_price = ?,
                in_stock = 1,
                total_purchased_qty = ?,
                total_purchased_cost = ?
            WHERE id = ? OR name = ?
        ");
        $stmtUpd->execute([
            $finalStockQty, 
            $weightedAvgCost, 
            $profit_percent, 
            $gst_percent, 
            $selling_price, 
            $original_price, 
            $totalPurchasedQty, 
            $totalPurchasedCost, 
            $product_id, 
            $product_name
        ]);
    } catch (Exception $e) {}
}

sendJson([
    'status' => 'SUCCESS',
    'message' => "Successfully recorded purchase of {$quantity} {$unit_name}! Total Stock updated to {$finalStockQty} {$unit_name} and Selling Price to ₹{$selling_price}",
    'purchase_id' => $purchaseId,
    'product_id' => $product_id,
    'product_name' => $product_name,
    'quantity_added' => $quantity,
    'total_cost' => $total_cost,
    'unit_cost' => $cost_per_unit,
    'current_stock_qty' => $finalStockQty,
    'weighted_avg_cost' => $weightedAvgCost,
    'profit_percent' => $profit_percent,
    'gst_percent' => $gst_percent,
    'selling_price' => $selling_price,
    'original_price' => $original_price
]);
