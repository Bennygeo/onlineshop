<?php
require_once __DIR__ . '/../config/db.php';

$date = getParam('date');
if (!$date) {
    $date = date('Y-m-d', strtotime('+1 day'));
}

$defaultSlots = [
    'SLOT_0800_0830' => 0,
    'SLOT_0830_0900' => 0,
    'SLOT_0900_0930' => 0,
    'SLOT_0930_1000' => 0,
    'SLOT_1000_1030' => 0,
    'SLOT_1030_1100' => 0,
    'SLOT_ANYTIME'   => 0
];

$slotCounts = $defaultSlots;

if ($pdo) {
    try {
        $stmt = $pdo->prepare("
            SELECT delivery_slot, COUNT(*) as cnt 
            FROM orders 
            WHERE delivery_date = ? 
              AND status NOT IN ('CANCELLED', 'cancelled')
              AND delivery_slot IS NOT NULL 
              AND delivery_slot != ''
            GROUP BY delivery_slot
        ");
        $stmt->execute([$date]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if ($rows) {
            foreach ($rows as $row) {
                $slot = $row['delivery_slot'];
                $cnt = (int)$row['cnt'];
                $slotCounts[$slot] = $cnt;
            }
        }
    } catch (Exception $e) {
        // Return defaults if column/table query fails
    }
}

sendJson([
    'status' => 'success',
    'date' => $date,
    'slot_counts' => $slotCounts
], 200, 30);

