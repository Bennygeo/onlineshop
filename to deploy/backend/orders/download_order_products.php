<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data') ?: getParam('ids') ?: getParam('products');
$ids = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$order_id = isset($details['order_id']) ? $details['order_id'] : getParam('order_id');

if (!$pdo) {
    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
}

try {
    if (!empty($ids) && is_array($ids)) {
        $cleanIds = array_values(array_filter($ids));
        if (!empty($cleanIds)) {
            $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
            $stmt = $pdo->prepare("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, subscribe_flg AS subscribe_flg, subscribe_flg AS subscribeFlg, index_num AS `index`, offer FROM products WHERE id IN ($placeholders)");
            $stmt->execute($cleanIds);
            $products = $stmt->fetchAll();
            sendJson(['live' => $products ?: [], 'outOfStock' => [], 'cart' => []]);
        }
    }

    if ($order_id) {
        $stmt = $pdo->prepare("SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.price, p.img_url, p.unit_name, p.weight FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?");
        $stmt->execute([$order_id]);
        $items = $stmt->fetchAll();
        sendJson(['live' => $items ?: [], 'items' => $items ?: []]);
    }

    sendJson(['live' => [], 'outOfStock' => [], 'cart' => []]);
} catch (Exception $e) {
    sendJson(['live' => [], 'error' => $e->getMessage()]);
}
