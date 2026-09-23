<?php
require_once __DIR__ . '/../config/db.php';

$query = trim(getParam('query', ''));

if (!$pdo) {
    sendJson([]);
}

try {
    $tables = ['products', 'zone1_products_new_1', 'zone2_products_new_1'];
    foreach ($tables as $t) {
        try {
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN in_stock INT DEFAULT 1");
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN stock_qty DECIMAL(10,2) DEFAULT 0.00");
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00");
            $pdo->exec("ALTER TABLE {$t} ADD COLUMN stock_price DECIMAL(10,2) DEFAULT 0.00");
        } catch (Exception $e) {}
    }

    if (empty($query)) {
        // If empty query, return top 20 trending / popular products
        try {
            $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg, offer, in_stock, stock_qty, is_unlimited, gst_percent FROM products WHERE (disabled = 0 OR disabled IS NULL) ORDER BY index_num ASC LIMIT 20");
            $stmt->execute();
            $products = $stmt->fetchAll();
        } catch (Exception $ex) {
            $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg, offer, in_stock, stock_qty, is_unlimited FROM products WHERE (disabled = 0 OR disabled IS NULL) ORDER BY index_num ASC LIMIT 20");
            $stmt->execute();
            $products = $stmt->fetchAll();
        }
    } else {
        $words = preg_split('/\s+/', $query);
        $whereClauses = [];
        $params = [];

        foreach ($words as $w) {
            $w = trim($w);
            if (!empty($w)) {
                $whereClauses[] = "(name LIKE ? OR tamil_name LIKE ? OR cat LIKE ? OR sub_cat LIKE ?)";
                $wildcard = "%{$w}%";
                $params[] = $wildcard;
                $params[] = $wildcard;
                $params[] = $wildcard;
                $params[] = $wildcard;
            }
        }

        if (empty($whereClauses)) {
            $whereSql = "1=1";
        } else {
            $whereSql = implode(" AND ", $whereClauses);
        }

        // Order by exact/starts-with relevance first
        $exactTerm = $query;
        $startsTerm = "{$query}%";
        $sql = "
            SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg, offer, in_stock, stock_qty, is_unlimited, gst_percent,
                   CASE 
                       WHEN LOWER(name) = LOWER(?) THEN 1
                       WHEN LOWER(name) LIKE LOWER(?) THEN 2
                       WHEN LOWER(cat) = LOWER(?) THEN 3
                       ELSE 4
                   END AS relevance
            FROM products 
            WHERE ({$whereSql}) AND (disabled = 0 OR disabled IS NULL) 
            ORDER BY relevance ASC, index_num ASC 
            LIMIT 50
        ";

        $execParams = array_merge([$exactTerm, $startsTerm, $exactTerm], $params);
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($execParams);
            $products = $stmt->fetchAll();
        } catch (Exception $exSearch) {
            $fallbackSql = "
                SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg, offer, in_stock, stock_qty, is_unlimited,
                       CASE 
                           WHEN LOWER(name) = LOWER(?) THEN 1
                           WHEN LOWER(name) LIKE LOWER(?) THEN 2
                           WHEN LOWER(cat) = LOWER(?) THEN 3
                           ELSE 4
                       END AS relevance
                FROM products 
                WHERE ({$whereSql}) AND (disabled = 0 OR disabled IS NULL) 
                ORDER BY relevance ASC, index_num ASC 
                LIMIT 50
            ";
            $stmt = $pdo->prepare($fallbackSql);
            $stmt->execute($execParams);
            $products = $stmt->fetchAll();
        }
    }

    foreach ($products as &$p) {
        $p['price'] = floatval($p['price'] ?: 0);
        $p['original_price'] = floatval($p['original_price'] ?: $p['price']);
        $p['weight'] = intval($p['weight'] ?: 500);
        $p['disabled'] = ((int)($p['disabled'] ?? 0) === 1);
        $p['stock_qty'] = isset($p['stock_qty']) ? round(floatval($p['stock_qty']), 2) : 0.0;
        $p['is_unlimited'] = isset($p['is_unlimited']) && ((int)$p['is_unlimited'] === 1 || $p['is_unlimited'] === true || $p['is_unlimited'] === '1');
        
        $isStockZero = isset($p['in_stock']) && ((int)$p['in_stock'] === 0 || $p['in_stock'] === false || $p['in_stock'] === '0');
        if ($p['is_unlimited']) {
            $p['in_stock'] = true;
        } else {
            $p['in_stock'] = !$isStockZero;
        }
        $p['gst_percent'] = isset($p['gst_percent']) ? floatval($p['gst_percent']) : 5.00;
        $p['subscribe_flg'] = (int)($p['subscribe_flg'] ?? 0);
        $p['subscribeFlg'] = ($p['subscribe_flg'] === 1);
    }

    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
