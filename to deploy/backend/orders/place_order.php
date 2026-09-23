<?php
date_default_timezone_set('Asia/Kolkata');
require_once __DIR__ . '/../config/db.php';

$detailsParam = getParam('details') ?: getParam('ordersDetails');
$details = is_string($detailsParam) ? json_decode($detailsParam, true) : $detailsParam;

if (!$details) {
    sendJson(['error' => 'Order details are required'], 400);
}

$mobile = isset($details['mobile']) ? $details['mobile'] : (isset($details['user_id']) ? $details['user_id'] : '');
$total_amount = isset($details['total_amount']) ? round((float)$details['total_amount']) : (isset($details['amount']) ? round((float)$details['amount']) : 0);
$payment_type = isset($details['payment_type']) ? $details['payment_type'] : 'Wallet';
$address_json = isset($details['address']) ? (is_string($details['address']) ? $details['address'] : json_encode($details['address'])) : '';
$order_id = isset($details['order_id']) && !empty($details['order_id']) ? $details['order_id'] : ('ORD_' . date('YmdHis') . '_' . rand(100, 999));

// Delivery Option & Scheduling (Strictly Asia/Kolkata IST)
$delivery_option = isset($details['delivery_option']) ? trim($details['delivery_option']) : 'NEXT_DAY_7AM';
$delivery_cutoff_ist = '12:00 Midnight IST';
$delivery_expected_at = null;

// Operating hours for instant 10, 30, 60 mins deliveries: 8:00 AM (8) to 8:00 PM (20) IST
$currentIstHour = (int)date('G');
$isImmediateOperatingHours = ($currentIstHour >= 8 && $currentIstHour < 20);

if (!$isImmediateOperatingHours && in_array($delivery_option, ['IMMEDIATE_10', 'IMMEDIATE_30', 'IMMEDIATE_60'])) {
    $delivery_option = 'NEXT_DAY_7AM';
}

if ($delivery_option === 'IMMEDIATE_10') {
    $delivery_expected_at = date('Y-m-d H:i:s', strtotime('+10 minutes'));
    $delivery_date = date('Y-m-d', strtotime($delivery_expected_at));
} elseif ($delivery_option === 'IMMEDIATE_30') {
    $delivery_expected_at = date('Y-m-d H:i:s', strtotime('+30 minutes'));
    $delivery_date = date('Y-m-d', strtotime($delivery_expected_at));
} elseif ($delivery_option === 'IMMEDIATE_60') {
    $delivery_expected_at = date('Y-m-d H:i:s', strtotime('+60 minutes'));
    $delivery_date = date('Y-m-d', strtotime($delivery_expected_at));
} else {
    $delivery_option = 'NEXT_DAY_7AM';
    $delivery_date_raw = isset($details['delivery_date']) ? $details['delivery_date'] : '';
    $delivery_date_timestamp = strtotime($delivery_date_raw);
    if ($delivery_date_raw && $delivery_date_timestamp && $delivery_date_timestamp > 0) {
        $delivery_date = date('Y-m-d', $delivery_date_timestamp);
    } else {
        $delivery_date = date('Y-m-d', strtotime('+1 day'));
    }
    // Will be adjusted for weekly_off_day after weeklyOffDay is loaded
}

$items = isset($details['items']) ? $details['items'] : (isset($details['products']) ? $details['products'] : []);
$order_source = isset($details['order_source']) ? trim($details['order_source']) : 'CLIENT_WEB';
$created_by = isset($details['created_by']) ? trim($details['created_by']) : null;
$isOffline = ($payment_type === 'OFFLINE' || $order_source === 'ADMIN_OFFLINE');

if (!$pdo) {
    sendJson(['status' => 'SUCCESS', 'order_id' => $order_id]);
}

if (strtoupper($payment_type) === 'COD') {
    try {
        $stmtCod = $pdo->query("SELECT `value` FROM store_settings WHERE `key` = 'enable_cod'");
        if ($stmtCod && $rCod = $stmtCod->fetch(PDO::FETCH_ASSOC)) {
            if ($rCod['value'] === '0') {
                sendJson(['status' => 'FAILED', 'message' => 'Cash on Delivery (COD) is temporarily disabled by store admin.'], 400);
                exit();
            }
        }
    } catch (Exception $e) {}
}

