<?php
require_once __DIR__ . '/../backend/config/db.php';
$stmt = $pdo->query("SELECT id, name, cat, sub_cat FROM products WHERE cat='Subscriptions'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
