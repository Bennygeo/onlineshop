<?php
require_once __DIR__ . '/../config/db.php';

$cat = getParam('cat');
$sub_cat = getParam('sub_cat');

if (!$pdo) {
    sendJson([]);
}

try {
    $table_name = getParam('table_name');
    if (!$table_name) { $table_name = 'products'; }
    $is_admin = (getParam('is_admin') == '1' || getParam('is_admin') === true || getParam('admin') == '1');

    // Ensure inventory and GST columns exist in all tables
    $allTables = ['products', 'zone1_products_new_1', 'zone2_products_new_1'];
    if (!in_array($table_name, $allTables)) {
        $allTables[] = $table_name;
    }
    foreach ($allTables as $t) {
        try {
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN in_stock INT DEFAULT 1");
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN stock_qty DECIMAL(10,2) DEFAULT 0.00");
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00");
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN stock_price DECIMAL(10,2) DEFAULT 0.00");
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN profit_percent DECIMAL(5,2) DEFAULT 10.00");
        } catch (Exception $colEx) {}
    }

    // Build query safely
    $sql = "SELECT id, name, tamil_name, cat, sub_cat, price, original_price, stock_price, profit_percent, weight, unit_name, img_url, disabled, subscribe_flg, index_num AS `index`, offer, in_stock, stock_qty, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM {$table_name} WHERE 1=1";
    $params = [];
    if (!$is_admin) {
        $sql .= " AND (disabled = 0 OR disabled IS NULL)";
    }
    if ($cat && strtolower($cat) !== 'all') {
        $sql .= " AND cat = ?";
        $params[] = $cat;
    }
    if ($sub_cat) {
        $sql .= " AND sub_cat = ?";
        $params[] = $sub_cat;
    }
    $sql .= " ORDER BY index_num ASC, id ASC";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $exTable) {
        // Fallback: query from master products table
        $sqlMaster = "SELECT id, name, tamil_name, cat, sub_cat, price, original_price, stock_price, profit_percent, weight, unit_name, img_url, disabled, subscribe_flg, index_num AS `index`, offer, in_stock, stock_qty, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM products WHERE 1=1";
        $mParams = [];
        if (!$is_admin) {
            $sqlMaster .= " AND (disabled = 0 OR disabled IS NULL)";
        }
        if ($cat && strtolower($cat) !== 'all') {
            $sqlMaster .= " AND cat = ?";
            $mParams[] = $cat;
        }
        if ($sub_cat) {
            $sqlMaster .= " AND sub_cat = ?";
            $mParams[] = $sub_cat;
        }
        $sqlMaster .= " ORDER BY index_num ASC, id ASC";
        try {
            $stmtM = $pdo->prepare($sqlMaster);
            $stmtM->execute($mParams);
            $products = $stmtM->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $exM) {
            $products = [];
        }
    }

    // Load master stock map from products table
    $masterStockMap = [];
    try {
        $stmtMasterStock = $pdo->query("SELECT id, stock_qty, in_stock, stock_price, profit_percent, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM products");
        while ($mRow = $stmtMasterStock->fetch(PDO::FETCH_ASSOC)) {
            $masterStockMap[$mRow['id']] = $mRow;
        }
    } catch (Exception $eSt) {}

    foreach ($products as &$p) {
        $pId = $p['id'] ?? '';
        $mStock = isset($masterStockMap[$pId]) ? $masterStockMap[$pId] : null;

        $p['price'] = (isset($p['price']) && floatval($p['price']) > 0) ? floatval($p['price']) : 60;
        $p['original_price'] = (isset($p['original_price']) && floatval($p['original_price']) > 0) ? floatval($p['original_price']) : (!empty($p['price']) ? floatval($p['price']) : 80);
        $p['weight'] = (isset($p['weight']) && intval($p['weight']) > 0) ? intval($p['weight']) : 500;
        $p['unit_name'] = !empty($p['unit_name']) ? $p['unit_name'] : 'grams';
        $p['stock_price'] = isset($p['stock_price']) ? round(floatval($p['stock_price']), 2) : ($mStock ? round(floatval($mStock['stock_price']), 2) : 0.0);
        $p['avg_cost'] = $p['stock_price'];
        $p['profit_percent'] = isset($p['profit_percent']) ? floatval($p['profit_percent']) : ($mStock ? floatval($mStock['profit_percent']) : 10.0);
        $p['disabled'] = (isset($p['disabled']) && (int)$p['disabled'] === 1) ? true : false;
        
        // Exact stock quantity from table or master
        if (isset($p['stock_qty']) && $p['stock_qty'] !== null) {
            $p['stock_qty'] = round(floatval($p['stock_qty']), 2);
        } elseif ($mStock && isset($mStock['stock_qty']) && $mStock['stock_qty'] !== null) {
            $p['stock_qty'] = round(floatval($mStock['stock_qty']), 2);
        } else {
            $p['stock_qty'] = 0.0;
        }

        // Out of stock calculation
        if ((isset($p['in_stock']) && (int)$p['in_stock'] === 0) || ($mStock && isset($mStock['in_stock']) && (int)$mStock['in_stock'] === 0) || $p['stock_qty'] <= 0) {
            $p['in_stock'] = false;
        } else {
            $p['in_stock'] = true;
        }

        $p['gst_percent'] = isset($p['gst_percent']) ? floatval($p['gst_percent']) : 5.00;
        $p['subscribe_flg'] = (isset($p['subscribe_flg']) && (int)$p['subscribe_flg'] === 1) ? 1 : 0;
        $p['subscribeFlg'] = ($p['subscribe_flg'] === 1);

        // Delivery option flags
        $p['allow_next_day'] = isset($p['allow_next_day']) ? (int)$p['allow_next_day'] : ($mStock && isset($mStock['allow_next_day']) ? (int)$mStock['allow_next_day'] : 1);
        $p['allow_immediate_10'] = isset($p['allow_immediate_10']) ? (int)$p['allow_immediate_10'] : ($mStock && isset($mStock['allow_immediate_10']) ? (int)$mStock['allow_immediate_10'] : 0);
        $p['allow_immediate_30'] = isset($p['allow_immediate_30']) ? (int)$p['allow_immediate_30'] : ($mStock && isset($mStock['allow_immediate_30']) ? (int)$mStock['allow_immediate_30'] : 0);
        $p['allow_immediate_60'] = isset($p['allow_immediate_60']) ? (int)$p['allow_immediate_60'] : ($mStock && isset($mStock['allow_immediate_60']) ? (int)$mStock['allow_immediate_60'] : 0);
    }

    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