// 1. Ensure table schemas and columns exist BEFORE starting transaction (DDL outside transaction)
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(100) UNIQUE NOT NULL,
            mobile VARCHAR(20) DEFAULT '',
            address_json TEXT DEFAULT NULL,
            total_amount DECIMAL(10,2) DEFAULT 0.00,
            payment_type VARCHAR(50) DEFAULT 'Wallet',
            order_source VARCHAR(50) DEFAULT 'CLIENT_WEB',
            created_by VARCHAR(100) DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'PLACED',
            delivery_date DATE DEFAULT NULL,
            delivery_inst TEXT DEFAULT NULL,
            delivery_mode VARCHAR(100) DEFAULT '',
            delivery_option VARCHAR(50) DEFAULT 'NEXT_DAY_7AM',
            delivery_expected_at DATETIME DEFAULT NULL,
            delivery_cutoff_ist VARCHAR(50) DEFAULT '12:00 Midnight IST',
            gst_amount DECIMAL(10,2) DEFAULT 0.00,
            cgst DECIMAL(10,2) DEFAULT 0.00,
            sgst DECIMAL(10,2) DEFAULT 0.00,
            gst_percent DECIMAL(5,2) DEFAULT 5.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
} catch (Exception $e) {}

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(100) NOT NULL,
            product_id VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) DEFAULT '',
            quantity INT DEFAULT 1,
            price DECIMAL(10,2) DEFAULT 0.00,
            weight VARCHAR(50) DEFAULT '',
            subscriptionType VARCHAR(50) DEFAULT 'none',
            rangeDates TEXT DEFAULT NULL,
            subscribedDates TEXT DEFAULT NULL,
            subsStatus VARCHAR(50) DEFAULT 'active',
            pausedDates TEXT DEFAULT NULL,
            startDate VARCHAR(50) DEFAULT '',
            endDate VARCHAR(50) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
} catch (Exception $e) {}

$alterCols = [
    "ALTER TABLE orders ADD COLUMN order_source VARCHAR(50) DEFAULT 'CLIENT_WEB'",
    "ALTER TABLE orders ADD COLUMN created_by VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE orders ADD COLUMN delivery_inst TEXT",
    "ALTER TABLE orders ADD COLUMN delivery_mode VARCHAR(100) DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN gst_amount DECIMAL(10,2) DEFAULT 0.00",
    "ALTER TABLE orders ADD COLUMN cgst DECIMAL(10,2) DEFAULT 0.00",
    "ALTER TABLE orders ADD COLUMN sgst DECIMAL(10,2) DEFAULT 0.00",
    "ALTER TABLE orders ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00",
    "ALTER TABLE orders ADD COLUMN delivery_option VARCHAR(50) DEFAULT 'NEXT_DAY_7AM'",
    "ALTER TABLE orders ADD COLUMN delivery_expected_at DATETIME DEFAULT NULL",
    "ALTER TABLE orders ADD COLUMN delivery_cutoff_ist VARCHAR(50) DEFAULT '12:00 Midnight IST'",
    "ALTER TABLE orders ADD COLUMN address_json TEXT DEFAULT NULL",
    "ALTER TABLE order_items ADD COLUMN product_name VARCHAR(255) DEFAULT ''",
    "ALTER TABLE order_items ADD COLUMN subscriptionType VARCHAR(50) DEFAULT 'none'",
    "ALTER TABLE order_items ADD COLUMN rangeDates TEXT",
    "ALTER TABLE order_items ADD COLUMN subscribedDates TEXT",
    "ALTER TABLE order_items ADD COLUMN subsStatus VARCHAR(50) DEFAULT 'active'",
    "ALTER TABLE order_items ADD COLUMN pausedDates TEXT",
    "ALTER TABLE order_items ADD COLUMN startDate VARCHAR(50) DEFAULT ''",
    "ALTER TABLE order_items ADD COLUMN endDate VARCHAR(50) DEFAULT ''",
    "ALTER TABLE order_items ADD COLUMN delivery_date DATE DEFAULT NULL"
];
foreach ($alterCols as $sql) {
    try { $pdo->exec($sql); } catch (Exception $e) {}
}

