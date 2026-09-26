<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([
        'period' => 'lifetime',
        'periodLabel' => 'Lifetime',
        'startDate' => null,
        'endDate' => null,
        'totalRevenue' => 0,
        'totalOrders' => 0,
        'aov' => 0,
        'totalExpenses' => 0,
        'totalRefunds' => 0,
        'totalRefundCount' => 0,
        'totalPromoDiscounts' => 0,
        'totalPromoCount' => 0,
        'totalReferralBonuses' => 0,
        'totalReferralCount' => 0,
        'totalProfit' => 0,
        'profitMargin' => 0,
        'totalWalletBalance' => 0,
        'totalLedgerBalance' => 0,
        'pendingDeliveries' => 0,
        'activeCustomers' => 0,
        'repeatCustomerRate' => 0,
        'statusBreakdown' => [
            'PLACED' => 0,
            'PACKED' => 0,
            'OUT_FOR_DELIVERY' => 0,
            'DELIVERED' => 0,
            'CANCELLED' => 0
        ],
        'paymentBreakdown' => [
            'COD' => ['count' => 0, 'amount' => 0],
            'ONLINE' => ['count' => 0, 'amount' => 0],
            'WALLET' => ['count' => 0, 'amount' => 0],
            'OFFLINE' => ['count' => 0, 'amount' => 0]
        ],
        'topProducts' => [],
        'categoryBreakdown' => [],
        'dailyTrend' => [],
        'recentOrders' => [],
        'today' => [
            'revenue' => 0,
            'orders' => 0,
            'aov' => 0,
            'refunds' => 0,
            'refundCount' => 0,
            'promoDiscounts' => 0,
            'promoCount' => 0,
            'referralBonuses' => 0,
            'referralCount' => 0,
            'walletCredit' => 0,
            'walletCreditCount' => 0,
            'walletDebit' => 0,
            'walletDebitCount' => 0,
            'pending' => 0,
            'customers' => 0,
            'profit' => 0
        ],
        'promoBreakdown' => [],
        'recentPromoOrders' => [],
        'recentReferralBonuses' => [],
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
    $period = strtolower(trim((string)(getParam('period') ?: 'lifetime')));
    $startDateParam = getParam('start_date');
    $endDateParam = getParam('end_date');

    $startDate = null;
    $endDate = null;
    $periodLabel = 'Lifetime (All Time)';

    if ($period === '1day' || $period === 'today') {
        $period = '1day';
        $startDate = $today;
        $endDate = $today;
        $periodLabel = 'Today (' . date('d M Y') . ')';
    } elseif ($period === '7days') {
        $startDate = date('Y-m-d', strtotime('-6 days'));
        $endDate = $today;
        $periodLabel = 'Last 7 Days (' . date('d M', strtotime($startDate)) . ' - ' . date('d M Y', strtotime($endDate)) . ')';
    } elseif ($period === '15days') {
        $startDate = date('Y-m-d', strtotime('-14 days'));
        $endDate = $today;
        $periodLabel = 'Last 15 Days (' . date('d M', strtotime($startDate)) . ' - ' . date('d M Y', strtotime($endDate)) . ')';
    } elseif ($period === '30days' || $period === 'month') {
        $period = '30days';
        $startDate = date('Y-m-d', strtotime('-29 days'));
        $endDate = $today;
        $periodLabel = 'Last 30 Days (' . date('d M', strtotime($startDate)) . ' - ' . date('d M Y', strtotime($endDate)) . ')';
    } elseif ($period === 'custom') {
        $startDate = $startDateParam ? date('Y-m-d', strtotime($startDateParam)) : $today;
        $endDate = $endDateParam ? date('Y-m-d', strtotime($endDateParam)) : $today;
        $periodLabel = 'Custom (' . date('d M Y', strtotime($startDate)) . ' - ' . date('d M Y', strtotime($endDate)) . ')';
    } else {
        $period = 'lifetime';
        $periodLabel = 'Lifetime (All Time)';
    }

    $hasRange = ($startDate !== null && $endDate !== null);

    // === 1. REVENUE, ORDERS & CUSTOMERS FOR SELECTED PERIOD ===
    if ($hasRange) {
        $stmtRev = $pdo->prepare("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders WHERE DATE(created_at) BETWEEN ? AND ?");
        $stmtRev->execute([$startDate, $endDate]);

        $stmtSt = $pdo->prepare("SELECT status, COUNT(*) as cnt FROM orders WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY status");
        $stmtSt->execute([$startDate, $endDate]);

        $stmtCust = $pdo->prepare("SELECT COUNT(DISTINCT mobile) as active_cust FROM orders WHERE DATE(created_at) BETWEEN ? AND ?");
        $stmtCust->execute([$startDate, $endDate]);

        // Repeat customers in period
        $stmtRep = $pdo->prepare("
            SELECT COUNT(*) as repeat_count FROM (
                SELECT mobile FROM orders 
                WHERE DATE(created_at) BETWEEN ? AND ? 
                GROUP BY mobile HAVING COUNT(*) > 1
            ) t
        ");
        $stmtRep->execute([$startDate, $endDate]);
    } else {
        $stmtRev = $pdo->query("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders");
        $stmtSt = $pdo->query("SELECT status, COUNT(*) as cnt FROM orders GROUP BY status");
        $stmtCust = $pdo->query("SELECT COUNT(DISTINCT mobile) as active_cust FROM orders");

        $stmtRep = $pdo->query("
            SELECT COUNT(*) as repeat_count FROM (
                SELECT mobile FROM orders GROUP BY mobile HAVING COUNT(*) > 1
            ) t
        ");
    }

    $revRow = $stmtRev->fetch();
    $periodRevenue = floatval($revRow['total_revenue'] ?? 0);
    $periodOrders = intval($revRow['total_orders'] ?? 0);
    $periodAov = ($periodOrders > 0) ? round($periodRevenue / $periodOrders, 2) : 0;

    $custRow = $stmtCust->fetch();
    $periodActiveCust = intval($custRow['active_cust'] ?? 0);

    $repRow = $stmtRep->fetch();
    $periodRepeatCust = intval($repRow['repeat_count'] ?? 0);
    $repeatRate = ($periodActiveCust > 0) ? round(($periodRepeatCust / $periodActiveCust) * 100, 1) : 0;

    $periodStatusMap = [
        'PLACED' => 0,
        'PACKED' => 0,
        'OUT_FOR_DELIVERY' => 0,
        'DELIVERED' => 0,
        'CANCELLED' => 0
    ];
    $periodPending = 0;
    foreach ($stmtSt->fetchAll() as $sr) {
        $stKey = strtoupper(trim($sr['status']));
        $periodStatusMap[$stKey] = (int)$sr['cnt'];
        if (in_array($stKey, ['PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'PENDING'])) {
            $periodPending += (int)$sr['cnt'];
        }
    }

    // === 2. REFUNDS FOR SELECTED PERIOD ===
    $periodRefunds = 0;
    $periodRefundCount = 0;
    try {
        if ($hasRange) {
            $stmtRef = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt FROM wallets WHERE (description LIKE '%Refund%' OR description LIKE '%refund%') AND UPPER(type) = 'CREDIT' AND DATE(created_at) BETWEEN ? AND ?");
            $stmtRef->execute([$startDate, $endDate]);
        } else {
            $stmtRef = $pdo->query("SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt FROM wallets WHERE (description LIKE '%Refund%' OR description LIKE '%refund%') AND UPPER(type) = 'CREDIT'");
        }
        $rRow = $stmtRef->fetch();
        $periodRefunds = floatval($rRow['amt'] ?? 0);
        $periodRefundCount = intval($rRow['cnt'] ?? 0);

        if ($hasRange) {
            $stmtOrdRef = $pdo->prepare("SELECT COALESCE(SUM(refund_amount), 0) as amt, COUNT(CASE WHEN refund_amount > 0 THEN 1 END) as cnt FROM orders WHERE refund_amount > 0 AND (DATE(created_at) BETWEEN ? AND ? OR DATE(updated_at) BETWEEN ? AND ?)");
            $stmtOrdRef->execute([$startDate, $endDate, $startDate, $endDate]);
        } else {
            $stmtOrdRef = $pdo->query("SELECT COALESCE(SUM(refund_amount), 0) as amt, COUNT(CASE WHEN refund_amount > 0 THEN 1 END) as cnt FROM orders WHERE refund_amount > 0");
        }
        $oRow = $stmtOrdRef->fetch();
        $ordAmt = floatval($oRow['amt'] ?? 0);
        $ordCnt = intval($oRow['cnt'] ?? 0);
        if ($ordAmt > $periodRefunds) {
            $periodRefunds = $ordAmt;
            $periodRefundCount = $ordCnt;
        }
    } catch (Exception $e) {}

    // === 3. PROMO DISCOUNTS FOR SELECTED PERIOD ===
    $periodPromoDiscounts = 0;
    $periodPromoCount = 0;
    try {
        if ($hasRange) {
            $stmtPr = $pdo->prepare("SELECT COALESCE(SUM(coupon_discount), 0) as amt, COUNT(CASE WHEN coupon_discount > 0 THEN 1 END) as cnt FROM orders WHERE coupon_discount > 0 AND DATE(created_at) BETWEEN ? AND ?");
            $stmtPr->execute([$startDate, $endDate]);
        } else {
            $stmtPr = $pdo->query("SELECT COALESCE(SUM(coupon_discount), 0) as amt, COUNT(CASE WHEN coupon_discount > 0 THEN 1 END) as cnt FROM orders WHERE coupon_discount > 0");
        }
        $prRow = $stmtPr->fetch();
        $periodPromoDiscounts = floatval($prRow['amt'] ?? 0);
        $periodPromoCount = intval($prRow['cnt'] ?? 0);
    } catch (Exception $e) {}

    // === 4. REFERRAL BONUSES FOR SELECTED PERIOD ===
    $periodReferralBonuses = 0;
    $periodReferralCount = 0;
    try {
        if ($hasRange) {
            $stmtRf = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt FROM wallets WHERE (description LIKE '%Referral Bonus%' OR description LIKE '%Referral%') AND UPPER(type) = 'CREDIT' AND DATE(created_at) BETWEEN ? AND ?");
            $stmtRf->execute([$startDate, $endDate]);
        } else {
            $stmtRf = $pdo->query("SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt FROM wallets WHERE (description LIKE '%Referral Bonus%' OR description LIKE '%Referral%') AND UPPER(type) = 'CREDIT'");
        }
        $rfRow = $stmtRf->fetch();
        $periodReferralBonuses = floatval($rfRow['amt'] ?? 0);
        $periodReferralCount = intval($rfRow['cnt'] ?? 0);
    } catch (Exception $e) {}

    // === 5. OPERATING EXPENSES & PROCUREMENT FOR SELECTED PERIOD ===
    $periodProcurement = 0;
    try {
        if ($hasRange) {
            $stmtProc = $pdo->prepare("
                SELECT COALESCE(SUM(COALESCE(p.stock_price, oi.price * 0.7) * COALESCE(oi.quantity, 1)), 0) as cost
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE DATE(o.created_at) BETWEEN ? AND ?
            ");
            $stmtProc->execute([$startDate, $endDate]);
        } else {
            $stmtProc = $pdo->query("
                SELECT COALESCE(SUM(COALESCE(p.stock_price, oi.price * 0.7) * COALESCE(oi.quantity, 1)), 0) as cost
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.id
            ");
        }
        $procRow = $stmtProc->fetch();
        $periodProcurement = floatval($procRow['cost'] ?? 0);
    } catch (Exception $e) {}

    $periodExpenses = [
        'procurement' => $periodProcurement,
        'rent' => 0,
        'delivery' => 0,
        'other' => 0
    ];
    try {
        if ($hasRange) {
            $stmtExp = $pdo->prepare("SELECT expense_type, COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY expense_type");
            $stmtExp->execute([$startDate, $endDate]);
        } else {
            $stmtExp = $pdo->query("SELECT expense_type, COALESCE(SUM(amount), 0) as total FROM expenses GROUP BY expense_type");
        }
        $hasSavedProc = false;
        foreach ($stmtExp->fetchAll() as $er) {
            $ek = strtolower($er['expense_type']);
            if (isset($periodExpenses[$ek])) {
                if ($ek === 'procurement') {
                    $hasSavedProc = true;
                }
                $periodExpenses[$ek] = floatval($er['total']);
            } else {
                $periodExpenses['other'] += floatval($er['total']);
            }
        }
        if (!$hasSavedProc) {
            $periodExpenses['procurement'] = $periodProcurement;
        }
    } catch (Exception $e) {}

    $periodTotalExpenses = floatval($periodExpenses['procurement']) +
                           floatval($periodExpenses['rent']) +
                           floatval($periodExpenses['delivery']) +
                           floatval($periodExpenses['other']);

    // Net Profit Calculation: Revenue - COGS/Procurement & OpEx - Refunds - Promo Discounts - Referral Bonuses
    $periodNetProfit = $periodRevenue - $periodTotalExpenses - $periodRefunds - $periodPromoDiscounts - $periodReferralBonuses;
    $periodProfitMargin = ($periodRevenue > 0) ? round(($periodNetProfit / $periodRevenue) * 100, 1) : 0;

    // === 6. PAYMENT BREAKDOWN FOR SELECTED PERIOD ===
    $paymentBreakdown = [
        'COD' => ['count' => 0, 'amount' => 0],
        'ONLINE' => ['count' => 0, 'amount' => 0],
        'WALLET' => ['count' => 0, 'amount' => 0],
        'OFFLINE' => ['count' => 0, 'amount' => 0]
    ];
    try {
        if ($hasRange) {
            $stmtPay = $pdo->prepare("
                SELECT payment_type, order_source, COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as amt 
                FROM orders 
                WHERE DATE(created_at) BETWEEN ? AND ? 
                GROUP BY payment_type, order_source
            ");
            $stmtPay->execute([$startDate, $endDate]);
        } else {
            $stmtPay = $pdo->query("
                SELECT payment_type, order_source, COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as amt 
                FROM orders 
                GROUP BY payment_type, order_source
            ");
        }
        foreach ($stmtPay->fetchAll() as $payRow) {
            $pt = strtoupper(trim($payRow['payment_type'] ?? ''));
            $os = strtoupper(trim($payRow['order_source'] ?? ''));
            if ($os === 'ADMIN_OFFLINE' || $pt === 'OFFLINE') {
                $paymentBreakdown['OFFLINE']['count'] += (int)$payRow['cnt'];
                $paymentBreakdown['OFFLINE']['amount'] += (float)$payRow['amt'];
            } elseif ($pt === 'COD') {
                $paymentBreakdown['COD']['count'] += (int)$payRow['cnt'];
                $paymentBreakdown['COD']['amount'] += (float)$payRow['amt'];
            } elseif ($pt === 'WALLET') {
                $paymentBreakdown['WALLET']['count'] += (int)$payRow['cnt'];
                $paymentBreakdown['WALLET']['amount'] += (float)$payRow['amt'];
            } else {
                $paymentBreakdown['ONLINE']['count'] += (int)$payRow['cnt'];
                $paymentBreakdown['ONLINE']['amount'] += (float)$payRow['amt'];
            }
        }
    } catch (Exception $e) {}

    // === 7. TOP SELLING PRODUCTS FOR SELECTED PERIOD ===
    $topProducts = [];
    try {
        if ($hasRange) {
            $stmtTop = $pdo->prepare("
                SELECT oi.product_id, COALESCE(p.name, oi.product_name) as name, COALESCE(p.cat, 'General') as cat, p.img_url,
                       SUM(oi.quantity) as units_sold,
                       SUM(oi.price * oi.quantity) as total_revenue,
                       SUM((oi.price - COALESCE(p.stock_price, oi.price * 0.7)) * oi.quantity) as gross_profit
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE DATE(o.created_at) BETWEEN ? AND ?
                GROUP BY oi.product_id, name, cat, p.img_url
                ORDER BY units_sold DESC
                LIMIT 10
            ");
            $stmtTop->execute([$startDate, $endDate]);
        } else {
            $stmtTop = $pdo->query("
                SELECT oi.product_id, COALESCE(p.name, oi.product_name) as name, COALESCE(p.cat, 'General') as cat, p.img_url,
                       SUM(oi.quantity) as units_sold,
                       SUM(oi.price * oi.quantity) as total_revenue,
                       SUM((oi.price - COALESCE(p.stock_price, oi.price * 0.7)) * oi.quantity) as gross_profit
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.id
                GROUP BY oi.product_id, name, cat, p.img_url
                ORDER BY units_sold DESC
                LIMIT 10
            ");
        }
        $topProducts = $stmtTop->fetchAll();
    } catch (Exception $e) {}

    // === 8. CATEGORY REVENUE BREAKDOWN ===
    $categoryBreakdown = [];
    try {
        if ($hasRange) {
            $stmtCat = $pdo->prepare("
                SELECT COALESCE(p.cat, 'General') as category,
                       COUNT(DISTINCT o.order_id) as order_count,
                       SUM(oi.quantity) as units_sold,
                       SUM(oi.price * oi.quantity) as total_sales
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE DATE(o.created_at) BETWEEN ? AND ?
                GROUP BY category
                ORDER BY total_sales DESC
            ");
            $stmtCat->execute([$startDate, $endDate]);
        } else {
            $stmtCat = $pdo->query("
                SELECT COALESCE(p.cat, 'General') as category,
                       COUNT(DISTINCT o.order_id) as order_count,
                       SUM(oi.quantity) as units_sold,
                       SUM(oi.price * oi.quantity) as total_sales
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                LEFT JOIN products p ON oi.product_id = p.id
                GROUP BY category
                ORDER BY total_sales DESC
            ");
        }
        $categoryBreakdown = $stmtCat->fetchAll();
    } catch (Exception $e) {}

    // === 9. DAILY SALES TREND (Last 14 days or filtered period) ===
    $dailyTrend = [];
    try {
        $trendStart = $hasRange ? $startDate : date('Y-m-d', strtotime('-13 days'));
        $trendEnd = $hasRange ? $endDate : date('Y-m-d');
        $stmtTrend = $pdo->prepare("
            SELECT DATE(created_at) as sale_date, COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as revenue
            FROM orders
            WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY sale_date ASC
        ");
        $stmtTrend->execute([$trendStart, $trendEnd]);
        $dailyTrend = $stmtTrend->fetchAll();
    } catch (Exception $e) {}

    // === 10. RECENT REVENUE-GENERATING ORDERS ===
    $recentOrders = [];
    try {
        $stmtRecentOrd = $pdo->query("
            SELECT o.order_id, o.mobile, o.total_amount, o.payment_type, o.status, o.created_at, o.delivery_date,
                   COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            GROUP BY o.order_id, o.mobile, o.total_amount, o.payment_type, o.status, o.created_at, o.delivery_date
            ORDER BY o.created_at DESC 
            LIMIT 10
        ");
        $recentOrders = $stmtRecentOrd->fetchAll();
    } catch (Exception $e) {}

    // === 11. WALLET & SUBSCRIPTION LEDGER BALANCES (LIABILITIES) ===
    $totalWalletBalance = 0;
    try {
        $stmtWal = $pdo->query("
            SELECT COALESCE(SUM(CASE 
                WHEN UPPER(type) = 'CREDIT' AND (status IS NULL OR status = '' OR status IN ('authorized', 'captured', 'placed', 'success')) THEN amount 
                WHEN UPPER(type) = 'DEBIT' AND (status IS NULL OR status = '' OR status IN ('authorized', 'captured', 'placed', 'success')) THEN -amount 
                ELSE 0 
            END), 0) as total_wallet
            FROM wallets
        ");
        $walRow = $stmtWal->fetch();
        $totalWalletBalance = max(0, floatval($walRow['total_wallet'] ?? 0));
    } catch (Exception $e) {}

    $totalLedgerBalance = 0;
    try {
        $stmtSubs = $pdo->query("
            SELECT oi.* FROM order_items oi 
            JOIN orders o ON oi.order_id = o.order_id 
            WHERE oi.subscriptionType IN ('range', 'multi_day') 
              AND oi.subsStatus IN ('active', 'resume')
        ");
        $subItems = $stmtSubs->fetchAll();
        $todayStr = date('Y-m-d');
        foreach ($subItems as $subItem) {
            $rawPrice = round((float)$subItem['price']);
            $datesJson = ($subItem['subscriptionType'] === 'range') ? $subItem['rangeDates'] : $subItem['subscribedDates'];
            $dates = json_decode($datesJson, true);
            if (is_array($dates) && count($dates) > 0) {
                $totalDays = count($dates);
                $qty = max(1, (int)$subItem['quantity']);
                $dailyUnitPrice = ($totalDays > 0 && $rawPrice > 0) ? ($rawPrice / ($totalDays * $qty)) : $rawPrice;

                foreach ($dates as $d) {
                    $dStr = is_array($d) ? (isset($d['date']) ? $d['date'] : '') : (string)$d;
                    $dStatus = is_array($d) ? (isset($d['status']) ? strtolower($d['status']) : '') : '';
                    $dCount = is_array($d) ? (isset($d['count']) ? (int)$d['count'] : $qty) : $qty;

                    if ($dStatus !== 'delivered' && $dStatus !== 'cancelled' && $dStatus !== 'refunded') {
                        if (!$dStr || strtotime($dStr) >= strtotime($todayStr)) {
                            $totalLedgerBalance += ($dCount * $dailyUnitPrice);
                        }
                    }
                }
            }
        }
        $totalLedgerBalance = round($totalLedgerBalance);
    } catch (Exception $e) {}

    // === 12. TODAY'S SNAPSHOT (ALWAYS ACCURATE FOR CURRENT DAY) ===
    $stmtToday = $pdo->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as rev FROM orders WHERE DATE(created_at) = ?");
    $stmtToday->execute([$today]);
    $todayRow = $stmtToday->fetch();
    $todayRevenue = floatval($todayRow['rev'] ?? 0);
    $todayOrders = intval($todayRow['cnt'] ?? 0);
    $todayAov = ($todayOrders > 0) ? round($todayRevenue / $todayOrders, 2) : 0;

    $stmtTodayPending = $pdo->prepare("SELECT COUNT(*) as cnt FROM orders WHERE DATE(created_at) = ? AND UPPER(status) IN ('PLACED','PACKED','OUT_FOR_DELIVERY','PENDING')");
    $stmtTodayPending->execute([$today]);
    $todayPendingRow = $stmtTodayPending->fetch();

    $stmtTodayCust = $pdo->prepare("SELECT COUNT(DISTINCT mobile) as cnt FROM orders WHERE DATE(created_at) = ?");
    $stmtTodayCust->execute([$today]);
    $todayCustRow = $stmtTodayCust->fetch();

    // Today's refunds
    $todayRefunds = 0;
    $todayRefundCount = 0;
    try {
        $stmtTRef = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt FROM wallets WHERE (description LIKE '%Refund%' OR description LIKE '%refund%') AND UPPER(type) = 'CREDIT' AND DATE(created_at) = ?");
        $stmtTRef->execute([$today]);
        $tRefRow = $stmtTRef->fetch();
        $todayRefunds = floatval($tRefRow['amt'] ?? 0);
        $todayRefundCount = intval($tRefRow['cnt'] ?? 0);

        $stmtTOrdRef = $pdo->prepare("SELECT COALESCE(SUM(refund_amount), 0) as amt, COUNT(CASE WHEN refund_amount > 0 THEN 1 END) as cnt FROM orders WHERE refund_amount > 0 AND (DATE(created_at) = ? OR DATE(updated_at) = ?)");
        $stmtTOrdRef->execute([$today, $today]);
        $tOrdRow = $stmtTOrdRef->fetch();
        $tOrdAmt = floatval($tOrdRow['amt'] ?? 0);
        if ($tOrdAmt > $todayRefunds) {
            $todayRefunds = $tOrdAmt;
            $todayRefundCount = intval($tOrdRow['cnt'] ?? 0);
        }
    } catch (Exception $e) {}

    // Today's promo discounts
    $todayPromoDiscounts = 0;
    $todayPromoCount = 0;
    try {
        $stmtTPr = $pdo->prepare("SELECT COALESCE(SUM(coupon_discount), 0) as amt, COUNT(CASE WHEN coupon_discount > 0 THEN 1 END) as cnt FROM orders WHERE coupon_discount > 0 AND DATE(created_at) = ?");
        $stmtTPr->execute([$today]);
        $tPrRow = $stmtTPr->fetch();
        $todayPromoDiscounts = floatval($tPrRow['amt'] ?? 0);
        $todayPromoCount = intval($tPrRow['cnt'] ?? 0);
    } catch (Exception $e) {}

    // Today's referral bonuses
    $todayReferralBonuses = 0;
    $todayReferralCount = 0;
    try {
        $stmtTRf = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt FROM wallets WHERE (description LIKE '%Referral Bonus%' OR description LIKE '%Referral%') AND UPPER(type) = 'CREDIT' AND DATE(created_at) = ?");
        $stmtTRf->execute([$today]);
        $tRfRow = $stmtTRf->fetch();
        $todayReferralBonuses = floatval($tRfRow['amt'] ?? 0);
        $todayReferralCount = intval($tRfRow['cnt'] ?? 0);
    } catch (Exception $e) {}

    // Today's genuine Razorpay wallet credits
    $todayWalletCredit = 0;
    $todayWalletCreditCount = 0;
    $todayWalletDebit = 0;
    $todayWalletDebitCount = 0;
    try {
        $stmtTodayCredit = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt 
            FROM wallets 
            WHERE UPPER(type) = 'CREDIT' 
              AND (
                  description LIKE '%Razorpay%' 
                  OR description LIKE '%pay_%' 
                  OR description LIKE '%Added money%'
              )
              AND description NOT LIKE '%Refund%' 
              AND description NOT LIKE '%Referral%'
              AND (status IS NULL OR status = '' OR LOWER(status) IN ('authorized', 'captured', 'placed', 'success'))
              AND DATE(created_at) = ?
        ");
        $stmtTodayCredit->execute([$today]);
        $crRow = $stmtTodayCredit->fetch();
        $todayWalletCredit = floatval($crRow['amt'] ?? 0);
        $todayWalletCreditCount = intval($crRow['cnt'] ?? 0);

        $stmtTodayDebit = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) as amt, COUNT(*) as cnt 
            FROM wallets 
            WHERE UPPER(type) = 'DEBIT' 
              AND (status IS NULL OR status = '' OR LOWER(status) IN ('authorized', 'captured', 'placed', 'success'))
              AND DATE(created_at) = ?
        ");
        $stmtTodayDebit->execute([$today]);
        $dbRow = $stmtTodayDebit->fetch();
        $todayWalletDebit = floatval($dbRow['amt'] ?? 0);
        $todayWalletDebitCount = intval($dbRow['cnt'] ?? 0);
    } catch (Exception $e) {}

    // Today's procurement from orders
    $stmtTProc = $pdo->prepare("
        SELECT COALESCE(SUM(COALESCE(p.stock_price, oi.price * 0.7) * COALESCE(oi.quantity, 1)), 0) as total_market_cost
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE DATE(o.created_at) = ?
    ");
    $stmtTProc->execute([$today]);
    $tProcRow = $stmtTProc->fetch();
    $todayCalculatedProcurement = floatval($tProcRow['total_market_cost'] ?? 0);

    $stmtTExp = $pdo->prepare("SELECT expense_type, COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = ? GROUP BY expense_type");
    $stmtTExp->execute([$today]);
    $tExpRows = $stmtTExp->fetchAll();

    $todayExpenses = [
        'procurement' => $todayCalculatedProcurement,
        'rent' => 0,
        'delivery' => 0,
        'other' => 0
    ];
    $hasSavedTProc = false;
    foreach ($tExpRows as $er) {
        $key = strtolower($er['expense_type']);
        if (isset($todayExpenses[$key])) {
            if ($key === 'procurement') {
                $hasSavedTProc = true;
            }
            $todayExpenses[$key] = floatval($er['total']);
        }
    }
    if (!$hasSavedTProc) {
        $todayExpenses['procurement'] = $todayCalculatedProcurement;
    }

    $todayTotalExpenses = floatval($todayExpenses['procurement'] ?? 0) +
                          floatval($todayExpenses['rent'] ?? 0) +
                          floatval($todayExpenses['delivery'] ?? 0) +
                          floatval($todayExpenses['other'] ?? 0);
    $todayNetProfit = $todayRevenue - $todayTotalExpenses - $todayRefunds - $todayReferralBonuses - $todayPromoDiscounts;

    // === 13. AUDIT LOGS ===
    $promoBreakdown = [];
    try {
        $stmtBrk = $pdo->query("SELECT coupon, COUNT(*) as usage_count, COALESCE(SUM(coupon_discount), 0) as total_discount FROM orders WHERE coupon_discount > 0 GROUP BY coupon ORDER BY total_discount DESC");
        $promoBreakdown = $stmtBrk->fetchAll();
    } catch (Exception $e) {}

    $recentPromoOrders = [];
    try {
        $stmtRecentPromo = $pdo->query("SELECT order_id, mobile, total_amount, coupon, coupon_discount, status, created_at FROM orders WHERE coupon_discount > 0 ORDER BY created_at DESC LIMIT 15");
        $recentPromoOrders = $stmtRecentPromo->fetchAll();
    } catch (Exception $e) {}

    $recentReferralBonuses = [];
    try {
        $stmtRecentRef = $pdo->query("SELECT id, mobile, amount, description, status, created_at FROM wallets WHERE (description LIKE '%Referral Bonus%' OR description LIKE '%Referral%') AND UPPER(type) = 'CREDIT' ORDER BY id DESC LIMIT 15");
        $recentReferralBonuses = $stmtRecentRef->fetchAll();
    } catch (Exception $e) {}

    sendJson([
        'period' => $period,
        'periodLabel' => $periodLabel,
        'startDate' => $startDate,
        'endDate' => $endDate,
        'totalRevenue' => $periodRevenue,
        'totalOrders' => $periodOrders,
        'aov' => $periodAov,
        'totalExpenses' => $periodTotalExpenses,
        'expenses' => $periodExpenses,
        'totalRefunds' => $periodRefunds,
        'totalRefundCount' => $periodRefundCount,
        'totalPromoDiscounts' => $periodPromoDiscounts,
        'totalPromoCount' => $periodPromoCount,
        'totalReferralBonuses' => $periodReferralBonuses,
        'totalReferralCount' => $periodReferralCount,
        'totalProfit' => $periodNetProfit,
        'profitMargin' => $periodProfitMargin,
        'totalWalletBalance' => $totalWalletBalance,
        'totalLedgerBalance' => $totalLedgerBalance,
        'pendingDeliveries' => $periodPending,
        'activeCustomers' => $periodActiveCust,
        'repeatCustomerRate' => $repeatRate,
        'statusBreakdown' => $periodStatusMap,
        'paymentBreakdown' => $paymentBreakdown,
        'topProducts' => $topProducts,
        'categoryBreakdown' => $categoryBreakdown,
        'dailyTrend' => $dailyTrend,
        'recentOrders' => $recentOrders,
        'today' => [
            'date' => date('M d, Y'),
            'revenue' => $todayRevenue,
            'orders' => $todayOrders,
            'aov' => $todayAov,
            'refunds' => $todayRefunds,
            'refundCount' => $todayRefundCount,
            'promoDiscounts' => $todayPromoDiscounts,
            'promoCount' => $todayPromoCount,
            'referralBonuses' => $todayReferralBonuses,
            'referralCount' => $todayReferralCount,
            'walletCredit' => $todayWalletCredit,
            'walletCreditCount' => $todayWalletCreditCount,
            'walletDebit' => $todayWalletDebit,
            'walletDebitCount' => $todayWalletDebitCount,
            'pending' => intval($todayPendingRow['cnt'] ?? 0),
            'customers' => intval($todayCustRow['cnt'] ?? 0),
            'profit' => $todayNetProfit
        ],
        'promoBreakdown' => $promoBreakdown,
        'recentPromoOrders' => $recentPromoOrders,
        'recentReferralBonuses' => $recentReferralBonuses,
        'calculatedProcurement' => $todayCalculatedProcurement,
        'todayExpenses' => $todayExpenses
    ]);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
