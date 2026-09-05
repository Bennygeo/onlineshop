<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('mobile');
$name = getParam('name', '');
$email = getParam('email', '');

if (!$mobile) {
    sendJson(['error' => 'Mobile number is required'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("INSERT INTO users (mobile, name, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)");
    $stmt->execute([$mobile, $name, $email]);
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
