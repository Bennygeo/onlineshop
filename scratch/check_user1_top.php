<?php
require_once __DIR__ . '/../backend/config/db.php';

echo "=== USER 1 (9486140936) LATEST 3 WALLET ENTRIES ===\n";
$stmt = $pdo->prepare("SELECT * FROM wallets WHERE mobile = ? ORDER BY id DESC LIMIT 3");
$stmt->execute(['9486140936']);
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
