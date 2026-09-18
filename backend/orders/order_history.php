<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$mobile = isset($details['mobile']) ? $details['mobile'] : getParam('mobile');

if (!$mobile || !$pdo) {
    sendJson([]);
}

try {
    $alters = [
        "ALTER TABLE orders ADD COLUMN order_source VARCHAR(50) DEFAULT 'CLIENT_WEB'",
        "ALTER TABLE orders ADD COLUMN created_by VARCHAR(100) DEFAULT NULL",
        "ALTER TABLE orders ADD COLUMN delivery_inst TEXT",
        "ALTER TABLE orders ADD COLUMN delivery_mode VARCHAR(100) DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL",
        "ALTER TABLE orders ADD COLUMN undelivered_reason VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE orders ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE orders ADD COLUMN refund_notes TEXT DEFAULT NULL",
        "ALTER TABLE orders ADD COLUMN assigned_to VARCHAR(100) DEFAULT ''"
    ];
    foreach ($alters as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Exception $e) {}
    }

    try {
        $stmt = $pdo->prepare("
            SELECT o.order_id, o.mobile, o.address_json, o.total_amount, o.payment_type, 
                   COALESCE(o.order_source, 'CLIENT_WEB') AS order_source, 
                   o.created_by, o.status, o.delivery_date, o.delivery_inst, o.delivery_mode, 
                   o.delivery_option, o.delivery_expected_at, o.delivery_cutoff_ist, o.created_at, 
                   o.delivered_at, o.undelivered_reason, o.refund_amount, o.refund_notes, o.assigned_to,
                   EXISTS (
                       SELECT 1 FROM order_items oi 
                       WHERE oi.order_id = o.order_id 
                         AND (
                             (oi.subscriptionType IS NOT NULL AND oi.subscriptionType != '' AND oi.subscriptionType != 'none' AND oi.subscriptionType != 'undefined')
                             OR (oi.rangeDates IS NOT NULL AND oi.rangeDates != '' AND oi.rangeDates != '[]' AND oi.rangeDates != 'undefined' AND oi.rangeDates != 'null')
                             OR (oi.subscribedDates IS NOT NULL AND oi.subscribedDates != '' AND oi.subscribedDates != '[]' AND oi.subscribedDates != 'undefined' AND oi.subscribedDates != 'null')
                         )
                   ) AS is_subscription
            FROM orders o 
            WHERE o.mobile = ? 
            ORDER BY o.created_at DESC
        ");
        $stmt->execute([$mobile]);
        $orders = $stmt->fetchAll();
    } catch (Exception $queryEx) {
        $stmt = $pdo->prepare("
            SELECT o.*,
                   EXISTS (
                       SELECT 1 FROM order_items oi 
                       WHERE oi.order_id = o.order_id 
                         AND (
                             (oi.subscriptionType IS NOT NULL AND oi.subscriptionType != '' AND oi.subscriptionType != 'none' AND oi.subscriptionType != 'undefined')
                             OR (oi.rangeDates IS NOT NULL AND oi.rangeDates != '' AND oi.rangeDates != '[]' AND oi.rangeDates != 'undefined' AND oi.rangeDates != 'null')
                             OR (oi.subscribedDates IS NOT NULL AND oi.subscribedDates != '' AND oi.subscribedDates != '[]' AND oi.subscribedDates != 'undefined' AND oi.subscribedDates != 'null')
                         )
                   ) AS is_subscription
            FROM orders o 
            WHERE o.mobile = ? 
            ORDER BY o.created_at DESC
        ");
        $stmt->execute([$mobile]);
        $orders = $stmt->fetchAll();
    }
    
    foreach ($orders as &$ord) {
        $ord['is_subscription'] = ((int)$ord['is_subscription'] === 1);
        $ord['total_amount'] = round((float)$ord['total_amount']);
        $ord['refund_amount'] = round((float)($ord['refund_amount'] ?? 0));
    }
    
    sendJson($orders);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
