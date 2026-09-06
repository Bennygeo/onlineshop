<?php
require_once __DIR__ . '/../backend/config/db.php';

echo "=== USER 1 (9486140936) WALLET ===\n";
$stmt = $pdo->prepare("SELECT * FROM wallets WHERE mobile = ? ORDER BY id DESC");
$stmt->execute(['9486140936']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== USER 2 (9994239924) WALLET ===\n";
$stmt = $pdo->prepare("SELECT * FROM wallets WHERE mobile = ? ORDER BY id DESC");
$stmt->execute(['9994239924']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== USER 2 (9994239924) COUPONS ===\n";
$stmt = $pdo->prepare("SELECT * FROM user_coupons WHERE mobile = ?");
$stmt->execute(['9994239924']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
