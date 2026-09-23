<?php
require_once __DIR__ . '/../config/db.php';

$rawParam = getParam('data');
$data = is_string($rawParam) ? json_decode($rawParam, true) : $rawParam;

if (!$data || !isset($data['action'])) {
    sendJson(['error' => 'Action and data parameters are required'], 400);
}

if ($pdo) {
    $alters = [
        "ALTER TABLE orders ADD COLUMN assigned_to VARCHAR(100) DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN delivery_inst TEXT",
        "ALTER TABLE orders ADD COLUMN delivery_mode VARCHAR(100) DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL",
        "ALTER TABLE orders ADD COLUMN undelivered_reason VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE orders ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE orders ADD COLUMN refund_notes TEXT DEFAULT NULL",
        "ALTER TABLE order_items ADD COLUMN item_status VARCHAR(50) DEFAULT 'packed'",
        "ALTER TABLE order_items ADD COLUMN missing_qty INT DEFAULT 0",
        "ALTER TABLE order_items ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00",
        "ALTER TABLE order_items ADD COLUMN delivered_weight DECIMAL(10,2) DEFAULT NULL",
        "ALTER TABLE order_items ADD COLUMN missing_weight DECIMAL(10,2) DEFAULT NULL",
        "ALTER TABLE order_items ADD COLUMN partial_refund_notes VARCHAR(255) DEFAULT NULL"
    ];
    foreach ($alters as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Exception $e) {}
    }
}

if (!$pdo) {
    sendJson(['status' => 'SUCCESS']);
}

$action = $data['action'];
$todayStr = date('Y-m-d');
$targetDate = isset($data['date']) && !empty($data['date']) ? $data['date'] : $todayStr;

