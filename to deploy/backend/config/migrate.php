<?php
require_once __DIR__ . '/db.php';

header('Content-Type: text/html; charset=UTF-8');
echo "<h2>TomorrowNeeds Database Migration & Schema Fix</h2>";

if (!$pdo) {
    echo "<p style='color:red;'>❌ Database connection failed. Please check credentials in db.php.</p>";
    exit();
}

$tables = [
    "store_settings" => "
        CREATE TABLE IF NOT EXISTS `store_settings` (
            `key` VARCHAR(100) PRIMARY KEY,
            `value` TEXT,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "system_logs" => "
        CREATE TABLE IF NOT EXISTS `system_logs` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `level` VARCHAR(20) NOT NULL,
            `source` VARCHAR(20) DEFAULT 'backend',
            `message` TEXT NOT NULL,
            `file` VARCHAR(255) DEFAULT NULL,
            `line` INT DEFAULT NULL,
            `trace` MEDIUMTEXT DEFAULT NULL,
            `url` VARCHAR(500) DEFAULT NULL,
            `user_info` VARCHAR(500) DEFAULT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (`level`),
            INDEX idx_source (`source`),
            INDEX idx_created_at (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "delivery_partners" => "
        CREATE TABLE IF NOT EXISTS `delivery_partners` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(100) NOT NULL,
            `mobile` VARCHAR(20) NOT NULL UNIQUE,
            `status` VARCHAR(20) DEFAULT 'active',
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "daily_expenses" => "
        CREATE TABLE IF NOT EXISTS `daily_expenses` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `expense_date` DATE NOT NULL,
            `procurement` DECIMAL(10,2) DEFAULT 0.00,
            `rent` DECIMAL(10,2) DEFAULT 0.00,
            `delivery` DECIMAL(10,2) DEFAULT 0.00,
            `electricity` DECIMAL(10,2) DEFAULT 0.00,
            `packaging` DECIMAL(10,2) DEFAULT 0.00,
            `salaries` DECIMAL(10,2) DEFAULT 0.00,
            `marketing` DECIMAL(10,2) DEFAULT 0.00,
            `other` DECIMAL(10,2) DEFAULT 0.00,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "razorpay_orders" => "
        CREATE TABLE IF NOT EXISTS `razorpay_orders` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `order_id` VARCHAR(100) UNIQUE NOT NULL,
            `mobile` VARCHAR(20) NOT NULL,
            `amount` DECIMAL(10,2) DEFAULT 0.00,
            `currency` VARCHAR(10) DEFAULT 'INR',
            `status` VARCHAR(20) DEFAULT 'created',
            `payment_id` VARCHAR(100) DEFAULT NULL,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "product_purchases" => "
        CREATE TABLE IF NOT EXISTS `product_purchases` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `product_id` VARCHAR(100) NOT NULL,
            `product_name` VARCHAR(255) DEFAULT '',
            `quantity` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `unit_name` VARCHAR(50) DEFAULT 'kg',
            `total_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `cost_per_unit` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `vendor_name` VARCHAR(255) DEFAULT '',
            `notes` TEXT DEFAULT NULL,
            `purchase_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prod (`product_id`),
            INDEX idx_date (`purchase_date`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    "
];

echo "<h3>1. Ensuring Required Tables</h3><ul>";
foreach ($tables as $tbl => $sql) {
    try {
        $pdo->exec($sql);
        echo "<li style='color:green;'>Table `$tbl` verified/created.</li>";
    } catch (Exception $e) {
        echo "<li style='color:orange;'>Table `$tbl`: " . htmlspecialchars($e->getMessage()) . "</li>";
    }
}
echo "</ul>";

// Default settings
try {
    $pdo->exec("INSERT IGNORE INTO `store_settings` (`key`, `value`) VALUES
        ('weekly_off_day', 'None'),
        ('enable_razorpay', '1'),
        ('enable_cod', '1')");
    echo "<p style='color:green;'>✓ Default store settings inserted.</p>";
} catch (Exception $e) {}

$columns = [
    "orders" => [
        "assigned_to VARCHAR(100) DEFAULT ''",
        "delivery_inst TEXT",
        "delivery_mode VARCHAR(100) DEFAULT ''",
        "delivery_option VARCHAR(50) DEFAULT 'next_day'",
        "delivery_expected_at VARCHAR(100) DEFAULT ''",
        "delivery_cutoff_ist VARCHAR(100) DEFAULT ''",
        "order_source VARCHAR(50) DEFAULT 'CLIENT_WEB'",
        "created_by VARCHAR(100) DEFAULT NULL",
        "delivered_at DATETIME NULL",
        "undelivered_reason VARCHAR(255) DEFAULT NULL",
        "refund_amount DECIMAL(10,2) DEFAULT 0.00",
        "refund_notes TEXT DEFAULT NULL",
        "coupon VARCHAR(50) DEFAULT NULL",
        "coupon_discount DECIMAL(10,2) DEFAULT 0.00",
        "referral_code VARCHAR(50) DEFAULT NULL",
        "referred_by VARCHAR(100) DEFAULT NULL"
    ],
    "order_items" => [
        "weight VARCHAR(50) DEFAULT ''",
        "item_status VARCHAR(50) DEFAULT 'packed'",
        "missing_qty INT DEFAULT 0",
        "refund_amount DECIMAL(10,2) DEFAULT 0.00",
        "subscriptionType VARCHAR(50) DEFAULT 'none'",
        "rangeDates TEXT",
        "subscribedDates TEXT",
        "subsStatus VARCHAR(50) DEFAULT 'active'",
        "pausedDates TEXT",
        "startDate VARCHAR(50) DEFAULT ''",
        "endDate VARCHAR(50) DEFAULT ''"
    ],
    "wallets" => [
        "status VARCHAR(20) DEFAULT 'authorized'"
    ],
    "users" => [
        "referral_id VARCHAR(50) DEFAULT NULL",
        "referred_by VARCHAR(50) DEFAULT NULL"
    ],
    "coupons" => [
        "count INT DEFAULT 5",
        "categories VARCHAR(255) DEFAULT 'all'",
        "description VARCHAR(255) DEFAULT NULL",
        "offer VARCHAR(100) DEFAULT NULL",
        "offer_desc VARCHAR(255) DEFAULT NULL"
    ],
    "products" => [
        "in_stock INT DEFAULT 1",
        "stock_qty DECIMAL(10,2) DEFAULT 100.00",
        "gst_percent DECIMAL(5,2) DEFAULT 5.00",
        "stock_price DECIMAL(10,2) DEFAULT 0.00",
        "profit_percent DECIMAL(5,2) DEFAULT 10.00",
        "preferred_days VARCHAR(255) DEFAULT '[]'",
        "subscribe_flg INT DEFAULT 0",
        "allow_next_day INT DEFAULT 1",
        "allow_immediate_10 INT DEFAULT 0",
        "allow_immediate_30 INT DEFAULT 0",
        "allow_immediate_60 INT DEFAULT 0",
        "is_unlimited TINYINT(1) DEFAULT 0"
    ]
];

echo "<h3>2. Ensuring Required Columns</h3><ul>";
foreach ($columns as $table => $cols) {
    foreach ($cols as $colDef) {
        $colName = explode(" ", $colDef)[0];
        try {
            $pdo->exec("ALTER TABLE `$table` ADD COLUMN $colDef");
            echo "<li style='color:green;'>Added `$table`.`$colName`</li>";
        } catch (Exception $e) {
            // Usually already exists
            echo "<li style='color:gray;'>`$table`.`$colName`: Verified (already exists).</li>";
        }
    }
}
echo "</ul>";

echo "<h3 style='color:green;'>🎉 Database Migration Completed Successfully!</h3>";
echo "<p><a href='/'>Go to TomorrowNeeds Home</a></p>";
