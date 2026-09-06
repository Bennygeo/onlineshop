<?php
require_once __DIR__ . '/../backend/config/db.php';

echo "=== USER 1 (9486140936) LATEST WALLET ===\n";
$stmt = $pdo->prepare("SELECT * FROM wallets WHERE mobile = ? ORDER BY id DESC LIMIT 2");
$stmt->execute(['9486140936']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== USER 3 (9888877777) WALLET ===\n";
$stmt = $pdo->prepare("SELECT * FROM wallets WHERE mobile = ? ORDER BY id DESC");
$stmt->execute(['9888877777']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== USER 3 (9888877777) COUPONS ===\n";
$stmt = $pdo->prepare("SELECT * FROM user_coupons WHERE mobile = ?");
$stmt->execute(['9888877777']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
