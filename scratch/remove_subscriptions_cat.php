<?php
require_once __DIR__ . '/../backend/config/db.php';

// Remove products with cat = 'Subscriptions' or reassign them to Milk / Tender
$pdo->exec("DELETE FROM products WHERE id IN ('p_sub_fresh_milk', 'p_sub_tender_coconut')");
$pdo->exec("UPDATE products SET cat = 'Milk' WHERE id = 'p_thinkspot_milk_1'");
$pdo->exec("UPDATE products SET cat = 'Tender' WHERE id = 'p_thinkspot_tender_coconut'");
$pdo->exec("UPDATE products SET cat = 'Milk' WHERE cat = 'Subscriptions'");

echo "Removed Subscriptions category and reassigned Milk and Tender products.\n";

$stmt = $pdo->query("SELECT DISTINCT cat FROM products WHERE disabled = 0 ORDER BY cat ASC");
print_r($stmt->fetchAll(PDO::FETCH_COLUMN));
