<?php
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if (!$pdo) {
    sendJson(['status' => 'error', 'message' => 'Database connection failed'], 500);
    exit();
}

if ($method === 'GET') {
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
        sendJson(array_merge(['status' => 'success', 'settings' => $settings], $settings));
    } catch (Exception $e) {
        sendJson(['status' => 'error', 'message' => $e->getMessage()], 500);
    }
    exit();
}

if ($method === 'POST') {
    try {
        $key = getParam('key');
        $value = getParam('value');
        $data = getParam('data');
        $settingsParam = getParam('settings');
        $weeklyOff = getParam('weekly_off_day');

        $toUpdate = [];

        if ($key && $value !== null) {
            $toUpdate[$key] = (string)$value;
        }

        if ($weeklyOff !== null) {
            $toUpdate['weekly_off_day'] = (string)$weeklyOff;
        }

        if ($data) {
            $decoded = is_array($data) ? $data : json_decode($data, true);
            if (is_array($decoded)) {
                foreach ($decoded as $k => $v) {
                    $toUpdate[$k] = (string)$v;
                }
            }
        }

        if ($settingsParam) {
            $decoded = is_array($settingsParam) ? $settingsParam : json_decode($settingsParam, true);
            if (is_array($decoded)) {
                foreach ($decoded as $k => $v) {
                    $toUpdate[$k] = (string)$v;
                }
            }
        }

        if (empty($toUpdate)) {
            // Check direct $_POST keys
            foreach ($_POST as $k => $v) {
                if ($k !== 'data' && $k !== 'settings') {
                    $toUpdate[$k] = is_array($v) ? json_encode($v) : (string)$v;
                }
            }
        }

        if (empty($toUpdate)) {
            sendJson(['status' => 'error', 'message' => 'No valid settings provided'], 400);
            exit();
        }

        $stmt = $pdo->prepare("INSERT INTO `store_settings` (`key`, `value`) VALUES (:k, :v) ON DUPLICATE KEY UPDATE `value` = :v2");
        foreach ($toUpdate as $k => $v) {
            $stmt->execute([':k' => $k, ':v' => $v, ':v2' => $v]);
        }

        sendJson(['status' => 'success', 'message' => 'Store settings saved successfully', 'settings' => $toUpdate]);
    } catch (Exception $e) {
        sendJson(['status' => 'error', 'message' => $e->getMessage()], 500);
    }
    exit();
}

sendJson(['status' => 'error', 'message' => 'Method not allowed'], 405);
