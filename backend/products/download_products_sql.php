<?php
require_once __DIR__ . '/../config/db.php';

$cat = getParam('cat');
$sub_cat = getParam('sub_cat');

if (!$pdo) {
    // Return sample mock product array matching Angular interface
    sendJson([
        [
            'id' => 'p1',
            'name' => 'Fresh Tomato',
            'tamil_name' => 'தக்காளி',
            'cat' => 'Vegetables',
            'sub_cat' => 'Daily Veg',
            'price' => 40,
            'original_price' => 50,
            'weight' => 500,
            'unit_name' => 'grams',
            'img_url' => 'assets/products/veg/thinkspot_greenTomato.jpg',
            'disabled' => false,
            'index' => 1,
            'offer' => 20
        ],
        [
            'id' => 'p2',
            'name' => 'Fresh Onion',
            'tamil_name' => 'வெங்காயம்',
            'cat' => 'Vegetables',
            'sub_cat' => 'Daily Veg',
            'price' => 30,
            'original_price' => 40,
            'weight' => 1000,
            'unit_name' => 'grams',
            'img_url' => 'assets/products/veg/thinkspot_whiteOnion.jpg',
            'disabled' => false,
            'index' => 2,
            'offer' => 25
        ]
    ]);
}

try {
    $table_name = getParam('table_name');
    if (!$table_name) { $table_name = 'products'; }

    try {
        $sql = "SELECT id, name, tamil_name, cat, sub_cat, price, original_price, stock_price, profit_percent, weight, unit_name, img_url, disabled, subscribe_flg, index_num AS `index`, offer FROM {$table_name} WHERE 1=1";
        $params = [];
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
        $products = $stmt->fetchAll();
    } catch (Exception $exTable) {
        // Fallback to 'products' table
        $sql = "SELECT id, name, tamil_name, cat, sub_cat, price, original_price, stock_price, profit_percent, weight, unit_name, img_url, disabled, subscribe_flg, index_num AS `index`, offer FROM products WHERE 1=1";
        $params = [];
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
        $products = $stmt->fetchAll();
    }

    foreach ($products as &$p) {
        $p['price'] = (isset($p['price']) && floatval($p['price']) > 0) ? floatval($p['price']) : 60;
        $p['original_price'] = (isset($p['original_price']) && floatval($p['original_price']) > 0) ? floatval($p['original_price']) : 80;
        $p['weight'] = (isset($p['weight']) && intval($p['weight']) > 0) ? intval($p['weight']) : 500;
        $p['unit_name'] = !empty($p['unit_name']) ? $p['unit_name'] : 'grams';
        $p['stock_price'] = (isset($p['stock_price']) && floatval($p['stock_price']) > 0) ? floatval($p['stock_price']) : 45;
        $p['profit_percent'] = (isset($p['profit_percent']) && floatval($p['profit_percent']) > 0) ? floatval($p['profit_percent']) : 25;
        $p['disabled'] = (isset($p['disabled']) && (int)$p['disabled'] === 1) ? true : false;
        $p['subscribe_flg'] = (isset($p['subscribe_flg']) && (int)$p['subscribe_flg'] === 1) ? 1 : 0;
        $p['subscribeFlg'] = ($p['subscribe_flg'] === 1);
    }

    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
