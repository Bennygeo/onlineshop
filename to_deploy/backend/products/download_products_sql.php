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

    // Ensure columns exist in products and zone tables
    $schemaCols = [
        "in_stock INT DEFAULT 1",
        "stock_qty DECIMAL(10,2) DEFAULT 100.00",
        "gst_percent DECIMAL(5,2) DEFAULT 5.00",
        "stock_price DECIMAL(10,2) DEFAULT 0.00",
        "profit_percent DECIMAL(5,2) DEFAULT 10.00",
        "preferred_days VARCHAR(255) DEFAULT '[]'",
        "subscribe_flg INT DEFAULT 0",
        "allow_next_day INT DEFAULT 1",
        "allow_immediate_10 INT DEFAULT 0",
        "allow_immediate_30 INT DEFAULT 0",
        "allow_immediate_60 INT DEFAULT 0",
        "is_unlimited TINYINT(1) DEFAULT 0"
    ];

    $allTables = ['products', 'zone1_products_new_1', 'zone2_products_new_1'];
    if (!empty($table_name) && !in_array($table_name, $allTables)) {
        $allTables[] = $table_name;
    }
    foreach ($allTables as $t) {
        foreach ($schemaCols as $colDef) {
            try {
                $pdo->exec("ALTER TABLE `{$t}` ADD COLUMN {$colDef}");
            } catch (Exception $colEx) {}
        }
    }

    // Fetch products
    $products = [];
    $targetTable = (!empty($table_name) && $table_name !== 'banners') ? $table_name : 'products';

    // Helper to query products from a given table
    $fetchFromTable = function($tbl) use ($pdo, $is_admin, $cat, $sub_cat) {
        $sql = "SELECT * FROM `{$tbl}` WHERE 1=1";
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

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    };

    try {
        $products = $fetchFromTable($targetTable);
        if (empty($products) && $targetTable !== 'products' && $targetTable !== 'zone2_products_new_1') {
            // If zone table was empty, fallback to master products table (except zone2 which has 0 products)
            $products = $fetchFromTable('products');
        }
    } catch (Exception $exTable) {
        if ($targetTable === 'zone2_products_new_1') {
            $products = [];
        } else {
            try {
                $products = $fetchFromTable('products');
            } catch (Exception $exM) {
                $products = [];
            }
        }
    }

    // Load master stock map from products table if querying a zone table
    $masterStockMap = [];
    if ($targetTable !== 'products') {
        try {
            $stmtMasterStock = $pdo->query("SELECT id, stock_qty, in_stock, is_unlimited, stock_price, profit_percent, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60, preferred_days FROM `products`");
            if ($stmtMasterStock) {
                while ($mRow = $stmtMasterStock->fetch(PDO::FETCH_ASSOC)) {
                    $masterStockMap[$mRow['id']] = $mRow;
                }
            }
        } catch (Exception $eSt) {}
    }

    foreach ($products as &$p) {
        $pId = $p['id'] ?? '';
        $mStock = isset($masterStockMap[$pId]) ? $masterStockMap[$pId] : null;

        $p['index'] = isset($p['index_num']) ? intval($p['index_num']) : (isset($p['index']) ? intval($p['index']) : 0);
        $p['price'] = (isset($p['price']) && floatval($p['price']) > 0) ? floatval($p['price']) : 60;
        $p['original_price'] = (isset($p['original_price']) && floatval($p['original_price']) > 0) ? floatval($p['original_price']) : (!empty($p['price']) ? floatval($p['price']) : 80);
        $p['weight'] = (isset($p['weight']) && intval($p['weight']) > 0) ? intval($p['weight']) : 500;
        $p['unit_name'] = !empty($p['unit_name']) ? $p['unit_name'] : 'grams';
        $p['stock_price'] = isset($p['stock_price']) ? round(floatval($p['stock_price']), 2) : ($mStock ? round(floatval($mStock['stock_price']), 2) : 0.0);
        $p['avg_cost'] = $p['stock_price'];
        $p['profit_percent'] = isset($p['profit_percent']) ? floatval($p['profit_percent']) : ($mStock ? floatval($mStock['profit_percent']) : 10.0);
        $p['disabled'] = (isset($p['disabled']) && ((int)$p['disabled'] === 1 || $p['disabled'] === true || $p['disabled'] === '1')) ? true : false;
        
        $p['is_unlimited'] = (isset($p['is_unlimited']) && ((int)$p['is_unlimited'] === 1 || $p['is_unlimited'] === true || $p['is_unlimited'] === '1')) || ($mStock && isset($mStock['is_unlimited']) && ((int)$mStock['is_unlimited'] === 1 || $mStock['is_unlimited'] === true));

        // Exact stock quantity from table or master
        if (isset($p['stock_qty']) && $p['stock_qty'] !== null) {
            $p['stock_qty'] = round(floatval($p['stock_qty']), 2);
        } elseif ($mStock && isset($mStock['stock_qty']) && $mStock['stock_qty'] !== null) {
            $p['stock_qty'] = round(floatval($mStock['stock_qty']), 2);
        } else {
            $p['stock_qty'] = 0.0;
        }

        $isStockZero = (isset($p['in_stock']) && ((int)$p['in_stock'] === 0 || $p['in_stock'] === false || $p['in_stock'] === '0')) ||
                       ($mStock && isset($mStock['in_stock']) && ((int)$mStock['in_stock'] === 0 || $mStock['in_stock'] === false || $mStock['in_stock'] === '0'));

        // Out of stock calculation:
        // A product is out of stock ONLY if:
        //   1. It is NOT unlimited AND
        //   2. The `in_stock` flag is explicitly set to 0 in the DB
        // A stock_qty of 0 means the field is untracked (market-sourced), NOT that it's out of stock.
        if ($p['is_unlimited']) {
            $p['in_stock'] = true;
        } else {
            if ($isStockZero) {
                $p['in_stock'] = false;
            } else {
                $p['in_stock'] = true;
            }
        }

        $p['gst_percent'] = isset($p['gst_percent']) ? floatval($p['gst_percent']) : 5.00;
        $p['subscribe_flg'] = (isset($p['subscribe_flg']) && ((int)$p['subscribe_flg'] === 1 || $p['subscribe_flg'] === true || $p['subscribe_flg'] === '1')) ? 1 : 0;
        $p['subscribeFlg'] = ($p['subscribe_flg'] === 1);

        // Delivery option flags
        $p['allow_next_day'] = isset($p['allow_next_day']) ? (int)$p['allow_next_day'] : ($mStock && isset($mStock['allow_next_day']) ? (int)$mStock['allow_next_day'] : 1);
        $p['allow_immediate_10'] = isset($p['allow_immediate_10']) ? (int)$p['allow_immediate_10'] : ($mStock && isset($mStock['allow_immediate_10']) ? (int)$mStock['allow_immediate_10'] : 0);
        $p['allow_immediate_30'] = isset($p['allow_immediate_30']) ? (int)$p['allow_immediate_30'] : ($mStock && isset($mStock['allow_immediate_30']) ? (int)$mStock['allow_immediate_30'] : 0);
        $p['allow_immediate_60'] = isset($p['allow_immediate_60']) ? (int)$p['allow_immediate_60'] : ($mStock && isset($mStock['allow_immediate_60']) ? (int)$mStock['allow_immediate_60'] : 0);

        // Preferred days parsing (e.g. JSON array or comma-separated strings)
        $rawPref = isset($p['preferred_days']) ? $p['preferred_days'] : ($mStock && isset($mStock['preferred_days']) ? $mStock['preferred_days'] : '[]');
        if (is_array($rawPref)) {
            $p['preferred_days'] = $rawPref;
        } elseif (is_string($rawPref) && !empty($rawPref)) {
            $decoded = json_decode($rawPref, true);
            if (is_array($decoded)) {
                $p['preferred_days'] = array_values(array_filter($decoded));
            } else {
                // Comma-separated string fallback
                $p['preferred_days'] = array_values(array_filter(array_map('trim', explode(',', $rawPref))));
            }
        } else {
            $p['preferred_days'] = [];
        }
    }

    sendJson($products, 200, 120);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
