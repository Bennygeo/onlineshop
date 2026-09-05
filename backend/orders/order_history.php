<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$mobile = isset($details['mobile']) ? $details['mobile'] : getParam('mobile');

if (!$mobile || !$pdo) {
    sendJson([]);
}

try {
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_inst TEXT");
    } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_mode VARCHAR(100) DEFAULT ''");
    } catch (Exception $e) {}

    $stmt = $pdo->prepare("
        SELECT o.order_id, o.mobile, o.address_json, o.total_amount, o.payment_type, o.status, o.delivery_date, o.delivery_inst, o.delivery_mode, o.created_at,
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
    
    foreach ($orders as &$ord) {
        $ord['is_subscription'] = ((int)$ord['is_subscription'] === 1);
        $ord['total_amount'] = (float)$ord['total_amount'];
    }
    
    sendJson($orders);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
