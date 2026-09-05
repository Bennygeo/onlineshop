<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$mobile = isset($details['mobile']) ? $details['mobile'] : getParam('mobile');

if (!$mobile || !$pdo) {
    sendJson([]);
}

try {
    // Ensure subscription columns exist in order_items table
    try {
        $pdo->exec("ALTER TABLE order_items ADD COLUMN subscriptionType VARCHAR(50) DEFAULT 'none'");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN rangeDates TEXT");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN subscribedDates TEXT");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN subsStatus VARCHAR(50) DEFAULT 'active'");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN pausedDates TEXT");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN startDate VARCHAR(50) DEFAULT ''");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN endDate VARCHAR(50) DEFAULT ''");
    } catch (Exception $e) {}

    $stmt = $pdo->prepare("
        SELECT oi.*, o.mobile, o.status as order_status 
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.mobile = ? 
          AND (
            oi.subscriptionType IN ('range', 'multi_day') 
            OR (oi.rangeDates IS NOT NULL AND oi.rangeDates != '' AND oi.rangeDates != '[]' AND oi.rangeDates != 'undefined')
            OR (oi.subscribedDates IS NOT NULL AND oi.subscribedDates != '' AND oi.subscribedDates != '[]' AND oi.subscribedDates != 'undefined')
          )
          AND o.status IN ('PLACED', 'CART', 'active')
        ORDER BY oi.id DESC
    ");
    $stmt->execute([$mobile]);
    $items = $stmt->fetchAll();

    $result = [];
    foreach ($items as $item) {
        $datesJson = ($item['subscriptionType'] === 'multi_day' || (isset($item['subscribedDates']) && $item['subscribedDates'] !== '[]' && $item['subscribedDates'] !== '')) ? $item['subscribedDates'] : $item['rangeDates'];
        $parsed = json_decode($datesJson, true);
        $calcQty = 0;
        if (is_array($parsed)) {
            foreach ($parsed as $entry) {
                $calcQty += (is_array($entry) && isset($entry['count'])) ? (int)$entry['count'] : 1;
            }
        }
        if (!empty($item['pausedDates']) && $item['pausedDates'] !== '[]') {
            $parsedPaused = json_decode($item['pausedDates'], true);
            if (is_array($parsedPaused)) {
                foreach ($parsedPaused as $pentry) {
                    $calcQty += (is_array($pentry) && isset($pentry['count'])) ? (int)$pentry['count'] : 1;
                }
            }
        }
        $finalQty = ($calcQty > 0) ? $calcQty : (int)$item['quantity'];

        $result[] = [
            'orderID' => $item['order_id'],
            'productID' => $item['product_id'],
            'product_name' => isset($item['product_name']) ? $item['product_name'] : '',
            'quantity' => $finalQty,
            'price' => (float)$item['price'],
            'weight' => isset($item['weight']) ? $item['weight'] : '',
            'rangeDates' => isset($item['rangeDates']) ? $item['rangeDates'] : '[]',
            'subscribedDates' => isset($item['subscribedDates']) ? $item['subscribedDates'] : '[]',
            'subscriptionType' => (isset($item['subscriptionType']) && $item['subscriptionType'] !== 'none') ? $item['subscriptionType'] : 'range',
            'subsStatus' => isset($item['subsStatus']) ? $item['subsStatus'] : 'active',
            'pausedDates' => isset($item['pausedDates']) ? $item['pausedDates'] : '[]',
            'startDate' => isset($item['startDate']) ? $item['startDate'] : '',
            'endDate' => isset($item['endDate']) ? $item['endDate'] : ''
        ];
    }

    sendJson($result);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
