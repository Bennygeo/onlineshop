<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');

if (!$mobile) {
    sendJson(['status' => 'ERROR', 'message' => 'Mobile number is required'], 400);
}

// Clean mobile number (keep digits only)
$cleanMobile = preg_replace('/[^0-9]/', '', (string)$mobile);
if (strlen($cleanMobile) === 12 && substr($cleanMobile, 0, 2) === '91') {
    $cleanMobile = substr($cleanMobile, 2);
}

if (strlen($cleanMobile) !== 10) {
    sendJson(['status' => 'ERROR', 'message' => 'Please enter a valid 10-digit mobile number'], 400);
}

$apiKey = '6d6b4043-bdd6-11ea-9fa5-0200cd936042';
$url = "https://2factor.in/API/V1/{$apiKey}/SMS/{$cleanMobile}/AUTOGEN/OTP1";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$response = curl_exec($ch);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false || !empty($curlErr)) {
    sendJson(['status' => 'ERROR', 'message' => 'SMS Gateway connection failed: ' . $curlErr], 500);
}

$resData = json_decode($response, true);

if (isset($resData['Status']) && strtolower($resData['Status']) === 'success') {
    $sessionId = $resData['Details'] ?? '';

    // Store in user_otps table for resilience
    try {
        global $pdo;
        if ($pdo) {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `user_otps` (
                `mobile` VARCHAR(15) NOT NULL PRIMARY KEY,
                `session_id` VARCHAR(100) NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

            $stmt = $pdo->prepare("INSERT INTO `user_otps` (`mobile`, `session_id`, `created_at`) 
                                   VALUES (?, ?, CURRENT_TIMESTAMP) 
                                   ON DUPLICATE KEY UPDATE `session_id` = VALUES(`session_id`), `created_at` = CURRENT_TIMESTAMP");
            $stmt->execute([$cleanMobile, $sessionId]);
        }
    } catch (\Throwable $e) {
        // Non-fatal database persistence error
    }

    sendJson([
        'status' => 'SUCCESS',
        'sessionId' => $sessionId,
        'message' => 'OTP sent successfully to +91 ' . $cleanMobile
    ]);
} else {
    $errMsg = $resData['Details'] ?? 'Failed to send OTP via SMS gateway';
    sendJson([
        'status' => 'ERROR',
        'message' => $errMsg
    ], 400);
}
