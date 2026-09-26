<?php
require_once __DIR__ . '/../config/db.php';

$action = getParam('action');
$orderId = getParam('order_id') ?: getParam('id');
$partnerName = getParam('partner') ?: getParam('partner_name');

if (empty($action) || empty($orderId)) {
    sendJson(['error' => 'Action and order_id are required'], 400);
}

if (!$pdo) {
    sendJson(['status' => 'SUCCESS', 'action' => $action]);
}

try {
    // Verify that the order is assigned to this partner (if partner name is provided)
    if (!empty($partnerName)) {
        $chkStmt = $pdo->prepare("SELECT assigned_to, status FROM orders WHERE order_id = ?");
        $chkStmt->execute([$orderId]);
        $orderRow = $chkStmt->fetch();

        if (!$orderRow) {
            sendJson(['error' => 'Order not found'], 404);
        }
        if (!empty($orderRow['assigned_to']) && strcasecmp($orderRow['assigned_to'], $partnerName) !== 0) {
            sendJson(['error' => 'Unauthorized: Order is not assigned to you'], 403);
        }
    }

    switch ($action) {
        case 'toggle_pack':
            $itemId = getParam('item_id');
            $packed = getParam('packed'); // boolean or 1/0
            $newStatus = ($packed == '1' || $packed === true || $packed == 'true') ? 'packed' : 'pending';

            if (!empty($itemId)) {
                $stmt = $pdo->prepare("UPDATE order_items SET item_status = ? WHERE id = ? AND order_id = ?");
                $stmt->execute([$newStatus, $itemId, $orderId]);
            }
            sendJson(['status' => 'SUCCESS', 'item_id' => $itemId, 'item_status' => $newStatus]);
            break;

        case 'mark_delivered':
            $stmt = $pdo->prepare("UPDATE orders SET status = 'DELIVERED', delivered_at = NOW() WHERE order_id = ?");
            $stmt->execute([$orderId]);

            // Also mark all items as delivered
            $stmtItems = $pdo->prepare("UPDATE order_items SET item_status = 'delivered' WHERE order_id = ?");
            $stmtItems->execute([$orderId]);

            // Process referral reward for referrer (User 1) on delivery of User 2's order
            require_once __DIR__ . '/../referral/process_referral_reward.php';
            $rewardResult = processReferralOnDelivery($pdo, $orderId);

            sendJson(['status' => 'SUCCESS', 'order_id' => $orderId, 'status_updated' => 'DELIVERED', 'referral_reward' => $rewardResult]);
            break;

        case 'mark_undelivered':
            $reason = trim(getParam('reason') ?: 'Customer unavailable / Door locked');
            $stmt = $pdo->prepare("UPDATE orders SET status = 'UNDELIVERED', undelivered_reason = ? WHERE order_id = ?");
            $stmt->execute([$reason, $orderId]);

            sendJson(['status' => 'SUCCESS', 'order_id' => $orderId, 'status_updated' => 'UNDELIVERED', 'reason' => $reason]);
            break;

        default:
            sendJson(['error' => 'Unsupported partner action'], 400);
            break;
    }
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
