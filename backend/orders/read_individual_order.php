<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;
$order_id = isset($details['order_id']) ? $details['order_id'] : getParam('order_id');

if (!$order_id || !$pdo) {
    sendJson([]);
}

try {
    $stmtItems = $pdo->prepare("SELECT oi.id, oi.product_id AS productID, COALESCE(NULLIF(oi.product_name, ''), p.name, oi.product_id, 'Product Item') AS product_name, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, p.img_url FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?");
    $stmtItems->execute([$order_id]);
    $items = $stmtItems->fetchAll();

    foreach ($items as &$item) {
        if (!empty($item['subscriptionType']) && $item['subscriptionType'] !== 'none') {
            $datesJson = ($item['subscriptionType'] === 'multi_day' || (!empty($item['subscribedDates']) && $item['subscribedDates'] !== '[]')) ? $item['subscribedDates'] : $item['rangeDates'];
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
            if ($calcQty > 0) {
                $item['quantity'] = (int)$calcQty;
            }
        }
    }

    sendJson($items);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
