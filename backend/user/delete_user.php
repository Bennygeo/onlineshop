<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');

if (!$mobile) {
    sendJson(['error' => 'Mobile number is required'], 400);
}

// Sanitize: must be a numeric string 10 chars
if (!preg_match('/^\d{10}$/', $mobile)) {
    sendJson(['error' => 'Invalid mobile number format'], 400);
}

// No DB connection (local dev with no DB) — return success gracefully
if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $pdo->beginTransaction();

    // 1. Delete order_items linked to this user's orders (subquery — compatible with MySQL & SQLite)
    $stmt = $pdo->prepare(
        "DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE mobile = ?)"
    );
    $stmt->execute([$mobile]);

    // 2. Delete orders
    $stmt = $pdo->prepare("DELETE FROM orders WHERE mobile = ?");
    $stmt->execute([$mobile]);

    // 3. Delete wallet entries
    $stmt = $pdo->prepare("DELETE FROM wallets WHERE mobile = ?");
    $stmt->execute([$mobile]);

    // 4. Delete user coupons
    $stmt = $pdo->prepare("DELETE FROM user_coupons WHERE mobile = ?");
    $stmt->execute([$mobile]);

    // 5. Delete user addresses (also handled by FK CASCADE on MySQL, but explicit for SQLite)
    $stmt = $pdo->prepare("DELETE FROM user_addresses WHERE mobile = ?");
    $stmt->execute([$mobile]);

    // 6. Delete the user record itself
    $stmt = $pdo->prepare("DELETE FROM users WHERE mobile = ?");
    $stmt->execute([$mobile]);

    $pdo->commit();

    sendJson('SUCCESS');

} catch (Exception $e) {
    $pdo->rollBack();
    sendJson(['error' => $e->getMessage()], 500);
}
