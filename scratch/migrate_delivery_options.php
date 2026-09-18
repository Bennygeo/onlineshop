<?php
require_once 'backend/config/db.php';

$productCols = [
    'allow_next_day' => "ALTER TABLE products ADD COLUMN allow_next_day INT DEFAULT 1",
    'allow_immediate_10' => "ALTER TABLE products ADD COLUMN allow_immediate_10 INT DEFAULT 0",
    'allow_immediate_30' => "ALTER TABLE products ADD COLUMN allow_immediate_30 INT DEFAULT 0",
    'allow_immediate_60' => "ALTER TABLE products ADD COLUMN allow_immediate_60 INT DEFAULT 0"
];

foreach ($productCols as $col => $sql) {
    try {
        $pdo->exec($sql);
        echo "Added column $col to products\n";
    } catch (Exception $e) {
        echo "Column $col on products: " . $e->getMessage() . "\n";
    }
}

$orderCols = [
    'delivery_option' => "ALTER TABLE orders ADD COLUMN delivery_option VARCHAR(50) DEFAULT 'NEXT_DAY_7AM'",
    'delivery_expected_at' => "ALTER TABLE orders ADD COLUMN delivery_expected_at DATETIME DEFAULT NULL",
    'delivery_cutoff_ist' => "ALTER TABLE orders ADD COLUMN delivery_cutoff_ist VARCHAR(50) DEFAULT ''"
];

foreach ($orderCols as $col => $sql) {
    try {
        $pdo->exec($sql);
        echo "Added column $col to orders\n";
    } catch (Exception $e) {
        echo "Column $col on orders: " . $e->getMessage() . "\n";
    }
}

// Enable 10m/30m/60m on Apple FUJI for demonstration/testing
$pdo->exec("UPDATE products SET allow_next_day = 1, allow_immediate_10 = 1, allow_immediate_30 = 1, allow_immediate_60 = 1 WHERE id = 'p_thinkspot_appleFUJI'");
echo "Updated Apple FUJI with immediate delivery options enabled\n";
