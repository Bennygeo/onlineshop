<?php
require_once __DIR__ . '/../backend/config/db.php';

echo "=== DISTINCT CATEGORIES ===\n";
$cats = $pdo->query("SELECT DISTINCT cat FROM products")->fetchAll(PDO::FETCH_COLUMN);
print_r($cats);

echo "\n=== PRODUCTS WITH MILK OR COCONUT IN NAME OR CAT ===\n";
$stmt = $pdo->query("SELECT id, name, cat, subscribe_flg FROM products WHERE cat IN ('Milk', 'Tender', 'Naturalhydrants', 'Dairyeggs') OR name LIKE '%milk%' OR name LIKE '%coconut%' OR name LIKE '%tender%'");
$prods = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($prods);
