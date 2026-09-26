<?php
// backend/referral/process_referral_reward.php

/**
 * Process referral reward after referee's order is delivered.
 * User 1 (Referrer) receives ₹100 credit on their wallet after User 2's order is DELIVERED.
 *
 * @param PDO $pdo
 * @param string $orderId
 * @return array
 */
function processReferralOnDelivery($pdo, $orderId) {
    if (!$pdo || empty($orderId)) {
        return ['status' => 'FAILED', 'reason' => 'Missing PDO or Order ID'];
    }

    try {
        // Ensure wallets table has necessary schema
        try {
            $pdo->exec("ALTER TABLE wallets ADD COLUMN status VARCHAR(20) DEFAULT 'authorized'");
        } catch (Exception $e) {}

        // 1. Fetch order details
        $stmtOrd = $pdo->prepare("
            SELECT order_id, mobile, status, referral_code, referred_by, coupon 
            FROM orders 
            WHERE order_id = ? 
            LIMIT 1
        ");
        $stmtOrd->execute([$orderId]);
        $order = $stmtOrd->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            return ['status' => 'FAILED', 'reason' => "Order #$orderId not found"];
        }

        // Only process when order status is DELIVERED
        if (strtoupper(trim($order['status'])) !== 'DELIVERED') {
            return ['status' => 'SKIPPED', 'reason' => "Order status is '{$order['status']}', not DELIVERED"];
        }

        $user2_mobile = trim($order['mobile']);
        if (!$user2_mobile) {
            return ['status' => 'SKIPPED', 'reason' => 'No referee mobile on order'];
        }

        // 2. Identify the referral code or referrer
        $refCode = trim($order['referral_code'] ?? '');
        $referredBy = trim($order['referred_by'] ?? '');

        // Fallback: check users table for user2's referred_by
        if (empty($refCode) || $refCode === 'xxxx' || $refCode === 'WELCOME25') {
            $uStmt = $pdo->prepare("SELECT referred_by FROM users WHERE mobile = ? LIMIT 1");
            $uStmt->execute([$user2_mobile]);
            $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
            if ($uRow && !empty($uRow['referred_by']) && $uRow['referred_by'] !== 'xxxx') {
                $refCode = trim($uRow['referred_by']);
            }
        }

        // If referred_by on order is a mobile number (10 digits)
        if (empty($refCode) && !empty($referredBy) && $referredBy !== 'xxxx') {
            $refCode = $referredBy;
        }

        if (empty($refCode) || $refCode === 'xxxx') {
            return ['status' => 'SKIPPED', 'reason' => 'No referral code found for this order or user'];
        }

        $cleanCode = strtoupper(trim($refCode));
        $digits = preg_replace('/[^0-9]/', '', $cleanCode);
        $last4 = strlen($digits) >= 4 ? substr($digits, -4) : $digits;
        $last6 = strlen($digits) >= 6 ? substr($digits, -6) : $digits;

        // 3. Find User 1 (Referrer) in users table
        $referrer = null;
        $stmtRef = $pdo->prepare("
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
        $stmtRef->execute([
            ':code' => $cleanCode,
            ':raw_code' => $refCode,
            ':last4' => $last4,
            ':last6' => $last6
        ]);
        $referrer = $stmtRef->fetch(PDO::FETCH_ASSOC);

        // Fallback: check orders/wallets for referrer mobile
        if (!$referrer && $last4 && strlen($last4) >= 4) {
            $stmtRefOrd = $pdo->prepare("SELECT mobile, name, referral_id FROM users WHERE RIGHT(mobile, 4) = ? LIMIT 1");
            $stmtRefOrd->execute([$last4]);
            $referrer = $stmtRefOrd->fetch(PDO::FETCH_ASSOC);
        }

        if (!$referrer) {
            return ['status' => 'SKIPPED', 'reason' => "Referrer not found matching referral code: $refCode"];
        }

        $referrer_mobile = trim($referrer['mobile']);
        $referrer_name = $referrer['name'] ?: ('User ' . substr($referrer_mobile, -4));

        // Prevent rewarding self
        if ($referrer_mobile === $user2_mobile) {
            return ['status' => 'SKIPPED', 'reason' => 'Self-referral cannot receive reward'];
        }

        // 4. Ensure reward is credited ONCE per referred user (on their first delivered order)
        // Check if Referrer already received a reward for this referee or order
        $chkWallet = $pdo->prepare("
            SELECT id, amount, created_at FROM wallets 
            WHERE mobile = ? 
              AND type = 'CREDIT' 
              AND (
                description LIKE ? 
                OR description LIKE ?
              )
            LIMIT 1
        ");
        $chkWallet->execute([
            $referrer_mobile,
            "%{$user2_mobile}%",
            "%{$orderId}%"
        ]);
        $existingWalletRow = $chkWallet->fetch(PDO::FETCH_ASSOC);

        if ($existingWalletRow) {
            return [
                'status' => 'ALREADY_CREDITED',
                'message' => "Referral reward of ₹100 already credited to referrer ($referrer_mobile) for User ($user2_mobile)",
                'wallet_id' => $existingWalletRow['id']
            ];
        }

        // 5. Credit User 1 ₹100 in wallets table
        $rewardAmount = 100.00;
        $rewardDesc = "Referral Bonus: ₹100 for Order #{$orderId} delivered (Friend {$user2_mobile})";

        $insWallet = $pdo->prepare("
            INSERT INTO wallets (mobile, amount, type, description, status) 
            VALUES (?, ?, 'CREDIT', ?, 'authorized')
        ");
        $insWallet->execute([$referrer_mobile, $rewardAmount, $rewardDesc]);
        $walletCreditId = $pdo->lastInsertId();

        // 6. Update order with exact referral code and referrer mobile
        $updOrder = $pdo->prepare("
            UPDATE orders 
            SET referral_code = COALESCE(NULLIF(referral_code, ''), NULLIF(referral_code, 'xxxx'), ?),
                referred_by = COALESCE(NULLIF(referred_by, ''), NULLIF(referred_by, 'xxxx'), ?)
            WHERE order_id = ?
        ");
        $updOrder->execute([$cleanCode, $referrer_mobile, $orderId]);

        return [
            'status' => 'SUCCESS',
            'rewarded' => true,
            'referrer_mobile' => $referrer_mobile,
            'referrer_name' => $referrer_name,
            'referrer_code' => $cleanCode,
            'referee_mobile' => $user2_mobile,
            'order_id' => $orderId,
            'amount' => $rewardAmount,
            'wallet_id' => $walletCreditId
        ];
    } catch (Exception $e) {
        return ['status' => 'ERROR', 'error' => $e->getMessage()];
    }
}
