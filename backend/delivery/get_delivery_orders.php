<?php
require_once __DIR__ . '/../config/db.php';

// Ensure table columns exist
if ($pdo) {
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN assigned_to VARCHAR(100) DEFAULT ''");
        $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_inst TEXT");
        $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_mode VARCHAR(100) DEFAULT ''");
        $pdo->exec("ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL");
        $pdo->exec("ALTER TABLE orders ADD COLUMN undelivered_reason VARCHAR(255) DEFAULT NULL");
        $pdo->exec("ALTER TABLE orders ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00");
        $pdo->exec("ALTER TABLE orders ADD COLUMN refund_notes TEXT DEFAULT NULL");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN item_status VARCHAR(50) DEFAULT 'packed'");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN missing_qty INT DEFAULT 0");
        $pdo->exec("ALTER TABLE order_items ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00");
    } catch (Exception $e) {}
}

$dateParam = getParam('date') ?: date('Y-m-d');
$partnerParam = getParam('partner') ?: '';

if (!$pdo) {
    sendJson([]);
}

try {
    // Query orders that have scheduled delivery for the target date
    $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC, order_id DESC LIMIT 500");
    $allOrders = $stmt->fetchAll();

    $deliveryOrders = [];

    foreach ($allOrders as $ord) {
        $orderId = $ord['order_id'];
        $assignedTo = !empty($ord['assigned_to']) ? $ord['assigned_to'] : '';

        // Filter by partner if specified
        if (!empty($partnerParam) && $partnerParam !== 'ALL' && strcasecmp($assignedTo, $partnerParam) !== 0) {
            continue;
        }

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
        $isTodayOrder = false;
        $orderType = 'regular';

        // Check if order primary delivery date is today
        $orderDelDate = !empty($ord['delivery_date']) ? date('Y-m-d', strtotime($ord['delivery_date'])) : date('Y-m-d', strtotime($ord['created_at']));
        if ($orderDelDate === $dateParam) {
            $isTodayOrder = true;
        }

        foreach ($dbItems as $it) {
            $hasRangeDates = !empty($it['rangeDates']) && $it['rangeDates'] !== '[]' && $it['rangeDates'] !== 'undefined' && $it['rangeDates'] !== 'null';
            $hasSubDates = !empty($it['subscribedDates']) && $it['subscribedDates'] !== '[]' && $it['subscribedDates'] !== 'undefined' && $it['subscribedDates'] !== 'null';
            $hasDateRange = !empty($it['startDate']) && !empty($it['endDate']);
            $isSubType = !empty($it['subscriptionType']) && $it['subscriptionType'] !== 'none' && $it['subscriptionType'] !== 'undefined' && $it['subscriptionType'] !== 'null';

            $isSub = ($isSubType || $hasRangeDates || $hasSubDates || $hasDateRange);

            if ($isSub) {
                $orderType = 'subscription';
            }

            // Check if this item is scheduled for delivery today
            $itemScheduledToday = false;
            $todayDeliveryStatus = 'pending';
            $todayCount = (int)$it['quantity'];

            if ($isSub) {
                $datesJson = ($it['subscriptionType'] === 'range') ? $it['rangeDates'] : $it['subscribedDates'];
                $dates = json_decode($datesJson, true);
                if (is_array($dates)) {
                    foreach ($dates as $d) {
                        $dStr = is_array($d) ? ($d['date'] ?? '') : (string)$d;
                        if (!empty($dStr) && date('Y-m-d', strtotime($dStr)) === $dateParam) {
                            $itemScheduledToday = true;
                            $isTodayOrder = true;
                            if (is_array($d)) {
                                $todayDeliveryStatus = $d['status'] ?? 'pending';
                                if (isset($d['count']) && (int)$d['count'] > 0) {
                                    $todayCount = (int)$d['count'];
                                }
                            }
                            break;
                        }
                    }
                }
            } else {
                if ($orderDelDate === $dateParam) {
                    $itemScheduledToday = true;
                }
            }

            $rawPrice = floatval($it['price']);
            $daysCount = 1;
            if ($isSub) {
                $datesJson = ($it['subscriptionType'] === 'range') ? $it['rangeDates'] : $it['subscribedDates'];
                $dates = json_decode($datesJson, true);
                if (is_array($dates) && count($dates) > 0) {
                    $daysCount = count($dates);
                }
            }

            $orderItemQty = max(1, (int)($it['quantity'] ?? 1));
            $totalUnits = $orderItemQty * $daysCount;
            if ($totalUnits > 0 && $rawPrice > 0) {
                $unitPrice = round($rawPrice / $totalUnits, 2);
            } else {
                $unitPrice = $rawPrice;
            }

            $itemStatus = !empty($it['item_status']) ? $it['item_status'] : 'packed';
            $missingQty = (int)($it['missing_qty'] ?? 0);
            $itemRefundAmount = floatval($it['refund_amount'] ?? 0);

            $formattedItems[] = [
                'id' => $it['id'],
                'product_id' => $it['product_id'],
                'name' => !empty($it['product_name']) ? $it['product_name'] : 'Product Item',
                'quantity' => $todayCount,
                'price' => round($unitPrice),
                'weight' => $it['weight'] ?? $it['base_weight'] ?? 500,
                'unit_name' => $it['unit_name'] ?? 'grams',
                'img_url' => !empty($it['img_url']) ? $it['img_url'] : 'assets/categories/Thinkspot_veggiesIcon.png',
                'is_subscription' => $isSub,
                'subscription_type' => $it['subscriptionType'] ?? 'none',
                'item_status' => $itemStatus,
                'is_packed' => ($itemStatus === 'packed' || $itemStatus === 'delivered'),
                'is_missing' => ($itemStatus === 'missing' || $itemStatus === 'refunded'),
                'missing_qty' => $missingQty,
                'refund_amount' => round($itemRefundAmount),
                'scheduled_today' => $itemScheduledToday,
                'today_delivery_status' => $todayDeliveryStatus
            ];
        }

        // If not scheduled for today and not matching filter, skip
        if (!$isTodayOrder && $orderDelDate !== $dateParam) {
            continue;
        }

        $orderStatus = strtoupper($ord['status'] ?? 'PLACED');
        $deliveryStatusCategory = 'packed'; // default tab category

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
            'assigned_to' => $assignedTo,
            'delivery_inst' => $ord['delivery_inst'] ?? '',
            'delivery_mode' => $ord['delivery_mode'] ?? 'Leave at door',
            'delivered_at' => $ord['delivered_at'] ?? null,
            'undelivered_reason' => $ord['undelivered_reason'] ?? '',
            'refund_amount' => round(floatval($ord['refund_amount'] ?? 0)),
            'refund_notes' => $ord['refund_notes'] ?? '',
            'order_type' => $orderType,
            'items' => $formattedItems,
            'items_count' => count($formattedItems),
            'created_at' => $ord['created_at']
        ];
    }

    sendJson($deliveryOrders);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
