<?php
require_once __DIR__ . '/../config/db.php';

$p_id = getParam('p_id') ?: getParam('id');

if (!$p_id) {
    sendJson(['error' => 'Product ID is required'], 400);
}

if (!$pdo) {
    sendJson([
        'p_id' => $p_id,
        'description' => 'Freshly sourced organic farm produce delivered directly to your home.',
        'benefits' => 'Rich in essential nutrients, vitamins, and antioxidants.'
    ]);
}

try {
    $stmt = $pdo->prepare("SELECT id AS p_id, name, cat, sub_cat, price, weight, unit_name, img_url FROM products WHERE id = ?");
    $stmt->execute([$p_id]);
    $prod = $stmt->fetch();
    if ($prod) {
        $prod['description'] = 'Freshly sourced organic farm produce delivered directly to your home.';
        $prod['benefits'] = 'Rich in essential nutrients, vitamins, and antioxidants.';
        sendJson($prod);
    } else {
        sendJson(null);
    }
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
