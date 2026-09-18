<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data') ?: (getParam('ids') ?: getParam('products'));
$ids = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;
$orderId = getParam('orderId');

$table_name = getParam('table_name') ?: 'products';

if (empty($ids) || !is_array($ids)) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}

if (!$pdo) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}

// Ensure schema columns exist on all tables
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
    } catch (Exception $colEx) {}
}

try {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $products = [];

    try {
        $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer, in_stock, stock_qty, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM {$table_name} WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $eCol) {
        $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer, in_stock, stock_qty, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM products WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Index found products
    $foundIds = [];
    foreach ($products as $p) {
        $foundIds[] = $p['id'];
    }

    // Check fallback tables for any missing items
    $missingIds = array_diff($ids, $foundIds);
    if (!empty($missingIds)) {
        $mPlaceholders = implode(',', array_fill(0, count($missingIds), '?'));
        $fallbackTables = ['products'];
        foreach ($fallbackTables as $fbTable) {
            if ($fbTable === $table_name) continue;
            try {
                $stmtFb = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer, in_stock, stock_qty, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM {$fbTable} WHERE id IN ($mPlaceholders)");
                $stmtFb->execute(array_values($missingIds));
                $fbRows = $stmtFb->fetchAll(PDO::FETCH_ASSOC);
                foreach ($fbRows as $fbP) {
                    $products[] = $fbP;
                    $missingIds = array_diff($missingIds, [$fbP['id']]);
                }
                if (empty($missingIds)) break;
            } catch (Exception $exFb) {}
        }
    }

    foreach ($products as &$p) {
        $p['price'] = floatval($p['price'] ?? 0);
        $p['original_price'] = floatval(!empty($p['original_price']) ? $p['original_price'] : $p['price']);
        $p['stock_qty'] = isset($p['stock_qty']) ? floatval($p['stock_qty']) : 0.0;
        $p['in_stock'] = (!isset($p['in_stock']) || (int)$p['in_stock'] === 1) && ($p['stock_qty'] > 0);
        $p['gst_percent'] = isset($p['gst_percent']) ? floatval($p['gst_percent']) : 5.00;
        $p['allow_next_day'] = isset($p['allow_next_day']) ? (int)$p['allow_next_day'] : 1;
        $p['allow_immediate_10'] = isset($p['allow_immediate_10']) ? (int)$p['allow_immediate_10'] : 0;
        $p['allow_immediate_30'] = isset($p['allow_immediate_30']) ? (int)$p['allow_immediate_30'] : 0;
        $p['allow_immediate_60'] = isset($p['allow_immediate_60']) ? (int)$p['allow_immediate_60'] : 0;
    }

    $cart = [];
    if ($orderId) {
        $stmtCart = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS productID, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi WHERE oi.order_id = ?");
        $stmtCart->execute([$orderId]);
        $cart = $stmtCart->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    sendJson([
        'live' => $products ?: [],
        'outOfStock' => [],
        'cart' => $cart
    ]);
} catch (Exception $e) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}
