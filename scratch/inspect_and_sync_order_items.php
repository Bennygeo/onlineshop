<?php
require_once __DIR__ . '/../backend/config/db.php';

if (!$pdo) {
    echo "DB Connection failed\n";
    exit;
}

$stmt = $pdo->query("SELECT id, order_id, product_id, quantity, subscriptionType, rangeDates, subscribedDates, pausedDates FROM order_items");
$items = $stmt->fetchAll();

echo "Found " . count($items) . " order items:\n";

foreach ($items as $item) {
    if (empty($item['subscriptionType']) || $item['subscriptionType'] === 'none') {
        continue;
    }
    echo "ID: {$item['id']} | OrderID: {$item['order_id']} | Product: {$item['product_id']} | Type: {$item['subscriptionType']}\n";

    $isMulti = ($item['subscriptionType'] === 'multi_day' || ($item['subscribedDates'] && $item['subscribedDates'] !== '[]'));
    $colName = $isMulti ? 'subscribedDates' : 'rangeDates';
    $rawJson = $item[$colName];
    $parsed = json_decode($rawJson, true);

    $cleanedDates = [];
    $calcQty = 0;

    if (is_array($parsed)) {
        foreach ($parsed as $entry) {
            $cnt = (is_array($entry) && isset($entry['count'])) ? (int)$entry['count'] : 1;
            if ($cnt > 0) {
                $cleanedDates[] = $entry;
                $calcQty += $cnt;
            }
        }
    }

    if (!empty($item['pausedDates']) && $item['pausedDates'] !== '[]') {
        $parsedPaused = json_decode($item['pausedDates'], true);
        if (is_array($parsedPaused)) {
            foreach ($parsedPaused as $pentry) {
                $cnt = (is_array($pentry) && isset($pentry['count'])) ? (int)$pentry['count'] : 1;
                $calcQty += $cnt;
            }
        }
    }

    $newJson = json_encode(array_values($cleanedDates));
    echo "  -> Cleaned Schedule: {$newJson}\n";
    echo "  -> Calculated Qty: {$calcQty}\n";

    $upd = $pdo->prepare("UPDATE order_items SET {$colName} = ?, quantity = ? WHERE id = ?");
    $upd->execute([$newJson, $calcQty, $item['id']]);
    echo "  --> UPDATED DB row {$item['id']}\n";
}

echo "Cleanup & Sync complete.\n";
