<?php
require_once __DIR__ . '/../backend/config/db.php';

echo "=== ORDER_ITEMS SCHEMA ===\n";
try {
    print_r($pdo->query("SHOW COLUMNS FROM order_items")->fetchAll());
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "=== ORDERS SCHEMA ===\n";
try {
    print_r($pdo->query("SHOW COLUMNS FROM orders")->fetchAll());
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
