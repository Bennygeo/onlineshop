<?php
require_once __DIR__ . '/../backend/config/db.php';
$stmt = $pdo->query("SELECT id, name, cat, sub_cat FROM products WHERE name LIKE '%Milk%' OR name LIKE '%Tender%' OR name LIKE '%Coconut%' OR cat IN ('Milk', 'Tender', 'Subscriptions')");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
