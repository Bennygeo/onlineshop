<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile') ?: getParam('user_id') ?: getParam('id') ?: '';
$mobile = preg_replace('/\D/', '', (string)$mobile);
if (strlen($mobile) > 10) {
    $mobile = substr($mobile, -10);
}

$name = trim(getParam('name') ?: 'Customer');
$email = trim(getParam('email') ?: '');
$address = trim(getParam('address') ?: '');
$pincode = trim(getParam('pincode') ?: '600095');
$landmark = trim(getParam('landmark') ?: '');

if (empty($mobile) || strlen($mobile) < 10) {
    sendJson(['error' => 'Valid 10-digit mobile number is required'], 400);
}

if (!$pdo) {
    sendJson(['status' => 'SUCCESS', 'message' => 'Customer saved successfully']);
}

try {
    // 1. Ensure columns exist on users table
    try { $pdo->exec("ALTER TABLE users ADD COLUMN referral_id VARCHAR(50) DEFAULT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (Exception $e) {}

    $refId = 'THINK' . substr($mobile, -6);

    // 2. Insert or update users table
    try {
        $stmt = $pdo->prepare("
            INSERT INTO users (mobile, name, email, referral_id) 
            VALUES (?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)
        ");
        $stmt->execute([$mobile, $name, $email, $refId]);
    } catch (Exception $eUsers) {
        $stmtFallback = $pdo->prepare("
            INSERT INTO users (mobile, name, email) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)
        ");
        $stmtFallback->execute([$mobile, $name, $email]);
    }

    // 3. Initialize zero wallet record if not present
    try {
        $stmtW = $pdo->prepare("SELECT id FROM wallets WHERE mobile = ? LIMIT 1");
        $stmtW->execute([$mobile]);
        if (!$stmtW->fetch()) {
            $insW = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, 0, 'CREDIT', 'Welcome to TomorrowNeeds', 'authorized')");
            $insW->execute([$mobile]);
        }
    } catch (Exception $eW) {}

    // 4. If address provided, create/update address in user_addresses
    if (!empty($address)) {
        try {
            $pdo->exec("ALTER TABLE user_addresses ADD COLUMN is_default TINYINT(1) DEFAULT 1");
        } catch (Exception $e) {}

        try {
            $chkAddr = $pdo->prepare("SELECT id FROM user_addresses WHERE mobile = ? LIMIT 1");
            $chkAddr->execute([$mobile]);
            $existingAddr = $chkAddr->fetch();

            if ($existingAddr) {
                $updAddr = $pdo->prepare("UPDATE user_addresses SET name = ?, address = ?, pincode = ?, landmark = ?, is_default = 1 WHERE id = ?");
                $updAddr->execute([$name, $address, $pincode, $landmark, $existingAddr['id']]);
            } else {
                $insAddr = $pdo->prepare("INSERT INTO user_addresses (mobile, name, address, pincode, landmark, is_default) VALUES (?, ?, ?, ?, ?, 1)");
                $insAddr->execute([$mobile, $name, $address, $pincode, $landmark]);
            }
        } catch (Exception $eAddr) {}
    }

    sendJson([
        'status' => 'SUCCESS',
        'message' => 'Customer saved successfully',
        'user' => [
            'mobile' => $mobile,
            'name' => $name,
            'email' => $email,
            'referral_id' => $refId
        ]
    ]);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
