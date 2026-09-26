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
    $stmt = $pdo->prepare("SELECT id, mobile, name, address, pincode, landmark, COALESCE(title, landmark, 'My Home') AS title, is_default, is_default AS `default`, is_default AS active FROM user_addresses WHERE mobile = ? ORDER BY is_default DESC, id DESC");
    $stmt->execute([$mobile]);
    $addresses = $stmt->fetchAll();
    sendJson($addresses ?: []);
} catch (Exception $e) {
    try {
        $stmt2 = $pdo->prepare("SELECT id, mobile, name, address, pincode, landmark, is_default, is_default AS `default`, is_default AS active FROM user_addresses WHERE mobile = ? ORDER BY is_default DESC, id DESC");
        $stmt2->execute([$mobile]);
        $addresses = $stmt2->fetchAll();
        sendJson($addresses ?: []);
    } catch (Exception $e2) {
        sendJson([]);
    }
}
