<?php
require_once __DIR__ . '/../backend/config/db.php';

$columns = [
    "weight VARCHAR(50) DEFAULT ''",
    "rangeDates TEXT",
    "subscribedDates TEXT",
    "subscriptionType VARCHAR(50) DEFAULT 'none'",
    "subsStatus VARCHAR(50) DEFAULT 'active'",
    "pausedDates TEXT",
    "startDate VARCHAR(50) DEFAULT ''",
    "endDate VARCHAR(50) DEFAULT ''"
];

foreach ($columns as $col) {
    try {
        $pdo->exec("ALTER TABLE order_items ADD COLUMN " . $col);
        echo "Added column: " . $col . "\n";
    } catch (Exception $e) {
        echo "Notice: " . $e->getMessage() . "\n";
    }
}
