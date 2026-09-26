<?php
require_once __DIR__ . '/../config/db.php';

if (!$pdo) {
    sendJson(['error' => 'No database connection'], 500);
}

// 1. Ensure serviceable_pincodes table exists
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `serviceable_pincodes` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `pincode` VARCHAR(10) NOT NULL UNIQUE,
        `zone` VARCHAR(50) NOT NULL DEFAULT 'zone1',
        `area_name` VARCHAR(100) DEFAULT '',
        `is_active` TINYINT(1) DEFAULT 1,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Seed default 400071 if table is empty
    $count = $pdo->query("SELECT COUNT(*) FROM `serviceable_pincodes`")->fetchColumn();
    if ($count == 0) {
        $pdo->exec("INSERT IGNORE INTO `serviceable_pincodes` (`pincode`, `zone`, `area_name`, `is_active`) VALUES ('400071', 'zone1', 'Chembur, Mumbai', 1)");
    }
} catch (Exception $e) {
    sendJson(['error' => 'Table setup error: ' . $e->getMessage()], 500);
}

$action = getParam('action', 'list');

switch ($action) {
    case 'list':
        try {
            $stmt = $pdo->query("SELECT id, pincode, zone, area_name, is_active, created_at FROM `serviceable_pincodes` ORDER BY zone ASC, pincode ASC");
            $pincodes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($pincodes as &$p) {
                $p['is_active'] = (int)$p['is_active'] === 1;
            }
            sendJson([
                'status' => 'SUCCESS',
                'success' => true,
                'pincodes' => $pincodes,
                'data' => $pincodes,
                'total' => count($pincodes)
            ]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage(), 'success' => false], 500);
        }
        break;

    case 'add':
        $dataParam = getParam('data');
        $data = is_string($dataParam) ? json_decode($dataParam, true) : $dataParam;
        if (!$data) {
            $data = [
                'pincode' => getParam('pincode'),
                'zone' => getParam('zone', 'zone1'),
                'area_name' => getParam('area_name', '')
            ];
        }

        $pincode = trim($data['pincode'] ?? '');
        $zone = strtolower(trim($data['zone'] ?? 'zone1'));
        $area_name = trim($data['area_name'] ?? '');

        if (empty($pincode) || strlen($pincode) !== 6 || !ctype_digit($pincode)) {
            sendJson(['error' => 'Valid 6-digit pincode is required'], 400);
        }

        try {
            $stmtCheck = $pdo->prepare("SELECT id FROM `serviceable_pincodes` WHERE pincode = ?");
            $stmtCheck->execute([$pincode]);
            if ($stmtCheck->fetch()) {
                sendJson(['error' => "Pincode {$pincode} already exists in the zones list"], 409);
            }

            $stmt = $pdo->prepare("INSERT INTO `serviceable_pincodes` (`pincode`, `zone`, `area_name`, `is_active`) VALUES (?, ?, ?, 1)");
            $stmt->execute([$pincode, $zone, $area_name]);
            $newId = $pdo->lastInsertId();

            sendJson([
                'status' => 'SUCCESS',
                'success' => true,
                'message' => "Pincode {$pincode} added to {$zone} successfully",
                'id' => $newId
            ]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage(), 'success' => false], 500);
        }
        break;

    case 'delete':
        $id = getParam('id');
        $pincode = getParam('pincode');

        if (!$id && !$pincode) {
            sendJson(['error' => 'Pincode ID or pincode value required for deletion', 'success' => false], 400);
        }

        try {
            if ($id) {
                $stmt = $pdo->prepare("DELETE FROM `serviceable_pincodes` WHERE id = ?");
                $stmt->execute([$id]);
            } else {
                $stmt = $pdo->prepare("DELETE FROM `serviceable_pincodes` WHERE pincode = ?");
                $stmt->execute([$pincode]);
            }

            sendJson([
                'status' => 'SUCCESS',
                'success' => true,
                'message' => 'Pincode removed successfully'
            ]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage(), 'success' => false], 500);
        }
        break;

    case 'toggle':
        $id = getParam('id');
        $isActive = getParam('is_active');

        if (!$id) {
            sendJson(['error' => 'Pincode ID is required', 'success' => false], 400);
        }

        try {
            $newStatus = ($isActive == '1' || $isActive === true || $isActive == 'true') ? 1 : 0;
            $stmt = $pdo->prepare("UPDATE `serviceable_pincodes` SET is_active = ? WHERE id = ?");
            $stmt->execute([$newStatus, $id]);

            sendJson([
                'status' => 'SUCCESS',
                'success' => true,
                'message' => 'Pincode status updated',
                'is_active' => $newStatus === 1
            ]);
        } catch (Exception $e) {
            sendJson(['error' => $e->getMessage(), 'success' => false], 500);
        }
        break;

    default:
        sendJson(['error' => 'Invalid action'], 400);
}
