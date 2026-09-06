<?php
require_once __DIR__ . '/../config/db.php';

$dataParam = getParam('data');
$data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;

if (!$data || !isset($data['order_id'])) {
    sendJson(['error' => 'Order ID is required'], 400);
}

$order_id = trim($data['order_id']);
$assignedTo = isset($data['assignedTo']) ? trim($data['assignedTo']) : null;
$status = isset($data['status']) ? trim($data['status']) : null;
$packedBy = isset($data['packedBy']) ? trim($data['packedBy']) : null;
$deliveredBy = isset($data['deliveredBy']) ? trim($data['deliveredBy']) : null;

if (!$pdo) {
    sendJson(['status' => 'SUCCESS']);
}

try {
    $updates = [];
    $params = [];

    if ($assignedTo !== null) { $updates[] = "assigned_to = ?"; $params[] = $assignedTo; }
    if ($status !== null) { $updates[] = "status = ?"; $params[] = $status; }
    if ($packedBy !== null) { $updates[] = "packed_by = ?"; $params[] = $packedBy; }
    if ($deliveredBy !== null) { $updates[] = "delivered_by = ?"; $params[] = $deliveredBy; }

    if (!empty($updates)) {
        $sql = "UPDATE orders SET " . implode(", ", $updates) . " WHERE order_id = ? OR id = ?";
        $params[] = $order_id;
        $params[] = $order_id;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    sendJson([
        'status' => 'SUCCESS',
        'message' => 'Order updated successfully'
    ]);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
