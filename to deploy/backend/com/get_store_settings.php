<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson(['status' => 'error', 'message' => 'Database connection failed', 'settings' => ['weekly_off_day' => 'None']], 200);
    exit();
}

try {
    $stmt = $pdo->query("SELECT `key`, `value` FROM `store_settings`");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $settings = [];
    foreach ($rows as $row) {
        $settings[$row['key']] = $row['value'];
    }
    if (!isset($settings['weekly_off_day'])) {
        $settings['weekly_off_day'] = 'None';
    }
    if (!isset($settings['enable_razorpay'])) {
        $settings['enable_razorpay'] = '1';
    }
    if (!isset($settings['enable_cod'])) {
        $settings['enable_cod'] = '1';
    }
    sendJson(['status' => 'success', 'settings' => $settings]);
} catch (Exception $e) {
    sendJson(['status' => 'success', 'settings' => ['weekly_off_day' => 'None', 'enable_razorpay' => '1', 'enable_cod' => '1']]);
}
