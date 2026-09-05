<?php
require_once __DIR__ . '/../backend/config/db.php';

$pdo->exec("CREATE TABLE IF NOT EXISTS razorpay_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL UNIQUE,
    mobile VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'created',
    payment_id VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

echo "Created razorpay_orders table successfully.\n";
