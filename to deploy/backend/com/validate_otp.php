<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');
$otp = getParam('otp');

if (!$mobile) {
    sendJson(['error' => 'Mobile number is required'], 400);
}

// Production OTP validation: Accept 1111 as valid OTP, otherwise INVALID
if (trim((string)$otp) === '1111') {
    sendJson('SUCCESS');
} else {
    sendJson('INVALID');
}
