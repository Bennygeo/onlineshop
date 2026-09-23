<?php
require_once __DIR__ . '/../config/db.php';

$addressParam = getParam('address');
$addrObj = is_string($addressParam) ? json_decode($addressParam, true) : $addressParam;

$id = isset($addrObj['id']) ? $addrObj['id'] : getParam('id');
$mobile = isset($addrObj['mobile']) ? $addrObj['mobile'] : getParam('mobile');

if (!$pdo) {
    sendJson('SUCCESS');
}

try {
    if ($id) {
        if (!$mobile) {
            // Retrieve mobile from existing address record if missing
            $stmt = $pdo->prepare("SELECT mobile FROM user_addresses WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if ($row) {
                $mobile = $row['mobile'];
            }
        }

        if ($mobile) {
            $stmt1 = $pdo->prepare("UPDATE user_addresses SET is_default = 0 WHERE mobile = ?");
            $stmt1->execute([$mobile]);
        }

        $stmt2 = $pdo->prepare("UPDATE user_addresses SET is_default = 1 WHERE id = ?");
        $stmt2->execute([$id]);
    }

    sendJson('SUCCESS');
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}

