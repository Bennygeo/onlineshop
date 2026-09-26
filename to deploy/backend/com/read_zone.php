<?php
require_once __DIR__ . '/../config/db.php';

// Auto-ensure serviceable_pincodes table exists
try {
    if ($pdo) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `serviceable_pincodes` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `pincode` VARCHAR(10) NOT NULL UNIQUE,
            `zone` VARCHAR(50) NOT NULL DEFAULT 'zone1',
            `area_name` VARCHAR(100) DEFAULT '',
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $count = $pdo->query("SELECT COUNT(*) FROM `serviceable_pincodes`")->fetchColumn();
        if ($count == 0) {
            $pdo->exec("INSERT IGNORE INTO `serviceable_pincodes` (`pincode`, `zone`, `area_name`, `is_active`) VALUES ('400071', 'zone1', 'Chembur, Mumbai', 1)");
        }
    }
} catch (Exception $e) {}

$action = getParam('action');
if ($action === 'get_serviceable_list') {
    try {
        $stmt = $pdo->query("SELECT pincode, zone, area_name FROM `serviceable_pincodes` WHERE is_active = 1 ORDER BY pincode ASC");
        sendJson($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        sendJson([['pincode' => '400071', 'zone' => 'zone1', 'area_name' => 'Chembur, Mumbai']]);
    }
    exit;
}

$pincode = trim(getParam('pincode', ''));

if (!$pincode || !$pdo) {
    sendJson([]);
}

try {
    $stmt = $pdo->prepare("SELECT pincode, zone, area_name, is_active FROM `serviceable_pincodes` WHERE pincode = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$pincode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        // Return array for existing callers expecting res[0].zone
        sendJson([
            [
                'pincode' => $row['pincode'],
                'zone' => $row['zone'] ?: 'zone1',
                'serviceable' => true,
                'area_name' => $row['area_name']
            ]
        ]);
    } else {
        // Pincode is not in the serviceable list -> return empty array (unserviceable, zone2)
        sendJson([]);
    }
} catch (Exception $e) {
    sendJson([]);
}
