<?php
require_once __DIR__ . '/../backend/config/db.php';

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL UNIQUE,
        mobile VARCHAR(20) NOT NULL,
        address_json TEXT,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        payment_type VARCHAR(50) DEFAULT 'COD',
        status VARCHAR(20) DEFAULT 'PLACED',
        delivery_date VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        product_id VARCHAR(100) NOT NULL,
        product_name VARCHAR(255),
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        weight VARCHAR(50),
        rangeDates TEXT,
        subscribedDates TEXT,
        subscriptionType VARCHAR(50),
        subsStatus VARCHAR(50) DEFAULT 'active',
        pausedDates TEXT,
        startDate VARCHAR(50),
        endDate VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    echo "Orders and order_items tables ready.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
