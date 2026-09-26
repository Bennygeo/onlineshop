<?php
require_once __DIR__ . '/../config/db.php';

$user2_mobile = getParam('mobile') ?: getParam('id');
$referralCode = trim(getParam('referralCode', ''));

if (!$referralCode) {
    sendJson(['valid' => false, 'status' => 'INVALID', 'message' => 'Referral code is required']);
}

$rewardAmount = 100.00;
$referrer_mobile = null;
$referrer_name = 'TomorrowNeeds Partner';
$cleanCode = strtoupper(trim($referralCode));

if ($pdo) {
    try {
        // Ensure status column exists in wallets table
        try {
            $pdo->exec("ALTER TABLE wallets ADD COLUMN status VARCHAR(20) DEFAULT 'authorized'");
        } catch (Exception $e) {}

        // Ensure users table has referral_id and referred_by columns
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN referral_id VARCHAR(50) DEFAULT NULL");
            $pdo->exec("ALTER TABLE users ADD COLUMN referred_by VARCHAR(50) DEFAULT NULL");
        } catch (Exception $e) {}

        // Extract digits: both 4 digits and 6 digits for robust code matching (e.g. THINK0936 -> 0936)
        $digits = preg_replace('/[^0-9]/', '', $cleanCode);
        $last4 = strlen($digits) >= 4 ? substr($digits, -4) : $digits;
        $last6 = strlen($digits) >= 6 ? substr($digits, -6) : $digits;

        // Check if referee already used WELCOME25 (strict 1-time single use)
        if ($user2_mobile) {
            $usedCheck = $pdo->prepare("SELECT used FROM user_coupons WHERE mobile = ? AND coupon_code = 'WELCOME25' LIMIT 1");
            $usedCheck->execute([$user2_mobile]);
            $ucRow = $usedCheck->fetch();
            if ($ucRow && (int)$ucRow['used'] >= 1) {
                sendJson([
                    'valid' => false,
                    'status' => 'INVALID',
                    'message' => 'The 25% referral discount is valid for your first order only and has already been used.'
                ]);
            }
        }

        // 1. Find User 1 (Referrer) in DB matching referralCode
        $stmt = $pdo->prepare("
            SELECT mobile, name, referral_id 
            FROM users 
            WHERE referral_id = :code 
               OR UPPER(referral_id) = :code 
               OR mobile = :raw_code 
               OR (:last4 != '' AND RIGHT(mobile, 4) = :last4)
               OR (:last6 != '' AND RIGHT(mobile, 6) = :last6)
               OR (:last4 != '' AND mobile LIKE CONCAT('%', :last4))
            LIMIT 1
        ");
        $stmt->execute([
            ':code' => $cleanCode,
            ':raw_code' => $referralCode,
            ':last4' => $last4,
            ':last6' => $last6
        ]);
        $referrer = $stmt->fetch();

        if ($referrer) {
            $referrer_mobile = $referrer['mobile'];
            $referrer_name = $referrer['name'] ?: ("User " . substr($referrer['mobile'], -4));
        } else {
            // Fallback: Check users table for referrer mobile by last 4 / 6 digits
            if ($last4 && strlen($last4) >= 4) {
                $refUsrStmt = $pdo->prepare("SELECT mobile, name, referral_id FROM users WHERE RIGHT(mobile, 4) = ? ORDER BY created_at DESC LIMIT 1");
                $refUsrStmt->execute([$last4]);
                $refU = $refUsrStmt->fetch();
                if ($refU && !empty($refU['mobile'])) {
                    $referrer_mobile = $refU['mobile'];
                    $referrer_name = $refU['name'] ?: ("User " . substr($referrer_mobile, -4));
                }
            }
            if (!$referrer_mobile && strlen($digits) >= 10) {
                $referrer_mobile = substr($digits, -10);
                $referrer_name = "User " . substr($referrer_mobile, -4);
            }
        }

        if (!$referrer_mobile) {
            sendJson(['valid' => false, 'status' => 'INVALID', 'message' => "Invalid referral code '$referralCode'. Please check and try again."]);
        }

        // Prevent user from referring themselves
        if ($user2_mobile && $referrer_mobile && $user2_mobile === $referrer_mobile) {
            sendJson(['valid' => false, 'status' => 'INVALID', 'message' => 'You cannot use your own referral code!']);
        }
        if ($user2_mobile && $last4 && strlen($last4) >= 4 && substr($user2_mobile, -4) === $last4) {
            sendJson(['valid' => false, 'status' => 'INVALID', 'message' => 'You cannot use your own referral code!']);
        }

        // 2. REWARD USER 2 (Referee / Friend): 25% OFF Coupon ONLY (count = 1 strictly, single use on first order)
        // Note: User 1 (Referrer) receives ₹100 credit on their wallet AFTER User 2's order is DELIVERED.
        $cStmt = $pdo->prepare("
            INSERT INTO coupons (code, discount_percent, max_discount, min_order_amount, count, categories, description, offer, offer_desc, disabled) 
            VALUES ('WELCOME25', 25.00, 500.00, 0.00, 1, 'all', '25% OFF on first order (One-time use)', '25% OFF', '25% discount on order', 0)
            ON DUPLICATE KEY UPDATE discount_percent = 25.00, count = 1, min_order_amount = 0.00, description = '25% OFF on first order (One-time use)'
        ");
        $cStmt->execute();

        if ($user2_mobile) {
            try {
                $ucCheck = $pdo->prepare("SELECT id FROM user_coupons WHERE mobile = ? AND coupon_code = 'WELCOME25' LIMIT 1");
                $ucCheck->execute([$user2_mobile]);
                if (!$ucCheck->fetch()) {
                    $ucStmt = $pdo->prepare("INSERT INTO user_coupons (mobile, coupon_code, used) VALUES (?, 'WELCOME25', 0)");
                    $ucStmt->execute([$user2_mobile]);
                }

                // Link referred_by in users table
                $upUser = $pdo->prepare("UPDATE users SET referred_by = ? WHERE mobile = ?");
                $upUser->execute([$cleanCode, $user2_mobile]);
            } catch (Exception $cex) {}
        }
    } catch (Exception $e) {
        // Log silently
    }
}

sendJson([
    'valid' => true,
    'status' => 'SUCCESS',
    'amount' => $rewardAmount,
    'referrer_mobile' => $referrer_mobile ?: '',
    'referrer_name' => $referrer_name,
    'referrer_code' => $cleanCode,
    'coupon_code' => 'WELCOME25',
    'discount_percent' => 25,
    'coupon_desc' => '25% OFF Coupon Unlocked! (Valid on your first order)',
    'message' => "Referral code $cleanCode applied! You unlocked 25% OFF on your first order. Referrer ($referrer_name) will receive ₹100 wallet credit once your first order is delivered."
]);
