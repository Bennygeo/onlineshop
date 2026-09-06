<?php
require_once __DIR__ . '/../backend/config/db.php';

// First reset all products to subscribe_flg = 0
$pdo->exec("UPDATE products SET subscribe_flg = 0");

// Enable subscription (subscribe_flg = 1) ONLY for Milk category and Tender Coconut products
$pdo->exec("UPDATE products SET subscribe_flg = 1 WHERE cat IN ('Milk', 'Tender') OR LOWER(name) LIKE '%milk 1%' OR LOWER(name) LIKE '%tender coconut%'");

// Verify results
$stmt = $pdo->query("SELECT id, name, cat, subscribe_flg FROM products WHERE subscribe_flg = 1");
$enabled = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "=== PRODUCTS WITH SUBSCRIPTION ENABLED (subscribe_flg = 1) ===\n";
print_r($enabled);

$stmtTotal = $pdo->query("SELECT COUNT(*) AS total_enabled FROM products WHERE subscribe_flg = 1");
$countEnabled = $stmtTotal->fetchColumn();

$stmtDisabled = $pdo->query("SELECT COUNT(*) AS total_disabled FROM products WHERE subscribe_flg = 0");
$countDisabled = $stmtDisabled->fetchColumn();

echo "\nSummary: Enabled = $countEnabled, Disabled = $countDisabled\n";
