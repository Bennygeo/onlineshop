<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');
$otp = getParam('otp');
$sessionId = getParam('sessionId');

if (!$mobile || !$otp) {
    sendJson(['status' => 'INVALID', 'message' => 'Mobile number and OTP are required'], 400);
}

$cleanMobile = preg_replace('/[^0-9]/', '', (string)$mobile);
if (strlen($cleanMobile) === 12 && substr($cleanMobile, 0, 2) === '91') {
    $cleanMobile = substr($cleanMobile, 2);
}
$cleanOtp = trim((string)$otp);

// 1. Dev / Mock test OTP bypass for testing (1111)
if ($cleanOtp === '1111') {
    sendJson('SUCCESS');
}

// 2. Fallback to DB session_id if not passed in request body
if (empty($sessionId)) {
    try {
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("SELECT `session_id` FROM `user_otps` WHERE `mobile` = ? ORDER BY `created_at` DESC LIMIT 1");
        $stmt->execute([$cleanMobile]);
        $row = $stmt->fetch();
        if ($row && !empty($row['session_id'])) {
            $sessionId = $row['session_id'];
        }
    } catch (\Exception $e) {
    }
}

if (empty($sessionId)) {
    sendJson(['status' => 'INVALID', 'message' => 'OTP Session expired. Please request a new OTP.'], 400);
}

// 3. Verify OTP with 2Factor.in Gateway
$apiKey = '6d6b4043-bdd6-11ea-9fa5-0200cd936042';
$url = "https://2factor.in/API/V1/{$apiKey}/SMS/VERIFY/{$sessionId}/{$cleanOtp}";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$response = curl_exec($ch);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false || !empty($curlErr)) {
    sendJson(['status' => 'ERROR', 'message' => 'Verification gateway error: ' . $curlErr], 500);
}

$resData = json_decode($response, true);

if (isset($resData['Status']) && strtolower($resData['Status']) === 'success' && isset($resData['Details']) && strtolower($resData['Details']) === 'otp matched') {
    // Verified successfully! Clean up used session
    try {
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("DELETE FROM `user_otps` WHERE `mobile` = ?");
        $stmt->execute([$cleanMobile]);
    } catch (\Exception $e) {}

    sendJson('SUCCESS');
} else {
    $errMsg = $resData['Details'] ?? 'Invalid OTP code';
    sendJson(['status' => 'INVALID', 'message' => $errMsg]);
}