try {
    // 1. Toggle Item Packed Status
    if ($action === 'toggle_item_packed') {
        $itemId = $data['item_id'] ?? null;
        $isPacked = !empty($data['is_packed']);
        $newStatus = $isPacked ? 'packed' : 'unpacked';

        if ($itemId) {
            $stmt = $pdo->prepare("UPDATE order_items SET item_status = ? WHERE id = ?");
            $stmt->execute([$newStatus, $itemId]);
        }

        sendJson(['status' => 'SUCCESS', 'message' => 'Item packing status updated', 'item_status' => $newStatus]);
    }

    // 2. Report Missing Item or Partial Weight Refund (Wallet credit + Subscription Ledger balance reduction)
    if ($action === 'report_missing_item' || $action === 'partial_refund_item') {
        $orderId = trim($data['order_id'] ?? '');
        $itemId = $data['item_id'] ?? null;
        $refundType = trim($data['refund_type'] ?? 'quantity'); // 'weight', 'quantity', 'custom'
        $missingQty = max(0, (int)($data['missing_qty'] ?? 0));
        $deliveredWeight = isset($data['delivered_weight']) ? floatval($data['delivered_weight']) : null;
        $missingWeight = isset($data['missing_weight']) ? floatval($data['missing_weight']) : null;
        $unitName = trim($data['unit_name'] ?? 'grams');
        $customRefundAmt = isset($data['refund_amount']) ? floatval($data['refund_amount']) : null;
        $reason = trim($data['reason'] ?? ($refundType === 'weight' ? 'Weight shortfall during packing' : 'Item missing during delivery'));

        if (!$orderId || !$itemId) {
            sendJson(['error' => 'Order ID and Item ID are required'], 400);
        }

        // Fetch order details
        $stmtOrd = $pdo->prepare("SELECT order_id, mobile, total_amount, refund_amount, refund_notes FROM orders WHERE order_id = ?");
        $stmtOrd->execute([$orderId]);
        $order = $stmtOrd->fetch();

        if (!$order) {
            sendJson(['error' => 'Order not found'], 404);
        }

        $customerMobile = $order['mobile'];

        // Fetch item details
        $stmtItem = $pdo->prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?");
        $stmtItem->execute([$itemId, $orderId]);
        $item = $stmtItem->fetch();

        if (!$item) {
            sendJson(['error' => 'Order item not found'], 404);
        }

        $productName = !empty($item['product_name']) ? $item['product_name'] : 'Product Item';
        
        $hasRangeDates = !empty($item['rangeDates']) && $item['rangeDates'] !== '[]' && $item['rangeDates'] !== 'undefined' && $item['rangeDates'] !== 'null';
        $hasSubDates = !empty($item['subscribedDates']) && $item['subscribedDates'] !== '[]' && $item['subscribedDates'] !== 'undefined' && $item['subscribedDates'] !== 'null';
        $hasDateRange = !empty($item['startDate']) && !empty($item['endDate']);
        $isSubType = !empty($item['subscriptionType']) && $item['subscriptionType'] !== 'none' && $item['subscriptionType'] !== 'undefined' && $item['subscriptionType'] !== 'null';

        $isSub = ($isSubType || $hasRangeDates || $hasSubDates || $hasDateRange);

        $daysCount = 1;
        if ($isSub) {
            $datesCol = ($item['subscriptionType'] === 'range') ? 'rangeDates' : 'subscribedDates';
            $dates = json_decode($item[$datesCol], true);
            if (is_array($dates) && count($dates) > 0) {
                $daysCount = count($dates);
            }
        }

        $rawPrice = floatval($item['price']);
        $orderItemQty = max(1, (int)($item['quantity'] ?? 1));
        $totalUnits = $orderItemQty * $daysCount;
        if ($totalUnits > 0 && $rawPrice > 0) {
            $unitPrice = $rawPrice / $totalUnits;
        } else {
            $unitPrice = $rawPrice;
        }

        // Calculate refund amount
        if ($customRefundAmt !== null && $customRefundAmt >= 0) {
            $refundAmount = round($customRefundAmt, 2);
        } else if ($refundType === 'weight' && $missingWeight !== null && $missingWeight > 0) {
            $baseWeight = floatval($item['weight'] ?? 500);
            if ($baseWeight > 0) {
                $refundAmount = round(($unitPrice / $baseWeight) * $missingWeight, 2);
            } else {
                $refundAmount = round($unitPrice * ($missingWeight / 1000), 2);
            }
        } else {
            $missingUnits = max(1, $missingQty);
            $refundAmount = round($unitPrice * $missingUnits, 2);
        }

        // Determine item status
        $newItemStatus = ($refundType === 'weight' && $deliveredWeight !== null && $deliveredWeight > 0) 
            ? 'partially_delivered' 
            : 'missing';

        $currMissingQty = (int)($item['missing_qty'] ?? 0) + ($missingQty > 0 ? $missingQty : 0);
        $currRefund = round(floatval($item['refund_amount'] ?? 0) + $refundAmount, 2);

        $partialNotes = ($refundType === 'weight')
            ? "Delivered {$deliveredWeight}{$unitName} (Shortfall: {$missingWeight}{$unitName})"
            : "{$missingQty}x item missing";

        $stmtUpdItem = $pdo->prepare("
            UPDATE order_items 
            SET item_status = ?, missing_qty = ?, refund_amount = ?, delivered_weight = ?, missing_weight = ?, partial_refund_notes = ? 
            WHERE id = ?
        ");
        $stmtUpdItem->execute([
            $newItemStatus,
            $currMissingQty,
            $currRefund,
            $deliveredWeight,
            $missingWeight,
            $partialNotes,
            $itemId
        ]);

        // If subscription order: mark today's schedule as adjusted/cancelled to immediately reduce Ledger balance
        if ($isSub) {
            $datesCol = ($item['subscriptionType'] === 'range') ? 'rangeDates' : 'subscribedDates';
            $datesJson = $item[$datesCol];
            $dates = json_decode($datesJson, true);

            if (is_array($dates)) {
                $subUpdated = false;
                foreach ($dates as &$d) {
                    $dStr = is_array($d) ? ($d['date'] ?? '') : (string)$d;
                    if (!empty($dStr) && date('Y-m-d', strtotime($dStr)) === $targetDate) {
                        if (is_array($d)) {
                            $d['status'] = ($newItemStatus === 'partially_delivered') ? 'partial_delivered' : 'cancelled';
                            $d['refund_amount'] = $refundAmount;
                        } else {
                            $d = ['date' => $dStr, 'status' => ($newItemStatus === 'partially_delivered' ? 'partial_delivered' : 'cancelled'), 'count' => (int)$item['quantity'], 'refund_amount' => $refundAmount];
                        }
                        $subUpdated = true;
                    }
                }
                if ($subUpdated) {
                    $stmtSubUpd = $pdo->prepare("UPDATE order_items SET $datesCol = ? WHERE id = ?");
                    $stmtSubUpd->execute([json_encode($dates), $itemId]);
                }
            }
        }

        // Credit Customer's TomorrowNeeds Wallet
        if ($refundType === 'weight') {
            $refundDesc = "Partial refund: {$missingWeight}{$unitName} deficit on {$productName} (Order #{$orderId} - {$reason})";
        } else {
            $refundDesc = "Refund for missing {$missingQty} x {$productName} (Order #{$orderId} - {$reason})";
        }

        $stmtWallet = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'authorized')");
        $stmtWallet->execute([$customerMobile, $refundAmount, $refundDesc]);

        // Update order header refund accumulation and notes
        $newOrderRefundAmt = round(floatval($order['refund_amount'] ?? 0) + $refundAmount, 2);
        $existingNotes = !empty($order['refund_notes']) ? $order['refund_notes'] . "; " : "";
        
        if ($refundType === 'weight') {
            $newOrderNotes = $existingNotes . "{$productName}: Delivered {$deliveredWeight}{$unitName} (₹{$refundAmount} refunded for {$missingWeight}{$unitName})";
        } else {
            $newOrderNotes = $existingNotes . "{$missingQty} x {$productName} missing (₹{$refundAmount} refunded)";
        }

        $stmtOrdUpd = $pdo->prepare("UPDATE orders SET refund_amount = ?, refund_notes = ? WHERE order_id = ?");
        $stmtOrdUpd->execute([$newOrderRefundAmt, $newOrderNotes, $orderId]);

        sendJson([
            'status' => 'SUCCESS',
            'message' => "₹" . number_format($refundAmount, 2) . " refunded to customer wallet and ledger adjusted.",
            'refund_amount' => $refundAmount,
            'delivered_weight' => $deliveredWeight,
            'missing_weight' => $missingWeight,
            'customer_mobile' => $customerMobile,
            'is_subscription' => $isSub
        ]);
    }

    // 3. Mark Order as Delivered
    if ($action === 'mark_delivered') {
        $orderId = trim($data['order_id'] ?? '');

        if (!$orderId) {
            sendJson(['error' => 'Order ID is required'], 400);
        }

        // Update orders table
        $stmt = $pdo->prepare("UPDATE orders SET status = 'DELIVERED', delivered_at = NOW() WHERE order_id = ?");
        $stmt->execute([$orderId]);

        // Mark today's subscription items as delivered
        $stmtSubs = $pdo->prepare("SELECT id, subscriptionType, rangeDates, subscribedDates, quantity FROM order_items WHERE order_id = ?");
        $stmtSubs->execute([$orderId]);
        $subItems = $stmtSubs->fetchAll();

        foreach ($subItems as $sItem) {
            $isSub = (!empty($sItem['subscriptionType']) && $sItem['subscriptionType'] !== 'none');
            if ($isSub) {
                $datesCol = ($sItem['subscriptionType'] === 'range') ? 'rangeDates' : 'subscribedDates';
                $datesJson = $sItem[$datesCol];
                $dates = json_decode($datesJson, true);
                if (is_array($dates)) {
                    $subUpdated = false;
                    foreach ($dates as &$d) {
                        $dStr = is_array($d) ? ($d['date'] ?? '') : (string)$d;
                        if (!empty($dStr) && date('Y-m-d', strtotime($dStr)) === $targetDate) {
                            if (is_array($d)) {
                                if (($d['status'] ?? '') !== 'cancelled') {
                                    $d['status'] = 'delivered';
                                    $subUpdated = true;
                                }
                            } else {
                                $d = ['date' => $dStr, 'status' => 'delivered', 'count' => (int)$sItem['quantity']];
                                $subUpdated = true;
                            }
                        }
                    }
                    if ($subUpdated) {
                        $stmtSubUpd = $pdo->prepare("UPDATE order_items SET $datesCol = ? WHERE id = ?");
                        $stmtSubUpd->execute([json_encode($dates), $sItem['id']]);
                    }
                }
            }
        }

        sendJson([
            'status' => 'SUCCESS',
            'message' => "Order #$orderId marked as Delivered successfully"
        ]);
    }

    // 4. Mark Order as Undelivered
    if ($action === 'mark_undelivered') {
        $orderId = trim($data['order_id'] ?? '');
        $reason = trim($data['reason'] ?? 'Customer not available');
        $refundFull = !empty($data['refund_to_wallet']);

        if (!$orderId) {
            sendJson(['error' => 'Order ID is required'], 400);
        }

        $stmt = $pdo->prepare("UPDATE orders SET status = 'UNDELIVERED', undelivered_reason = ? WHERE order_id = ?");
        $stmt->execute([$reason, $orderId]);

        // Optional full refund
        if ($refundFull) {
            $stmtOrd = $pdo->prepare("SELECT mobile, total_amount FROM orders WHERE order_id = ?");
            $stmtOrd->execute([$orderId]);
            $ord = $stmtOrd->fetch();

            if ($ord && floatval($ord['total_amount']) > 0) {
                $refundAmt = round(floatval($ord['total_amount']));
                $stmtWallet = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'authorized')");
                $stmtWallet->execute([$ord['mobile'], $refundAmt, "Full refund for undelivered Order #$orderId ($reason)"]);

                $stmtOrdUpd = $pdo->prepare("UPDATE orders SET refund_amount = ?, refund_notes = ? WHERE order_id = ?");
                $stmtOrdUpd->execute([$refundAmt, "Full order refunded due to non-delivery: $reason", $orderId]);
            }
        }

        sendJson([
            'status' => 'SUCCESS',
            'message' => "Order #$orderId marked as Undelivered"
        ]);
    }

    sendJson(['error' => 'Unknown action'], 400);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
