<?php
require_once __DIR__ . '/../config/db.php';

$mobile = getParam('id') ?: getParam('mobile');

if (!$mobile) {
    sendJson([]);
}

if (!$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->prepare("SELECT id, mobile, name, address, pincode, landmark, is_default FROM user_addresses WHERE mobile = ? ORDER BY is_default DESC, id DESC");
    $stmt->execute([$mobile]);
    $addresses = $stmt->fetchAll();
    sendJson($addresses);
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
