-- ==============================================================
-- TomorrowNeeds Database Quick Fix (Run in phpMyAdmin SQL tab)
-- Target Database: u628989339_tmwneeds
-- ==============================================================

-- 1. Create missing tables
CREATE TABLE IF NOT EXISTS `store_settings` (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `store_settings` (`key`, `value`) VALUES
('weekly_off_day', 'None'),
('enable_razorpay', '1'),
('enable_cod', '1');

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `delivery_partners` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `mobile` VARCHAR(20) NOT NULL UNIQUE,
    `status` VARCHAR(20) DEFAULT 'active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `razorpay_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` VARCHAR(100) UNIQUE NOT NULL,
    `mobile` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(10,2) DEFAULT 0.00,
    `currency` VARCHAR(10) DEFAULT 'INR',
    `status` VARCHAR(20) DEFAULT 'created',
    `payment_id` VARCHAR(100) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add missing columns to order_items
ALTER TABLE `order_items`
    ADD COLUMN IF NOT EXISTS `weight` VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `item_status` VARCHAR(50) DEFAULT 'packed',
    ADD COLUMN IF NOT EXISTS `missing_qty` INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `refund_amount` DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS `subscriptionType` VARCHAR(50) DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS `rangeDates` TEXT,
    ADD COLUMN IF NOT EXISTS `subscribedDates` TEXT,
    ADD COLUMN IF NOT EXISTS `subsStatus` VARCHAR(50) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS `pausedDates` TEXT,
    ADD COLUMN IF NOT EXISTS `startDate` VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `endDate` VARCHAR(50) DEFAULT '';

-- 3. Add missing columns to orders
ALTER TABLE `orders`
    ADD COLUMN IF NOT EXISTS `assigned_to` VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `delivery_inst` TEXT,
    ADD COLUMN IF NOT EXISTS `delivery_mode` VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `delivery_option` VARCHAR(50) DEFAULT 'next_day',
    ADD COLUMN IF NOT EXISTS `delivery_expected_at` VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `delivery_cutoff_ist` VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS `delivery_slot` VARCHAR(50) DEFAULT 'SLOT_ANYTIME',
    ADD COLUMN IF NOT EXISTS `delivery_slot_label` VARCHAR(100) DEFAULT 'Anytime Delivery',
    ADD COLUMN IF NOT EXISTS `order_source` VARCHAR(50) DEFAULT 'CLIENT_WEB',
    ADD COLUMN IF NOT EXISTS `created_by` VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `delivered_at` DATETIME NULL,
    ADD COLUMN IF NOT EXISTS `undelivered_reason` VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `refund_amount` DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS `refund_notes` TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `coupon` VARCHAR(50) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `coupon_discount` DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS `referral_code` VARCHAR(50) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `referred_by` VARCHAR(100) DEFAULT NULL;

-- 4. Add missing columns to products
ALTER TABLE `products`
    ADD COLUMN IF NOT EXISTS `in_stock` INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS `stock_qty` DECIMAL(10,2) DEFAULT 100.00,
    ADD COLUMN IF NOT EXISTS `gst_percent` DECIMAL(5,2) DEFAULT 5.00,
    ADD COLUMN IF NOT EXISTS `stock_price` DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS `profit_percent` DECIMAL(5,2) DEFAULT 10.00,
    ADD COLUMN IF NOT EXISTS `preferred_days` VARCHAR(255) DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS `subscribe_flg` INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `allow_next_day` INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS `allow_immediate_10` INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `allow_immediate_30` INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `allow_immediate_60` INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `is_unlimited` TINYINT(1) DEFAULT 0;

-- 5. Add missing columns to users & wallets
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `referral_id` VARCHAR(50) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `referred_by` VARCHAR(50) DEFAULT NULL;

ALTER TABLE `wallets`
    ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) DEFAULT 'authorized';
