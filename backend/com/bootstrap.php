<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([
        'server_time' => date('Y-m-d H:i:s'),
        'server_time_iso' => date('c'),
        'server_epoch_ms' => round(microtime(true) * 1000),
        'store_settings' => [
            'weekly_off_day' => 'None',
            'enable_razorpay' => '1',
            'enable_cod' => '1'
        ],
        'categories' => [],
        'zone' => 'zone1',
        'cart' => []
    ]);
}

try {
    $pincode = trim(getParam('pincode', ''));
    $customerID = trim(getParam('customerID', '') ?: getParam('userID', ''));

    // 1. Server time
    $serverTime = date('Y-m-d H:i:s');

    // 2. Store settings
    $settings = [
        'weekly_off_day' => 'None',
        'enable_razorpay' => '1',
        'enable_cod' => '1'
    ];
    try {
        $stmtSettings = $pdo->query("SELECT `key`, `value` FROM `store_settings`");
        while ($row = $stmtSettings->fetch(PDO::FETCH_ASSOC)) {
            $settings[$row['key']] = $row['value'];
        }
    } catch (Exception $eS) {}

    // 3. Categories (5 curated categories with icons)
    $categories = [];
    $categoryIcons = [
        'Vegetables' => 'assets/categories/Thinkspot_veggiesIcon.png',
        'Fruits' => 'assets/categories/fruitsIcons.png',
        'Greens' => 'assets/categories/Thinkspot_greensIcon.png',
        'Flowers' => 'assets/categories/Thinkspot_flowers.png',
        'Oils' => 'assets/categories/oil.png'
    ];

    try {
        $stmtCats = $pdo->query("SELECT id, key_name, label, img_url FROM `categories` WHERE disabled = 0 ORDER BY sort_order ASC, id ASC");
        $rows = $stmtCats->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $k = $r['key_name'];
            $icon = isset($categoryIcons[$k]) ? $categoryIcons[$k] : ($r['img_url'] ?: 'assets/categories/Thinkspot_veggiesIcon.png');
            $categories[] = [
                'id' => $r['id'],
                'name' => $r['label'],
                'cat' => $r['key_name'],
                'imgUrl' => $icon,
                'routerLink' => '/products/category/' . urlencode($r['key_name'])
            ];
        }
    } catch (Exception $eC) {}

    // 4. Zone determination
    $zone = 'zone1';
    $pincodeInfo = null;
    if (!empty($pincode)) {
        try {
            $stmtZone = $pdo->prepare("SELECT pincode, zone, area_name FROM `serviceable_pincodes` WHERE pincode = ? AND is_active = 1 LIMIT 1");
            $stmtZone->execute([$pincode]);
            $rowZ = $stmtZone->fetch(PDO::FETCH_ASSOC);
            if ($rowZ) {
                $zone = $rowZ['zone'] ?: 'zone1';
                $pincodeInfo = [
                    'pincode' => $rowZ['pincode'],
                    'zone' => $zone,
                    'serviceable' => true,
                    'area_name' => $rowZ['area_name']
                ];
            }
        } catch (Exception $eZ) {}
    }

    // 5. Active Cart Items & Order ID
    $cart = [];
    $activeOrderID = null;
    if (!empty($customerID)) {
        try {
            $stmtCart = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS id, oi.product_id AS productID, COALESCE(NULLIF(oi.product_name, ''), p.name, 'Product Item') AS name, COALESCE(p.img_url, 'assets/categories/Thinkspot_veggiesIcon.png') AS img_url, COALESCE(p.unit_name, '') AS unit_name, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi JOIN orders o ON oi.order_id = o.order_id LEFT JOIN products p ON oi.product_id = p.id WHERE o.mobile = ? AND o.status = 'CART'");
            $stmtCart->execute([$customerID]);
            $cart = $stmtCart->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (!empty($cart)) {
                $activeOrderID = $cart[0]['orderID'];
            }
        } catch (Exception $eCart) {
            try {
                $stmtCart = $pdo->prepare("SELECT oi.order_id AS orderID, oi.product_id AS id, oi.product_id AS productID, COALESCE(p.name, 'Product Item') AS name, COALESCE(p.img_url, 'assets/categories/Thinkspot_veggiesIcon.png') AS img_url, COALESCE(p.unit_name, '') AS unit_name, oi.quantity, oi.price, oi.weight, oi.rangeDates, oi.subscribedDates, oi.subscriptionType, oi.subsStatus, oi.pausedDates, 'CART' AS status FROM order_items oi JOIN orders o ON oi.order_id = o.order_id LEFT JOIN products p ON oi.product_id = p.id WHERE o.mobile = ? AND o.status = 'CART'");
                $stmtCart->execute([$customerID]);
                $cart = $stmtCart->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (!empty($cart)) {
                    $activeOrderID = $cart[0]['orderID'];
                }
            } catch (Exception $eCart2) {}
        }
    }

    $response = [
        'server_time' => $serverTime,
        'server_time_iso' => date('c'),
        'server_epoch_ms' => round(microtime(true) * 1000),
        'store_settings' => $settings,
        'categories' => $categories,
        'zone' => $zone,
        'pincode_info' => $pincodeInfo,
        'cart' => $cart,
        'active_order_id' => $activeOrderID
    ];

    // If guest user without cart, allow browser caching for 60s
    $cacheTtl = empty($customerID) ? 60 : 0;
    sendJson($response, 200, $cacheTtl);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
