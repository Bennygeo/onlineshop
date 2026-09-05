<?php
require_once __DIR__ . '/../backend/config/db.php';
$stmt = $pdo->query("SHOW COLUMNS FROM wallets");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
