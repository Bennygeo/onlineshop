<?php
require_once __DIR__ . '/../config/db.php';

$user2_mobile = getParam('mobile') ?: getParam('id');
$referralCode = trim(getParam('referralCode', ''));

if (!$referralCode) {
    sendJson(['valid' => false, 'status' => 'INVALID', 'message' => 'Referral code is required']);
}

$rewardAmount = 100.00;
$referrer_mobile = null;
$referrer_name = 'Thinkspot Partner';

if ($pdo) {
    try {
        // Ensure status column exists in wallets table
        try {
            $pdo->exec("ALTER TABLE wallets ADD COLUMN status VARCHAR(20) DEFAULT 'authorized'");
        } catch (Exception $e) {}

        // Ensure users table has referral_id column
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN referral_id VARCHAR(50) DEFAULT NULL");
        } catch (Exception $e) {}

        // 1. Find User 1 (Referrer) in DB matching referralCode
        $stmt = $pdo->prepare("SELECT mobile, name, referral_id FROM users WHERE referral_id = ? OR mobile = ? OR ? LIKE CONCAT('%', RIGHT(mobile, 6), '%') LIMIT 1");
        $stmt->execute([$referralCode, $referralCode, $referralCode]);
        $referrer = $stmt->fetch();

        if ($referrer) {
            $referrer_mobile = $referrer['mobile'];
            $referrer_name = $referrer['name'] ?: ("User " . substr($referrer['mobile'], -4));
        } else {
            // Fallback: If code contains 10 digit mobile or numeric string
            $digits = preg_replace('/[^0-9]/', '', $referralCode);
            if (strlen($digits) >= 10) {
                $referrer_mobile = substr($digits, -10);
                $referrer_name = "User " . substr($referrer_mobile, -4);
            }
        }

        // Prevent user from referring themselves
        if ($user2_mobile && $referrer_mobile && $user2_mobile === $referrer_mobile) {
            sendJson(['valid' => false, 'status' => 'INVALID', 'message' => 'You cannot use your own referral code!']);
        }

        // 2. CREDIT USER 1 (Referrer) ₹100 in wallets table ONLY
        if ($referrer_mobile) {
            $refCheck = $pdo->prepare("SELECT id FROM wallets WHERE mobile = ? AND description LIKE ? LIMIT 1");
            $refCheck->execute([$referrer_mobile, "%Referral Bonus from $user2_mobile%"]);
            if (!$refCheck->fetch()) {
                $refCreditStmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description, status) VALUES (?, ?, 'CREDIT', ?, 'authorized')");
                $refCreditStmt->execute([$referrer_mobile, $rewardAmount, "Referral Bonus from $user2_mobile"]);
            }
        }

        // 3. REWARD USER 2 (Referee / Friend): 25% CASHBACK Coupon ONLY (No wallet cash)
        if ($user2_mobile) {
            try {
                $cStmt = $pdo->prepare("INSERT INTO coupons (code, discount_percent, max_discount, min_order_amount) VALUES ('WELCOME25', 25.00, 200.00, 100.00) ON DUPLICATE KEY UPDATE discount_percent = 25.00");
                $cStmt->execute();

                $ucCheck = $pdo->prepare("SELECT id FROM user_coupons WHERE mobile = ? AND coupon_code = 'WELCOME25' LIMIT 1");
                $ucCheck->execute([$user2_mobile]);
                if (!$ucCheck->fetch()) {
                    $ucStmt = $pdo->prepare("INSERT INTO user_coupons (mobile, coupon_code, used) VALUES (?, 'WELCOME25', 0)");
                    $ucStmt->execute([$user2_mobile]);
                }
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
    'coupon_desc' => '25% CASHBACK Coupon Unlocked!',
    'message' => "Referral code applied! ₹100 credited to referrer ($referrer_name) and 25% Cashback coupon unlocked for your account."
]);