$prodTables = ['products', 'zone1_products_new_1', 'zone2_products_new_1'];
foreach ($prodTables as $pTbl) {
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN in_stock INT DEFAULT 1"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN stock_qty DECIMAL(10,2) DEFAULT 0.00"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 5.00"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN stock_price DECIMAL(10,2) DEFAULT 0.00"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN disabled INT DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN allow_next_day INT DEFAULT 1"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN allow_immediate_10 INT DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN allow_immediate_30 INT DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN allow_immediate_60 INT DEFAULT 0"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE {$pTbl} ADD COLUMN preferred_days VARCHAR(255) DEFAULT '[]'"); } catch (Exception $e) {}
}

/**
 * Fetch weekly off day from store settings
 */
$weeklyOffDay = 'None';
try {
    $stmtSet = $pdo->query("SELECT `value` FROM store_settings WHERE `key` = 'weekly_off_day'");
    if ($stmtSet && $r = $stmtSet->fetch(PDO::FETCH_ASSOC)) {
        $weeklyOffDay = trim($r['value']);
    }
} catch (Exception $e) {}

function adjustDeliveryDateForWeeklyOff($dateStr, $weeklyOffDay) {
    if (!$dateStr || empty($weeklyOffDay) || strtolower($weeklyOffDay) === 'none') {
        return $dateStr;
    }
    $ts = strtotime($dateStr);
    for ($k = 0; $k < 7; $k++) {
        $dayName = strtolower(date('l', $ts));
        $offName = strtolower($weeklyOffDay);
        if ($dayName === $offName || strpos($dayName, $offName) === 0) {
            $ts = strtotime('+1 day', $ts);
        } else {
            break;
        }
    }
    return date('Y-m-d', $ts);
}

/**
 * Calculate the next valid delivery date in Asia/Kolkata IST based on preferred days.
 */
function calculateNextPreferredDeliveryDate($preferredDays, $defaultDeliveryDate, $weeklyOffDay = 'None') {
    $baseDate = adjustDeliveryDateForWeeklyOff($defaultDeliveryDate, $weeklyOffDay);
    if (empty($preferredDays)) {
        return $baseDate;
    }
    
    $daysList = [];
    if (is_array($preferredDays)) {
        $daysList = $preferredDays;
    } elseif (is_string($preferredDays)) {
        $dec = json_decode($preferredDays, true);
        if (is_array($dec)) {
            $daysList = $dec;
        } else {
            $daysList = explode(',', $preferredDays);
        }
    }
    
    $normalized = [];
    foreach ($daysList as $d) {
        $clean = strtolower(trim((string)$d));
        if ($clean) {
            $normalized[] = $clean;
        }
    }
    
    if (empty($normalized)) {
        return $baseDate;
    }
    
    // Check next 7 days starting from baseDate
    $startTs = strtotime($baseDate);
    for ($i = 0; $i < 7; $i++) {
        $checkTs = strtotime("+{$i} days", $startTs);
        $dayFull = strtolower(date('l', $checkTs));
        $dayShort = strtolower(date('D', $checkTs));
        $offName = strtolower($weeklyOffDay);
        if (!empty($weeklyOffDay) && $offName !== 'none' && ($dayFull === $offName || $dayShort === $offName || strpos($dayFull, $offName) === 0)) {
            continue; // skip weekly off day
        }
        foreach ($normalized as $pref) {
            if ($pref === $dayFull || $pref === $dayShort || strpos($dayFull, $pref) === 0) {
                return date('Y-m-d', $checkTs);
            }
        }
    }
    
    return $baseDate;
}

if ($delivery_option === 'NEXT_DAY_7AM') {
    $delivery_date = adjustDeliveryDateForWeeklyOff($delivery_date, $weeklyOffDay);
    $delivery_expected_at = $delivery_date . ' 07:00:00';
}

// 2. Calculate total order amount for balance verification
$finalTotal = $total_amount;
if ($finalTotal <= 0 && !empty($items) && is_array($items)) {
    $calcTotal = 0;
    foreach ($items as $item) {
        $qty = isset($item['qty']) ? (int)$item['qty'] : (isset($item['quantity']) ? (int)$item['quantity'] : (isset($item['units']) ? (int)$item['units'] : 1));
        $price = isset($item['price']) ? round((float)$item['price']) : 0;
        $rangeDates = isset($item['rangeDates']) ? (is_string($item['rangeDates']) ? $item['rangeDates'] : json_encode($item['rangeDates'])) : '[]';
        $subsDates = isset($item['subscribedDates']) ? (is_string($item['subscribedDates']) ? $item['subscribedDates'] : json_encode($item['subscribedDates'])) : '[]';
        $daysCount = 1;
        if ($rangeDates && $rangeDates !== '[]') {
            $r = json_decode($rangeDates, true);
            if (is_array($r) && count($r) > 0) $daysCount = count($r);
        } elseif ($subsDates && $subsDates !== '[]') {
            $s = json_decode($subsDates, true);
            if (is_array($s) && count($s) > 0) $daysCount = count($s);
        }
        if (isset($item['unit_price']) && (float)$item['unit_price'] > 0 && $price == round((float)$item['unit_price'])) {
            $price = round((float)$item['unit_price'] * $qty * $daysCount);
        }
        $calcTotal += $price;
    }
    if ($calcTotal > 0) {
        $finalTotal = round($calcTotal);
    }
}
$finalTotal = round($finalTotal);

