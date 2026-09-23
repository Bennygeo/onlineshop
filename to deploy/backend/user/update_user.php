<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');
$name = getParam('name');
$email = getParam('email');

if (!$mobile) {
    sendJson(['error' => 'Mobile number is required'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE mobile = ?");
    $stmt->execute([$name, $email, $mobile]);
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
