<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([]);
}

try {
    // Select all orders from database
    $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC, order_id DESC LIMIT 500");
    $orders = $stmt->fetchAll();

    foreach ($orders as &$ord) {
        // Normalize order_id
        if (!isset($ord['order_id']) || empty($ord['order_id'])) {
            $ord['order_id'] = 'ORD_' . rand(1000, 9999);
        }
        $ord['id'] = $ord['order_id'];

        // Normalize amount
        $ord['amount'] = isset($ord['total_amount']) && floatval($ord['total_amount']) > 0 
            ? floatval($ord['total_amount']) 
            : (isset($ord['amount']) ? floatval($ord['amount']) : 0);

        // JSON parse items
        $parsedItems = [];
        if (isset($ord['items']) && is_string($ord['items']) && !empty($ord['items'])) {
            $parsedItems = json_decode($ord['items'], true);
        } else if (isset($ord['cart_json']) && is_string($ord['cart_json']) && !empty($ord['cart_json'])) {
            $parsedItems = json_decode($ord['cart_json'], true);
        } else if (isset($ord['items']) && is_array($ord['items'])) {
            $parsedItems = $ord['items'];
        }
        $ord['items'] = is_array($parsedItems) ? $parsedItems : [];

        // JSON parse address
        $parsedAddr = null;
        if (isset($ord['address']) && is_string($ord['address']) && !empty($ord['address'])) {
            $parsedAddr = json_decode($ord['address'], true);
        } else if (isset($ord['address_json']) && is_string($ord['address_json']) && !empty($ord['address_json'])) {
            $parsedAddr = json_decode($ord['address_json'], true);
        } else if (isset($ord['address']) && (is_array($ord['address']) || is_object($ord['address']))) {
            $parsedAddr = $ord['address'];
        }
        $ord['address'] = $parsedAddr;

        // Normalize delivery date (YYYY-MM-DD)
        if (!empty($ord['delivery_date'])) {
            $ord['delivery_date'] = date('Y-m-d', strtotime($ord['delivery_date']));
        } else if (!empty($ord['created_at'])) {
            $ord['delivery_date'] = date('Y-m-d', strtotime($ord['created_at']));
        } else {
            $ord['delivery_date'] = date('Y-m-d');
        }

        $allDeliveryDates = [$ord['delivery_date']];
        $isSub = (isset($ord['order_type']) && strtolower($ord['order_type']) === 'subscription');

        // Fetch all items from order_items table for this order
        try {
            $stmtItems = $pdo->prepare("
                SELECT oi.*, p.img_url, p.unit_name, p.price as base_product_price, p.stock_price, p.weight as base_weight
                FROM order_items oi 
                LEFT JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = ?
            ");
            $stmtItems->execute([$ord['order_id']]);
            $dbItems = $stmtItems->fetchAll();

            if (!empty($dbItems)) {
                $itemRows = [];
                foreach ($dbItems as $dbItem) {
                    $itemRows[] = [
                        'id' => $dbItem['product_id'],
                        'product_id' => $dbItem['product_id'],
                        'name' => !empty($dbItem['product_name']) ? $dbItem['product_name'] : 'Product',
                        'quantity' => (int)$dbItem['quantity'],
                        'price' => floatval($dbItem['price']),
                        'weight' => $dbItem['weight'],
                        'unit_name' => !empty($dbItem['unit_name']) ? $dbItem['unit_name'] : 'grams',
                        'base_product_price' => isset($dbItem['base_product_price']) ? floatval($dbItem['base_product_price']) : floatval($dbItem['price']),
                        'stock_price' => isset($dbItem['stock_price']) ? floatval($dbItem['stock_price']) : 0.00,
                        'base_weight' => isset($dbItem['base_weight']) ? $dbItem['base_weight'] : $dbItem['weight'],
                        'img_url' => !empty($dbItem['img_url']) ? $dbItem['img_url'] : 'assets/categories/Thinkspot_veggiesIcon.png',
                        'subscriptionType' => $dbItem['subscriptionType'],
                        'subscribedDates' => isset($dbItem['subscribedDates']) ? $dbItem['subscribedDates'] : '[]',
                        'rangeDates' => isset($dbItem['rangeDates']) ? $dbItem['rangeDates'] : '[]',
                        'subsStatus' => isset($dbItem['subsStatus']) ? $dbItem['subsStatus'] : '',
                        'pausedDates' => isset($dbItem['pausedDates']) ? $dbItem['pausedDates'] : '[]',
                        'startDate' => isset($dbItem['startDate']) ? $dbItem['startDate'] : '',
                        'endDate' => isset($dbItem['endDate']) ? $dbItem['endDate'] : ''
                    ];

                    // Only mark as subscription if item actually has non-empty subscription dates
                    $hasRangeDates = !empty($dbItem['rangeDates']) && $dbItem['rangeDates'] !== '[]' && $dbItem['rangeDates'] !== 'undefined' && $dbItem['rangeDates'] !== 'null';
                    $hasSubDates = !empty($dbItem['subscribedDates']) && $dbItem['subscribedDates'] !== '[]' && $dbItem['subscribedDates'] !== 'undefined' && $dbItem['subscribedDates'] !== 'null';
                    $hasDateRange = !empty($dbItem['startDate']) && !empty($dbItem['endDate']);
                    if ($hasRangeDates || $hasSubDates || $hasDateRange) {
                        $isSub = true;
                    }

                    // Parse subscribedDates & rangeDates JSON arrays
                    foreach ([$dbItem['subscribedDates'], $dbItem['rangeDates']] as $jsonStr) {
                        if (!empty($jsonStr) && $jsonStr !== '[]' && $jsonStr !== 'undefined') {
                            $parsed = json_decode($jsonStr, true);
                            if (is_array($parsed)) {
                                foreach ($parsed as $d) {
                                    $dVal = is_array($d) ? ($d['date'] ?? '') : $d;
                                    if (!empty($dVal)) {
                                        $ts = strtotime($dVal);
                                        if ($ts && $ts > 0) {
                                            $allDeliveryDates[] = date('Y-m-d', $ts);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Parse startDate to endDate range
                    if (!empty($dbItem['startDate']) && !empty($dbItem['endDate'])) {
                        $st = strtotime($dbItem['startDate']);
                        $et = strtotime($dbItem['endDate']);
                        if ($st && $et && $et >= $st) {
                            $curr = $st;
                            while ($curr <= $et) {
                                $allDeliveryDates[] = date('Y-m-d', $curr);
                                $curr = strtotime('+1 day', $curr);
                            }
                        }
                    }
                }

                // Populate ALL items from order_items if $ord['items'] is empty or has fewer items
                if (empty($ord['items']) || count($itemRows) > count($ord['items'])) {
                    $ord['items'] = $itemRows;
                }
            }
        } catch (Exception $exItems) {}

        // Check inline items array for subscribedDates or rangeDates
        if (is_array($ord['items'])) {
            foreach ($ord['items'] as $it) {
                if (!is_array($it)) continue;

                // Only mark as subscription if item has actual non-empty subscription dates
                $itSubDates = isset($it['subscribedDates']) ? $it['subscribedDates'] : '';
                $itRangeDates = isset($it['rangeDates']) ? $it['rangeDates'] : '';
                $itSubsOpts = isset($it['subs_options']) ? $it['subs_options'] : null;

                $hasValidSubDates = !empty($itSubDates) && $itSubDates !== '[]' && $itSubDates !== 'undefined' && $itSubDates !== 'null';
                $hasValidRangeDates = !empty($itRangeDates) && $itRangeDates !== '[]' && $itRangeDates !== 'undefined' && $itRangeDates !== 'null';
                $hasSubsOptions = !empty($itSubsOpts) && is_array($itSubsOpts) && (!empty($itSubsOpts['rangeSelected']) || !empty($itSubsOpts['multiDaySelected']));

                if ($hasValidSubDates || $hasValidRangeDates || $hasSubsOptions) {
                    $isSub = true;
                }

                $sDates = $hasValidSubDates ? $itSubDates : ($hasValidRangeDates ? $itRangeDates : ($hasSubsOptions ? ($itSubsOpts['rangeSelected'] ?? ($itSubsOpts['multiDaySelected'] ?? null)) : null));
                if (!empty($sDates)) {
                    $arr = is_array($sDates) ? $sDates : json_decode($sDates, true);
                    if (is_array($arr)) {
                        foreach ($arr as $d) {
                            $dVal = is_array($d) ? ($d['date'] ?? '') : $d;
                            if (!empty($dVal)) {
                                $ts = strtotime($dVal);
                                if ($ts && $ts > 0) {
                                    $allDeliveryDates[] = date('Y-m-d', $ts);
                                }
                            }
                        }
                    }
                }
            }
        }

        $ord['items_count'] = is_array($ord['items']) ? count($ord['items']) : 0;
        $ord['order_type'] = $isSub ? 'subscription' : 'regular';
        $ord['delivery_dates'] = array_values(array_unique($allDeliveryDates));
        $ord['assigned_to'] = !empty($ord['assigned_to']) ? $ord['assigned_to'] : '';
    }

    sendJson($orders);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
