<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$data = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;

if (!$data || !$pdo) {
    sendJson('FAILED');
}

$orderID = isset($data['orderID']) ? $data['orderID'] : '';
$productID = isset($data['productID']) ? $data['productID'] : '';
$type = isset($data['type']) ? $data['type'] : 'range';
$datesArrayStr = isset($data['datesArray']) ? (is_string($data['datesArray']) ? $data['datesArray'] : json_encode($data['datesArray'])) : '[]';
$parsedDates = json_decode($datesArrayStr, true);

$totalQty = 0;
if (is_array($parsedDates)) {
    foreach ($parsedDates as $entry) {
        $totalQty += (is_array($entry) && isset($entry['count'])) ? (int)$entry['count'] : 1;
    }
}

try {
    if ($type === 'range') {
        $stmt = $pdo->prepare("UPDATE order_items SET rangeDates = ?, quantity = ? WHERE order_id = ? AND product_id = ?");
        $stmt->execute([$datesArrayStr, $totalQty, $orderID, $productID]);
    } else {
        $stmt = $pdo->prepare("UPDATE order_items SET subscribedDates = ?, quantity = ? WHERE order_id = ? AND product_id = ?");
        $stmt->execute([$datesArrayStr, $totalQty, $orderID, $productID]);
    }

    sendJson('UPDATED');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
