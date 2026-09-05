<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('id') ?: getParam('mobile');

if (!$mobile || !$pdo) {
    sendJson([]);
}

try {
    try {
        $pdo->exec("ALTER TABLE wallets ADD COLUMN status VARCHAR(20) DEFAULT 'authorized'");
    } catch (Exception $e) {}

    // Calculate ledger balance from active non-paused subscriptions
    $ledgerBalance = 0;
    try {
        $stmtSubs = $pdo->prepare("
            SELECT oi.* FROM order_items oi 
            JOIN orders o ON oi.order_id = o.order_id 
            WHERE o.mobile = ? AND oi.subscriptionType IN ('range', 'multi_day') AND oi.subsStatus IN ('active', 'resume')
        ");
        $stmtSubs->execute([$mobile]);
        $subItems = $stmtSubs->fetchAll();

        $todayStr = date('Y-m-d');
        foreach ($subItems as $subItem) {
            $price = (float)$subItem['price'];
            $datesJson = ($subItem['subscriptionType'] === 'range') ? $subItem['rangeDates'] : $subItem['subscribedDates'];
            $dates = json_decode($datesJson, true);
            if (is_array($dates)) {
                foreach ($dates as $d) {
                    $dStr = is_array($d) ? (isset($d['date']) ? $d['date'] : '') : (string)$d;
                    $dStatus = is_array($d) ? (isset($d['status']) ? $d['status'] : '') : '';
                    $dCount = is_array($d) ? (isset($d['count']) ? (int)$d['count'] : (int)$subItem['quantity']) : (int)$subItem['quantity'];

                    if ($dStatus !== 'delivered' && $dStatus !== 'cancelled') {
                        if (!$dStr || strtotime($dStr) >= strtotime($todayStr)) {
                            $ledgerBalance += ($dCount * $price);
                        }
                    }
                }
            }
        }
    } catch (Exception $ex) {
        $ledgerBalance = 0;
    }

    $stmt = $pdo->prepare("SELECT id, mobile, amount, type, description, status, created_at FROM wallets WHERE mobile = ? ORDER BY id ASC");
    $stmt->execute([$mobile]);
    $rows = $stmt->fetchAll();

    $runningTotal = 0;
    $walletList = [];

    foreach ($rows as $row) {
        $amt = (float)$row['amount'];
        $type = (strtoupper($row['type']) === 'DEBIT') ? 'Debit' : 'Credit';
        $status = strtolower($row['status'] ?: 'authorized');

        // Only valid transactions update running total
        if ($status === 'authorized' || $status === 'captured' || $status === 'placed' || $status === 'success') {
            if ($type === 'Credit') {
                $runningTotal += $amt;
            } else {
                $runningTotal -= $amt;
            }
        }

        $walletList[] = [
            'id' => (string)$row['id'],
            'mobile' => (string)$row['mobile'],
            'type' => $type,
            'amount' => $amt,
            'total' => $runningTotal,
            'ledger_balance' => $ledgerBalance,
            'timestamp' => strtotime($row['created_at']) * 1000,
            'created_at' => $row['created_at'],
            'description' => $row['description'] ?: 'Wallet Transaction',
            'trxn_id' => 'TXN_' . $row['id'],
            'status' => $status
        ];
    }

    sendJson($walletList);
} catch (Exception $e) {
    sendJson([]);
}



