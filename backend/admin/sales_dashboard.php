<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([
        'totalRevenue' => 0,
        'totalOrders' => 0,
        'pendingDeliveries' => 0,
        'activeCustomers' => 0,
        'statusBreakdown' => [
            'PLACED' => 0,
            'PACKED' => 0,
            'OUT_FOR_DELIVERY' => 0,
            'DELIVERED' => 0,
            'CANCELLED' => 0
        ],
        'today' => [
            'revenue' => 0,
            'orders' => 0,
            'pending' => 0,
            'customers' => 0
        ],
        'expenses' => [
            'procurement' => 0,
            'rent' => 0,
            'delivery' => 0,
            'other' => 0
        ]
    ]);
}

try {
    // Ensure expenses table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) DEFAULT 0,
        expense_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $today = date('Y-m-d');

    // === LIFETIME STATS ===
    $stmt1 = $pdo->query("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders");
    $row1 = $stmt1->fetch();

    // Status breakdown (lifetime)
    $stmt2 = $pdo->query("SELECT status, COUNT(*) as cnt FROM orders GROUP BY status");
    $statusRows = $stmt2->fetchAll();

    $statusMap = [
        'PLACED' => 0,
        'PACKED' => 0,
        'OUT_FOR_DELIVERY' => 0,
        'DELIVERED' => 0,
        'CANCELLED' => 0
    ];

    $pending = 0;
    foreach ($statusRows as $sr) {
        $stKey = strtoupper($sr['status']);
        $statusMap[$stKey] = (int)$sr['cnt'];
        if (in_array($stKey, ['PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'PENDING'])) {
            $pending += (int)$sr['cnt'];
        }
    }

    // Active Customers (lifetime)
    $stmt3 = $pdo->query("SELECT COUNT(DISTINCT mobile) as active_cust FROM orders");
    $row3 = $stmt3->fetch();

    // === TODAY'S STATS ===
    $stmtToday = $pdo->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as rev FROM orders WHERE DATE(created_at) = ?");
    $stmtToday->execute([$today]);
    $todayRow = $stmtToday->fetch();

    // Today's pending
    $stmtTodayPending = $pdo->prepare("SELECT COUNT(*) as cnt FROM orders WHERE DATE(created_at) = ? AND UPPER(status) IN ('PLACED','PACKED','OUT_FOR_DELIVERY','PENDING')");
    $stmtTodayPending->execute([$today]);
    $todayPendingRow = $stmtTodayPending->fetch();

    // Today's customers
    $stmtTodayCust = $pdo->prepare("SELECT COUNT(DISTINCT mobile) as cnt FROM orders WHERE DATE(created_at) = ?");
    $stmtTodayCust->execute([$today]);
    $todayCustRow = $stmtTodayCust->fetch();

    // === TODAY'S EXPENSES ===
    // Calculate total Market Procurement Cost from today's orders: SUM(stock_price * quantity)
    // Note: oi.price is the total line price for the quantity, and p.stock_price is the cost per unit.
    $stmtProc = $pdo->prepare("
        SELECT 
            COALESCE(SUM(COALESCE(p.stock_price, 0) * COALESCE(oi.quantity, 1)), 0) as total_market_cost,
            COALESCE(SUM(COALESCE(oi.price, 0) - (COALESCE(p.stock_price, 0) * COALESCE(oi.quantity, 1))), 0) as total_profit_margin
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE DATE(o.created_at) = ?
    ");
    $stmtProc->execute([$today]);
    $procRow = $stmtProc->fetch();
    $calculatedProcurement = floatval($procRow['total_market_cost'] ?? 0);

    $stmtExp = $pdo->prepare("SELECT expense_type, COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = ? GROUP BY expense_type");
    $stmtExp->execute([$today]);
    $expRows = $stmtExp->fetchAll();

    $expenses = [
        'procurement' => $calculatedProcurement,
        'rent' => 0,
        'delivery' => 0,
        'other' => 0
    ];
    $hasSavedProcurement = false;
    foreach ($expRows as $er) {
        $key = strtolower($er['expense_type']);
        if (isset($expenses[$key])) {
            if ($key === 'procurement') {
                $hasSavedProcurement = true;
            }
            $expenses[$key] = floatval($er['total']);
        }
    }
    if (!$hasSavedProcurement) {
        $expenses['procurement'] = $calculatedProcurement;
    }

    sendJson([
        'totalRevenue' => floatval($row1['total_revenue'] ?? 0),
        'totalOrders' => intval($row1['total_orders'] ?? 0),
        'pendingDeliveries' => $pending,
        'activeCustomers' => intval($row3['active_cust'] ?? 0),
        'statusBreakdown' => $statusMap,
        'today' => [
            'revenue' => floatval($todayRow['rev'] ?? 0),
            'orders' => intval($todayRow['cnt'] ?? 0),
            'pending' => intval($todayPendingRow['cnt'] ?? 0),
            'customers' => intval($todayCustRow['cnt'] ?? 0)
        ],
        'calculatedProcurement' => $calculatedProcurement,
        'expenses' => $expenses
    ]);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
