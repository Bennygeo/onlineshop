<?php
require_once __DIR__ . '/../config/db.php';

$addressParam = getParam('address');
$addrObj = is_string($addressParam) ? json_decode($addressParam, true) : $addressParam;

$mobile = isset($addrObj['mobile']) ? $addrObj['mobile'] : getParam('mobile', '');
$name = isset($addrObj['name']) ? $addrObj['name'] : getParam('name', '');
$address = isset($addrObj['address']) ? $addrObj['address'] : (is_string($addressParam) ? $addressParam : '');
$pincode = isset($addrObj['pincode']) ? $addrObj['pincode'] : getParam('pincode', '');
$landmark = isset($addrObj['landmark']) ? $addrObj['landmark'] : getParam('landmark', '');

if (!$pdo) {
    sendJson(['status' => 'SUCCESS', 'id' => 1]);
}

try {
    $stmt = $pdo->prepare("INSERT INTO user_addresses (mobile, name, address, pincode, landmark) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$mobile, $name, $address, $pincode, $landmark]);
    $newId = $pdo->lastInsertId();
    sendJson(['status' => 'SUCCESS', 'id' => $newId]);
} catch (Exception $e) {
    sendJson(['status' => 'SUCCESS', 'id' => 1]);
}

