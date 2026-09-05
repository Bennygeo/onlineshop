<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');

if (!$mobile) {
    sendJson(['error' => 'Mobile number is required'], 400);
}

// Generates an OTP response or sends mock status
sendJson([
    'status' => 'SUCCESS',
    'message' => 'OTP sent successfully to ' . $mobile
]);