// 3. Stock Availability Verification (Bypassed for offline / direct admin counter sales)
if (!empty($items) && is_array($items) && !$isOffline) {
    $stockErrors = [];
    $outOfStockItems = [];

    foreach ($items as $item) {
        $prod_id = isset($item['id']) ? $item['id'] : (isset($item['product_id']) ? $item['product_id'] : '');
        $prod_name = isset($item['name']) ? $item['name'] : (isset($item['product_name']) ? $item['product_name'] : '');
        $qty = isset($item['qty']) ? (int)$item['qty'] : (isset($item['quantity']) ? (int)$item['quantity'] : (isset($item['units']) ? (int)$item['units'] : 1));
        
        $rangeDates = isset($item['rangeDates']) ? (is_string($item['rangeDates']) ? $item['rangeDates'] : json_encode($item['rangeDates'])) : '[]';
        $subsDates = isset($item['subscribedDates']) ? (is_string($item['subscribedDates']) ? $item['subscribedDates'] : json_encode($item['subscribedDates'])) : '[]';
        $daysCount = 1;
        if ($rangeDates && $rangeDates !== '[]') {
            $r = json_decode($rangeDates, true);
            if (is_array($r) && count($r) > 0) $daysCount = count($r);
        } elseif ($subsDates && $subsDates !== '[]') {
            $s = json_decode($subsDates, true);
            if (is_array($s) && count($s) > 0) $daysCount = count($s);
        }
        $requiredQty = $qty * $daysCount;

        if ($prod_id || $prod_name) {
            $prodRow = null;
            foreach ($prodTables as $pTbl) {
                try {
                    $stmtProd = $pdo->prepare("SELECT id, name, unit_name, in_stock, stock_qty, is_unlimited, disabled, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM {$pTbl} WHERE id = ? OR name = ? LIMIT 1");
                    $stmtProd->execute([$prod_id, $prod_name]);
                    $r = $stmtProd->fetch(PDO::FETCH_ASSOC);
                    if ($r) {
                        $prodRow = $r;
                        break;
                    }
                } catch (Exception $e) {}
            }

            $isProdUnlimited = (isset($prodRow['is_unlimited']) && ((int)$prodRow['is_unlimited'] === 1 || $prodRow['is_unlimited'] === true));

            if (!$prodRow || (isset($prodRow['disabled']) && (int)$prodRow['disabled'] === 1)) {
                $displayName = $prodRow['name'] ?? ($prod_name ?: 'Selected item');
                $stockErrors[] = "Product '{$displayName}' is currently unavailable.";
                $outOfStockItems[] = ['product_id' => $prod_id, 'product_name' => $displayName, 'reason' => 'disabled'];
            } elseif (!$isProdUnlimited && isset($prodRow['in_stock']) && (int)$prodRow['in_stock'] === 0) {
                $displayName = $prodRow['name'] ?? ($prod_name ?: 'Selected item');
                $stockErrors[] = "'{$displayName}' is currently out of stock.";
                $outOfStockItems[] = ['product_id' => $prod_id, 'product_name' => $displayName, 'reason' => 'out_of_stock', 'available_stock' => 0];
            } elseif (!$isProdUnlimited && isset($prodRow['stock_qty']) && floatval($prodRow['stock_qty']) > 0 && $requiredQty > floatval($prodRow['stock_qty'])) {
                $displayName = $prodRow['name'] ?? ($prod_name ?: 'Selected item');
                $avail = floatval($prodRow['stock_qty']);
                $unit = $prodRow['unit_name'] ?: 'units';
                $stockErrors[] = "Insufficient stock for '{$displayName}'. Only {$avail} {$unit} available, but {$requiredQty} {$unit} requested.";
                $outOfStockItems[] = [
                    'product_id' => $prod_id,
                    'product_name' => $displayName,
                    'reason' => 'insufficient_stock',
                    'available_stock' => $avail,
                    'requested_qty' => $requiredQty
                ];
            } elseif ($delivery_option === 'IMMEDIATE_10' && ((int)($prodRow['allow_immediate_10'] ?? 0) !== 1)) {
                $displayName = $prodRow['name'] ?? ($prod_name ?: 'Selected item');
                $stockErrors[] = "'{$displayName}' does not support 10-minute immediate delivery.";
            } elseif ($delivery_option === 'IMMEDIATE_30' && ((int)($prodRow['allow_immediate_30'] ?? 0) !== 1 && (int)($prodRow['allow_immediate_10'] ?? 0) !== 1)) {
                $displayName = $prodRow['name'] ?? ($prod_name ?: 'Selected item');
                $stockErrors[] = "'{$displayName}' does not support immediate delivery within 30 minutes.";
            } elseif ($delivery_option === 'IMMEDIATE_60' && ((int)($prodRow['allow_immediate_60'] ?? 0) !== 1 && (int)($prodRow['allow_immediate_30'] ?? 0) !== 1 && (int)($prodRow['allow_immediate_10'] ?? 0) !== 1)) {
                $displayName = $prodRow['name'] ?? ($prod_name ?: 'Selected item');
                $stockErrors[] = "'{$displayName}' does not support immediate delivery within 60 minutes.";
            }
        }
    }

    if (!empty($stockErrors)) {
        sendJson([
            'error' => implode("\n", $stockErrors),
            'code' => 'INSUFFICIENT_STOCK',
            'stock_errors' => $stockErrors,
            'out_of_stock_items' => $outOfStockItems
        ], 400);
        exit;
    }
}

