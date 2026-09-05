<?php
require_once __DIR__ . '/../config/db.php';

$table_name = getParam('table_name');

if ($table_name === 'banners') {
    sendJson([
        [ 'index' => 1, 'route_url' => '/products/category/Vegetables', 'bg_clr' => '#e8f5e9', 'title' => 'Fresh Veggies', 'description' => 'Get farm fresh vegetables.' ],
        [ 'index' => 2, 'route_url' => '/products/category/Fruits', 'bg_clr' => '#fff3e0', 'title' => 'Seasonal Fruits', 'description' => 'Enjoy sweet and fresh fruits.' ],
        [ 'index' => 3, 'route_url' => '/products/category/Naturalhydrants', 'bg_clr' => '#e0f7fa', 'title' => 'Tender Coconut', 'description' => 'Stay hydrated naturally.' ],
        [ 'index' => 4, 'route_url' => '/products/category/Greenssprouts', 'bg_clr' => '#f1f8e9', 'title' => 'Greens', 'description' => 'Healthy greens.' ],
        [ 'index' => 5, 'route_url' => '/products/category/Woodpressed', 'bg_clr' => '#fff8e1', 'title' => 'Oils', 'description' => 'Woodpressed oils.' ]
    ]);
}

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->query("SELECT id, name, tamil_name, cat, sub_cat, price, original_price, weight, unit_name, img_url, disabled, index_num AS `index`, offer FROM products WHERE disabled = 0 ORDER BY index_num ASC");
    $products = $stmt->fetchAll();
    sendJson($products);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
