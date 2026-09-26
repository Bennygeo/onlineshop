<?php
require_once __DIR__ . '/../config/db.php';

// Ensure table exists with default partner data
if ($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS delivery_partners (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                zone VARCHAR(100) DEFAULT 'Zone 1',
                vehicle VARCHAR(50) DEFAULT '',
                status VARCHAR(50) DEFAULT 'Available',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");

        $count = $pdo->query("SELECT COUNT(*) FROM delivery_partners")->fetchColumn();
        if ((int)$count === 0) {
            $pdo->exec("
                INSERT INTO delivery_partners (id, username, password, name, phone, zone, vehicle, status) VALUES
                (1, 'delivery1', 'partner123', 'Ramesh Kumar', '9876543210', 'Zone 1 (Central & North)', 'TN-37-AB-1001', 'Available'),
                (2, 'delivery2', 'partner123', 'Suresh Raj', '9876543211', 'Zone 2 (East & South)', 'TN-38-CD-2002', 'Available'),
                (3, 'delivery3', 'partner123', 'Karthik P', '9876543212', 'Zone 1 (Central & North)', 'TN-37-EF-3003', 'Available'),
                (4, 'delivery4', 'partner123', 'Vignesh M', '9876543213', 'Zone 2 (East & South)', 'TN-37-GH-4004', 'Available'),
                (5, 'delivery5', 'partner123', 'Manikandan S', '9876543214', 'All Zones', 'TN-38-JK-5005', 'Available')
            ");
        }
    } catch (Exception $e) {}
}

$username = trim(getParam('username', ''));
$password = trim(getParam('password', ''));

if (empty($username) || empty($password)) {
    sendJson(['error' => 'Username and password are required', 'code' => 'INVALID_INPUT'], 400);
}

if (!$pdo) {
    // Demo fallback in case DB is offline
    $demoPartners = [
        'delivery1' => ['id' => 1, 'username' => 'delivery1', 'password' => 'partner123', 'name' => 'Ramesh Kumar', 'phone' => '9876543210', 'zone' => 'Zone 1 (Central & North)', 'vehicle' => 'TN-37-AB-1001'],
        'delivery2' => ['id' => 2, 'username' => 'delivery2', 'password' => 'partner123', 'name' => 'Suresh Raj', 'phone' => '9876543211', 'zone' => 'Zone 2 (East & South)', 'vehicle' => 'TN-38-CD-2002'],
        'delivery3' => ['id' => 3, 'username' => 'delivery3', 'password' => 'partner123', 'name' => 'Karthik P', 'phone' => '9876543212', 'zone' => 'Zone 1 (Central & North)', 'vehicle' => 'TN-37-EF-3003'],
        'delivery4' => ['id' => 4, 'username' => 'delivery4', 'password' => 'partner123', 'name' => 'Vignesh M', 'phone' => '9876543213', 'zone' => 'Zone 2 (East & South)', 'vehicle' => 'TN-37-GH-4004'],
        'delivery5' => ['id' => 5, 'username' => 'delivery5', 'password' => 'partner123', 'name' => 'Manikandan S', 'phone' => '9876543214', 'zone' => 'All Zones', 'vehicle' => 'TN-38-JK-5005']
    ];

    if (isset($demoPartners[$username]) && $demoPartners[$username]['password'] === $password) {
        $p = $demoPartners[$username];
        unset($p['password']);
        $token = base64_encode(json_encode(['id' => $p['id'], 'username' => $p['username'], 'name' => $p['name'], 'time' => time()]));
        sendJson(['status' => 'SUCCESS', 'partner' => $p, 'token' => $token]);
    } else {
        sendJson(['error' => 'Invalid username or password', 'code' => 'AUTH_FAILED'], 401);
    }
}

try {
    $stmt = $pdo->prepare("SELECT id, username, password, name, phone, zone, vehicle, status FROM delivery_partners WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $partner = $stmt->fetch();

    if ($partner && ($partner['password'] === $password || password_verify($password, $partner['password']))) {
        // Count active assigned orders
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE assigned_to = ? AND status NOT IN ('DELIVERED', 'CANCELLED')");
        $countStmt->execute([$partner['name']]);
        $activeOrders = (int)$countStmt->fetchColumn();

        unset($partner['password']);
        $partner['activeOrders'] = $activeOrders;
        $token = base64_encode(json_encode(['id' => $partner['id'], 'username' => $partner['username'], 'name' => $partner['name'], 'time' => time()]));

        sendJson([
            'status' => 'SUCCESS',
            'partner' => $partner,
            'token' => $token
        ]);
    } else {
        sendJson(['error' => 'Invalid username or password', 'code' => 'AUTH_FAILED'], 401);
    }
} catch (Exception $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
