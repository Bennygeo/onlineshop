<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('id') ?: getParam('mobile');

if (!$mobile || !$pdo) {
    sendJson([]);
}

try {
    syncWalletAndRazorpayTables($pdo);

    try {
        $pdo->exec("ALTER TABLE wallets ADD COLUMN status VARCHAR(20) DEFAULT 'authorized'");
    } catch (Exception $e) {}

    // Fetch all transactions for mobile to compute running total
    $stmt = $pdo->prepare("SELECT id, mobile, amount, type, description, status, created_at FROM wallets WHERE mobile = ? ORDER BY id ASC");
    $stmt->execute([$mobile]);
    $rows = $stmt->fetchAll();

    if (empty($rows)) {
        sendJson([[
            'id' => '0',
            'mobile' => (string)$mobile,
            'type' => 'Credit',
            'amount' => 0,
            'total' => 0,
            'timestamp' => time() * 1000,
            'created_at' => date('Y-m-d H:i:s'),
            'description' => 'Initial Balance',
            'trxn_id' => 'TXN_0',
            'status' => 'authorized'
        ]]);
        exit;
    }

    $runningTotal = 0;
    $lastTxObj = null;

    foreach ($rows as $row) {
        $amt = round((float)$row['amount']);
        $type = (strtoupper($row['type']) === 'DEBIT') ? 'Debit' : 'Credit';
        $status = strtolower($row['status'] ?: 'authorized');

        if ($status === 'authorized' || $status === 'captured' || $status === 'placed' || $status === 'success') {
            if ($type === 'Credit') {
                $runningTotal += $amt;
            } else {
                $runningTotal -= $amt;
            }
        }

        $runningTotal = round($runningTotal);

        $lastTxObj = [
            'id' => (string)$row['id'],
            'mobile' => (string)$row['mobile'],
            'type' => $type,
            'amount' => $amt,
            'total' => $runningTotal,
            'timestamp' => strtotime($row['created_at']) * 1000,
            'created_at' => $row['created_at'],
            'description' => $row['description'] ?: 'Wallet Transaction',
            'trxn_id' => 'TXN_' . $row['id'],
            'status' => $status
        ];
    }

    // Return as array res where res[0] is the latest transaction
    sendJson([$lastTxObj]);
} catch (Exception $e) {
    sendJson([]);
}

