<?php
require_once __DIR__ . '/../backend/config/db.php';

$pdo->exec("UPDATE products SET subscribe_flg = 1 WHERE cat IN ('Milk', 'Tender')");
$pdo->exec("UPDATE products SET subscribe_flg = 0 WHERE cat NOT IN ('Milk', 'Tender')");

echo "Cleaned subscribe_flg: Only Milk & Tender category products have subscribe_flg = 1.\n";

$stmt = $pdo->query("SELECT id, name, cat, subscribe_flg FROM products WHERE subscribe_flg = 1");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
