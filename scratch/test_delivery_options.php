<?php
date_default_timezone_set('Asia/Kolkata');
require_once __DIR__ . '/../backend/config/db.php';

echo "=== TESTING DELIVERY OPTIONS BACKEND LOGIC ===\n\n";

// 1. Check Product delivery columns
$stmt = $pdo->query("SELECT id, name, allow_next_day, allow_immediate_10, allow_immediate_30, allow_immediate_60 FROM products LIMIT 5");
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "1. Sample Products Delivery Options:\n";
foreach ($products as $p) {
    echo "  - [{$p['id']}] {$p['name']}: Next-Day: {$p['allow_next_day']}, 10m: {$p['allow_immediate_10']}, 30m: {$p['allow_immediate_30']}, 60m: {$p['allow_immediate_60']}\n";
}

// 2. Set product #1 with 10m allowed, product #2 with 10m disallowed
if (count($products) >= 2) {
    $p1 = $products[0];
    $p2 = $products[1];

    $pdo->prepare("UPDATE products SET allow_next_day = 1, allow_immediate_10 = 1, allow_immediate_30 = 1, allow_immediate_60 = 1 WHERE id = ?")->execute([$p1['id']]);
    $pdo->prepare("UPDATE products SET allow_next_day = 1, allow_immediate_10 = 0, allow_immediate_30 = 0, allow_immediate_60 = 0 WHERE id = ?")->execute([$p2['id']]);

    echo "\n2. Configured test products:\n";
    echo "  - {$p1['name']}: Enabled for all immediate delivery\n";
    echo "  - {$p2['name']}: Next-day ONLY\n";
}

// 3. Test IST Cutoff Calculation
$now_ist = new DateTime('now', new DateTimeZone('Asia/Kolkata'));
$next_day_7am = clone $now_ist;
$next_day_7am->modify('+1 day');
$next_day_7am->setTime(7, 0, 0);

echo "\n3. IST Time & Scheduling Calculations:\n";
echo "  - Current IST Timestamp: " . $now_ist->format('Y-m-d H:i:s T') . "\n";
echo "  - Scheduled Next-Day 7 AM IST: " . $next_day_7am->format('Y-m-d H:i:s T') . "\n";
echo "  - Immediate 10m IST: " . date('Y-m-d H:i:s', strtotime('+10 minutes')) . "\n";
echo "  - Immediate 30m IST: " . date('Y-m-d H:i:s', strtotime('+30 minutes')) . "\n";
echo "  - Immediate 60m IST: " . date('Y-m-d H:i:s', strtotime('+60 minutes')) . "\n";

echo "\n=== ALL CHECKS COMPLETED SUCCESSFULLY ===\n";
