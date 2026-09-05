<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('id') ?: getParam('mobile');

if (!$mobile) {
    sendJson([]);
}

if (!$pdo) {
    sendJson([]);
}

try {
    // Fetch all transactions for mobile to compute running total
    $stmt = $pdo->prepare("SELECT id, mobile, amount, type, description, created_at FROM wallets WHERE mobile = ? ORDER BY id ASC");
    $stmt->execute([$mobile]);
    $rows = $stmt->fetchAll();

    if (empty($rows)) {
        sendJson([]);
        exit;
    }

    $runningTotal = 0;
    $lastTxObj = null;

    foreach ($rows as $row) {
        $amt = (float)$row['amount'];
        $type = (strtoupper($row['type']) === 'DEBIT') ? 'Debit' : 'Credit';

        if ($type === 'Credit') {
            $runningTotal += $amt;
        } else {
            $runningTotal -= $amt;
        }

        $lastTxObj = [
            'id' => (string)$row['id'],
            'mobile' => (string)$row['mobile'],
            'type' => $type,
            'amount' => $amt,
            'total' => $runningTotal,
            'timestamp' => strtotime($row['created_at']) * 1000,
            'description' => $row['description'] ?: 'Wallet Transaction',
            'trxn_id' => 'TXN_' . $row['id'],
            'status' => 'authorized'
        ];
    }

    // Return as array res where res[0] is the latest transaction
    sendJson([$lastTxObj]);
} catch (Exception $e) {
    sendJson([]);
}
