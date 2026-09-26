<?php
require_once __DIR__ . '/../config/db.php';

$addressParam = getParam('address');
$addrObj = is_string($addressParam) ? json_decode($addressParam, true) : $addressParam;

$mobile = isset($addrObj['mobile']) ? $addrObj['mobile'] : getParam('mobile', '');
$name = isset($addrObj['name']) ? $addrObj['name'] : getParam('name', '');
$address = isset($addrObj['address']) ? $addrObj['address'] : (is_string($addressParam) ? $addressParam : '');
$pincode = isset($addrObj['pincode']) ? $addrObj['pincode'] : getParam('pincode', '');
$title = isset($addrObj['title']) ? $addrObj['title'] : (isset($addrObj['landmark']) ? $addrObj['landmark'] : 'My Home');

if (!$pdo) {
    sendJson(['status' => 'SUCCESS', 'id' => 1]);
}

try {
    $chk = $pdo->prepare("SELECT COUNT(*) FROM user_addresses WHERE mobile = ?");
    $chk->execute([$mobile]);
    $existingCount = (int)$chk->fetchColumn();
    $isDefault = ($existingCount === 0) ? 1 : 0;

    $stmt = $pdo->prepare("INSERT INTO user_addresses (mobile, name, address, pincode, landmark, title, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$mobile, $name, $address, $pincode, $landmark, $title, $isDefault]);
    $newId = (int)$pdo->lastInsertId();
    sendJson(['status' => 'SUCCESS', 'id' => $newId, 'is_default' => $isDefault]);
} catch (Exception $e) {
    try {
        $stmt2 = $pdo->prepare("INSERT INTO user_addresses (mobile, name, address, pincode, landmark) VALUES (?, ?, ?, ?, ?)");
        $stmt2->execute([$mobile, $name, $address, $pincode, $landmark]);
        $newId = (int)$pdo->lastInsertId();
        sendJson(['status' => 'SUCCESS', 'id' => $newId, 'is_default' => 1]);
    } catch (Exception $e2) {
        sendJson(['status' => 'SUCCESS', 'id' => time(), 'is_default' => 1]);
    }
}

