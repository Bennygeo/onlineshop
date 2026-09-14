<?php
require_once __DIR__ . '/../config/db.php';

$query = trim(getParam('query', ''));

if (!$pdo) {
    sendJson([]);
}

try {
    if (empty($query)) {
        // If empty query, return top 20 trending / popular products
        $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg, offer FROM products WHERE disabled = 0 ORDER BY index_num ASC LIMIT 20");
        $stmt->execute();
        $products = $stmt->fetchAll();
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
            SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg, offer,
                   CASE 
                       WHEN LOWER(name) = LOWER(?) THEN 1
                       WHEN LOWER(name) LIKE LOWER(?) THEN 2
                       WHEN LOWER(cat) = LOWER(?) THEN 3
                       ELSE 4
                   END AS relevance
            FROM products 
            WHERE ({$whereSql}) AND disabled = 0 
            ORDER BY relevance ASC, index_num ASC 
            LIMIT 50
        ";

        $execParams = array_merge([$exactTerm, $startsTerm, $exactTerm], $params);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execParams);
        $products = $stmt->fetchAll();
    }

    foreach ($products as &$p) {
        $p['price'] = floatval($p['price'] ?: 0);
        $p['original_price'] = floatval($p['original_price'] ?: $p['price']);
        $p['weight'] = intval($p['weight'] ?: 500);
        $p['disabled'] = ((int)($p['disabled'] ?? 0) === 1);
        $p['subscribe_flg'] = (int)($p['subscribe_flg'] ?? 0);
        $p['subscribeFlg'] = ($p['subscribe_flg'] === 1);
    }

    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
