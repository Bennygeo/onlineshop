<?php
require_once __DIR__ . '/../config/db.php';

$walletData = getParam('walletData');
$data = is_string($walletData) ? json_decode($walletData, true) : $walletData;

$mobile = isset($data['mobile']) ? $data['mobile'] : getParam('mobile');
$amount = isset($data['amount']) ? $data['amount'] : getParam('amount', 0);
$type = isset($data['type']) ? $data['type'] : 'CREDIT';
$description = isset($data['description']) ? $data['description'] : '';

if (!$mobile || !$amount) {
    sendJson(['error' => 'Mobile and amount are required'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("INSERT INTO wallets (mobile, amount, type, description) VALUES (?, ?, ?, ?)");
    $stmt->execute([$mobile, $amount, $type, $description]);
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
