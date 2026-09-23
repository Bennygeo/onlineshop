<?php
require_once __DIR__ . '/../config/db.php';

$partnerName = trim(getParam('partner') ?: getParam('name') ?: '');
$dateParam = getParam('date') ?: date('Y-m-d');

if (empty($partnerName)) {
    sendJson(['error' => 'Delivery partner identification is required'], 400);
}

if (!$pdo) {
    sendJson([]);
}

try {
    // Select orders where assigned_to matches this delivery partner exactly
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE assigned_to = ? ORDER BY created_at DESC, order_id DESC LIMIT 300");
    $stmt->execute([$partnerName]);
    $partnerOrders = $stmt->fetchAll();

    $deliveryOrders = [];

    foreach ($partnerOrders as $ord) {
        $orderId = $ord['order_id'];

        // Normalize address
        $parsedAddr = null;
        if (isset($ord['address_json']) && !empty($ord['address_json'])) {
            $parsedAddr = json_decode($ord['address_json'], true);
        } else if (isset($ord['address']) && !empty($ord['address'])) {
            $parsedAddr = is_string($ord['address']) ? json_decode($ord['address'], true) : $ord['address'];
        }

        // Fetch items from order_items table
        $stmtItems = $pdo->prepare("
            SELECT oi.*, p.img_url, p.unit_name, p.price as base_product_price, p.weight as base_weight
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ");
        $stmtItems->execute([$orderId]);
        $dbItems = $stmtItems->fetchAll();

        $formattedItems = [];
        $isDateOrder = false;

        $orderDelDate = !empty($ord['delivery_date']) ? date('Y-m-d', strtotime($ord['delivery_date'])) : date('Y-m-d', strtotime($ord['created_at']));
        if ($orderDelDate === $dateParam) {
            $isDateOrder = true;
        }

        foreach ($dbItems as $it) {
            $hasRangeDates = !empty($it['rangeDates']) && $it['rangeDates'] !== '[]' && $it['rangeDates'] !== 'undefined' && $it['rangeDates'] !== 'null';
            $hasSubDates = !empty($it['subscribedDates']) && $it['subscribedDates'] !== '[]' && $it['subscribedDates'] !== 'undefined' && $it['subscribedDates'] !== 'null';
            $isSub = ($hasRangeDates || $hasSubDates || (!empty($it['subscriptionType']) && $it['subscriptionType'] !== 'none' && $it['subscriptionType'] !== 'undefined'));

            $itemScheduledDate = false;
            $itemStatus = !empty($it['item_status']) ? $it['item_status'] : 'packed';
            $todayCount = (int)$it['quantity'];

            if ($isSub) {
                $datesJson = ($it['subscriptionType'] === 'range') ? $it['rangeDates'] : $it['subscribedDates'];
                $dates = json_decode($datesJson, true);
                if (is_array($dates)) {
                    foreach ($dates as $d) {
                        $dStr = is_array($d) ? ($d['date'] ?? '') : (string)$d;
                        if (!empty($dStr) && date('Y-m-d', strtotime($dStr)) === $dateParam) {
                            $itemScheduledDate = true;
                            $isDateOrder = true;
                            if (is_array($d) && isset($d['count']) && (int)$d['count'] > 0) {
                                $todayCount = (int)$d['count'];
                            }
                            break;
                        }
                    }
                }
            } else {
                if ($orderDelDate === $dateParam) {
                    $itemScheduledDate = true;
                }
            }

            $formattedItems[] = [
                'id' => $it['id'],
                'product_id' => $it['product_id'],
                'name' => !empty($it['product_name']) ? $it['product_name'] : 'Product Item',
                'quantity' => $todayCount,
                'price' => round(floatval($it['price'])),
                'weight' => $it['weight'] ?? $it['base_weight'] ?? '1 kg',
                'unit_name' => $it['unit_name'] ?? 'pack',
                'img_url' => !empty($it['img_url']) ? $it['img_url'] : 'assets/categories/Thinkspot_veggiesIcon.png',
                'is_subscription' => $isSub,
                'subscription_type' => $it['subscriptionType'] ?? 'none',
                'item_status' => $itemStatus,
                'is_packed' => ($itemStatus === 'packed' || $itemStatus === 'delivered'),
                'scheduled_date' => $itemScheduledDate
            ];
        }

        // Only include if scheduled on target date or overall order date matches
        if (!$isDateOrder && $orderDelDate !== $dateParam) {
            continue;
        }

        $orderStatus = strtoupper($ord['status'] ?? 'PLACED');
        $deliveryStatusCategory = 'packed';

        if ($orderStatus === 'DELIVERED') {
            $deliveryStatusCategory = 'delivered';
        } else if ($orderStatus === 'UNDELIVERED' || $orderStatus === 'CANCELLED') {
            $deliveryStatusCategory = 'undelivered';
        } else {
            $deliveryStatusCategory = 'packed';
        }

        $deliveryOrders[] = [
            'order_id' => $orderId,
            'id' => $orderId,
            'mobile' => $ord['mobile'],
            'customer_name' => is_array($parsedAddr) && !empty($parsedAddr['name']) ? $parsedAddr['name'] : 'Customer',
            'phone' => is_array($parsedAddr) && !empty($parsedAddr['phone']) ? $parsedAddr['phone'] : $ord['mobile'],
            'address' => $parsedAddr,
            'address_text' => is_array($parsedAddr) 
                ? (($parsedAddr['name'] ? $parsedAddr['name'] . ', ' : '') . ($parsedAddr['address'] ?? $parsedAddr['addr_line_1'] ?? '') . ' ' . ($parsedAddr['landmark'] ?? '') . ' - ' . ($parsedAddr['pincode'] ?? ''))
                : (string)($ord['address_json'] ?? ''),
            'total_amount' => round(floatval($ord['total_amount'])),
            'payment_type' => $ord['payment_type'] ?? 'Wallet',
            'status' => $orderStatus,
            'delivery_category' => $deliveryStatusCategory,
            'delivery_date' => $orderDelDate,
            'assigned_to' => $ord['assigned_to'],
            'delivery_inst' => $ord['delivery_inst'] ?? '',
            'delivery_mode' => $ord['delivery_mode'] ?? 'Leave at door',
            'delivered_at' => $ord['delivered_at'] ?? null,
            'undelivered_reason' => $ord['undelivered_reason'] ?? '',
            'items' => $formattedItems,
            'items_count' => count($formattedItems),
            'created_at' => $ord['created_at']
        ];
    }

    sendJson($deliveryOrders);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
