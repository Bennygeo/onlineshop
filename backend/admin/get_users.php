<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson([]);
}

try {
    // Ensure users table exists
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mobile VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100) DEFAULT '',
                email VARCHAR(150) DEFAULT '',
                referral_id VARCHAR(50) DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
    } catch (Exception $e) {}

    // Ensure referral_id & created_at exist in users
    try { $pdo->exec("ALTER TABLE users ADD COLUMN referral_id VARCHAR(50) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Exception $e) {}

    // Synchronize any distinct mobile numbers from orders, user_addresses, or wallets into users table if not already present
    try {
        $pdo->exec("
            INSERT IGNORE INTO users (mobile, name, email, referral_id)
            SELECT DISTINCT mobile, 'Customer', '', CONCAT('THINK', RIGHT(mobile, 6))
            FROM orders 
            WHERE mobile IS NOT NULL AND mobile != '' AND mobile NOT IN (SELECT mobile FROM users)
        ");
        $pdo->exec("
            INSERT IGNORE INTO users (mobile, name, email, referral_id)
            SELECT DISTINCT mobile, name, '', CONCAT('THINK', RIGHT(mobile, 6))
            FROM user_addresses 
            WHERE mobile IS NOT NULL AND mobile != '' AND mobile NOT IN (SELECT mobile FROM users)
        ");
    } catch (Exception $e) {}

    // Fetch all users
    $stmtUsers = $pdo->query("SELECT mobile, name, email, referral_id, created_at FROM users ORDER BY created_at DESC, mobile ASC");
    $users = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

    // Fetch wallet balances grouped by mobile
    $walletBalances = [];
    try {
        $wStmt = $pdo->query("
            SELECT mobile, 
                SUM(CASE 
                    WHEN status IN ('authorized','captured','placed','success') AND UPPER(type) = 'DEBIT' THEN -ROUND(amount)
                    WHEN status IN ('authorized','captured','placed','success') THEN ROUND(amount)
                    ELSE 0 
                END) as balance
            FROM wallets
            WHERE mobile IS NOT NULL AND mobile != ''
            GROUP BY mobile
        ");
        $wRows = $wStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($wRows as $wr) {
            $walletBalances[$wr['mobile']] = max(0, round((float)$wr['balance']));
        }
    } catch (Exception $e) {}

    // Fetch order stats grouped by mobile
    $orderStats = [];
    try {
        $oStmt = $pdo->query("
            SELECT mobile, COUNT(id) as total_orders, MAX(created_at) as last_order_date, SUM(ROUND(total_amount)) as total_spent
            FROM orders
            WHERE mobile IS NOT NULL AND mobile != ''
            GROUP BY mobile
        ");
        $oRows = $oStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($oRows as $or) {
            $orderStats[$or['mobile']] = [
                'total_orders' => (int)$or['total_orders'],
                'last_order_date' => $or['last_order_date'],
                'total_spent' => round((float)$or['total_spent'])
            ];
        }
    } catch (Exception $e) {}

    // Fetch default / latest addresses grouped by mobile
    $addresses = [];
    try {
        $aStmt = $pdo->query("SELECT id, mobile, name, address, pincode, landmark, is_default FROM user_addresses ORDER BY is_default DESC, id DESC");
        $aRows = $aStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($aRows as $ar) {
            $m = $ar['mobile'];
            if (!isset($addresses[$m])) {
                $addresses[$m] = $ar;
            }
        }
    } catch (Exception $e) {}

    $result = [];
    foreach ($users as $u) {
        $mob = $u['mobile'];
        $stats = $orderStats[$mob] ?? ['total_orders' => 0, 'last_order_date' => null, 'total_spent' => 0];
        $addr = $addresses[$mob] ?? null;
        $bal = $walletBalances[$mob] ?? 0;

        $displayName = !empty($u['name']) && $u['name'] !== 'Customer' && $u['name'] !== 'Thinkspot User' && $u['name'] !== 'TomorrowNeeds User'
            ? $u['name'] 
            : (!empty($addr['name']) ? $addr['name'] : (!empty($u['name']) ? $u['name'] : 'Customer'));

        $formattedAddress = '';
        if ($addr) {
            $parts = array_filter([$addr['address'] ?? '', $addr['landmark'] ?? '', $addr['pincode'] ?? '']);
            $formattedAddress = implode(', ', $parts);
        }

        $result[] = [
            'mobile' => $mob,
            'name' => $displayName,
            'email' => $u['email'] ?? '',
            'referral_id' => $u['referral_id'] ?? ('THINK' . substr($mob, -6)),
            'wallet_balance' => $bal,
            'total_orders' => $stats['total_orders'],
            'total_spent' => $stats['total_spent'],
            'last_order_date' => $stats['last_order_date'],
            'created_at' => $u['created_at'] ?? null,
            'address' => $formattedAddress,
            'address_details' => $addr
        ];
    }

    sendJson($result);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
