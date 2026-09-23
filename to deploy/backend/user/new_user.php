<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');
$name = getParam('name', '');
$email = getParam('email', '');
$referralCode = trim(getParam('referralCode', ''));

if (!$mobile) {
    sendJson(['error' => 'Mobile number is required'], 400);
}

if (!$pdo) {
    sendJson([
        'status' => 'EXISTING',
        'is_new' => false,
        'mobile' => $mobile
    ]);
}

try {
    // Ensure users table has referral_id column
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN referral_id VARCHAR(50) DEFAULT NULL");
    } catch (Exception $e) {}

    // 1. Check if user already exists in users table
    $checkUser = $pdo->prepare("SELECT mobile, name, email, referral_id FROM users WHERE mobile = ? LIMIT 1");
    $checkUser->execute([$mobile]);
    $existingUser = $checkUser->fetch();

    $isExisting = false;
    if ($existingUser) {
        $isExisting = true;
    } else {
        // Also check if user has previous addresses or orders (legacy data check)
        $checkAddr = $pdo->prepare("SELECT id FROM user_addresses WHERE mobile = ? LIMIT 1");
        $checkAddr->execute([$mobile]);
        if ($checkAddr->fetch()) {
            $isExisting = true;
        } else {
            $checkOrder = $pdo->prepare("SELECT order_id FROM orders WHERE mobile = ? LIMIT 1");
            $checkOrder->execute([$mobile]);
            if ($checkOrder->fetch()) {
                $isExisting = true;
            }
        }
    }

    if ($isExisting) {
        // User is already registered: update name/email if provided and not empty
        if ($name || $email) {
            $upStmt = $pdo->prepare("UPDATE users SET name = COALESCE(NULLIF(?, ''), name), email = COALESCE(NULLIF(?, ''), email) WHERE mobile = ?");
            $upStmt->execute([$name, $email, $mobile]);
        }
        
        // If they didn't have a record in users table, insert it now
        if (!$existingUser) {
            $refId = 'THINK' . substr($mobile, -6);
            $insStmt = $pdo->prepare("INSERT INTO users (mobile, name, email, referral_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE mobile = mobile");
            $insStmt->execute([$mobile, $name ?: 'TomorrowNeeds User', $email ?: '', $refId]);
        }

        sendJson([
            'status' => 'EXISTING',
            'is_new' => false,
            'mobile' => $mobile,
            'message' => 'User already registered'
        ]);
    } else {
        // First-time brand new user
        $refId = 'THINK' . substr($mobile, -6);
        $insStmt = $pdo->prepare("INSERT INTO users (mobile, name, email, referral_id) VALUES (?, ?, ?, ?)");
        $insStmt->execute([$mobile, $name ?: 'TomorrowNeeds User', $email ?: '', $refId]);

        $referrerInfo = null;
        if (!empty($referralCode)) {
            // Check and apply referral code if provided
            $refStmt = $pdo->prepare("SELECT mobile, name FROM users WHERE referral_id = ? OR mobile = ? LIMIT 1");
            $refStmt->execute([$referralCode, $referralCode]);
            $referrer = $refStmt->fetch();
            if ($referrer && $referrer['mobile'] !== $mobile) {
                $rewardAmount = 100.00;
                $refCreditStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'authorized')");
                $refCreditStmt->execute([$referrer['mobile'], $rewardAmount, "Referral Bonus from $mobile"]);
                
                $referrerInfo = [
                    'referrer_name' => $referrer['name'] ?: ('User ' . substr($referrer['mobile'], -4)),
                    'coupon_desc' => '25% CASHBACK Coupon Unlocked!',
                    'referrer' => $referralCode,
                    'status' => 1
                ];
            }
        }

        sendJson([
            'status' => 'ADDED',
            'is_new' => true,
            'mobile' => $mobile,
            'referral_id' => $refId,
            'referrer' => $referrerInfo,
            'message' => 'New user registered successfully'
        ]);
    }
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage(), 'status' => 'EXISTING', 'is_new' => false], 500);
}

