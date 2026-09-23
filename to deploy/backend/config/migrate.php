<?php
require_once __DIR__ . '/db.php';

if ($pdo) {
    $columns = [
        "orders" => [
            "assigned_to VARCHAR(100) DEFAULT ''",
            "delivery_inst TEXT",
            "delivery_mode VARCHAR(100) DEFAULT ''",
            "delivered_at DATETIME NULL",
            "undelivered_reason VARCHAR(255) DEFAULT NULL",
            "refund_amount DECIMAL(10,2) DEFAULT 0.00",
            "refund_notes TEXT DEFAULT NULL"
        ],
        "order_items" => [
            "item_status VARCHAR(50) DEFAULT 'packed'",
            "missing_qty INT DEFAULT 0",
            "refund_amount DECIMAL(10,2) DEFAULT 0.00"
        ]
    ];

    foreach ($columns as $table => $cols) {
        foreach ($cols as $colDef) {
            $colName = explode(" ", $colDef)[0];
            try {
                $pdo->exec("ALTER TABLE `$table` ADD COLUMN $colDef");
                echo "Added $table.$colName\n";
            } catch (Exception $e) {
                echo "Notice $table.$colName: " . $e->getMessage() . "\n";
            }
        }
    }
}
echo "Migration finished.\n";
