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
            'referral_id' => ''
        ]
    ]);
}

try {
    $stmt = $pdo->prepare("SELECT mobile, name, email FROM users WHERE mobile = ?");
    $stmt->execute([$mobile]);
    $user = $stmt->fetch();

    if ($user) {
        if (!isset($user['referral_id'])) {
            $user['referral_id'] = '';
        }
        sendJson([$user]);
    } else {
        sendJson([]);
    }
} catch (Exception $e) {
    sendJson([]);
}

