<?php
require_once __DIR__ . '/../backend/config/db.php';

echo "=== WALLETS ===\n";
print_r($pdo->query('SHOW COLUMNS FROM wallets')->fetchAll());

echo "=== RAZORPAY_ORDERS ===\n";
print_r($pdo->query('SHOW COLUMNS FROM razorpay_orders')->fetchAll());
