<?php
require_once __DIR__ . '/../backend/config/db.php';

// Check if subscribe_flg column exists, if not add it
$checkCol = $pdo->query("SHOW COLUMNS FROM products LIKE 'subscribe_flg'");
if ($checkCol->rowCount() == 0) {
    $pdo->exec("ALTER TABLE products ADD COLUMN subscribe_flg INT DEFAULT 0 AFTER disabled");
    echo "Added subscribe_flg column to products table.\n";
} else {
    echo "subscribe_flg column already exists.\n";
}

// Enable subscription for Milk and Tender products in DB
$pdo->exec("UPDATE products SET subscribe_flg = 1 WHERE cat IN ('Milk', 'Tender') OR name LIKE '%Milk%' OR name LIKE '%Tender%' OR name LIKE '%Coconut%'");
$pdo->exec("UPDATE products SET subscribe_flg = 0 WHERE cat NOT IN ('Milk', 'Tender') AND name NOT LIKE '%Milk%' AND name NOT LIKE '%Tender%' AND name NOT LIKE '%Coconut%'");

echo "Updated subscribe_flg in database: Enabled (1) for Milk & Tender products, Disabled (0) for others.\n";

$stmt = $pdo->query("SELECT id, name, cat, subscribe_flg FROM products WHERE subscribe_flg = 1");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