// 4. Verify available wallet balance (only required for Prepaid / Wallet payment, bypass for COD and Offline/Admin orders)
if ($mobile && $payment_type !== 'COD' && !$isOffline) {
    $stmtBal = $pdo->prepare("SELECT amount, type, status FROM wallets WHERE mobile = ?");
    $stmtBal->execute([$mobile]);
    $walletRows = $stmtBal->fetchAll();

    $availableWalletBalance = 0;
    foreach ($walletRows as $wRow) {
        $wAmt = round((float)$wRow['amount']);
        $wType = strtoupper($wRow['type']);
        $wStatus = strtolower($wRow['status'] ?: 'authorized');

        if ($wStatus === 'authorized' || $wStatus === 'captured' || $wStatus === 'placed' || $wStatus === 'success') {
            if ($wType === 'DEBIT') {
                $availableWalletBalance -= $wAmt;
            } else {
                $availableWalletBalance += $wAmt;
            }
        }
    }
    $availableWalletBalance = round($availableWalletBalance);

    if ($availableWalletBalance < $finalTotal) {
        sendJson([
            'error' => 'Insufficient wallet balance. Available: ₹' . number_format($availableWalletBalance, 0) . ', Required: ₹' . number_format($finalTotal, 0),
            'code' => 'INSUFFICIENT_WALLET_BALANCE',
            'available_balance' => $availableWalletBalance,
            'required_amount' => $finalTotal
        ], 400);
        exit;
    }
}

