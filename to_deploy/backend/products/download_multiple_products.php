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



try {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $products = [];

    try {
        $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer, in_stock, stock_qty, is_unlimited, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60, preferred_days FROM {$table_name} WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $eCol) {
        $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer, in_stock, stock_qty, is_unlimited, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60, preferred_days FROM products WHERE id IN ($placeholders)");
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
                $stmtFb = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer, in_stock, stock_qty, is_unlimited, gst_percent, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60, preferred_days FROM {$fbTable} WHERE id IN ($mPlaceholders)");
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
        $p['is_unlimited'] = isset($p['is_unlimited']) && ((int)$p['is_unlimited'] === 1 || $p['is_unlimited'] === true || $p['is_unlimited'] === '1');
        $isStockZero = (isset($p['in_stock']) && ((int)$p['in_stock'] === 0 || $p['in_stock'] === false || $p['in_stock'] === '0'));
        // stock_qty = 0 means "not tracked" (market-sourced), not "out of stock".
        // Only explicit in_stock = 0 marks a product as unavailable.
        $p['in_stock'] = $p['is_unlimited'] ? true : !$isStockZero;
        $p['gst_percent'] = isset($p['gst_percent']) ? floatval($p['gst_percent']) : 5.00;
        $p['allow_next_day'] = isset($p['allow_next_day']) ? (int)$p['allow_next_day'] : 1;
        $p['allow_immediate_10'] = isset($p['allow_immediate_10']) ? (int)$p['allow_immediate_10'] : 0;
        $p['allow_immediate_30'] = isset($p['allow_immediate_30']) ? (int)$p['allow_immediate_30'] : 0;
        $p['allow_immediate_60'] = isset($p['allow_immediate_60']) ? (int)$p['allow_immediate_60'] : 0;

        $rawPref = $p['preferred_days'] ?? '[]';
        if (is_array($rawPref)) {
            $p['preferred_days'] = $rawPref;
        } elseif (is_string($rawPref) && !empty($rawPref)) {
            $decoded = json_decode($rawPref, true);
            if (is_array($decoded)) {
                $p['preferred_days'] = array_values(array_filter($decoded));
            } else {
                $p['preferred_days'] = array_values(array_filter(array_map('trim', explode(',', $rawPref))));
            }
        } else {
            $p['preferred_days'] = [];
        }
    }

    $cart = [];
    if ($orderId) {
        try {
            $stmtCart = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS id, oi.product_id AS productID, COALESCE(NULLIF(oi.product_name, ''), p.name, 'Product Item') AS name, COALESCE(p.img_url, 'assets/categories/Thinkspot_veggiesIcon.png') AS img_url, COALESCE(p.unit_name, '') AS unit_name, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?");
            $stmtCart->execute([$orderId]);
            $cart = $stmtCart->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Exception $eCart) {
            $stmtCart = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS id, oi.product_id AS productID, COALESCE(p.name, 'Product Item') AS name, COALESCE(p.img_url, 'assets/categories/Thinkspot_veggiesIcon.png') AS img_url, COALESCE(p.unit_name, '') AS unit_name, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?");
            $stmtCart->execute([$orderId]);
            $cart = $stmtCart->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
    }

    sendJson([
        'live' => $products ?: [],
        'outOfStock' => [],
        'cart' => $cart
    ], 200, 60);
} catch (Exception $e) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}
