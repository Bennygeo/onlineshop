<?php
require_once __DIR__ . '/../backend/config/db.php';
$stmt = $pdo->query("SELECT id, name, price, original_price, stock_price, profit_percent, show_off_percent FROM products WHERE name LIKE '%Davana%' OR name LIKE '%Mari%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
