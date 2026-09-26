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
        $refId = 'THINK' . substr($mobile, -4);
        $insStmt = $pdo->prepare("INSERT INTO users (mobile, name, email, referral_id) VALUES (?, ?, ?, ?)");
        $insStmt->execute([$mobile, $name ?: 'TomorrowNeeds User', $email ?: '', $refId]);

        $referrerInfo = null;
        if (!empty($referralCode)) {
            // Check and apply referral code if provided
            $cleanCode = strtoupper(trim($referralCode));
            $digits = preg_replace('/[^0-9]/', '', $cleanCode);
            $last4 = strlen($digits) >= 4 ? substr($digits, -4) : $digits;
            $last6 = strlen($digits) >= 6 ? substr($digits, -6) : $digits;

            $refStmt = $pdo->prepare("
                SELECT mobile, name, referral_id FROM users 
                WHERE referral_id = :code 
                   OR UPPER(referral_id) = :code 
                   OR mobile = :raw_code 
                   OR (:last4 != '' AND RIGHT(mobile, 4) = :last4)
                   OR (:last6 != '' AND RIGHT(mobile, 6) = :last6)
                   OR (:last4 != '' AND mobile LIKE CONCAT('%', :last4))
                LIMIT 1
            ");
            $refStmt->execute([
                ':code' => $cleanCode,
                ':raw_code' => $referralCode,
                ':last4' => $last4,
                ':last6' => $last6
            ]);
            $referrer = $refStmt->fetch();
            if ($referrer && $referrer['mobile'] !== $mobile) {
                // Referrer User 1 will receive ₹100 credit on their wallet AFTER User 2's order is DELIVERED.
                // Seed WELCOME25 (25% off) for referee User 2 (1-time use on first order)
                try {
                    $pdo->prepare("
                        INSERT INTO coupons (code, discount_percent, max_discount, min_order_amount, count, categories, description, offer, offer_desc, disabled) 
                        VALUES ('WELCOME25', 25.00, 500.00, 0.00, 1, 'all', '25% OFF on first order (One-time use)', '25% OFF', '25% discount on order', 0)
                        ON DUPLICATE KEY UPDATE discount_percent = 25.00, count = 1, min_order_amount = 0.00
                    ")->execute();
                    $pdo->prepare("INSERT INTO user_coupons (mobile, coupon_code, used) VALUES (?, 'WELCOME25', 0)")->execute([$mobile]);
                    $pdo->prepare("UPDATE users SET referred_by = ? WHERE mobile = ?")->execute([$cleanCode, $mobile]);
                } catch (Exception $cex) {}

                $referrerInfo = [
                    'referrer_name' => $referrer['name'] ?: ('User ' . substr($referrer['mobile'], -4)),
                    'coupon_desc' => '25% OFF Coupon Unlocked! (Valid on your first order)',
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

