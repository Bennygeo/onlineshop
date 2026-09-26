<?php
require_once __DIR__ . '/../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!$pdo) {
    sendJson([
        'summary' => [
            'totalRevenue' => 0,
            'totalOrders' => 0,
            'deliveredOrders' => 0,
            'cancelledOrders' => 0,
            'placedOrders' => 0,
            'avgOrderValue' => 0,
            'totalCost' => 0,
            'estimatedMargin' => 0,
            'marginPercentage' => 0
        ],
        'salesTrend' => [],
        'products' => [],
        'deliveryPartners' => [],
        'paymentMethods' => [],
        'statusBreakdown' => [],
        'orders' => []
    ]);
}

try {
    $rawInput = file_get_contents('php://input');
    $data = [];
    if (!empty($rawInput)) {
        $data = json_decode($rawInput, true) ?: [];
    }
    // Also support GET params or form-encoded POST
    $fromDate = $_GET['from_date'] ?? ($data['from_date'] ?? null);
    $toDate = $_GET['to_date'] ?? ($data['to_date'] ?? null);
    $statusFilter = $_GET['status'] ?? ($data['status'] ?? 'ALL');
    $orderTypeFilter = $_GET['order_type'] ?? ($data['order_type'] ?? 'ALL');

    // Default dates if empty
    if (empty($fromDate)) {
        $fromDate = date('Y-m-01'); // 1st day of current month
    }
    if (empty($toDate)) {
        $toDate = date('Y-m-d'); // Today
    }

    // Build query conditions
    // Dates can filter based on order created_at (or delivery_date if available)
    $params = [
        ':from_date' => $fromDate . ' 00:00:00',
        ':to_date' => $toDate . ' 23:59:59'
    ];

    $queryStr = "SELECT * FROM orders WHERE created_at BETWEEN :from_date AND :to_date";

    if (!empty($statusFilter) && strtoupper($statusFilter) !== 'ALL') {
        $queryStr .= " AND status = :status";
        $params[':status'] = strtoupper($statusFilter);
    }

    $queryStr .= " ORDER BY created_at DESC, order_id DESC LIMIT 1000";

    $stmt = $pdo->prepare($queryStr);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    $totalRevenue = 0;
    $totalCost = 0;
    $deliveredOrders = 0;
    $cancelledOrders = 0;
    $placedOrders = 0;

    $dailySalesMap = [];
    $productMap = [];
    $deliveryPartnerMap = [];
    $paymentMethodMap = [
        'Cash on Delivery' => ['method' => 'Cash on Delivery', 'count' => 0, 'amount' => 0],
        'Online / UPI' => ['method' => 'Online / UPI', 'count' => 0, 'amount' => 0],
        'Wallet' => ['method' => 'Wallet', 'count' => 0, 'amount' => 0],
        'Other' => ['method' => 'Other', 'count' => 0, 'amount' => 0]
    ];
    $statusCountMap = [
        'PLACED' => 0,
        'PACKED' => 0,
        'OUT_FOR_DELIVERY' => 0,
        'DELIVERED' => 0,
        'CANCELLED' => 0
    ];

    $filteredOrders = [];

    foreach ($orders as &$ord) {
        $orderId = !empty($ord['order_id']) ? $ord['order_id'] : 'ORD_' . rand(1000, 9999);
        $ord['order_id'] = $orderId;
        $ord['id'] = $orderId;

        // Amount
        $amount = isset($ord['total_amount']) && floatval($ord['total_amount']) > 0 
            ? floatval($ord['total_amount']) 
            : (isset($ord['amount']) ? floatval($ord['amount']) : 0.0);
        $ord['amount'] = $amount;

        $status = strtoupper($ord['status'] ?? 'PLACED');
        $ord['status'] = $status;

        // Fetch items from order_items table with products stock_price
        $orderCost = 0;
        try {
            $stmtItems = $pdo->prepare("
                SELECT oi.*, p.category, p.unit_name, p.price as base_product_price, p.stock_price, p.weight as base_weight
                FROM order_items oi 
                LEFT JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = ?
            ");
            $stmtItems->execute([$orderId]);
            $dbItems = $stmtItems->fetchAll();

            $itemRows = [];
            $isSub = (isset($ord['order_type']) && strtolower($ord['order_type']) === 'subscription');

            if (!empty($dbItems)) {
                foreach ($dbItems as $dbItem) {
                    $qty = max(1, (int)$dbItem['quantity']);
                    $itemPrice = floatval($dbItem['price']);
                    $stockPrice = isset($dbItem['stock_price']) ? floatval($dbItem['stock_price']) : 0.0;
                    
                    // If stock price is 0 or missing, estimate cost as 70% of price
                    $unitCost = ($stockPrice > 0) ? $stockPrice : ($itemPrice * 0.70);
                    $lineCost = $unitCost * $qty;
                    $lineRevenue = $itemPrice * $qty;
                    $orderCost += $lineCost;

                    $prodId = $dbItem['product_id'] ?? 'PROD_' . rand(100, 999);
                    $prodName = !empty($dbItem['product_name']) ? $dbItem['product_name'] : 'Product #' . $prodId;
                    $category = !empty($dbItem['category']) ? $dbItem['category'] : 'General';

                    // Aggregate product stats if order is not cancelled
                    if ($status !== 'CANCELLED') {
                        if (!isset($productMap[$prodId])) {
                            $productMap[$prodId] = [
                                'id' => $prodId,
                                'name' => $prodName,
                                'category' => $category,
                                'unitsSold' => 0,
                                'revenue' => 0,
                                'cost' => 0,
                                'ordersCount' => 0
                            ];
                        }
                        $productMap[$prodId]['unitsSold'] += $qty;
                        $productMap[$prodId]['revenue'] += $lineRevenue;
                        $productMap[$prodId]['cost'] += $lineCost;
                        $productMap[$prodId]['ordersCount'] += 1;
                    }

                    $itemRows[] = [
                        'id' => $prodId,
                        'product_id' => $prodId,
                        'name' => $prodName,
                        'quantity' => $qty,
                        'price' => $itemPrice,
                        'cost' => $unitCost,
                        'weight' => $dbItem['weight'] ?? '',
                        'category' => $category
                    ];

                    $hasRangeDates = !empty($dbItem['rangeDates']) && $dbItem['rangeDates'] !== '[]' && $dbItem['rangeDates'] !== 'undefined';
                    $hasSubDates = !empty($dbItem['subscribedDates']) && $dbItem['subscribedDates'] !== '[]' && $dbItem['subscribedDates'] !== 'undefined';
                    $hasDateRange = !empty($dbItem['startDate']) && !empty($dbItem['endDate']);
                    if ($hasRangeDates || $hasSubDates || $hasDateRange) {
                        $isSub = true;
                    }
                }
            } else {
                // Check inline cart_json or items JSON
                $parsedItems = [];
                if (isset($ord['items']) && is_string($ord['items']) && !empty($ord['items'])) {
                    $parsedItems = json_decode($ord['items'], true);
                } else if (isset($ord['cart_json']) && is_string($ord['cart_json']) && !empty($ord['cart_json'])) {
                    $parsedItems = json_decode($ord['cart_json'], true);
                } else if (isset($ord['items']) && is_array($ord['items'])) {
                    $parsedItems = $ord['items'];
                }

                if (is_array($parsedItems)) {
                    foreach ($parsedItems as $it) {
                        $qty = isset($it['quantity']) ? (int)$it['quantity'] : (isset($it['unit']) ? (int)$it['unit'] : 1);
                        $qty = max(1, $qty);
                        $itemPrice = floatval($it['price'] ?? 0);
                        $unitCost = isset($it['stock_price']) && floatval($it['stock_price']) > 0 ? floatval($it['stock_price']) : ($itemPrice * 0.70);
                        $lineCost = $unitCost * $qty;
                        $lineRevenue = $itemPrice * $qty;
                        $orderCost += $lineCost;

                        $prodId = $it['id'] ?? ($it['product_id'] ?? 'PROD_' . rand(100, 999));
                        $prodName = $it['name'] ?? ($it['product_name'] ?? 'Product');
                        $category = $it['category'] ?? 'General';

                        if ($status !== 'CANCELLED') {
                            if (!isset($productMap[$prodId])) {
                                $productMap[$prodId] = [
                                    'id' => $prodId,
                                    'name' => $prodName,
                                    'category' => $category,
                                    'unitsSold' => 0,
                                    'revenue' => 0,
                                    'cost' => 0,
                                    'ordersCount' => 0
                                ];
                            }
                            $productMap[$prodId]['unitsSold'] += $qty;
                            $productMap[$prodId]['revenue'] += $lineRevenue;
                            $productMap[$prodId]['cost'] += $lineCost;
                            $productMap[$prodId]['ordersCount'] += 1;
                        }

                        $itemRows[] = [
                            'id' => $prodId,
                            'name' => $prodName,
                            'quantity' => $qty,
                            'price' => $itemPrice,
                            'cost' => $unitCost
                        ];
                    }
                }
            }

            $ord['items'] = $itemRows;
            $ord['order_type'] = $isSub ? 'subscription' : 'regular';
            $ord['cost'] = $orderCost;
        } catch (Exception $ex) {
            $ord['items'] = [];
            $ord['order_type'] = 'regular';
            $ord['cost'] = $amount * 0.70;
        }

        // Filter by Order Type if specified
        if (!empty($orderTypeFilter) && strtoupper($orderTypeFilter) !== 'ALL') {
            if (strtolower($ord['order_type']) !== strtolower($orderTypeFilter)) {
                continue;
            }
        }

        // Status counts
        if (isset($statusCountMap[$status])) {
            $statusCountMap[$status]++;
        } else {
            $statusCountMap[$status] = 1;
        }

        if ($status === 'DELIVERED') {
            $deliveredOrders++;
        } else if ($status === 'CANCELLED') {
            $cancelledOrders++;
        } else {
            $placedOrders++;
        }

        // Daily trend (Only count non-cancelled in revenue)
        $orderDate = !empty($ord['created_at']) ? date('Y-m-d', strtotime($ord['created_at'])) : date('Y-m-d');
        if (!isset($dailySalesMap[$orderDate])) {
            $dailySalesMap[$orderDate] = [
                'date' => $orderDate,
                'ordersCount' => 0,
                'regularOrders' => 0,
                'subscriptionOrders' => 0,
                'revenue' => 0,
                'cost' => 0,
                'margin' => 0,
                'deliveredCount' => 0,
                'cancelledCount' => 0
            ];
        }

        $dailySalesMap[$orderDate]['ordersCount']++;
        if ($ord['order_type'] === 'subscription') {
            $dailySalesMap[$orderDate]['subscriptionOrders']++;
        } else {
            $dailySalesMap[$orderDate]['regularOrders']++;
        }

        if ($status === 'DELIVERED') {
            $dailySalesMap[$orderDate]['deliveredCount']++;
        } else if ($status === 'CANCELLED') {
            $dailySalesMap[$orderDate]['cancelledCount']++;
        }

        if ($status !== 'CANCELLED') {
            $totalRevenue += $amount;
            $totalCost += $ord['cost'];
            $dailySalesMap[$orderDate]['revenue'] += $amount;
            $dailySalesMap[$orderDate]['cost'] += $ord['cost'];
            $dailySalesMap[$orderDate]['margin'] += ($amount - $ord['cost']);
        }

        // Delivery Partner Stats
        $assignedTo = !empty($ord['assigned_to']) ? trim($ord['assigned_to']) : 'Unassigned';
        if (!isset($deliveryPartnerMap[$assignedTo])) {
            $deliveryPartnerMap[$assignedTo] = [
                'partnerName' => $assignedTo,
                'totalAssigned' => 0,
                'delivered' => 0,
                'pending' => 0,
                'cancelled' => 0,
                'totalValue' => 0
            ];
        }
        $deliveryPartnerMap[$assignedTo]['totalAssigned']++;
        $deliveryPartnerMap[$assignedTo]['totalValue'] += $amount;
        if ($status === 'DELIVERED') {
            $deliveryPartnerMap[$assignedTo]['delivered']++;
        } else if ($status === 'CANCELLED') {
            $deliveryPartnerMap[$assignedTo]['cancelled']++;
        } else {
            $deliveryPartnerMap[$assignedTo]['pending']++;
        }

        // Payment Method breakdown
        $paymentType = 'Cash on Delivery';
        if (!empty($ord['payment_mode'])) {
            $pm = strtolower($ord['payment_mode']);
            if (strpos($pm, 'wallet') !== false) {
                $paymentType = 'Wallet';
            } else if (strpos($pm, 'online') !== false || strpos($pm, 'upi') !== false || strpos($pm, 'card') !== false || strpos($pm, 'razorpay') !== false) {
                $paymentType = 'Online / UPI';
            } else if (strpos($pm, 'cod') !== false || strpos($pm, 'cash') !== false) {
                $paymentType = 'Cash on Delivery';
            } else {
                $paymentType = 'Other';
            }
        }
        $paymentMethodMap[$paymentType]['count']++;
        if ($status !== 'CANCELLED') {
            $paymentMethodMap[$paymentType]['amount'] += $amount;
        }

        $filteredOrders[] = $ord;
    }

    // Compute Margins for Product Map
    $productsList = array_values($productMap);
    foreach ($productsList as &$p) {
        $p['margin'] = round($p['revenue'] - $p['cost'], 2);
        $p['marginPercentage'] = $p['revenue'] > 0 ? round(($p['margin'] / $p['revenue']) * 100, 1) : 0;
        $p['avgPrice'] = $p['unitsSold'] > 0 ? round($p['revenue'] / $p['unitsSold'], 2) : 0;
    }
    // Sort products by revenue descending
    usort($productsList, function($a, $b) {
        return $b['revenue'] <=> $a['revenue'];
    });

    // Compute Delivery Partner completion rate
    $deliveryPartnersList = array_values($deliveryPartnerMap);
    foreach ($deliveryPartnersList as &$dp) {
        $dp['completionRate'] = $dp['totalAssigned'] > 0 
            ? round(($dp['delivered'] / $dp['totalAssigned']) * 100, 1) 
            : 0;
    }
    usort($deliveryPartnersList, function($a, $b) {
        return $b['totalAssigned'] <=> $a['totalAssigned'];
    });

    // Sort Daily Sales Trend by date ASC
    $salesTrend = array_values($dailySalesMap);
    usort($salesTrend, function($a, $b) {
        return strcmp($a['date'], $b['date']);
    });

    $validOrdersCount = count($filteredOrders) - $cancelledOrders;
    $avgOrderValue = $validOrdersCount > 0 ? round($totalRevenue / $validOrdersCount, 2) : 0;
    $estimatedMargin = round($totalRevenue - $totalCost, 2);
    $marginPercentage = $totalRevenue > 0 ? round(($estimatedMargin / $totalRevenue) * 100, 1) : 0;

    $summary = [
        'fromDate' => $fromDate,
        'toDate' => $toDate,
        'totalRevenue' => round($totalRevenue, 2),
        'totalOrders' => count($filteredOrders),
        'deliveredOrders' => $deliveredOrders,
        'cancelledOrders' => $cancelledOrders,
        'placedOrders' => $placedOrders,
        'avgOrderValue' => $avgOrderValue,
        'totalCost' => round($totalCost, 2),
        'estimatedMargin' => $estimatedMargin,
        'marginPercentage' => $marginPercentage
    ];

    sendJson([
        'summary' => $summary,
        'salesTrend' => $salesTrend,
        'products' => $productsList,
        'deliveryPartners' => $deliveryPartnersList,
        'paymentMethods' => array_values($paymentMethodMap),
        'statusBreakdown' => $statusCountMap,
        'orders' => $filteredOrders
    ]);

} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
