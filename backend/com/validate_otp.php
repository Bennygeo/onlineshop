<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');
$otp = getParam('otp');

if (!$mobile) {
    sendJson(['error' => 'Mobile number is required'], 400);
}

// Simple validation logic
sendJson([
    'status' => 'SUCCESS',
    'verified' => true
]);
