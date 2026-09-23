<?php
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details');
$data = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;

if (!$data || !$pdo) {
    sendJson('FAILED');
}

$orderID = isset($data['orderID']) ? $data['orderID'] : '';
$productID = isset($data['productID']) ? $data['productID'] : '';
$status = isset($data['status']) ? $data['status'] : 'paused';
$pausedArray = isset($data['pausedArray']) ? (is_string($data['pausedArray']) ? $data['pausedArray'] : json_encode($data['pausedArray'])) : '[]';
$datesArray = isset($data['datesArray']) ? (is_string($data['datesArray']) ? $data['datesArray'] : json_encode($data['datesArray'])) : '[]';

try {
    if ($data['type'] === 'range') {
        $stmt = $pdo->prepare("UPDATE order_items SET subsStatus = ?, pausedDates = ?, rangeDates = ? WHERE order_id = ? AND product_id = ?");
        $stmt->execute([$status, $pausedArray, $datesArray, $orderID, $productID]);
    } else {
        $stmt = $pdo->prepare("UPDATE order_items SET subsStatus = ?, pausedDates = ?, subscribedDates = ? WHERE order_id = ? AND product_id = ?");
        $stmt->execute([$status, $pausedArray, $datesArray, $orderID, $productID]);
    }

    sendJson('UPDATED');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
