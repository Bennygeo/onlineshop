<?php
require_once __DIR__ . '/../config/db.php';

$query = getParam('query', '');

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer FROM products WHERE (name LIKE ? OR tamil_name LIKE ? OR cat LIKE ?) AND disabled = 0 LIMIT 20");
    $searchTerm = "%{$query}%";
    $stmt->execute([$searchTerm, $searchTerm, $searchTerm]);
    $products = $stmt->fetchAll();
    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
