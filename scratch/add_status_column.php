<?php
require_once __DIR__ . '/../backend/config/db.php';

try {
    $pdo->exec("ALTER TABLE wallets ADD COLUMN status VARCHAR(20) DEFAULT 'authorized'");
    echo "Status column added successfully to wallets table.\n";
} catch (Exception $e) {
    echo "Notice: " . $e->getMessage() . "\n";
}
