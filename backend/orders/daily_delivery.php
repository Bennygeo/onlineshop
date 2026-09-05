<?php
require_once __DIR__ . '/../config/db.php';

$dateParam = getParam('date') ?: date('Y-m-d');

if (!$pdo) {
    sendJson(['status' => 'FAILED']);
}

try {
    $stmtSubs = $pdo->prepare("
        SELECT oi.*, o.mobile FROM order_items oi 
        JOIN orders o ON oi.order_id = o.order_id 
        WHERE oi.subscriptionType IN ('range', 'multi_day') 
          AND oi.subsStatus IN ('active', 'resume')
    ");
    $stmtSubs->execute();
    $items = $stmtSubs->fetchAll();

    $deliveredCount = 0;
    foreach ($items as $item) {
        $datesJson = ($item['subscriptionType'] === 'range') ? $item['rangeDates'] : $item['subscribedDates'];
        $dates = json_decode($datesJson, true);
        if (!is_array($dates)) continue;

        $updated = false;
        foreach ($dates as &$d) {
            if (is_array($d) && isset($d['date'])) {
                if (date('Y-m-d', strtotime($d['date'])) === date('Y-m-d', strtotime($dateParam))) {
                    if (isset($d['status']) && $d['status'] !== 'delivered') {
                        $d['status'] = 'delivered';
                        $updated = true;
                        $deliveredCount++;
                    }
                }
            }
        }

        if ($updated) {
            $newJson = json_encode($dates);
            if ($item['subscriptionType'] === 'range') {
                $updStmt = $pdo->prepare("UPDATE order_items SET rangeDates = ? WHERE id = ?");
            } else {
                $updStmt = $pdo->prepare("UPDATE order_items SET subscribedDates = ? WHERE id = ?");
            }
            $updStmt->execute([$newJson, $item['id']]);
        }
    }

    sendJson([
        'status' => 'SUCCESS',
        'processed_date' => $dateParam,
        'deliveries_processed' => $deliveredCount
    ]);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
