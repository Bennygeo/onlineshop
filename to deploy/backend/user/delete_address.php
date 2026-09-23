<?php
require_once __DIR__ . '/../config/db.php';

$addressParam = getParam('address');
$addrObj = is_string($addressParam) ? json_decode($addressParam, true) : $addressParam;
$id = isset($addrObj['id']) ? $addrObj['id'] : getParam('id');

if (!$id) {
    sendJson(['error' => 'Address ID is required for deletion'], 400);
}

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("DELETE FROM user_addresses WHERE id = ?");
    $stmt->execute([$id]);
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
