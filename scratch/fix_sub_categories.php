<?php
require_once __DIR__ . '/../backend/config/db.php';

$pdo->exec("UPDATE products SET cat = 'Milk', sub_cat = 'General' WHERE id = 'p_thinkspot_milk_1'");
$pdo->exec("UPDATE products SET cat = 'Tender', sub_cat = 'General' WHERE id = 'p_thinkspot_tender_coconut'");

echo "Updated p_thinkspot_milk_1 and p_thinkspot_tender_coconut back to original categories.\n";

$stmt = $pdo->query("SELECT id, name, cat, sub_cat FROM products WHERE cat='Subscriptions'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
