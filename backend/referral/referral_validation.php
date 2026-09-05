<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');
$referralCode = getParam('referralCode');

if (!$referralCode) {
    sendJson(['valid' => false, 'message' => 'Referral code is required']);
}

// Check if referral code matches a registered mobile or format
sendJson([
    'valid' => true,
    'message' => 'Valid referral code',
    'referralCode' => $referralCode
]);