try {
    $pdo->beginTransaction();

    // If address is empty or not provided, fallback to default address in user_addresses or in-store counter address
    if (empty($address_json) || $address_json === '{}' || $address_json === 'null' || $address_json === '""' || $address_json === '[]') {
        try {
            $addrStmt = $pdo->prepare("SELECT * FROM user_addresses WHERE mobile = ? ORDER BY is_default DESC, id DESC LIMIT 1");
            $addrStmt->execute([$mobile]);
            $defaultAddr = $addrStmt->fetch(PDO::FETCH_ASSOC);
            if ($defaultAddr) {
                $address_json = json_encode($defaultAddr);
            } else {
                $address_json = json_encode([
                    'name' => 'Store Customer',
                    'mobile' => $mobile,
                    'address' => $isOffline ? 'Store Counter / In-Store Direct Sale' : 'Store Pickup',
                    'pincode' => '600095'
                ]);
            }
        } catch (Exception $addrEx) {}
    }

    $delivery_inst = isset($details['delivery_inst']) ? $details['delivery_inst'] : (isset($details['instructions']) ? $details['instructions'] : '');
    $delivery_mode = isset($details['delivery_mode']) ? (string)$details['delivery_mode'] : '0';

    // Check if order exists and is in CART status
    $stmtCheck = $pdo->prepare("SELECT order_id, status FROM orders WHERE order_id = ?");
    $stmtCheck->execute([$order_id]);
    $existing = $stmtCheck->fetch();

    $total_amount = round($total_amount);
    $gst_amount = isset($details['gst_amount']) ? (float)$details['gst_amount'] : 0.0;
    $cgst = isset($details['cgst']) ? (float)$details['cgst'] : 0.0;
    $sgst = isset($details['sgst']) ? (float)$details['sgst'] : 0.0;
    $gst_percent = isset($details['gst_percent']) ? (float)$details['gst_percent'] : 5.0;

    // Resolve delivery date per item based on preferred_days and IST forward scheduling
    $deliveryGroups = [];
    if (!empty($items) && is_array($items)) {
        foreach ($items as &$it) {
            $pId = isset($it['id']) ? $it['id'] : (isset($it['product_id']) ? $it['product_id'] : '');
            $itemDate = isset($it['delivery_date']) && !empty($it['delivery_date']) ? $it['delivery_date'] : (isset($it['scheduled_delivery_date']) ? $it['scheduled_delivery_date'] : null);
            if (!$itemDate) {
                $prefDays = isset($it['preferred_days']) ? $it['preferred_days'] : null;
                if ($prefDays === null && $pId) {
                    foreach ($prodTables as $pTbl) {
                        try {
                            $stP = $pdo->prepare("SELECT preferred_days FROM {$pTbl} WHERE id = ? LIMIT 1");
                            $stP->execute([$pId]);
                            $rowP = $stP->fetch(PDO::FETCH_ASSOC);
                            if ($rowP && isset($rowP['preferred_days'])) {
                                $prefDays = $rowP['preferred_days'];
                                break;
                            }
                        } catch (Exception $eP) {}
                    }
                }
                $itemDate = calculateNextPreferredDeliveryDate($prefDays, $delivery_date);
            }
            $it['delivery_date'] = $itemDate;
            if (!isset($deliveryGroups[$itemDate])) {
                $deliveryGroups[$itemDate] = [];
            }
            $deliveryGroups[$itemDate][] = $it;
        }
        unset($it);
    }

    if (empty($deliveryGroups)) {
        $deliveryGroups[$delivery_date] = $items;
    }

    $allGroupDates = array_keys($deliveryGroups);
    $primaryDeliveryDate = $allGroupDates[0];
    $createdOrderIds = [];

    $groupIndex = 0;
    foreach ($deliveryGroups as $grpDate => $grpItems) {
        $currOrderId = ($groupIndex === 0) ? $order_id : ($order_id . '_' . ($groupIndex + 1));
        $createdOrderIds[] = $currOrderId;
        
        // Calculate group total
        $grpTotal = 0;
        foreach ($grpItems as $gIt) {
            $gQty = isset($gIt['qty']) ? (int)$gIt['qty'] : (isset($gIt['quantity']) ? (int)$gIt['quantity'] : (isset($gIt['units']) ? (int)$gIt['units'] : 1));
            $gPrice = isset($gIt['price']) ? round((float)$gIt['price']) : 0;
            if (isset($gIt['unit_price']) && (float)$gIt['unit_price'] > 0 && $gPrice == round((float)$gIt['unit_price'])) {
                $gPrice = round((float)$gIt['unit_price'] * $gQty);
            }
            $grpTotal += $gPrice;
        }
        $grpTotal = round($grpTotal);
        if ($groupIndex === 0 && count($deliveryGroups) === 1 && $total_amount > 0) {
            $grpTotal = $total_amount;
        }

        $grpExpectedAt = $grpDate . ' 07:00:00';
        if ($delivery_option !== 'NEXT_DAY_7AM') {
            $grpExpectedAt = $delivery_expected_at ?: ($grpDate . ' 07:00:00');
        }

        if ($groupIndex === 0 && $existing && $existing['status'] === 'CART') {
            $stmtUpd = $pdo->prepare("
                UPDATE orders 
                SET mobile = ?, address_json = ?, total_amount = ?, payment_type = ?, 
                    order_source = ?, created_by = ?,
                    status = 'PLACED', delivery_date = ?, delivery_inst = ?, delivery_mode = ?, 
                    delivery_option = ?, delivery_expected_at = ?, delivery_cutoff_ist = ?,
                    gst_amount = ?, cgst = ?, sgst = ?, gst_percent = ? 
                WHERE order_id = ?
            ");
            $stmtUpd->execute([
                $mobile, $address_json, $grpTotal, $payment_type, 
                $order_source, $created_by,
                $grpDate, $delivery_inst, $delivery_mode, 
                $delivery_option, $grpExpectedAt, $delivery_cutoff_ist,
                $gst_amount, $cgst, $sgst, $gst_percent, $currOrderId
            ]);
        } else {
            $stmtIns = $pdo->prepare("
                INSERT INTO orders 
                (order_id, mobile, address_json, total_amount, payment_type, order_source, created_by, status, delivery_date, delivery_inst, delivery_mode, delivery_option, delivery_expected_at, delivery_cutoff_ist, gst_amount, cgst, sgst, gst_percent) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PLACED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtIns->execute([
                $currOrderId, $mobile, $address_json, $grpTotal, $payment_type, 
                $order_source, $created_by,
                $grpDate, $delivery_inst, $delivery_mode, 
                $delivery_option, $grpExpectedAt, $delivery_cutoff_ist,
                $gst_amount, $cgst, $sgst, $gst_percent
            ]);
        }

        // Insert items for this order/shipment
        $delItems = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
        $delItems->execute([$currOrderId]);

        $stmtItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, price, weight, subscriptionType, rangeDates, subscribedDates, subsStatus, startDate, endDate, delivery_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($grpItems as $item) {
            $prod_id = isset($item['id']) ? $item['id'] : (isset($item['product_id']) ? $item['product_id'] : '');
            $prod_name = isset($item['name']) ? $item['name'] : (isset($item['product_name']) ? $item['product_name'] : '');
            $qty = isset($item['qty']) ? (int)$item['qty'] : (isset($item['quantity']) ? (int)$item['quantity'] : (isset($item['units']) ? (int)$item['units'] : 1));
            $weight = isset($item['weight']) ? $item['weight'] : '';
            $subType = isset($item['subscriptionType']) ? $item['subscriptionType'] : 'none';
            $rangeDates = isset($item['rangeDates']) ? (is_string($item['rangeDates']) ? $item['rangeDates'] : json_encode($item['rangeDates'])) : '[]';
            $subsDates = isset($item['subscribedDates']) ? (is_string($item['subscribedDates']) ? $item['subscribedDates'] : json_encode($item['subscribedDates'])) : '[]';
            $subsStatus = isset($item['subsStatus']) ? $item['subsStatus'] : 'active';
            $startDate = isset($item['startDate']) ? $item['startDate'] : '';
            $endDate = isset($item['endDate']) ? $item['endDate'] : '';
            $iDeliveryDate = isset($item['delivery_date']) ? $item['delivery_date'] : $grpDate;

            $daysCount = 1;
            if ($rangeDates && $rangeDates !== '[]') {
                $r = json_decode($rangeDates, true);
                if (is_array($r) && count($r) > 0) $daysCount = count($r);
            } elseif ($subsDates && $subsDates !== '[]') {
                $s = json_decode($subsDates, true);
                if (is_array($s) && count($s) > 0) $daysCount = count($s);
            }

            $price = isset($item['price']) ? round((float)$item['price']) : 0;
            if (isset($item['unit_price']) && (float)$item['unit_price'] > 0 && $price == round((float)$item['unit_price'])) {
                $price = round((float)$item['unit_price'] * $qty * $daysCount);
            }
            $price = round($price);

            if ($prod_id) {
                $stmtItem->execute([$currOrderId, $prod_id, $prod_name, $qty, $price, $weight, $subType, $rangeDates, $subsDates, $subsStatus, $startDate, $endDate, $iDeliveryDate]);

                // Deduct ordered quantity from product inventory stock across all product tables
                $deductQty = $qty * $daysCount;
                
                $foundStocks = [];
                $isItemUnlimited = false;
                foreach ($prodTables as $pTbl) {
                    try {
                        $stmtChk = $pdo->prepare("SELECT stock_qty, is_unlimited FROM {$pTbl} WHERE id = ? OR name = ?");
                        $stmtChk->execute([$prod_id, $prod_name]);
                        $row = $stmtChk->fetch(PDO::FETCH_ASSOC);
                        if ($row) {
                            if (isset($row['is_unlimited']) && ((int)$row['is_unlimited'] === 1 || $row['is_unlimited'] === true)) {
                                $isItemUnlimited = true;
                            }
                            if (isset($row['stock_qty'])) {
                                $foundStocks[] = floatval($row['stock_qty']);
                            }
                        }
                    } catch (Exception $e) {}
                }
                
                if (!$isItemUnlimited) {
                    $effectiveStock = !empty($foundStocks) ? min($foundStocks) : 0;
                    $newStock = max(0.0, $effectiveStock - $deductQty);
                    $newInStock = ($newStock > 0) ? 1 : 0;

                    foreach ($prodTables as $pTbl) {
                        try {
                            $stockUpd = $pdo->prepare("
                                UPDATE {$pTbl} 
                                SET stock_qty = ?,
                                    in_stock = ?
                                WHERE id = ? OR name = ?
                            ");
                            $stockUpd->execute([$newStock, $newInStock, $prod_id, $prod_name]);
                        } catch (Exception $stEx) {}
                    }
                }
            }
        }

        $groupIndex++;
    }

    $walletId = null;
    // Insert wallet debit transaction only for non-COD and non-Offline orders
    if ($mobile && $total_amount > 0 && $payment_type !== 'COD' && !$isOffline) {
        $walletStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'DEBIT', ?, 'placed')");
        $walletStmt->execute([
            $mobile,
            round($total_amount),
            "Order #{$order_id} placed"
        ]);
        $walletId = $pdo->lastInsertId();
    }

    if ($pdo->inTransaction()) {
        $pdo->commit();
    }

    // Query updated stock levels for ordered items to return to client
    $updatedStocks = [];
    if (!empty($items) && is_array($items)) {
        foreach ($items as $item) {
            $pId = isset($item['id']) ? $item['id'] : (isset($item['product_id']) ? $item['product_id'] : '');
            if ($pId) {
                try {
                    $stCheck = $pdo->prepare("SELECT id, stock_qty, in_stock FROM products WHERE id = ?");
                    $stCheck->execute([$pId]);
                    $stRow = $stCheck->fetch(PDO::FETCH_ASSOC);
                    if ($stRow) {
                        $updatedStocks[$pId] = [
                            'stock_qty' => floatval($stRow['stock_qty']),
                            'in_stock' => ((int)$stRow['in_stock'] === 1 && floatval($stRow['stock_qty']) > 0)
                        ];
                    }
                } catch (Exception $e) {}
            }
        }
    }

    // Calculate current wallet balance
    $currentWalletBal = 0;
    if ($mobile) {
        $stmtBal = $pdo->prepare("SELECT amount, type, status FROM wallets WHERE mobile = ?");
        $stmtBal->execute([$mobile]);
        $walletRows = $stmtBal->fetchAll();
        foreach ($walletRows as $wRow) {
            $wAmt = round((float)$wRow['amount']);
            $wType = strtoupper($wRow['type']);
            $wStatus = strtolower($wRow['status'] ?: 'authorized');
            if ($wStatus === 'authorized' || $wStatus === 'captured' || $wStatus === 'placed' || $wStatus === 'success') {
                if ($wType === 'DEBIT') $currentWalletBal -= $wAmt;
                else $currentWalletBal += $wAmt;
            }
        }
        $currentWalletBal = max(0, round($currentWalletBal));
    }

    sendJson([
        'status' => 'SUCCESS',
        'order_id' => $order_id,
        'amount' => round($total_amount),
        'total' => $currentWalletBal,
        'payment_type' => $payment_type,
        'order_source' => $order_source,
        'created_by' => $created_by,
        'type' => $isOffline ? 'OFFLINE' : (($payment_type === 'COD') ? 'COD' : 'Debit'),
        'description' => "Order #{$order_id} placed (" . ($isOffline ? 'Admin/Offline' : ($payment_type === 'COD' ? 'COD' : 'Prepaid')) . ")",
        'created_at' => date('Y-m-d H:i:s'),
        'timestamp' => time() * 1000,
        'trxn_id' => 'TXN_' . ($walletId ?: rand(100, 999)),
        'updated_stocks' => $updatedStocks
    ]);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(['error' => $e->getMessage()], 500);
}
