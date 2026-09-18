<?php
require_once __DIR__ . '/../config/db.php';

$product_id = getParam('product_id');

if (!$pdo) {
    sendJson([]);
}

try {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS product_purchases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id VARCHAR(100) NOT NULL,
                product_name VARCHAR(255) DEFAULT '',
                quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                unit_name VARCHAR(50) DEFAULT 'kg',
                total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                vendor_name VARCHAR(255) DEFAULT '',
                notes TEXT DEFAULT NULL,
                purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_prod (product_id),
                INDEX idx_date (purchase_date)
            )
        ");
    } catch (Exception $e) {}

    if ($product_id) {
        $stmt = $pdo->prepare("SELECT * FROM product_purchases WHERE product_id = ? ORDER BY purchase_date DESC, id DESC");
        $stmt->execute([$product_id]);
    } else {
        $stmt = $pdo->prepare("SELECT * FROM product_purchases ORDER BY purchase_date DESC, id DESC LIMIT 100");
        $stmt->execute();
    }
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($records as &$r) {
        $r['quantity'] = floatval($r['quantity']);
        $r['total_cost'] = floatval($r['total_cost']);
        $r['cost_per_unit'] = floatval($r['cost_per_unit']);
    }

    sendJson($records ?: []);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
