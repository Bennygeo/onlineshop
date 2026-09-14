<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');

if (!$mobile || !$pdo) {
    sendJson([]);
}

try {
    $sql = "
        SELECT DISTINCT p.id, p.name, p.tamil_name, p.cat, p.sub_cat, p.price, p.original_price, 
                        p.weight, p.unit_name, p.img_url, p.disabled, p.subscribe_flg, p.offer,
                        MAX(o.created_at) AS last_ordered_at
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN products p ON (oi.product_id = p.id OR oi.product_id = p.name)
        WHERE o.mobile = ? AND o.status != 'CANCELLED'
        GROUP BY p.id, p.name, p.tamil_name, p.cat, p.sub_cat, p.price, p.original_price, 
                 p.weight, p.unit_name, p.img_url, p.disabled, p.subscribe_flg, p.offer
        ORDER BY last_ordered_at DESC
        LIMIT 12
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$mobile]);
    $products = $stmt->fetchAll();

    foreach ($products as &$p) {
        $p['price'] = floatval($p['price']);
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
