<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');

if (!$mobile) {
    sendJson([]);
}

if (!$pdo) {
    sendJson([
        [
            'mobile' => $mobile,
            'name' => 'Test User',
            'email' => 'user@example.com',
            'referral_id' => 'THINK' . substr($mobile, -6)
        ]
    ]);
}

try {
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN referral_id VARCHAR(50) DEFAULT NULL");
    } catch (Exception $e) {}

    $stmt = $pdo->prepare("SELECT mobile, name, email, referral_id FROM users WHERE mobile = ?");
    $stmt->execute([$mobile]);
    $user = $stmt->fetch();

    if ($user) {
        if (empty($user['referral_id'])) {
            $refId = 'THINK' . substr($mobile, -6);
            $upStmt = $pdo->prepare("UPDATE users SET referral_id = ? WHERE mobile = ?");
            $upStmt->execute([$refId, $mobile]);
            $user['referral_id'] = $refId;
        }
        sendJson([$user]);
    } else {
        $refId = 'THINK' . substr($mobile, -6);
        $insStmt = $pdo->prepare("INSERT INTO users (mobile, name, email, referral_id) VALUES (?, 'Thinkspot User', '', ?)");
        $insStmt->execute([$mobile, $refId]);
        sendJson([
            [
                'mobile' => $mobile,
                'name' => 'Thinkspot User',
                'email' => '',
                'referral_id' => $refId
            ]
        ]);
    }
} catch (Exception $e) {
    sendJson([]);
}


