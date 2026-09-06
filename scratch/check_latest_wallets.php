<?php
require_once __DIR__ . '/../backend/config/db.php';

$stmt = $pdo->prepare('SELECT * FROM wallets ORDER BY id DESC LIMIT 5');
$stmt->execute();
print_r($stmt->fetchAll());
