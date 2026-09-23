<?php
require_once __DIR__ . '/../config/db.php';

$addressParam = getParam('address');
$addrObj = is_string($addressParam) ? json_decode($addressParam, true) : $addressParam;

if (!$addrObj || !isset($addrObj['id'])) {
    sendJson(['error' => 'Address ID is required for update'], 400);
}

$id = $addrObj['id'];
$name = isset($addrObj['name']) ? $addrObj['name'] : '';
$address = isset($addrObj['address']) ? $addrObj['address'] : '';
$pincode = isset($addrObj['pincode']) ? $addrObj['pincode'] : '';
$landmark = isset($addrObj['landmark']) ? $addrObj['landmark'] : '';

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    $stmt = $pdo->prepare("UPDATE user_addresses SET name = ?, address = ?, pincode = ?, landmark = ? WHERE id = ?");
    $stmt->execute([$name, $address, $pincode, $landmark, $id]);
    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
